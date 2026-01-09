/**
 * @fileoverview Passport.js Authentication Configuration
 * @description Configures Passport.js strategies for local authentication,
 * Google OAuth 2.0, and Microsoft Entra ID (Azure AD) SSO.
 * Resilient to missing configuration - will log warnings and disable unavailable strategies.
 * @module config/passport
 */

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const { isDbConfigured, query } = require('./database');
const logger = require('../utils/logger');

/**
 * Check if a configuration value is valid (not empty or placeholder)
 * @param {string} value - Configuration value to check
 * @returns {boolean} True if valid
 */
const isValidConfig = (value) => {
  if (!value || value.trim() === '') return false;
  if (value.includes('your_') || value.includes('YOUR_')) return false;
  return true;
};

/**
 * Track which auth methods are available
 */
const authMethods = {
  local: false,
  google: false,
  microsoft: false
};

/**
 * MSAL Client (initialized only if Microsoft SSO is configured)
 */
let msalClient = null;

/**
 * Find or create user from OAuth profile
 * Implements account linking: if email exists, links OAuth to existing account
 * @async
 * @param {string} provider - OAuth provider name
 * @param {Object} profile - OAuth profile data
 * @returns {Promise<Object>} User object
 */
const findOrCreateOAuthUser = async (provider, profile) => {
  if (!isDbConfigured()) {
    throw new Error('Database not configured - OAuth authentication requires database');
  }
  
  const email = (profile.emails?.[0]?.value || profile.email)?.toLowerCase();
  const displayName = profile.displayName || profile.name || email?.split('@')[0];
  
  if (!email) {
    throw new Error('OAuth profile must include an email address');
  }
  
  try {
    // First, check if user exists with this provider ID
    let result = await query(
      'SELECT * FROM users WHERE oauth_provider = $1 AND oauth_id = $2',
      [provider, profile.id]
    );
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      
      // Check if user is blocked
      if (user.is_blocked) {
        const error = new Error('Account is blocked');
        error.code = 'ACCOUNT_BLOCKED';
        error.reason = user.blocked_reason;
        throw error;
      }
      
      // Update last login
      await query(
        'UPDATE users SET last_login = NOW() WHERE id = $1',
        [user.id]
      );
      return user;
    }
    
    // Check if user exists with this email (for account linking)
    result = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length > 0) {
      const existingUser = result.rows[0];
      
      // Check if user is blocked
      if (existingUser.is_blocked) {
        const error = new Error('Account is blocked');
        error.code = 'ACCOUNT_BLOCKED';
        error.reason = existingUser.blocked_reason;
        throw error;
      }
      
      // Link OAuth to existing account
      // If user has a password, they can use both password AND SSO
      // We update oauth_id to link this SSO account
      await query(
        `UPDATE users SET 
          oauth_provider = CASE 
            WHEN password_hash IS NOT NULL THEN COALESCE(oauth_provider, $1)
            ELSE $1 
          END,
          oauth_id = $2, 
          email_verified = true,
          last_login = NOW(),
          display_name = COALESCE(NULLIF(display_name, ''), $3, display_name)
        WHERE id = $4`,
        [provider, profile.id, displayName, existingUser.id]
      );
      
      logger.info('OAuth account linked to existing user', { 
        provider, 
        email, 
        userId: existingUser.id,
        hadPassword: !!existingUser.password_hash
      });
      
      // Fetch and return updated user
      const updated = await query('SELECT * FROM users WHERE id = $1', [existingUser.id]);
      return updated.rows[0];
    }
    
    // Create new user with default role
    result = await query(
      `INSERT INTO users (
        email, 
        display_name, 
        oauth_provider, 
        oauth_id, 
        email_verified, 
        role,
        created_at, 
        last_login
      )
      VALUES ($1, $2, $3, $4, true, 'user', NOW(), NOW())
      RETURNING *`,
      [email, displayName, provider, profile.id]
    );
    
    logger.info('New OAuth user created', { 
      provider, 
      email, 
      userId: result.rows[0].id 
    });
    return result.rows[0];
  } catch (error) {
    logger.error('Error in findOrCreateOAuthUser', { 
      error: error.message, 
      code: error.code,
      provider, 
      email 
    });
    throw error;
  }
};

/**
 * Configure Passport serialization
 */
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  if (!isDbConfigured()) {
    return done(null, { id, _fromSession: true });
  }
  
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return done(null, false);
    }
    done(null, result.rows[0]);
  } catch (error) {
    done(error, null);
  }
});

/**
 * Configure Local Strategy (requires database)
 */
if (isDbConfigured()) {
  passport.use(new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password'
    },
    async (email, password, done) => {
      try {
        const result = await query(
          'SELECT * FROM users WHERE email = $1 AND password_hash IS NOT NULL',
          [email.toLowerCase()]
        );
        
        if (result.rows.length === 0) {
          return done(null, false, { message: 'Invalid email or password' });
        }
        
        const user = result.rows[0];
        
        // Check if user is blocked
        if (user.is_blocked) {
          return done(null, false, { 
            message: 'Account is blocked',
            code: 'ACCOUNT_BLOCKED',
            reason: user.blocked_reason 
          });
        }
        
        const isValid = await bcrypt.compare(password, user.password_hash);
        
        if (!isValid) {
          return done(null, false, { message: 'Invalid email or password' });
        }
        
        // Update last login
        await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
        
        return done(null, user);
      } catch (error) {
        logger.error('Local authentication error', { error: error.message });
        return done(error);
      }
    }
  ));
  authMethods.local = true;
  logger.info('✅ Local authentication strategy configured');
} else {
  logger.warn('⚠️  Local authentication not available - database not configured');
}

