/**
 * @fileoverview Users Routes
 * @description Handles user profile management and admin user operations.
 * Routes are thin wrappers that delegate business logic to usersController.
 * 
 * @module routes/users
 */

const express = require('express');
const usersController = require('../controllers/usersController');
const { 
  authenticate, 
  requireAdmin, 
  requireSuperAdmin,
  canAccessUser 
} = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// =============================================================================
// SWAGGER COMPONENT SCHEMAS
// =============================================================================

/**
 * @swagger
 * components:
 *   schemas:
 *     UserProfile:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         email:
 *           type: string
 *           format: email
 *         display_name:
 *           type: string
 *         avatar_url:
 *           type: string
 *           nullable: true
 *         language_preference:
 *           type: string
 *           enum: [en, fr]
 *         role:
 *           type: string
 *           enum: [superadmin, admin, user]
 *         additional_roles:
 *           type: array
 *           items:
 *             type: string
 *         oauth_provider:
 *           type: string
 *         email_verified:
 *           type: boolean
 *         is_blocked:
 *           type: boolean
 *         blocked_reason:
 *           type: string
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *         last_login:
 *           type: string
 *           format: date-time
 *           nullable: true
 *     
 *     UpdateProfileRequest:
 *       type: object
 *       properties:
 *         display_name:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *         avatar_url:
 *           type: string
 *           maxLength: 500
 *           nullable: true
 *         language_preference:
 *           type: string
 *           enum: [en, fr]
 *     
 *     ChangePasswordRequest:
 *       type: object
 *       required:
 *         - currentPassword
 *         - newPassword
 *         - confirmPassword
 *       properties:
 *         currentPassword:
 *           type: string
 *         newPassword:
 *           type: string
 *           minLength: 8
 *         confirmPassword:
 *           type: string
 *     
 *     UpdateRoleRequest:
 *       type: object
 *       properties:
 *         role:
 *           type: string
 *           enum: [superadmin, admin, user]
 *         additional_roles:
 *           type: array
 *           items:
 *             type: string
 *     
 *     BlockUserRequest:
 *       type: object
 *       properties:
 *         reason:
 *           type: string
 *     
 *     UserListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         users:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/UserProfile'
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *             limit:
 *               type: integer
 *             total:
 *               type: integer
 *             totalPages:
 *               type: integer
 */

// =============================================================================
// PROFILE ROUTES (Self - Authenticated Users)
// =============================================================================

/**
 * @swagger
 * /users/profile:
 *   get:
 *     summary: Get current user's profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
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
 *                   $ref: '#/components/schemas/UserProfile'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/profile', authenticate, asyncHandler(usersController.getProfile));

/**
 * @swagger
 * /users/profile:
 *   put:
 *     summary: Update current user's profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/UserProfile'
 *       400:
 *         description: Validation error
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put('/profile', authenticate, asyncHandler(usersController.updateProfile));

/**
 * @swagger
 * /users/password:
 *   put:
 *     summary: Change current user's password
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Current password is incorrect
 */
router.put('/password', authenticate, asyncHandler(usersController.changePassword));

// =============================================================================
// ADMIN ROUTES - User Management
// =============================================================================

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List all users (admin only)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by email or display name
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [superadmin, admin, user]
 *       - in: query
 *         name: blocked
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created_at, email, display_name, role, last_login]
 *           default: created_at
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: List of users
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserListResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/', authenticate, requireAdmin(), asyncHandler(usersController.listUsers));

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get a specific user (admin only)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/UserProfile'
 *       404:
 *         description: User not found
 */
router.get('/:id', 
  authenticate, 
  canAccessUser({ allowSelf: true, allowAdmin: true }), 
  asyncHandler(usersController.getUser)
);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Update a user (admin only)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *     responses:
 *       200:
 *         description: User updated successfully
 *       403:
 *         description: Cannot modify user with equal or higher role
 *       404:
 *         description: User not found
 */
router.put('/:id', 
  authenticate, 
  canAccessUser({ allowSelf: false, allowAdmin: true }), 
  asyncHandler(usersController.updateUser)
);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete a user (admin only)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       403:
 *         description: Cannot delete user with equal or higher role
 *       404:
 *         description: User not found
 */
router.delete('/:id', 
  authenticate, 
  canAccessUser({ allowSelf: false, allowAdmin: true }), 
  asyncHandler(usersController.deleteUser)
);

/**
 * @swagger
 * /users/{id}/role:
 *   put:
 *     summary: Update a user's role (admin only)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateRoleRequest'
 *     responses:
 *       200:
 *         description: Role updated successfully
 *       403:
 *         description: Cannot assign role equal to or higher than your own
 *       404:
 *         description: User not found
 */
router.put('/:id/role', 
  authenticate, 
  canAccessUser({ allowSelf: false, allowAdmin: true }), 
  asyncHandler(usersController.updateUserRole)
);

/**
 * @swagger
 * /users/{id}/block:
 *   post:
 *     summary: Block a user (admin only)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BlockUserRequest'
 *     responses:
 *       200:
 *         description: User blocked successfully
 *       400:
 *         description: User is already blocked
 *       403:
 *         description: Cannot block user with equal or higher role
 */
router.post('/:id/block', 
  authenticate, 
  canAccessUser({ allowSelf: false, allowAdmin: true }), 
  asyncHandler(usersController.blockUser)
);

/**
 * @swagger
 * /users/{id}/unblock:
 *   post:
 *     summary: Unblock a user (admin only)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User unblocked successfully
 *       400:
 *         description: User is not blocked
 */
router.post('/:id/unblock', 
  authenticate, 
  canAccessUser({ allowSelf: false, allowAdmin: true }), 
  asyncHandler(usersController.unblockUser)
);

/**
 * @swagger
 * /users/{id}/audit:
 *   get:
 *     summary: Get audit log for a user (admin only)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: User audit log
 */
router.get('/:id/audit', 
  authenticate, 
  canAccessUser({ allowSelf: true, allowAdmin: true }), 
  asyncHandler(usersController.getUserAuditLog)
);

/**
 * @swagger
 * /users/{id}/reset-token:
 *   post:
 *     summary: Generate password reset token for a user (admin only)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Reset token generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 resetToken:
 *                   type: string
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *                 resetUrl:
 *                   type: string
 */
router.post('/:id/reset-token', 
  authenticate, 
  canAccessUser({ allowSelf: false, allowAdmin: true }), 
  asyncHandler(usersController.generateResetToken)
);

// =============================================================================
// ADMIN ROUTES - Password Reset Management
// =============================================================================

/**
 * @swagger
 * /users/admin/password-resets:
 *   get:
 *     summary: List pending password reset requests (admin only)
 *     tags: [Admin - Password Resets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending password reset requests
 */
router.get('/admin/password-resets', 
  authenticate, 
  requireAdmin(), 
  asyncHandler(usersController.listPasswordResets)
);

module.exports = router;