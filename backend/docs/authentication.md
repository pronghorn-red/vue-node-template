# Authentication

## What it is

The template provides a comprehensive authentication system supporting multiple authentication methods: local email/password, Google OAuth 2.0, and Microsoft Entra ID (Azure AD) SSO. Authentication uses JWT tokens with a dual-token strategy: short-lived access tokens and long-lived refresh tokens stored in httpOnly cookies for security.

## Where it lives (code map)

- **`backend/src/controllers/authController.js`** - Business logic for registration, login, logout, token refresh, OAuth callbacks, and password reset
- **`backend/src/config/passport.js`** - Passport.js strategy configuration (Local, Google, Microsoft)
- **`backend/src/middleware/auth.js`** - JWT token generation/verification, role-based access control, authentication middleware
- **`backend/src/routes/auth.js`** - Authentication route definitions
- **`backend/src/database/migrate.js`** - User table schema, password reset fields, OAuth fields

## How it works

### Authentication Flow

1. **Local Authentication**:
   ```
   Client → POST /api/v1/auth/login { email, password }
   Server → Validates credentials → Generates JWT tokens
   Server → Sets httpOnly refresh token cookie
   Server → Returns access token in response body
   Client → Stores access token in sessionStorage
   ```

2. **OAuth Flow (Google/Microsoft)**:
   ```
   Client → GET /api/v1/auth/google (or /microsoft)
   Server → Redirects to OAuth provider
   Provider → User authenticates → Redirects back with code
   Server → Exchanges code for user info → Creates/links account
   Server → Generates tokens → Redirects to frontend with access token
   Client → Stores access token in sessionStorage
   ```

3. **Token Refresh**:
   ```
   Client → POST /api/v1/auth/refresh (with httpOnly cookie)
   Server → Validates refresh token → Generates new tokens
   Server → Sets new httpOnly refresh token cookie
   Server → Returns new access token in response body
   ```

### Token Strategy

- **Access Token**: 
  - Stored in `sessionStorage` (frontend) or sent in `Authorization: Bearer <token>` header
  - Short-lived (default: 15 minutes, configurable via `JWT_EXPIRES_IN`)
  - Contains user ID, email, display name, role, additional roles

- **Refresh Token**:
  - Stored ONLY in httpOnly cookie (never accessible to JavaScript)
  - Long-lived (default: 7 days, configurable via `JWT_REFRESH_EXPIRES_IN`)
  - Used to obtain new access tokens without re-authentication

### Role Hierarchy

The template implements a three-tier role system:

- **superadmin** (level 100): Full system access, can modify any role
- **admin** (level 50): User management access, can modify user roles only
- **user** (level 10): Standard access, self-management only

Role checks use hierarchy: a user with a higher level can access/modify users with lower levels.

## How to use it

### Register a new user

```javascript
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "display_name": "John Doe"
}

Response:
{
  "success": true,
  "message": "Registration successful",
  "user": { ... },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Login

```javascript
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

Response:
{
  "success": true,
  "message": "Login successful",
  "user": { ... },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Refresh token

```javascript
POST /api/v1/auth/refresh
// Refresh token automatically sent via httpOnly cookie

Response:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Get current user

```javascript
GET /api/v1/auth/me
Authorization: Bearer <access_token>

Response:
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "display_name": "John Doe",
    "role": "user",
    "additional_roles": [],
    ...
  }
}
```

### OAuth Login

**Google**:
```javascript
// Redirect user to:
GET /api/v1/auth/google

// After OAuth, user is redirected to:
// /auth/callback?token=<access_token>
```

**Microsoft**:
```javascript
// Redirect user to:
GET /api/v1/auth/microsoft

// After OAuth, user is redirected to:
// /auth/callback?token=<access_token>
```

### Password Reset

**Request reset**:
```javascript
POST /api/v1/auth/password-reset/request
Content-Type: application/json

{
  "email": "user@example.com"
}

Response:
{
  "success": true,
  "message": "If an account exists with this email, a password reset link has been sent"
}
```

**Reset password**:
```javascript
POST /api/v1/auth/password-reset/confirm
Content-Type: application/json

{
  "resetToken": "<token-from-email>",
  "newPassword": "NewSecurePass123!",
  "confirmPassword": "NewSecurePass123!"
}
```

## Configuration

### Required Environment Variables

```bash
# JWT Secrets (required for token generation)
JWT_SECRET=your_secure_secret_here_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_here_min_32_chars

