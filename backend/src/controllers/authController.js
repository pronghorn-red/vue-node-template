/**
 * @fileoverview Authentication Controller
 * @description Handles all authentication business logic including registration,
 * login, logout, token refresh, and OAuth callbacks.
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
     RETURNING id, email, display_name, created_at`,
    [email.toLowerCase(), passwordHash, display_name]
  );

  const user = result.rows[0];

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Set cookies
  setAuthCookies(res, accessToken, refreshToken);

  logger.info('New user registered', { userId: user.id, email: user.email });

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name
    },
    token: accessToken,
    refreshToken
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

  passport.authenticate('local', { session: false }, (err, user, info) => {
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
    req.session.userId = user.id;

    // Set cookies
    setAuthCookies(res, accessToken, refreshToken);

    logger.info('User logged in', { userId: user.id, email: user.email });

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        display_name: user.display_name
      },
      token: accessToken,
      refreshToken
    });
  })(req, res, next);
};

/**
 * Logout user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const logout = async (req, res) => {
  // Clear session
  if (req.session) {
    req.session.destroy();
  }

  // Clear cookies
  clearAuthCookies(res);

  res.json({
    success: true,
    message: 'Logout successful'
  });
};

/**
 * Refresh access token using refresh token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const refresh = async (req, res) => {
  const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;

  if (!refreshToken) {
    throw ApiError.unauthorized('Refresh token required');
  }

  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded) {
    throw ApiError.unauthorized('Invalid refresh token');
  }

  // Get user
  const result = await query('SELECT * FROM users WHERE id = $1', [decoded.id]);
  if (result.rows.length === 0) {
    throw ApiError.unauthorized('User not found');
  }

  const user = result.rows[0];

  // Generate new tokens
  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  // Set cookies
  setAuthCookies(res, newAccessToken, newRefreshToken);

  res.json({
    success: true,
    token: newAccessToken,
    refreshToken: newRefreshToken
  });
};

/**
 * Get current user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getMe = async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      display_name: req.user.display_name,
      oauth_provider: req.user.oauth_provider,
      email_verified: req.user.email_verified,
      created_at: req.user.created_at,
      last_login: req.user.last_login
    }
  });
};

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
  const accessToken = generateAccessToken(req.user);
  const refreshToken = generateRefreshToken(req.user);

  // Set session
  req.session.userId = req.user.id;

  // Set cookies
  setAuthCookies(res, accessToken, refreshToken);

  logger.info('Google OAuth login', { userId: req.user.id, email: req.user.email });

  // Redirect to frontend
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.redirect(`${frontendUrl}/auth/callback?token=${accessToken}`);
};

/**
 * Initiate Microsoft SSO login
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const microsoftAuth = async (req, res) => {
  const authUrl = await getMicrosoftAuthUrl();
  res.redirect(authUrl);
};

/**
 * Handle Microsoft SSO callback
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const microsoftCallback = async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    logger.error('Microsoft OAuth error', { error, error_description });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/auth/login?error=microsoft_failed`);
  }

  try {
    const user = await handleMicrosoftCallback(code);

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Set session
    req.session.userId = user.id;

    // Set cookies
    setAuthCookies(res, accessToken, refreshToken);

    logger.info('Microsoft SSO login', { userId: user.id, email: user.email });

    // Redirect to frontend
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?token=${accessToken}`);
  } catch (error) {
    logger.error('Microsoft callback error', { error: error.message });
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/login?error=microsoft_failed`);
  }
};

/**
 * Request password reset
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw ApiError.badRequest('Email is required');
  }

  // Check if user exists
  const result = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
  if (result.rows.length === 0) {
    // Don't reveal if email exists for security
    return res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent'
    });
  }

  const user = result.rows[0];

  // Generate reset token (valid for 1 hour)
  const resetToken = require('crypto').randomBytes(32).toString('hex');
  const resetTokenHash = await bcrypt.hash(resetToken, 10);
  const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Store reset token in database
  await query(
    `UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3`,
    [resetTokenHash, resetTokenExpires, user.id]
  );

  // TODO: Send email with reset link
  logger.info('Password reset requested', { userId: user.id, email });

  res.json({
    success: true,
    message: 'If an account exists with this email, a password reset link has been sent'
  });
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

  // Find user with valid reset token
  const users = await query(
    `SELECT id, email FROM users WHERE reset_token_expires > NOW() LIMIT 100`
  );

  let validUser = null;
  for (const user of users.rows) {
    const result = await query('SELECT reset_token FROM users WHERE id = $1', [user.id]);
    if (result.rows[0] && await bcrypt.compare(resetToken, result.rows[0].reset_token)) {
      validUser = user;
      break;
    }
  }

  if (!validUser) {
    throw ApiError.badRequest('Invalid or expired reset token');
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, 12);

  // Update password and clear reset token
  await query(
    `UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2`,
    [passwordHash, validUser.id]
  );

  logger.info('Password reset successful', { userId: validUser.id, email: validUser.email });

  res.json({
    success: true,
    message: 'Password reset successful'
  });
};

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
