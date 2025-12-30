/**
 * @fileoverview User Management Routes
 * @description Handles user profile management, password changes, and account settings.
 * @module routes/users
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /users/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/profile', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, email, display_name, oauth_provider, email_verified, created_at, last_login
     FROM users WHERE id = $1`,
    [req.user.id]
  );
  
  if (result.rows.length === 0) {
    throw ApiError.notFound('User not found');
  }
  
  res.json({
    success: true,
    user: result.rows[0]
  });
}));

/**
 * @swagger
 * /users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               display_name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put('/profile', authenticate, asyncHandler(async (req, res) => {
  const { display_name } = req.body;
  
  if (!display_name || display_name.length < 2 || display_name.length > 100) {
    throw ApiError.badRequest('Display name must be between 2 and 100 characters');
  }
  
  const result = await query(
    `UPDATE users SET display_name = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, email, display_name, oauth_provider, email_verified, created_at, last_login`,
    [display_name, req.user.id]
  );
  
  logger.info('User profile updated', { userId: req.user.id });
  
  res.json({
    success: true,
    message: 'Profile updated successfully',
    user: result.rows[0]
  });
}));

/**
 * @swagger
 * /users/password:
 *   put:
 *     summary: Change user password
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Current password incorrect
 */
router.put('/password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    throw ApiError.badRequest('Current password and new password are required');
  }
  
  if (newPassword.length < 8) {
    throw ApiError.badRequest('New password must be at least 8 characters');
  }
  
  // Check if user has a password (not OAuth-only)
  const userResult = await query(
    'SELECT password_hash FROM users WHERE id = $1',
    [req.user.id]
  );
  
  if (!userResult.rows[0].password_hash) {
    throw ApiError.badRequest('Cannot change password for OAuth-only accounts');
  }
  
  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
  if (!isValid) {
    throw ApiError.unauthorized('Current password is incorrect');
  }
  
  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, 12);
  
  await query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [newPasswordHash, req.user.id]
  );
  
  logger.info('User password changed', { userId: req.user.id });
  
  res.json({
    success: true,
    message: 'Password changed successfully'
  });
}));

/**
 * @swagger
 * /users/account:
 *   delete:
 *     summary: Delete user account
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 description: Required for local accounts
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *       401:
 *         description: Password verification failed
 */
router.delete('/account', authenticate, asyncHandler(async (req, res) => {
  const { password } = req.body;
  
  // For local accounts, require password confirmation
  const userResult = await query(
    'SELECT password_hash, oauth_provider FROM users WHERE id = $1',
    [req.user.id]
  );
  
  if (userResult.rows[0].oauth_provider === 'local' && userResult.rows[0].password_hash) {
    if (!password) {
      throw ApiError.badRequest('Password required to delete account');
    }
    
    const isValid = await bcrypt.compare(password, userResult.rows[0].password_hash);
    if (!isValid) {
      throw ApiError.unauthorized('Password is incorrect');
    }
  }
  
  // Delete user (cascade will handle related data)
  await query('DELETE FROM users WHERE id = $1', [req.user.id]);
  
  logger.info('User account deleted', { userId: req.user.id });
  
  res.json({
    success: true,
    message: 'Account deleted successfully'
  });
}));

module.exports = router;
