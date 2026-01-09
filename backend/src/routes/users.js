/**
 * @fileoverview Users Routes
 * @description Handles user profile management and admin user operations.
 * Routes are thin wrappers that delegate business logic to usersController.
 * 
 * Route Categories:
 * - Profile Routes: Self-service for authenticated users
 * - Admin Routes: User management for admins/superadmins
 * - Password Reset Routes: Admin-managed password resets
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
// SWAGGER TAG DEFINITIONS
// =============================================================================

/**
 * @swagger
 * tags:
 *   - name: Profile
 *     description: Self-service profile management for authenticated users
 *   - name: Admin - Users
 *     description: User management operations (admin/superadmin only)
 *   - name: Admin - Password Resets
 *     description: Password reset management (admin only)
 */

// =============================================================================
// SWAGGER COMPONENT SCHEMAS
// =============================================================================

/**
 * @swagger
 * components:
 *   schemas:
 *     UserProfile:
 *       type: object
 *       description: Complete user profile object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique user identifier
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address (unique)
 *           example: "user@example.com"
 *         display_name:
 *           type: string
 *           description: User's display name
 *           example: "John Doe"
 *         avatar_url:
 *           type: string
 *           nullable: true
 *           description: URL to user's avatar image
 *           example: "https://example.com/avatars/john.jpg"
 *         language_preference:
 *           type: string
 *           enum: [en, fr]
 *           description: User's preferred language
 *           default: en
 *           example: "en"
 *         role:
 *           type: string
 *           enum: [superadmin, admin, user]
 *           description: User's primary role
 *           example: "user"
 *         additional_roles:
 *           type: array
 *           items:
 *             type: string
 *           description: Additional custom roles assigned to user
 *           example: ["moderator", "reviewer"]
 *         oauth_provider:
 *           type: string
 *           enum: [local, google, microsoft]
 *           nullable: true
 *           description: OAuth provider if using SSO
 *           example: "google"
 *         email_verified:
 *           type: boolean
 *           description: Whether email has been verified
 *           example: true
 *         is_blocked:
 *           type: boolean
 *           description: Whether user account is blocked
 *           example: false
 *         blocked_reason:
 *           type: string
 *           nullable: true
 *           description: Reason for blocking (if blocked)
 *           example: null
 *         blocked_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: When the user was blocked
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Account creation timestamp
 *           example: "2024-01-15T10:30:00Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Last profile update timestamp
 *           example: "2024-06-20T14:45:00Z"
 *         last_login:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Last login timestamp
 *           example: "2024-06-25T09:00:00Z"
 *     
 *     CreateUserRequest:
 *       type: object
 *       required:
 *         - email
 *         - display_name
 *       description: Request body for creating a new user (admin only)
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address (must be unique)
 *           example: "newuser@example.com"
 *         display_name:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           description: User's display name
 *           example: "Jane Smith"
 *         password:
 *           type: string
 *           minLength: 8
 *           description: Temporary password (auto-generated if not provided)
 *           example: "TempPass123!"
 *         role:
 *           type: string
 *           enum: [admin, user]
 *           default: user
 *           description: User's role (cannot assign equal or higher than your own)
 *           example: "user"
 *         language_preference:
 *           type: string
 *           enum: [en, fr]
 *           default: en
 *           description: User's preferred language
 *           example: "en"
 *         email_verified:
 *           type: boolean
 *           default: false
 *           description: Mark email as pre-verified
 *           example: false
 *     
 *     CreateUserResponse:
 *       type: object
 *       description: Response after creating a new user
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "User created successfully. Please share the temporary password securely with the user."
 *         user:
 *           $ref: '#/components/schemas/UserProfile'
 *         temporaryPassword:
 *           type: string
 *           description: Generated or provided password (shown only once)
 *           example: "xK9#mP2$vL5@nQ8"
 *     
 *     UpdateProfileRequest:
 *       type: object
 *       description: Request body for updating user profile
 *       properties:
 *         display_name:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           description: User's display name
 *           example: "John Smith"
 *         avatar_url:
 *           type: string
 *           maxLength: 500
 *           nullable: true
 *           description: URL to avatar image (must be valid HTTP/HTTPS URL)
 *           example: "https://example.com/avatar.jpg"
 *         language_preference:
 *           type: string
 *           enum: [en, fr]
 *           description: Preferred language
 *           example: "fr"
 *     
 *     AdminUpdateUserRequest:
 *       type: object
 *       description: Request body for admin updating a user
 *       properties:
 *         display_name:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           description: User's display name
 *           example: "John Smith"
 *         avatar_url:
 *           type: string
 *           maxLength: 500
 *           nullable: true
 *           description: URL to avatar image
 *         language_preference:
 *           type: string
 *           enum: [en, fr]
 *           description: Preferred language
 *         email_verified:
 *           type: boolean
 *           description: Email verification status
 *           example: true
 *     
 *     ChangePasswordRequest:
 *       type: object
 *       required:
 *         - currentPassword
 *         - newPassword
 *         - confirmPassword
 *       description: Request body for changing password
 *       properties:
 *         currentPassword:
 *           type: string
 *           description: Current password for verification
 *           example: "OldPass123!"
 *         newPassword:
 *           type: string
 *           minLength: 8
 *           description: New password (minimum 8 characters)
 *           example: "NewPass456!"
 *         confirmPassword:
 *           type: string
 *           description: Must match newPassword
 *           example: "NewPass456!"
 *     
 *     UpdateRoleRequest:
 *       type: object
 *       description: Request body for updating user role
 *       properties:
 *         role:
 *           type: string
 *           enum: [superadmin, admin, user]
 *           description: Primary role (subject to hierarchy restrictions)
 *           example: "admin"
 *         additional_roles:
 *           type: array
 *           items:
 *             type: string
 *             maxLength: 50
 *           description: Custom additional roles
 *           example: ["moderator", "reviewer"]
 *     
 *     BlockUserRequest:
 *       type: object
 *       description: Request body for blocking a user
 *       properties:
 *         reason:
 *           type: string
 *           description: Reason for blocking the user
 *           example: "Violation of terms of service"
 *     
 *     ResetPasswordRequest:
 *       type: object
 *       description: Request body for admin password reset
 *       properties:
 *         password:
 *           type: string
 *           minLength: 8
 *           description: Specific password to set (auto-generated if not provided)
 *           example: "NewTempPass123!"
 *     
 *     ResetPasswordResponse:
 *       type: object
 *       description: Response after resetting a user's password
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Password has been reset. Please share the new password securely with the user."
 *         temporaryPassword:
 *           type: string
 *           description: The new password (shown only once)
 *           example: "xK9#mP2$vL5@nQ8"
 *         userId:
 *           type: string
 *           format: uuid
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *         email:
 *           type: string
 *           format: email
 *           example: "user@example.com"
 *     
 *     ResetTokenResponse:
 *       type: object
 *       description: Response after generating a password reset token
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Password reset token generated"
 *         resetToken:
 *           type: string
 *           description: Plain reset token (shown only once)
 *           example: "a1b2c3d4e5f6g7h8i9j0..."
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           description: Token expiration time (24 hours for admin-generated)
 *           example: "2024-06-26T09:00:00Z"
 *         resetUrl:
 *           type: string
 *           description: Full URL for password reset
 *           example: "https://app.example.com/auth/reset?token=a1b2c3d4..."
 *     
 *     UserListResponse:
 *       type: object
 *       description: Paginated list of users
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         users:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/UserProfile'
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *               description: Current page number
 *               example: 1
 *             limit:
 *               type: integer
 *               description: Items per page
 *               example: 20
 *             total:
 *               type: integer
 *               description: Total number of users
 *               example: 150
 *             totalPages:
 *               type: integer
 *               description: Total number of pages
 *               example: 8
 *     
 *     AuditLogEntry:
 *       type: object
 *       description: Single audit log entry
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         action:
 *           type: string
 *           description: Action performed
 *           example: "profile_updated"
 *         details:
 *           type: object
 *           description: Additional action details
 *         ip_address:
 *           type: string
 *           description: IP address of actor
 *           example: "192.168.1.1"
 *         created_at:
 *           type: string
 *           format: date-time
 *         actor_email:
 *           type: string
 *           description: Email of user who performed action
 *         actor_display_name:
 *           type: string
 *           description: Display name of actor
 *     
 *     AuditLogResponse:
 *       type: object
 *       description: User audit log response
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         audit_log:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AuditLogEntry'
 *     
 *     PasswordResetRequest:
 *       type: object
 *       description: Pending password reset request
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         user_id:
 *           type: string
 *           format: uuid
 *         email:
 *           type: string
 *           format: email
 *         requested_at:
 *           type: string
 *           format: date-time
 *         expires_at:
 *           type: string
 *           format: date-time
 *         status:
 *           type: string
 *           enum: [pending, used, expired]
 *     
 *     SuccessResponse:
 *       type: object
 *       description: Generic success response
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Operation completed successfully"
 *     
 *     ErrorResponse:
 *       type: object
 *       description: Error response
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *           description: Error message
 *           example: "Validation error"
 *         code:
 *           type: string
 *           description: Error code
 *           example: "VALIDATION_ERROR"
 *         details:
 *           type: object
 *           description: Additional error details
 *   
 *   responses:
 *     UnauthorizedError:
 *       description: Authentication required or invalid token
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               error:
 *                 type: string
 *                 example: "Authentication required"
 *               code:
 *                 type: string
 *                 example: "UNAUTHORIZED"
 *     
 *     ForbiddenError:
 *       description: Insufficient permissions
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               error:
 *                 type: string
 *                 example: "Insufficient permissions"
 *               code:
 *                 type: string
 *                 example: "FORBIDDEN"
 *     
 *     NotFoundError:
 *       description: Resource not found
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               error:
 *                 type: string
 *                 example: "User not found"
 *               code:
 *                 type: string
 *                 example: "NOT_FOUND"
 *     
 *     ValidationError:
 *       description: Invalid request data
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               error:
 *                 type: string
 *                 example: "Validation error"
 *               code:
 *                 type: string
 *                 example: "BAD_REQUEST"
 *               details:
 *                 type: object
 *     
 *     ConflictError:
 *       description: Resource conflict (e.g., email already exists)
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               error:
 *                 type: string
 *                 example: "Email already registered"
 *               code:
 *                 type: string
 *                 example: "CONFLICT"
 *   
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: JWT access token
 */