/**
 * Configure Google OAuth 2.0 Strategy
 */
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (isValidConfig(googleClientId) && isValidConfig(googleClientSecret)) {
  try {
    const GoogleStrategy = require('passport-google-oauth20').Strategy;
    
    passport.use(new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: process.env.GOOGLE_REDIRECT_URI || '/api/v1/auth/google/callback',
        scope: ['profile', 'email']
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await findOrCreateOAuthUser('google', profile);
          return done(null, user);
        } catch (error) {
          logger.error('Google OAuth error', { error: error.message, code: error.code });
          return done(error, null);
        }
      }
    ));
    authMethods.google = true;
    logger.info('✅ Google OAuth strategy configured');
  } catch (error) {
    logger.warn('⚠️  Google OAuth not available', { error: error.message });
  }
} else {
  logger.warn('⚠️  Google OAuth not configured - GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set');
}

/**
 * Configure Microsoft MSAL
 */
const msClientId = process.env.MICROSOFT_CLIENT_ID;
const msClientSecret = process.env.MICROSOFT_CLIENT_SECRET;

if (isValidConfig(msClientId) && isValidConfig(msClientSecret)) {
  try {
    const { ConfidentialClientApplication } = require('@azure/msal-node');
    
    const msalConfig = {
      auth: {
        clientId: msClientId,
        authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}`,
        clientSecret: msClientSecret
      },
      system: {
        loggerOptions: {
          loggerCallback: (level, message) => {
            logger.debug(`MSAL: ${message}`);
          },
          piiLoggingEnabled: false,
          logLevel: 3 // Info
        }
      }
    };
    
    msalClient = new ConfidentialClientApplication(msalConfig);
    authMethods.microsoft = true;
    logger.info('✅ Microsoft SSO (MSAL) configured');
  } catch (error) {
    logger.warn('⚠️  Microsoft SSO not available', { error: error.message });
  }
} else {
  logger.warn('⚠️  Microsoft SSO not configured - MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET not set');
}

/**
 * Get Microsoft OAuth authorization URL
 * @returns {Promise<string>} Authorization URL
 */
const getMicrosoftAuthUrl = async () => {
  if (!msalClient) {
    throw new Error('Microsoft SSO not configured');
  }
  
  const authCodeUrlParameters = {
    scopes: ['user.read', 'email', 'profile', 'openid'],
    redirectUri: process.env.MICROSOFT_REDIRECT_URI || '/api/v1/auth/microsoft/callback'
  };
  
  return await msalClient.getAuthCodeUrl(authCodeUrlParameters);
};

/**
 * Handle Microsoft OAuth callback
 * @async
 * @param {string} code - Authorization code
 * @returns {Promise<Object>} User object
 */
const handleMicrosoftCallback = async (code) => {
  if (!msalClient) {
    throw new Error('Microsoft SSO not configured');
  }
  
  const tokenRequest = {
    code,
    scopes: ['user.read', 'email', 'profile', 'openid'],
    redirectUri: process.env.MICROSOFT_REDIRECT_URI || '/api/v1/auth/microsoft/callback'
  };
  
  const response = await msalClient.acquireTokenByCode(tokenRequest);
  
  // Extract user info from token claims
  const profile = {
    id: response.account.homeAccountId,
    displayName: response.account.name,
    email: response.account.username,
    emails: [{ value: response.account.username }]
  };
  
  return await findOrCreateOAuthUser('microsoft', profile);
};

/**
 * Validate Microsoft access token
 * @async
 * @param {string} accessToken - Microsoft access token
 * @returns {Promise<Object>} Token validation result
 */
const validateMicrosoftToken = async (accessToken) => {
  try {
    const axios = require('axios');
    const response = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    
    return {
      valid: true,
      user: response.data
    };
  } catch (error) {
    logger.error('Microsoft token validation failed', { error: error.message });
    return { valid: false, error: error.message };
  }
};

/**
 * Get available authentication methods
 * @returns {Object} Available auth methods
 */
const getAvailableAuthMethods = () => {
  return { ...authMethods };
};

// Log summary of available auth methods
const availableMethods = Object.entries(authMethods)
  .filter(([_, enabled]) => enabled)
  .map(([method]) => method);

if (availableMethods.length === 0) {
  logger.warn('⚠️  No authentication methods available - authentication will not work');
} else {
  logger.info(`📋 Available authentication methods: ${availableMethods.join(', ')}`);
}

module.exports = passport;
module.exports.getMicrosoftAuthUrl = getMicrosoftAuthUrl;
module.exports.handleMicrosoftCallback = handleMicrosoftCallback;
module.exports.validateMicrosoftToken = validateMicrosoftToken;
module.exports.getAvailableAuthMethods = getAvailableAuthMethods;
module.exports.msalClient = msalClient;