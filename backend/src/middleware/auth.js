/**
 * @fileoverview Authentication Middleware
 * @description Provides JWT and session-based authentication middleware
 * with support for token refresh, role-based access control, and role hierarchy.
 * 
 * Role Hierarchy:
 * - superadmin (level 100): Full system access, can modify any role
 * - admin (level 50): User management, can modify user roles only
 * - user (level 10): Standard access, self-management only
 * 
 * Token Strategy:
 * - Access token: In Authorization header (from frontend sessionStorage) 
 *                 OR in cookie (for server-side requests)
 * - Refresh token: httpOnly cookie ONLY (never accessible to JavaScript)
 * 
 * @module middleware/auth
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { isDbConfigured, query } = require('../config/database');
const logger = require('../utils/logger');

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Role hierarchy levels - higher number = more permissions
 */
const ROLE_LEVELS = {
  superadmin: 100,
  admin: 50,
  user: 10
};

/**
 * Valid role values
 */
const VALID_ROLES = ['superadmin', 'admin', 'user'];

// =============================================================================
// JWT SECRET MANAGEMENT
// =============================================================================

/**
 * Get JWT secret from environment or generate dynamic one
 * @returns {string} JWT secret
 */
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (secret && !secret.includes('your_') && secret.length >= 32) {
    return secret;
  }
  if (!process.env._DYNAMIC_JWT_SECRET) {
    process.env._DYNAMIC_JWT_SECRET = crypto.randomBytes(32).toString('hex');
    logger.warn('⚠️  Using dynamically generated JWT_SECRET - tokens will be invalid after restart');
  }
  return process.env._DYNAMIC_JWT_SECRET;
};

/**
 * Get JWT refresh secret from environment or generate dynamic one
 * @returns {string} JWT refresh secret
 */
const getJwtRefreshSecret = () => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (secret && !secret.includes('your_') && secret.length >= 32) {
    return secret;
  }
  if (!process.env._DYNAMIC_JWT_REFRESH_SECRET) {
    process.env._DYNAMIC_JWT_REFRESH_SECRET = crypto.randomBytes(32).toString('hex');
    logger.warn('⚠️  Using dynamically generated JWT_REFRESH_SECRET');
  }
  return process.env._DYNAMIC_JWT_REFRESH_SECRET;
};

const JWT_SECRET = getJwtSecret();
const JWT_REFRESH_SECRET = getJwtRefreshSecret();

// =============================================================================
// TOKEN GENERATION
// =============================================================================

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
      display_name: user.display_name,
      role: user.role || 'user',
      additional_roles: user.additional_roles || []
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
};

/**
 * Generate JWT refresh token
 * @param {Object} user - User object
 * @returns {string} JWT refresh token
 */
const generateRefreshToken = (user) => {
  return jwt.sign(
    { 
      id: user.id,
      type: 'refresh'
    },
    JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

// =============================================================================
// TOKEN VERIFICATION
// =============================================================================

/**
 * Verify JWT access token
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded token or null if invalid
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.debug('Access token expired');
    } else if (error.name === 'JsonWebTokenError') {
      logger.debug('Invalid access token', { message: error.message });
    }
    return null;
  }
};

/**
 * Verify JWT refresh token
 * @param {string} token - JWT refresh token
 * @returns {Object|null} Decoded token or null if invalid
 */
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    if (decoded.type !== 'refresh') {
      logger.warn('Token is not a refresh token');
      return null;
    }
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.debug('Refresh token expired');
    } else if (error.name === 'JsonWebTokenError') {
      logger.debug('Invalid refresh token', { message: error.message });
    }
    return null;
  }
};

// =============================================================================
// ROLE HELPERS
// =============================================================================

/**
 * Get role hierarchy level
 * @param {string} role - Role name
 * @returns {number} Role level (higher = more permissions)
 */
const getRoleLevel = (role) => {
  return ROLE_LEVELS[role] || 0;
};

/**
 * Check if a role is valid
 * @param {string} role - Role name
 * @returns {boolean}
 */
const isValidRole = (role) => {
  return VALID_ROLES.includes(role);
};

/**
 * Check if actor can modify target's role
 * @param {string} actorRole - Actor's role
 * @param {string} targetCurrentRole - Target's current role
 * @param {string} [targetNewRole] - Target's new role (if changing)
 * @returns {boolean}
 */