// =============================================================================
// PROFILE ROUTES (Self - Authenticated Users)
// =============================================================================

/**
 * @swagger
 * /users/profile:
 *   get:
 *     summary: Get current user's profile
 *     description: Returns the authenticated user's complete profile information.
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
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
 *     description: |
 *       Update the authenticated user's profile information.
 *       Only provided fields will be updated.
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *           examples:
 *             updateName:
 *               summary: Update display name
 *               value:
 *                 display_name: "Jane Doe"
 *             updateAll:
 *               summary: Update all fields
 *               value:
 *                 display_name: "Jane Doe"
 *                 avatar_url: "https://example.com/avatar.jpg"
 *                 language_preference: "fr"
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
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Profile updated successfully"
 *                 user:
 *                   $ref: '#/components/schemas/UserProfile'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put('/profile', authenticate, asyncHandler(usersController.updateProfile));

/**
 * @swagger
 * /users/password:
 *   put:
 *     summary: Change current user's password
 *     description: |
 *       Change the authenticated user's password.
 *       Requires current password verification.
 *       Not available for OAuth-only accounts.
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *           example:
 *             currentPassword: "OldPassword123!"
 *             newPassword: "NewPassword456!"
 *             confirmPassword: "NewPassword456!"
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Password changed successfully"
 *       400:
 *         description: Validation error or OAuth-only account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               mismatch:
 *                 summary: Passwords don't match
 *                 value:
 *                   success: false
 *                   error: "New passwords do not match"
 *               tooShort:
 *                 summary: Password too short
 *                 value:
 *                   success: false
 *                   error: "Password must be at least 8 characters"
 *               oauthOnly:
 *                 summary: OAuth account
 *                 value:
 *                   success: false
 *                   error: "Cannot change password for OAuth-only accounts"
 *       401:
 *         description: Current password is incorrect
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "Current password is incorrect"
 */
