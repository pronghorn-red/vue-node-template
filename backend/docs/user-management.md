# User Management

## What it is

The user management system provides comprehensive user administration capabilities including CRUD operations, role management, user blocking, password reset administration, and audit logging. It implements a role hierarchy system where admins can only manage users with lower roles than their own.

## Where it lives (code map)

- **`backend/src/controllers/usersController.js`** - User CRUD, role management, blocking, password reset, audit logging
- **`backend/src/routes/users.js`** - User management route definitions with Swagger documentation
- **`backend/src/middleware/auth.js`** - Role hierarchy, permission checks, `canAccessUser` middleware
- **`backend/src/database/migrate.js`** - User schema, audit log table, blocking fields, role functions

## How it works

### Role Hierarchy

The system uses a three-tier role hierarchy:

- **superadmin** (level 100): Full system access, can modify any role
- **admin** (level 50): User management access, can modify user roles only
- **user** (level 10): Standard access, self-management only

**Permission Rules**:
- Users can only modify users with **lower** role levels
- Users cannot modify their own role
- Superadmins cannot delete their own accounts
- Admins cannot see or modify superadmins (unless they are superadmin)

### Access Control

The `canAccessUser` middleware enforces access rules:

```javascript
// Users can access their own profile
canAccessUser({ allowSelf: true })

// Admins can access users with lower roles
canAccessUser({ allowSelf: false, allowAdmin: true })

// Users can view their own audit log
canAccessUser({ allowSelf: true, allowAdmin: true })
```

### Audit Logging

All user-related actions are logged to `user_audit_log` table:

- User creation, updates, deletion
- Role changes
- Account blocking/unblocking
- Password changes
- Profile updates

Each log entry includes:
- User ID (target user)
- Actor ID (who performed the action)
- Action type
- Details (JSONB)
- IP address and user agent
- Timestamp

## How to use it

### Profile Management (Self)

**Get own profile**:
```javascript
GET /api/v1/users/profile
Authorization: Bearer <token>

Response:
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "display_name": "John Doe",
    "role": "user",
    ...
  }
}
```

**Update own profile**:
```javascript
PUT /api/v1/users/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "display_name": "Jane Doe",
  "avatar_url": "https://example.com/avatar.jpg",
  "language_preference": "fr"
}
```

**Change password**:
```javascript
PUT /api/v1/users/password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass456!",
  "confirmPassword": "NewPass456!"
}
```

**Delete own account**:
```javascript
DELETE /api/v1/users/me
Authorization: Bearer <token>

// Note: Superadmins cannot delete their own accounts
```

### User Management (Admin)

**List users**:
```javascript
GET /api/v1/users?page=1&limit=20&search=john&role=user&blocked=false&sortBy=created_at&sortOrder=desc
Authorization: Bearer <admin_token>

Response:
{
  "success": true,
  "users": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

**Create user**:
```javascript
POST /api/v1/users
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "email": "newuser@example.com",
  "display_name": "New User",
  "password": "TempPass123!",  // Optional - auto-generated if not provided
  "role": "user",
  "language_preference": "en",
  "email_verified": false
}

Response:
{
  "success": true,
  "message": "User created successfully. Please share the temporary password securely with the user.",
  "user": {...},
  "temporaryPassword": "xK9#mP2$vL5@nQ8"  // Only if auto-generated
}
```

**Get user**:
```javascript
GET /api/v1/users/{id}
Authorization: Bearer <admin_token>
```

**Update user**:
```javascript
PUT /api/v1/users/{id}
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "display_name": "Updated Name",
  "avatar_url": "https://example.com/new-avatar.jpg",
  "language_preference": "fr",
  "email_verified": true
}
```

**Update user role**:
```javascript
PUT /api/v1/users/{id}/role
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "role": "admin",
  "additional_roles": ["moderator", "reviewer"]
}

// Note: Cannot assign role equal to or higher than your own
```

**Block user**:
```javascript
POST /api/v1/users/{id}/block
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "reason": "Violation of terms of service"
}
```

**Unblock user**:
```javascript
POST /api/v1/users/{id}/unblock
Authorization: Bearer <admin_token>
```

**Delete user**:
```javascript
DELETE /api/v1/users/{id}
Authorization: Bearer <admin_token>

// Note: Cannot delete yourself or users with equal/higher roles
```

### Password Reset Management (Admin)

**Generate reset token**:
```javascript
POST /api/v1/users/{id}/reset-token
Authorization: Bearer <admin_token>

Response:
{
  "success": true,
  "message": "Password reset token generated",
  "resetToken": "a1b2c3d4e5f6...",
  "expiresAt": "2024-06-26T09:00:00Z",
  "resetUrl": "https://app.example.com/auth/reset?token=..."
}
```

**Reset user password**:
```javascript
POST /api/v1/users/{id}/reset-password
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "password": "NewTempPass123!"  // Optional - auto-generated if not provided
}

Response:
{
  "success": true,
  "message": "Password has been reset. Please share the new password securely with the user.",
  "temporaryPassword": "xK9#mP2$vL5@nQ8",
  "userId": "uuid",
  "email": "user@example.com"
}
```

**List pending password resets**:
```javascript
GET /api/v1/users/admin/password-resets
Authorization: Bearer <admin_token>