# Token Expiration (optional, defaults shown)
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Session Configuration (optional)
SESSION_SECRET=your_session_secret_here
SESSION_MAX_AGE=86400000  # 24 hours in ms
COOKIE_SECURE=true        # Use HTTPS cookies in production
COOKIE_SAME_SITE=lax      # CSRF protection
COOKIE_DOMAIN=            # Optional domain for cookies
```

### OAuth Configuration

**Google OAuth**:
```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=/api/v1/auth/google/callback
```

**Microsoft SSO**:
```bash
MICROSOFT_CLIENT_ID=your_azure_app_client_id
MICROSOFT_CLIENT_SECRET=your_azure_app_secret
MICROSOFT_TENANT_ID=common  # or specific tenant ID
MICROSOFT_REDIRECT_URI=/api/v1/auth/microsoft/callback
```

### Database Requirements

Authentication requires a PostgreSQL database with the `users` table. The migration creates:

- User accounts with email/password or OAuth provider
- Password reset token fields
- OAuth provider linking
- Role and additional roles fields
- Account blocking fields

Run migrations:
```bash
node backend/src/database/migrate.js
```

## Extending / modifying

### Adding a new OAuth provider

1. Install the provider's Passport strategy:
   ```bash
   npm install passport-github2  # Example for GitHub
   ```

2. Add configuration in `backend/src/config/passport.js`:
   ```javascript
   const GitHubStrategy = require('passport-github2').Strategy;
   
   if (isValidConfig(process.env.GITHUB_CLIENT_ID)) {
     passport.use(new GitHubStrategy({
       clientID: process.env.GITHUB_CLIENT_ID,
       clientSecret: process.env.GITHUB_CLIENT_SECRET,
       callbackURL: '/api/v1/auth/github/callback'
     }, async (accessToken, refreshToken, profile, done) => {
       const user = await findOrCreateOAuthUser('github', profile);
       return done(null, user);
     }));
   }
   ```

3. Add routes in `backend/src/routes/auth.js`:
   ```javascript
   router.get('/github', authController.githubAuth);
   router.get('/github/callback', 
     passport.authenticate('github', { session: false }),
     authController.githubCallback
   );
   ```

4. Add controller methods in `backend/src/controllers/authController.js`

### Customizing token payload

Edit `backend/src/middleware/auth.js`:
```javascript
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      role: user.role || 'user',
      additional_roles: user.additional_roles || [],
      // Add custom claims here
      customField: user.custom_field
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
};
```

### Adding custom roles

1. Update `VALID_ROLES` in `backend/src/middleware/auth.js`
2. Update `ROLE_LEVELS` to assign hierarchy levels
3. Update database migration if needed
4. Update frontend role display logic in `frontend/src/composables/useUsers.js`

## Troubleshooting

### "Invalid token" errors

- **Check JWT_SECRET**: Must be set and consistent across restarts
- **Check token expiration**: Access tokens expire after 15 minutes by default
- **Check token format**: Should be `Bearer <token>` in Authorization header
- **Check refresh token**: If refresh fails, user must log in again

### OAuth not working

- **Check environment variables**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, etc.
- **Check redirect URIs**: Must match exactly in OAuth provider console
- **Check database**: OAuth requires database for user storage
- **Check logs**: Look for OAuth errors in server logs

### Password reset not working

- **Check email sending**: Currently logs reset tokens in development (see `authController.js`)
- **Check token expiration**: Reset tokens expire after 1 hour
- **Check database**: Ensure `reset_token` fields exist in users table
- **Check OAuth accounts**: Password reset is disabled for OAuth-only accounts

### Session not persisting

- **Check cookies**: Ensure `withCredentials: true` in API requests
- **Check CORS**: Frontend URL must match `FRONTEND_URL` environment variable
- **Check cookie settings**: `COOKIE_SECURE` should be `true` in production (HTTPS only)
- **Check session store**: If database not configured, sessions are in-memory (lost on restart)

## Security considerations

1. **Token Storage**:
   - Access tokens in `sessionStorage` (cleared on tab close)
   - Refresh tokens in httpOnly cookies (not accessible to JavaScript)
   - Never expose refresh tokens in response bodies

2. **Token Rotation**:
   - Refresh tokens are rotated on each refresh (new token issued, old one invalidated)
   - Prevents token reuse if compromised

3. **Password Security**:
   - Passwords hashed with bcrypt (12 rounds)
   - Minimum 8 characters required
   - Password reset tokens hashed before storage

4. **OAuth Security**:
   - State parameter validation (can be added)
   - Account linking: OAuth accounts linked to existing email accounts
   - Email verification status tracked

5. **Role-Based Access**:
   - Role hierarchy enforced: cannot modify users with equal or higher roles
   - Self-modification restrictions: cannot modify own role
   - Blocked users cannot authenticate

6. **Rate Limiting**:
   - Applied to all `/api/v1/*` routes (see `server.js`)
   - Default: 100 requests per 15 minutes per IP

## Related docs

- [WebSocket Authentication](../docs/websockets.md#authentication) - WebSocket token validation
- [User Management](./user-management.md) - Admin user operations
- [Database](./database.md) - User table schema
- [Server Configuration](./server-configuration.md) - Middleware setup