router.put('/password', authenticate, asyncHandler(usersController.changePassword));

/**
 * @swagger
 * /users/me:
 *   delete:
 *     summary: Delete own account
 *     description: |
 *       Permanently delete the authenticated user's own account.
 *       
 *       **Restrictions:**
 *       - Superadmin accounts cannot be self-deleted for security reasons
 *       - This action is irreversible
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Account deleted successfully"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Superadmin accounts cannot be self-deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "Superadmin accounts cannot be self-deleted. Contact another superadmin."
 */
router.delete('/me', authenticate, asyncHandler(usersController.deleteOwnAccount));

// =============================================================================
// ADMIN ROUTES - User Management
// =============================================================================

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List all users
 *     description: |
 *       Get a paginated list of all users.
 *       
 *       **Access Control:**
 *       - Admins can only see users with roles lower than their own
 *       - Superadmins can see all users
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by email or display name (case-insensitive)
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [superadmin, admin, user]
 *         description: Filter by role
 *       - in: query
 *         name: blocked
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: Filter by blocked status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [created_at, email, display_name, role, last_login]
 *           default: created_at
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort direction
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
 * /users:
 *   post:
 *     summary: Create a new user
 *     description: |
 *       Create a new user account (admin only).
 *       
 *       **Role Hierarchy:**
 *       - Admins can only create users with role 'user'
 *       - Superadmins can create users with role 'admin' or 'user'
 *       - Cannot create users with equal or higher role than your own
 *       
 *       **Password:**
 *       - If password is not provided, a secure random password is generated
 *       - The temporary password is returned in the response (shown only once)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *           examples:
 *             minimal:
 *               summary: Minimal (auto-generated password)
 *               value:
 *                 email: "newuser@example.com"
 *                 display_name: "New User"
 *             complete:
 *               summary: Complete with all options
 *               value:
 *                 email: "admin@example.com"
 *                 display_name: "Admin User"
 *                 password: "TempPass123!"
 *                 role: "admin"
 *                 language_preference: "en"
 *                 email_verified: true
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CreateUserResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Cannot create user with equal or higher role
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "Cannot create user with equal or higher role than your own"
 *       409:
 *         $ref: '#/components/responses/ConflictError'
 */
