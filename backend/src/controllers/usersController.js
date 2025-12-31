/**
 * @fileoverview Users Controller
 * @description Handles user management operations including profile management,
 * admin user operations, role management, and password reset administration.
 * 
 * @module controllers/usersController
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('../config/database');
const { 
  isValidRole, 
  canModifyUserRole, 
  getRoleLevel,
  VALID_ROLES 
} = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Format user object for API response (excludes sensitive fields)
 * @param {Object} user - Raw user object from database
 * @returns {Object} Safe user object
 */
const formatUserResponse = (user) => ({
  id: user.id,
  email: user.email,
  display_name: user.display_name,
  avatar_url: user.avatar_url,
  language_preference: user.language_preference,
  role: user.role,
  additional_roles: user.additional_roles || [],
  oauth_provider: user.oauth_provider,
  email_verified: user.email_verified,
  is_blocked: user.is_blocked,
  blocked_reason: user.blocked_reason,
  blocked_at: user.blocked_at,
  created_at: user.created_at,
  updated_at: user.updated_at,
  last_login: user.last_login
});

/**
 * Log user action to audit log
 * @param {Object} params - Log parameters
 */
const logUserAction = async ({ userId, actorId, action, details, req }) => {
  try {
    await query(
      `SELECT log_user_action($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        actorId,
        action,
        JSON.stringify(details || {}),
        req?.ip || null,
        req?.get('user-agent') || null
      ]
    );
  } catch (error) {
    logger.warn('Failed to log user action', { error: error.message, action });
  }
};

// =============================================================================
// PROFILE MANAGEMENT (Self)
// =============================================================================

/**
 * Get current user's profile
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getProfile = async (req, res) => {
  res.json({
    success: true,
    user: formatUserResponse(req.user)
  });
};

/**
 * Update current user's profile
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const updateProfile = async (req, res) => {
  const { display_name, avatar_url, language_preference } = req.body;
  const userId = req.user.id;
  
  // Build update query dynamically
  const updates = [];
  const values = [];
  let paramIndex = 1;
  
  if (display_name !== undefined) {
    if (!display_name || display_name.trim().length < 2) {
      throw ApiError.badRequest('Display name must be at least 2 characters');
    }
    if (display_name.length > 100) {
      throw ApiError.badRequest('Display name must be less than 100 characters');
    }
    updates.push(`display_name = $${paramIndex++}`);
    values.push(display_name.trim());
  }
  
  if (avatar_url !== undefined) {
    if (avatar_url && avatar_url.length > 500) {
      throw ApiError.badRequest('Avatar URL must be less than 500 characters');
    }
    // Basic URL validation
    if (avatar_url && !avatar_url.match(/^https?:\/\/.+/)) {
      throw ApiError.badRequest('Avatar URL must be a valid HTTP(S) URL');
    }
    updates.push(`avatar_url = $${paramIndex++}`);
    values.push(avatar_url || null);
  }
  
  if (language_preference !== undefined) {
    const validLanguages = ['en', 'fr']; // Add more as needed
    if (language_preference && !validLanguages.includes(language_preference)) {
      throw ApiError.badRequest(`Language must be one of: ${validLanguages.join(', ')}`);
    }
    updates.push(`language_preference = $${paramIndex++}`);
    values.push(language_preference || 'en');
  }
  
  if (updates.length === 0) {
    throw ApiError.badRequest('No valid fields to update');
  }
  
  values.push(userId);
  
  const result = await query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  
  if (result.rows.length === 0) {
    throw ApiError.notFound('User not found');
  }
  
  await logUserAction({
    userId,
    actorId: userId,
    action: 'profile_updated',
    details: { fields: Object.keys(req.body) },
    req
  });
  
  logger.info('Profile updated', { userId });
  
  res.json({
    success: true,
    message: 'Profile updated successfully',
    user: formatUserResponse(result.rows[0])
  });
};

/**
 * Change current user's password
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const changePassword = async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const userId = req.user.id;
  
  if (!currentPassword || !newPassword || !confirmPassword) {
    throw ApiError.badRequest('Current password, new password, and confirmation are required');
  }
  
  if (newPassword !== confirmPassword) {
    throw ApiError.badRequest('New passwords do not match');
  }
  
  if (newPassword.length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters');
  }
  
  // Get current password hash
  const userResult = await query(
    'SELECT password_hash, oauth_provider FROM users WHERE id = $1',
    [userId]
  );
  
  if (userResult.rows.length === 0) {
    throw ApiError.notFound('User not found');
  }
  
  const user = userResult.rows[0];
  
  // OAuth users may not have a password
  if (!user.password_hash) {
    throw ApiError.badRequest('Cannot change password for OAuth accounts');
  }
  
  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isValid) {
    throw ApiError.unauthorized('Current password is incorrect');
  }
  
  // Hash and update new password
  const newHash = await bcrypt.hash(newPassword, 12);
  await query(
    'UPDATE users SET password_hash = $1 WHERE id = $2',
    [newHash, userId]
  );
  
  await logUserAction({
    userId,
    actorId: userId,
    action: 'password_changed',
    details: {},
    req
  });
  
  logger.info('Password changed', { userId });
  
  res.json({
    success: true,
    message: 'Password changed successfully'
  });
};

// =============================================================================
// USER MANAGEMENT (Admin)
// =============================================================================

/**
 * List all users (admin only)
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const listUsers = async (req, res) => {
  const { 
    page = 1, 
    limit = 20, 
    search, 
    role, 
    blocked,
    sortBy = 'created_at',
    sortOrder = 'desc'
  } = req.query;
  
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const validSortFields = ['created_at', 'email', 'display_name', 'role', 'last_login'];
  const validSortOrders = ['asc', 'desc'];
  
  const actualSortBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';
  const actualSortOrder = validSortOrders.includes(sortOrder.toLowerCase()) ? sortOrder : 'desc';
  
  // Build WHERE clause
  const conditions = [];
  const values = [];
  let paramIndex = 1;
  
  // Admins can only see users at their level or below
  const actorLevel = getRoleLevel(req.user.role);
  if (actorLevel < 100) { // Not superadmin
    conditions.push(`(
      CASE role 
        WHEN 'superadmin' THEN 100 
        WHEN 'admin' THEN 50 
        ELSE 10 
      END
    ) < $${paramIndex++}`);
    values.push(actorLevel);
  }
  
  if (search) {
    conditions.push(`(email ILIKE $${paramIndex} OR display_name ILIKE $${paramIndex})`);
    values.push(`%${search}%`);
    paramIndex++;
  }
  
  if (role && VALID_ROLES.includes(role)) {
    conditions.push(`role = $${paramIndex++}`);
    values.push(role);
  }
  
  if (blocked !== undefined) {
    conditions.push(`is_blocked = $${paramIndex++}`);
    values.push(blocked === 'true');
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) FROM users ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0].count);
  
  // Get users
  values.push(parseInt(limit), offset);
  const usersResult = await query(
    `SELECT * FROM users ${whereClause} 
     ORDER BY ${actualSortBy} ${actualSortOrder}
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    values
  );
  
  res.json({
    success: true,
    users: usersResult.rows.map(formatUserResponse),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit))
    }
  });
};