const canModifyUserRole = (actorRole, targetCurrentRole, targetNewRole = null) => {
  const actorLevel = getRoleLevel(actorRole);
  const targetLevel = getRoleLevel(targetCurrentRole);
  
  // Actor must have higher level than target's current role
  if (actorLevel <= targetLevel) {
    return false;
  }
  
  // If setting a new role, actor must have higher level than the new role too
  if (targetNewRole) {
    const newRoleLevel = getRoleLevel(targetNewRole);
    if (actorLevel <= newRoleLevel) {
      return false;
    }
  }
  
  return true;
};

/**
 * Check if user has a specific role or higher
 * @param {Object} user - User object
 * @param {string} requiredRole - Required role
 * @returns {boolean}
 */
const hasRoleOrHigher = (user, requiredRole) => {
  const userLevel = getRoleLevel(user.role);
  const requiredLevel = getRoleLevel(requiredRole);
  return userLevel >= requiredLevel;
};

/**
 * Check if user has any of the specified roles
 * @param {Object} user - User object
 * @param {Array<string>} roles - Array of role names
 * @returns {boolean}
 */
const hasAnyRole = (user, roles) => {
  // Check primary role
  if (roles.includes(user.role)) {
    return true;
  }
  
  // Check additional roles
  const additionalRoles = user.additional_roles || [];
  return roles.some(role => additionalRoles.includes(role));
};

/**
 * Check if user has all of the specified roles
 * @param {Object} user - User object
 * @param {Array<string>} roles - Array of role names
 * @returns {boolean}
 */
const hasAllRoles = (user, roles) => {
  const userRoles = new Set([user.role, ...(user.additional_roles || [])]);
  return roles.every(role => userRoles.has(role));
};

// =============================================================================
// DATABASE HELPERS
// =============================================================================

/**
 * Get user from database by ID
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

// =============================================================================
// AUTHENTICATION MIDDLEWARE
// =============================================================================

/**
 * Extract token from request
 * @param {Object} req - Express request
 * @returns {string|null} Token or null
 */
const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }
  
  return null;
};

/**
 * Authentication middleware
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
        // Check if user is blocked
        if (user.is_blocked) {
          return res.status(403).json({
            success: false,
            error: 'Account is blocked',
            code: 'ACCOUNT_BLOCKED',
            reason: user.blocked_reason
          });
        }
        req.user = user;
        return next();
      }
    }
    
    // Extract and verify token
    const token = extractToken(req);
    
    if (token) {
      const decoded = verifyToken(token);
      
      if (decoded) {
        // Try to get full user from database
        const user = await getUserFromDb(decoded.id);
        if (user) {
          // Check if user is blocked
          if (user.is_blocked) {
            return res.status(403).json({
              success: false,
              error: 'Account is blocked',
              code: 'ACCOUNT_BLOCKED',
              reason: user.blocked_reason
            });
          }
          req.user = user;
          return next();
        }
        // If no database, use JWT payload as user
        req.user = {
          id: decoded.id,
          email: decoded.email,
          display_name: decoded.display_name,
          role: decoded.role || 'user',
          additional_roles: decoded.additional_roles || [],
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

const authenticateJWT = authenticate;

/**
 * Optional authentication middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const optionalAuth = async (req, res, next) => {
  try {
    if (req.session?.userId && isDbConfigured()) {
      const user = await getUserFromDb(req.session.userId);
      if (user && !user.is_blocked) {
        req.user = user;
        return next();
      }
    }
    
    const token = extractToken(req);
    
    if (token) {
      const decoded = verifyToken(token);
      
      if (decoded) {
        const user = await getUserFromDb(decoded.id);
        if (user && !user.is_blocked) {
          req.user = user;
        } else if (!user) {
          req.user = {
            id: decoded.id,
            email: decoded.email,
            display_name: decoded.display_name,
            role: decoded.role || 'user',
            additional_roles: decoded.additional_roles || [],
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

// =============================================================================
// AUTHORIZATION MIDDLEWARE
// =============================================================================

/**
 * Require specific role(s) - checks if user has ANY of the specified roles
 * @param {Array<string>|string} roles - Allowed role(s)
 * @returns {Function} Middleware function
 */
const requireRole = (roles) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }
    
    // Check if user has any of the allowed roles (including via hierarchy)
    const userLevel = getRoleLevel(req.user.role);
    const hasAccess = allowedRoles.some(role => {
      const requiredLevel = getRoleLevel(role);
      // User has access if their role level >= required level
      // OR if the role is in their additional_roles
      return userLevel >= requiredLevel || 
             (req.user.additional_roles || []).includes(role);
    });
    
    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: allowedRoles
      });
    }
    
    next();
  };
};