router.post('/', authenticate, requireAdmin(), asyncHandler(usersController.createUser));

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get a specific user
 *     description: |
 *       Get detailed information about a specific user.
 *       
 *       **Access Control:**
 *       - Users can view their own profile
 *       - Admins can view users with lower roles
 *       - Superadmins can view any user
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
 *         description: User ID
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
 *                   example: true
 *                 user:
 *                   $ref: '#/components/schemas/UserProfile'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
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
 *     summary: Update a user
 *     description: |
 *       Update a user's profile information (admin only).
 *       
 *       **Access Control:**
 *       - Cannot update your own profile via this endpoint (use PUT /users/profile)
 *       - Cannot update users with equal or higher role
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
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminUpdateUserRequest'
 *           example:
 *             display_name: "Updated Name"
 *             email_verified: true
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "User updated successfully"
 *                 user:
 *                   $ref: '#/components/schemas/UserProfile'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Cannot modify user with equal or higher role
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
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
 *     summary: Delete a user
 *     description: |
 *       Permanently delete a user account (admin only).
 *       
 *       **Restrictions:**
 *       - Cannot delete yourself (use DELETE /users/me)
 *       - Cannot delete users with equal or higher role
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
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "User deleted successfully"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Cannot delete user with equal or higher role or yourself
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
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
 *     summary: Update a user's role
 *     description: |
 *       Update a user's primary role and/or additional roles.
 *       
 *       **Role Hierarchy:**
 *       - superadmin (100) > admin (50) > user (10)
 *       - Cannot modify your own role
 *       - Cannot assign role equal to or higher than your own
 *       - Cannot modify users with equal or higher role
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
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateRoleRequest'
 *           examples:
 *             promoteToAdmin:
 *               summary: Promote to admin
 *               value:
 *                 role: "admin"
 *             addCustomRoles:
 *               summary: Add custom roles
 *               value:
 *                 additional_roles: ["moderator", "reviewer"]
 *     responses:
 *       200:
 *         description: Role updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "User role updated successfully"
 *                 user:
 *                   $ref: '#/components/schemas/UserProfile'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Cannot assign role equal to or higher than your own
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
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
 *     summary: Block a user
 *     description: |
 *       Block a user account, preventing them from logging in.
 *       
 *       **Restrictions:**
 *       - Cannot block yourself
 *       - Cannot block users with equal or higher role
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
 *         description: User ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BlockUserRequest'
 *           example:
 *             reason: "Violation of terms of service"
 *     responses:
 *       200:
 *         description: User blocked successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "User blocked successfully"
 *       400:
 *         description: User is already blocked
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Cannot block user with equal or higher role
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
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
 *     summary: Unblock a user
 *     description: |
 *       Unblock a previously blocked user account.
 *       Clears the blocked status, reason, and timestamp.
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
 *         description: User ID
 *     responses:
 *       200:
 *         description: User unblocked successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "User unblocked successfully"
 *       400:
 *         description: User is not blocked
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
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
 *     summary: Get audit log for a user
 *     description: |
 *       Get the audit log showing all actions performed on or by a user.
 *       
 *       **Access Control:**
 *       - Users can view their own audit log
 *       - Admins can view audit logs for users with lower roles
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
 *         description: User ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *           default: 50
 *         description: Maximum number of entries to return
 *     responses:
 *       200:
 *         description: User audit log
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuditLogResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
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
 *     summary: Generate password reset token
 *     description: |
 *       Generate a password reset token for a user (admin only).
 *       The token can be shared with the user to reset their password.
 *       
 *       **Token Details:**
 *       - Valid for 24 hours
 *       - Token is shown only once in response
 *       - A reset URL is also provided
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
 *         description: User ID
 *     responses:
 *       200:
 *         description: Reset token generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResetTokenResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post('/:id/reset-token', 
  authenticate, 
  canAccessUser({ allowSelf: false, allowAdmin: true }), 
  asyncHandler(usersController.generateResetToken)
);