/**
 * Get a specific user by ID (admin only)
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getUser = async (req, res) => {
  // targetUser is set by canAccessUser middleware
  res.json({
    success: true,
    user: formatUserResponse(req.targetUser)
  });
};

/**
 * Update a user (admin only)
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const updateUser = async (req, res) => {
  const { display_name, avatar_url, language_preference, email_verified } = req.body;
  const targetUser = req.targetUser;
  
  const updates = [];
  const values = [];
  let paramIndex = 1;
  
  if (display_name !== undefined) {
    if (!display_name || display_name.trim().length < 2) {
      throw ApiError.badRequest('Display name must be at least 2 characters');
    }
    updates.push(`display_name = $${paramIndex++}`);
    values.push(display_name.trim());
  }
  
  if (avatar_url !== undefined) {
    updates.push(`avatar_url = $${paramIndex++}`);
    values.push(avatar_url || null);
  }
  
  if (language_preference !== undefined) {
    updates.push(`language_preference = $${paramIndex++}`);
    values.push(language_preference || 'en');
  }
  
  if (email_verified !== undefined) {
    updates.push(`email_verified = $${paramIndex++}`);
    values.push(!!email_verified);
  }
  
  if (updates.length === 0) {
    throw ApiError.badRequest('No valid fields to update');
  }
  
  values.push(targetUser.id);
  
  const result = await query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  
  await logUserAction({
    userId: targetUser.id,
    actorId: req.user.id,
    action: 'user_updated_by_admin',
    details: { fields: Object.keys(req.body) },
    req
  });
  
  logger.info('User updated by admin', { 
    targetUserId: targetUser.id, 
    adminId: req.user.id 
  });
  
  res.json({
    success: true,
    message: 'User updated successfully',
    user: formatUserResponse(result.rows[0])
  });
};

/**
 * Update user's role (admin only, with hierarchy checks)
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const updateUserRole = async (req, res) => {
  const { role, additional_roles } = req.body;
  const targetUser = req.targetUser;
  const actor = req.user;
  
  // Prevent self-modification (except superadmin)
  if (req.isSelf && actor.role !== 'superadmin') {
    throw ApiError.forbidden('Cannot modify your own role');
  }
  
  const updates = [];
  const values = [];
  let paramIndex = 1;
  
  // Handle primary role change
  if (role !== undefined) {
    if (!isValidRole(role)) {
      throw ApiError.badRequest(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
    }
    
    // Check if actor can assign this role
    if (!canModifyUserRole(actor.role, targetUser.role, role)) {
      throw ApiError.forbidden('Cannot assign role equal to or higher than your own');
    }
    
    updates.push(`role = $${paramIndex++}`);
    values.push(role);
  }
  
  // Handle additional roles
  if (additional_roles !== undefined) {
    if (!Array.isArray(additional_roles)) {
      throw ApiError.badRequest('Additional roles must be an array');
    }
    
    // Validate each additional role (these are custom, not hierarchy-based)
    const validAdditionalRoles = additional_roles.filter(r => 
      typeof r === 'string' && r.length > 0 && r.length <= 50
    );
    
    updates.push(`additional_roles = $${paramIndex++}`);
    values.push(JSON.stringify(validAdditionalRoles));
  }
  
  if (updates.length === 0) {
    throw ApiError.badRequest('No role changes specified');
  }
  
  values.push(targetUser.id);
  
  const result = await query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );
  
  await logUserAction({
    userId: targetUser.id,
    actorId: actor.id,
    action: 'role_changed',
    details: { 
      previousRole: targetUser.role,
      newRole: role || targetUser.role,
      previousAdditionalRoles: targetUser.additional_roles,
      newAdditionalRoles: additional_roles
    },
    req
  });
  
  logger.info('User role updated', { 
    targetUserId: targetUser.id, 
    adminId: actor.id,
    newRole: role 
  });
  
  res.json({
    success: true,
    message: 'User role updated successfully',
    user: formatUserResponse(result.rows[0])
  });
};

/**
 * Block a user (admin only)
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const blockUser = async (req, res) => {
  const { reason } = req.body;
  const targetUser = req.targetUser;
  
  if (req.isSelf) {
    throw ApiError.forbidden('Cannot block yourself');
  }
  
  if (targetUser.is_blocked) {
    throw ApiError.badRequest('User is already blocked');
  }
  
  await query(
    `UPDATE users SET is_blocked = true, blocked_reason = $1, blocked_by = $2 WHERE id = $3`,
    [reason || 'Blocked by administrator', req.user.id, targetUser.id]
  );
  
  await logUserAction({
    userId: targetUser.id,
    actorId: req.user.id,
    action: 'user_blocked',
    details: { reason },
    req
  });
  
  logger.info('User blocked', { 
    targetUserId: targetUser.id, 
    adminId: req.user.id,
    reason 
  });
  
  res.json({
    success: true,
    message: 'User blocked successfully'
  });
};

/**
 * Unblock a user (admin only)
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const unblockUser = async (req, res) => {
  const targetUser = req.targetUser;
  
  if (!targetUser.is_blocked) {
    throw ApiError.badRequest('User is not blocked');
  }
  
  await query(
    `UPDATE users SET is_blocked = false WHERE id = $1`,
    [targetUser.id]
  );
  
  await logUserAction({
    userId: targetUser.id,
    actorId: req.user.id,
    action: 'user_unblocked',
    details: {},
    req
  });
  
  logger.info('User unblocked', { 
    targetUserId: targetUser.id, 
    adminId: req.user.id 
  });
  
  res.json({
    success: true,
    message: 'User unblocked successfully'
  });
};

/**
 * Delete a user (admin only)
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const deleteUser = async (req, res) => {
  const targetUser = req.targetUser;
  
  if (req.isSelf) {
    throw ApiError.forbidden('Cannot delete yourself');
  }
  
  await query('DELETE FROM users WHERE id = $1', [targetUser.id]);
  
  await logUserAction({
    userId: targetUser.id,
    actorId: req.user.id,
    action: 'user_deleted',
    details: { email: targetUser.email },
    req
  });
  
  logger.info('User deleted', { 
    targetUserId: targetUser.id, 
    adminId: req.user.id 
  });
  
  res.json({
    success: true,
    message: 'User deleted successfully'
  });
};

// =============================================================================
// PASSWORD RESET MANAGEMENT (Admin)
// =============================================================================

/**
 * List pending password reset requests (admin only)
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const listPasswordResets = async (req, res) => {
  const result = await query(`
    SELECT * FROM pending_password_resets 
    ORDER BY requested_at DESC
    LIMIT 100
  `);
  
  res.json({
    success: true,
    resets: result.rows
  });
};

/**
 * Generate a password reset token for a user (admin only)
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const generateResetToken = async (req, res) => {
  const targetUser = req.targetUser;
  
  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = await bcrypt.hash(resetToken, 10);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours for admin-generated
  
  // Update user
  await query(
    `UPDATE users 
     SET reset_token = $1, reset_token_expires = $2, reset_token_used = false 
     WHERE id = $3`,
    [resetTokenHash, expiresAt, targetUser.id]
  );
  
  // Log to password_reset_requests table
  await query(
    `INSERT INTO password_reset_requests (user_id, reset_token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [targetUser.id, resetTokenHash, expiresAt, req.ip, req.get('user-agent')]
  );
  
  await logUserAction({
    userId: targetUser.id,
    actorId: req.user.id,
    action: 'admin_generated_reset_token',
    details: {},
    req
  });
  
  logger.info('Password reset token generated by admin', { 
    targetUserId: targetUser.id, 
    adminId: req.user.id 
  });
  
  // Return the plain token (admin can share it with user)
  res.json({
    success: true,
    message: 'Password reset token generated',
    resetToken,
    expiresAt,
    resetUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/auth/reset?token=${resetToken}`
  });
};

// =============================================================================
// AUDIT LOG (Admin)
// =============================================================================

/**
 * Get audit log for a user (admin only)
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
const getUserAuditLog = async (req, res) => {
  const targetUser = req.targetUser;
  const { limit = 50 } = req.query;
  
  const result = await query(
    `SELECT 
      ual.id,
      ual.action,
      ual.details,
      ual.ip_address,
      ual.created_at,
      actor.email AS actor_email,
      actor.display_name AS actor_display_name
     FROM user_audit_log ual
     LEFT JOIN users actor ON ual.actor_id = actor.id
     WHERE ual.user_id = $1
     ORDER BY ual.created_at DESC
     LIMIT $2`,
    [targetUser.id, parseInt(limit)]
  );
  
  res.json({
    success: true,
    audit_log: result.rows
  });
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Profile (self)
  getProfile,
  updateProfile,
  changePassword,
  
  // User management (admin)
  listUsers,
  getUser,
  updateUser,
  updateUserRole,
  blockUser,
  unblockUser,
  deleteUser,
  
  // Password reset management (admin)
  listPasswordResets,
  generateResetToken,
  
  // Audit
  getUserAuditLog
};