/**
 * @fileoverview Authentication Controller
 * @description Handles all authentication business logic including registration,
 * login, logout, token refresh, and OAuth callbacks.
 * 
 * Token Strategy:
 * - Access token: Returned in response body (stored in sessionStorage by frontend)
 * - Refresh token: ONLY in httpOnly cookie (never exposed to JavaScript)
 * 
 * @module controllers/authController
 */

const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies
} = require('../middleware/auth');
const { getMicrosoftAuthUrl, handleMicrosoftCallback } = require('../config/passport');
const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get frontend URL from environment
 * @returns {string} Frontend URL
 */
const getFrontendUrl = () => {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
};

/**
 * Format user object for API response
 * Excludes sensitive fields like password_hash
 * @param {Object} user - Raw user object from database
 * @returns {Object} Safe user object for response
 */
const formatUserResponse = (user) => ({
  id: user.id,
  email: user.email,
  display_name: user.display_name,
  oauth_provider: user.oauth_provider,
  email_verified: user.email_verified,
  role: user.role,
  additional_roles: user.additional_roles,
  avatar_url: user.avatar_url,
  language_preference: user.language_preference,
  created_at: user.created_at,
  last_login: user.last_login
});

// =============================================================================
// REGISTRATION & LOGIN
// =============================================================================

/**
 * Register a new user with email and password
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @throws {ApiError} Validation or conflict errors
 */