/**
 * Require minimum role level (uses hierarchy)
 * @param {string} minRole - Minimum required role
 * @returns {Function} Middleware function
 */
const requireMinRole = (minRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }
    
    if (!hasRoleOrHigher(req.user, minRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: minRole
      });
    }
    
    next();
  };
};

/**
 * Require user to be admin or higher
 * @returns {Function} Middleware function
 */
const requireAdmin = () => requireMinRole('admin');

/**
 * Require user to be superadmin
 * @returns {Function} Middleware function
 */
const requireSuperAdmin = () => requireMinRole('superadmin');

/**
 * Check if user can access/modify target user
 * Adds targetUser to request if authorized
 * @param {Object} options - Options
 * @param {boolean} options.allowSelf - Allow user to access their own resource
 * @param {boolean} options.allowAdmin - Allow admin to access any user
 * @param {string} options.paramName - Request param name for user ID (default: 'id')
 * @returns {Function} Middleware function
 */
const canAccessUser = (options = {}) => {
  const { 
    allowSelf = true, 
    allowAdmin = true, 
    paramName = 'id' 
  } = options;
  
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      });
    }
    
    const targetUserId = req.params[paramName];
    
    // Check if accessing self
    if (allowSelf && req.user.id === targetUserId) {
      req.targetUser = req.user;
      req.isSelf = true;
      return next();
    }
    
    // Check if admin/superadmin accessing another user
    if (allowAdmin && hasRoleOrHigher(req.user, 'admin')) {
      try {
        const targetUser = await getUserFromDb(targetUserId);
        if (!targetUser) {
          return res.status(404).json({
            success: false,
            error: 'User not found',
            code: 'USER_NOT_FOUND'
          });
        }
        
        // Admins cannot access superadmins (unless they are superadmin)
        if (!canModifyUserRole(req.user.role, targetUser.role)) {
          return res.status(403).json({
            success: false,
            error: 'Cannot access user with equal or higher role',
            code: 'FORBIDDEN'
          });
        }
        
        req.targetUser = targetUser;
        req.isSelf = false;
        return next();
      } catch (error) {
        logger.error('Error fetching target user', { error: error.message });
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch user',
          code: 'SERVER_ERROR'
        });
      }
    }
    
    return res.status(403).json({
      success: false,
      error: 'Access denied',
      code: 'FORBIDDEN'
    });
  };
};

// =============================================================================
// COOKIE MANAGEMENT
// =============================================================================

/**
 * Set authentication cookies
 * @param {Object} res - Express response object
 * @param {string} accessToken - JWT access token
 * @param {string} refreshToken - JWT refresh token
 */
const setAuthCookies = (res, accessToken, refreshToken) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const secure = isProduction || process.env.COOKIE_SECURE === 'true';
  const sameSite = process.env.COOKIE_SAME_SITE || 'lax';
  const domain = process.env.COOKIE_DOMAIN || undefined;
  
  res.cookie('accessToken', accessToken, {
    httpOnly: false,
    secure,
    sameSite,
    domain,
    path: '/',
    maxAge: 15 * 60 * 1000
  });
  
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure,
    sameSite,
    domain,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
};

/**
 * Clear authentication cookies
 * @param {Object} res - Express response object
 */
const clearAuthCookies = (res) => {
  const domain = process.env.COOKIE_DOMAIN || undefined;
  res.clearCookie('accessToken', { path: '/', domain });
  res.clearCookie('refreshToken', { path: '/', domain });
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Constants
  ROLE_LEVELS,
  VALID_ROLES,
  
  // Token generation
  generateAccessToken,
  generateRefreshToken,
  
  // Token verification
  verifyToken,
  verifyRefreshToken,
  
  // Role helpers
  getRoleLevel,
  isValidRole,
  canModifyUserRole,
  hasRoleOrHigher,
  hasAnyRole,
  hasAllRoles,
  
  // Authentication middleware
  authenticate,
  authenticateJWT,
  optionalAuth,
  
  // Authorization middleware
  requireRole,
  requireMinRole,
  requireAdmin,
  requireSuperAdmin,
  canAccessUser,
  
  // Cookie management
  setAuthCookies,
  clearAuthCookies,
  
  // Helpers
  extractToken,
  getUserFromDb
};