Response:
{
  "success": true,
  "resets": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "email": "user@example.com",
      "requested_at": "2024-06-25T10:00:00Z",
      "expires_at": "2024-06-26T10:00:00Z",
      "status": "pending"
    }
  ]
}
```

### Audit Log

**Get user audit log**:
```javascript
GET /api/v1/users/{id}/audit?limit=50
Authorization: Bearer <admin_token>

Response:
{
  "success": true,
  "audit_log": [
    {
      "id": "uuid",
      "action": "role_changed",
      "details": {
        "previousRole": "user",
        "newRole": "admin"
      },
      "actor_email": "admin@example.com",
      "created_at": "2024-06-25T10:00:00Z"
    }
  ]
}
```

## Configuration

### Role Configuration

Roles are defined in `backend/src/middleware/auth.js`:

```javascript
const ROLE_LEVELS = {
  superadmin: 100,
  admin: 50,
  user: 10
};

const VALID_ROLES = ['superadmin', 'admin', 'user'];
```

### Database Functions

The migration creates helper functions:

- **`get_role_level(role_name)`**: Returns hierarchy level for a role
- **`can_modify_user_role(actor_role, target_current_role, target_new_role)`**: Checks if role modification is allowed
- **`is_valid_role(role_name)`**: Validates role name
- **`log_user_action(...)`**: Logs actions to audit table

### Default User Roles

New users are created with `role = 'user'` by default. Admins can change roles after creation.

## Extending / modifying

### Adding Custom Roles

1. Update `VALID_ROLES` in `backend/src/middleware/auth.js`:
   ```javascript
   const VALID_ROLES = ['superadmin', 'admin', 'user', 'moderator', 'reviewer'];
   ```

2. Update `ROLE_LEVELS`:
   ```javascript
   const ROLE_LEVELS = {
     superadmin: 100,
     admin: 50,
     moderator: 30,
     reviewer: 20,
     user: 10
   };
   ```

3. Update database function in migration:
   ```sql
   CREATE OR REPLACE FUNCTION get_role_level(role_name VARCHAR)
   RETURNS INTEGER AS $$
   BEGIN
     RETURN CASE role_name
       WHEN 'superadmin' THEN 100
       WHEN 'admin' THEN 50
       WHEN 'moderator' THEN 30
       WHEN 'reviewer' THEN 20
       WHEN 'user' THEN 10
       ELSE 0
     END;
   END;
   $$ LANGUAGE plpgsql IMMUTABLE;
   ```

4. Run migration:
   ```bash
   node backend/src/database/migrate.js
   ```

### Custom User Fields

1. Add column in migration:
   ```sql
   ALTER TABLE users 
   ADD COLUMN IF NOT EXISTS custom_field VARCHAR(255);
   ```

2. Update `formatUserResponse` in `usersController.js`:
   ```javascript
   const formatUserResponse = (user) => ({
     // ... existing fields
     custom_field: user.custom_field
   });
   ```

3. Update validation in controller methods

### Custom Audit Actions

Add custom action logging:

```javascript
await logUserAction({
  userId: targetUser.id,
  actorId: req.user.id,
  action: 'custom_action',
  details: { customData: 'value' },
  req
});
```

## Troubleshooting

### "Cannot modify user with equal or higher role" errors

- **Check role hierarchy**: Ensure actor has higher role level than target
- **Check self-modification**: Cannot modify own role
- **Check role assignment**: Cannot assign role equal to or higher than your own

### User not found errors

- **Check user ID**: Ensure UUID format is correct
- **Check access**: Admins can only see users with lower roles
- **Check database**: Ensure user exists in database

### Password reset not working

- **Check token expiration**: Reset tokens expire after 1 hour (user-initiated) or 24 hours (admin-generated)
- **Check token usage**: Tokens can only be used once
- **Check OAuth accounts**: Password reset disabled for OAuth-only accounts

### Audit log not showing

- **Check database**: Ensure `user_audit_log` table exists
- **Check permissions**: Ensure database user has INSERT permissions
- **Check action name**: Use consistent action names for filtering

## Security considerations

1. **Role Hierarchy Enforcement**:
   - Always check role levels before allowing modifications
   - Use `canModifyUserRole()` helper function
   - Never trust client-provided role values

2. **Self-Modification Restrictions**:
   - Users cannot modify their own role
   - Superadmins cannot delete their own accounts
   - Users cannot block themselves

3. **Password Security**:
   - Admin-generated passwords are shown only once
   - Passwords are hashed with bcrypt (12 rounds)
   - Reset tokens are hashed before storage

4. **Audit Logging**:
   - All sensitive actions are logged
   - Includes IP address and user agent
   - Cannot be modified or deleted by users

5. **Input Validation**:
   - Email format validation
   - Display name length limits (2-100 characters)
   - Avatar URL validation (must be HTTP/HTTPS)
   - Role validation against VALID_ROLES

## Related docs

- [Authentication](./authentication.md) - User authentication
- [Database](./database.md) - User table schema
- [Error Handling](./error-handling-logging.md) - Error responses