const register = async (req, res) => {
  const { email, password, display_name } = req.body;

  // Validation
  if (!email || !password || !display_name) {
    throw ApiError.badRequest('Email, password, and display name are required');
  }

  if (password.length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters');
  }

  // Check if email exists
  const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (existing.rows.length > 0) {
    throw ApiError.conflict('Email already registered');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Create user
  const result = await query(
    `INSERT INTO users (email, password_hash, display_name, oauth_provider, created_at)
     VALUES ($1, $2, $3, 'local', NOW())
     RETURNING *`,
    [email.toLowerCase(), passwordHash, display_name]
  );

  const user = result.rows[0];

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Set cookies (refresh token is httpOnly, access token is not)
  setAuthCookies(res, accessToken, refreshToken);

  // Set session
  if (req.session) {
    req.session.userId = user.id;
  }

  logger.info('New user registered', { userId: user.id, email: user.email });

  // Return access token in body (for sessionStorage)
  // Refresh token is ONLY in httpOnly cookie - never in response body
  res.status(201).json({
    success: true,
    message: 'Registration successful',
    user: formatUserResponse(user),
    token: accessToken
    // NOTE: refreshToken intentionally NOT included - it's in httpOnly cookie only
  });
};

/**
 * Login user with email and password
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
const login = async (req, res, next) => {
  const passport = require('passport');

  passport.authenticate('local', { session: false }, async (err, user, info) => {
    if (err) {
      return next(err);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: info?.message || 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Set session
    if (req.session) {
      req.session.userId = user.id;
    }

    // Set cookies
    setAuthCookies(res, accessToken, refreshToken);

    // Update last_login timestamp
    try {
      await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    } catch (dbErr) {
      logger.warn('Failed to update last_login', { userId: user.id, error: dbErr.message });
    }

    logger.info('User logged in', { userId: user.id, email: user.email });

    // Return access token in body (for sessionStorage)
    // Refresh token is ONLY in httpOnly cookie
    res.json({
      success: true,
      message: 'Login successful',
      user: formatUserResponse(user),
      token: accessToken
      // NOTE: refreshToken intentionally NOT included
    });
  })(req, res, next);
};

/**
 * Logout user - clears session and cookies
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const logout = async (req, res) => {
  // Clear session
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        logger.warn('Session destruction error', { error: err.message });
      }
    });
  }

  // Clear cookies
  clearAuthCookies(res);

  res.json({
    success: true,
    message: 'Logout successful'
  });
};

// =============================================================================
// TOKEN REFRESH
// =============================================================================

/**
 * Refresh access token using httpOnly cookie
 * The refresh token is read ONLY from the cookie - never from request body
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const refresh = async (req, res) => {
  // SECURITY: Only read refresh token from httpOnly cookie
  // Never accept it from request body to prevent token theft via XSS
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    throw ApiError.unauthorized('Refresh token required');
  }

  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded) {
    // Clear invalid cookies
    clearAuthCookies(res);
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  // Get user from database
  const result = await query('SELECT * FROM users WHERE id = $1', [decoded.id]);
  if (result.rows.length === 0) {
    clearAuthCookies(res);
    throw ApiError.unauthorized('User not found');
  }

  const user = result.rows[0];

  // Generate new tokens (token rotation for security)
  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  // Set new cookies
  setAuthCookies(res, newAccessToken, newRefreshToken);

  logger.debug('Token refreshed', { userId: user.id });

  // Return only access token in body
  res.json({
    success: true,
    token: newAccessToken
    // NOTE: new refreshToken is in httpOnly cookie only
  });
};

// =============================================================================
// USER PROFILE
// =============================================================================

/**
 * Get current user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getMe = async (req, res) => {
  res.json({
    success: true,
    user: formatUserResponse(req.user)
  });
};

// =============================================================================
// GOOGLE OAUTH
// =============================================================================

/**
 * Initiate Google OAuth login
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const googleAuth = (req, res) => {
  const passport = require('passport');
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })(req, res);
};

/**
 * Handle Google OAuth callback
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const googleCallback = async (req, res) => {
  try {
    const accessToken = generateAccessToken(req.user);
    const refreshToken = generateRefreshToken(req.user);

    // Set session
    if (req.session) {
      req.session.userId = req.user.id;
    }

    // Set cookies
    setAuthCookies(res, accessToken, refreshToken);

    // Update last_login
    try {
      await query('UPDATE users SET last_login = NOW() WHERE id = $1', [req.user.id]);
    } catch (dbErr) {
      logger.warn('Failed to update last_login', { userId: req.user.id, error: dbErr.message });
    }

    logger.info('Google OAuth login', { userId: req.user.id, email: req.user.email });

    // Redirect to frontend callback with access token
    // Refresh token is in httpOnly cookie
    const frontendUrl = getFrontendUrl();
    res.redirect(`${frontendUrl}/auth/callback?token=${accessToken}`);
  } catch (error) {
    logger.error('Google callback error', { error: error.message });
    const frontendUrl = getFrontendUrl();
    res.redirect(`${frontendUrl}/auth?error=google_failed`);
  }
};

// =============================================================================
// MICROSOFT OAUTH
// =============================================================================

/**
 * Initiate Microsoft SSO login
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const microsoftAuth = async (req, res) => {
  try {
    const authUrl = await getMicrosoftAuthUrl();
    res.redirect(authUrl);
  } catch (error) {
    logger.error('Microsoft auth initiation error', { error: error.message });
    const frontendUrl = getFrontendUrl();
    res.redirect(`${frontendUrl}/auth?error=microsoft_failed`);
  }
};

/**
 * Handle Microsoft SSO callback
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const microsoftCallback = async (req, res) => {
  const { code, error, error_description } = req.query;
  const frontendUrl = getFrontendUrl();

  if (error) {
    logger.error('Microsoft OAuth error', { error, error_description });
    return res.redirect(`${frontendUrl}/auth?error=microsoft_failed`);
  }

  try {
    const user = await handleMicrosoftCallback(code);

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Set session
    if (req.session) {
      req.session.userId = user.id;
    }

    // Set cookies
    setAuthCookies(res, accessToken, refreshToken);

    // Update last_login
    try {
      await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    } catch (dbErr) {
      logger.warn('Failed to update last_login', { userId: user.id, error: dbErr.message });
    }

    logger.info('Microsoft SSO login', { userId: user.id, email: user.email });

    // Redirect to frontend callback with access token
    res.redirect(`${frontendUrl}/auth/callback?token=${accessToken}`);
  } catch (error) {
    logger.error('Microsoft callback error', { error: error.message });
    res.redirect(`${frontendUrl}/auth?error=microsoft_failed`);
  }
};

// =============================================================================
// PASSWORD RESET
// =============================================================================

/**
 * Request password reset
 * Generates a reset token and stores it (hashed) in the database
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw ApiError.badRequest('Email is required');
  }

  // Always return success message to prevent email enumeration
  const successResponse = {
    success: true,
    message: 'If an account exists with this email, a password reset link has been sent'
  };

  // Check if user exists
  const result = await query(
    'SELECT id, email, oauth_provider FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  if (result.rows.length === 0) {
    // Don't reveal if email exists
    return res.json(successResponse);
  }

  const user = result.rows[0];

  // Don't allow password reset for OAuth-only accounts
  if (user.oauth_provider && user.oauth_provider !== 'local') {
    logger.info('Password reset attempted for OAuth account', { email: user.email, provider: user.oauth_provider });
    return res.json(successResponse);
  }

  // Generate reset token (valid for 1 hour)
  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = await bcrypt.hash(resetToken, 10);
  const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Store reset token in database
  await query(
    `UPDATE users 
     SET reset_token = $1, reset_token_expires = $2, reset_token_used = false 
     WHERE id = $3`,
    [resetTokenHash, resetTokenExpires, user.id]
  );

  // TODO: Send email with reset link containing the token
  // For now, log it (in production, this should be an email)
  logger.info('Password reset requested', {
    userId: user.id,
    email: user.email,
    // In dev only - remove in production
    resetToken: process.env.NODE_ENV === 'development' ? resetToken : '[REDACTED]'
  });

  res.json(successResponse);
};

/**
 * Reset password with token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const resetPassword = async (req, res) => {
  const { resetToken, newPassword, confirmPassword } = req.body;

  if (!resetToken || !newPassword || !confirmPassword) {
    throw ApiError.badRequest('Reset token and new password are required');
  }

  if (newPassword !== confirmPassword) {
    throw ApiError.badRequest('Passwords do not match');
  }

  if (newPassword.length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters');
  }

  // Find users with unexpired, unused reset tokens
  const users = await query(
    `SELECT id, email, reset_token 
     FROM users 
     WHERE reset_token IS NOT NULL 
       AND reset_token_expires > NOW() 
       AND (reset_token_used = false OR reset_token_used IS NULL)
     LIMIT 100`
  );

  // Find the user whose token matches
  let validUser = null;
  for (const user of users.rows) {
    if (user.reset_token && await bcrypt.compare(resetToken, user.reset_token)) {
      validUser = user;
      break;
    }
  }

  if (!validUser) {
    throw ApiError.badRequest('Invalid or expired reset token');
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, 12);

  // Update password and mark token as used
  await query(
    `UPDATE users 
     SET password_hash = $1, 
         reset_token_used = true,
         reset_token_expires = NOW()
     WHERE id = $2`,
    [passwordHash, validUser.id]
  );

  logger.info('Password reset successful', { userId: validUser.id, email: validUser.email });

  res.json({
    success: true,
    message: 'Password reset successful. You can now log in with your new password.'
  });
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  register,
  login,
  logout,
  refresh,
  getMe,
  googleAuth,
  googleCallback,
  microsoftAuth,
  microsoftCallback,
  requestPasswordReset,
  resetPassword
};