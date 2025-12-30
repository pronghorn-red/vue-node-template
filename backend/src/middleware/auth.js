/**
 * @fileoverview Authentication Middleware
 * @description Provides JWT and session-based authentication middleware
 * with support for token refresh and role-based access control.
 * Resilient to missing database - will work with JWT-only mode.
 * @module middleware/auth
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { isDbConfigured, query } = require('../config/database');
const logger = require('../utils/logger');

// Get secrets from environment or use dynamically generated ones
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (secret && !secret.includes('your_')) {
    return secret;
  }
  // Generate a dynamic secret (note: will change on restart)
  if (!process.env._DYNAMIC_JWT_SECRET) {
    process.env._DYNAMIC_JWT_SECRET = crypto.randomBytes(32).toString('hex');
    logger.warn('⚠️  Using dynamically generated JWT_SECRET - tokens will be invalid after restart');
  }
  return process.env._DYNAMIC_JWT_SECRET;
};

const getJwtRefreshSecret = () => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (secret && !secret.includes('your_')) {
    return secret;
  }
  if (!process.env._DYNAMIC_JWT_REFRESH_SECRET) {
    process.env._DYNAMIC_JWT_REFRESH_SECRET = crypto.randomBytes(32).toString('hex');
  }
  return process.env._DYNAMIC_JWT_REFRESH_SECRET;
};

const JWT_SECRET = getJwtSecret();
const JWT_REFRESH_SECRET = getJwtRefreshSecret();

/**
 * Generate JWT access token
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      display_name: user.display_name
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
};

/**
 * Generate JWT refresh token
 * @param {Object} user - User object
 * @returns {string} JWT refresh token
 */
const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id },
    JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded token or null
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

/**
 * Verify refresh token
 * @param {string} token - JWT refresh token
 * @returns {Object|null} Decoded token or null
 */
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
};

/**
 * Get user from database by ID (if database is configured)
 * @param {string|number} userId - User ID
 * @returns {Promise<Object|null>} User object or null
 */
const getUserFromDb = async (userId) => {
  if (!isDbConfigured()) {
    return null;
  }
  
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.debug('Database query failed in auth', { error: error.message });
    return null;
  }
};

/**
 * Authentication middleware
 * Checks for valid JWT token in Authorization header or session
 * Works without database - uses JWT payload as user if DB unavailable
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticate = async (req, res, next) => {
  try {
    // Check for session-based authentication first
    if (req.session?.userId && isDbConfigured()) {
      const user = await getUserFromDb(req.session.userId);
      if (user) {
        req.user = user;
        return next();
      }
    }
    
    // Check for JWT token in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      
      if (decoded) {
        // Try to get full user from database
        const user = await getUserFromDb(decoded.id);
        if (user) {
          req.user = user;
          return next();
        }
        // If no database, use JWT payload as user
        req.user = {
          id: decoded.id,
          email: decoded.email,
          display_name: decoded.display_name,
          _fromToken: true
        };
        return next();
      }
    }
    
    // Check for token in cookies
    const cookieToken = req.cookies?.accessToken;
    if (cookieToken) {
      const decoded = verifyToken(cookieToken);
      
      if (decoded) {
        const user = await getUserFromDb(decoded.id);
        if (user) {
          req.user = user;
          return next();
        }
        // If no database, use JWT payload as user
        req.user = {
          id: decoded.id,
          email: decoded.email,
          display_name: decoded.display_name,
          _fromToken: true
        };
        return next();
      }
    }
    
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHORIZED'
    });
  } catch (error) {
    logger.error('Authentication error', { error: error.message });
    return res.status(500).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
};

// Alias for authenticate (for backward compatibility)
const authenticateJWT = authenticate;

/**
 * Optional authentication middleware
 * Attaches user to request if authenticated, but doesn't require it
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const optionalAuth = async (req, res, next) => {
  try {
    // Check for session-based authentication
    if (req.session?.userId && isDbConfigured()) {
      const user = await getUserFromDb(req.session.userId);
      if (user) {
        req.user = user;
      }
    }
    
    // Check for JWT token
    const authHeader = req.headers.authorization;
    if (!req.user && authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      
      if (decoded) {
        const user = await getUserFromDb(decoded.id);
        if (user) {
          req.user = user;
        } else {
          // Use JWT payload as user if no database
          req.user = {
            id: decoded.id,
            email: decoded.email,
            display_name: decoded.display_name,
            _fromToken: true
          };
        }
      }
    }
    
    // Check for token in cookies
    if (!req.user && req.cookies?.accessToken) {
      const decoded = verifyToken(req.cookies.accessToken);
      
      if (decoded) {
        const user = await getUserFromDb(decoded.id);
        if (user) {
          req.user = user;
        } else {
          req.user = {
            id: decoded.id,
            email: decoded.email,
            display_name: decoded.display_name,
            _fromToken: true
          };
        }
      }
    }
    
    next();
  } catch (error) {
    logger.error('Optional auth error', { error: error.message });
    next();
  }
};

/**
 * Role-based access control middleware
 * @param {Array<string>} roles - Allowed roles
 * @returns {Function} Middleware function
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN'
      });
    }
    
    next();
  };
};

/**
 * Set authentication cookies
 * @param {Object} res - Express response object
 * @param {string} accessToken - JWT access token
 * @param {string} refreshToken - JWT refresh token
 */
const setAuthCookies = (res, accessToken, refreshToken) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction || process.env.COOKIE_SECURE === 'true',
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
    path: '/'
  };
  
  res.cookie('accessToken', accessToken, {
    ...cookieOptions,
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  });
  
  res.cookie('refreshToken', refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
};

/**
 * Clear authentication cookies
 * @param {Object} res - Express response object
 */
const clearAuthCookies = (res) => {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
  authenticate,
  authenticateJWT, // Alias
  optionalAuth,
  requireRole,
  setAuthCookies,
  clearAuthCookies
};