/**
 * @swagger
 * /users/{id}/reset-password:
 *   post:
 *     summary: Reset user's password
 *     description: |
 *       Directly reset a user's password (admin only).
 *       Returns the new password for the admin to share securely with the user.
 *       
 *       **Options:**
 *       - Provide a specific password in the request body
 *       - Or leave empty to auto-generate a secure random password
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
 *         description: User ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordRequest'
 *           examples:
 *             autoGenerate:
 *               summary: Auto-generate password
 *               value: {}
 *             specific:
 *               summary: Set specific password
 *               value:
 *                 password: "NewTempPass123!"
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResetPasswordResponse'
 *       400:
 *         description: Password too short (if provided)
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post('/:id/reset-password', 
  authenticate, 
  canAccessUser({ allowSelf: false, allowAdmin: true }), 
  asyncHandler(usersController.resetUserPassword)
);

// =============================================================================
// ADMIN ROUTES - Password Reset Management
// =============================================================================

/**
 * @swagger
 * /users/admin/password-resets:
 *   get:
 *     summary: List pending password reset requests
 *     description: |
 *       Get a list of all pending password reset requests (admin only).
 *       Useful for monitoring and managing password reset activity.
 *     tags: [Admin - Password Resets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending password reset requests
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 resets:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PasswordResetRequest'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/admin/password-resets', 
  authenticate, 
  requireAdmin(), 
  asyncHandler(usersController.listPasswordResets)
);

module.exports = router;