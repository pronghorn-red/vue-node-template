# Authentication (Frontend)

## What it is

The frontend authentication system manages user authentication state, JWT token storage, session recovery, and integration with the WebSocket connection. It provides a composable (`useAuth`) that handles login, registration, OAuth callbacks, token refresh, and logout.

## Where it lives (code map)

- **`frontend/src/composables/useAuth.js`** - Main authentication composable with token management
- **`frontend/src/services/api.js`** - Axios instance with automatic token refresh interceptors
- **`frontend/src/router/index.js`** - Route guards for protected routes
- **`frontend/src/views/AuthView.vue`** - Login/register UI
- **`frontend/src/views/AuthCallbackView.vue`** - OAuth callback handler

## How it works

### Token Storage Strategy

- **Access Token**: Stored in `sessionStorage` (accessible to JavaScript for API requests)
- **Refresh Token**: Stored in httpOnly cookie (never accessible to JavaScript, handled by browser)

### Authentication Flow

1. **Login/Register**:
   ```
   User submits credentials → API call → Server returns access token
   → Store in sessionStorage → Trigger WebSocket connect
   ```

2. **Session Recovery**:
   ```
   App startup → Check sessionStorage → If empty, check httpOnly cookie
   → Call /auth/refresh → Get new access token → Store in sessionStorage
   ```

3. **Token Refresh**:
   ```
   API request → 401 response → Interceptor catches → Call /auth/refresh
   → Get new token → Retry original request → Update sessionStorage
   ```

### Route Guards

Routes can be protected with:
- `meta: { requiresAuth: true }` - Requires authentication
- `meta: { requiresAdmin: true }` - Requires admin role
- `meta: { guest: true }` - Only for unauthenticated users

## How to use it

### Basic Usage

```javascript
import { useAuth } from '@/composables/useAuth'

const {
  user,
  isAuthenticated,
  loading,
  error,
  signIn,
  signUp,
  signOut
} = useAuth()

// Login
const success = await signIn('user@example.com', 'password123')

// Register
const success = await signUp('John', 'Doe', 'user@example.com', 'password123')

// Logout
await signOut()

// Check auth status
if (isAuthenticated.value) {
  console.log('User:', user.value)
}
```

### OAuth Login

```javascript
const { signInWithSSO, handleOAuthCallback, getOAuthRedirect } = useAuth()

// Initiate OAuth
signInWithSSO('google')  // or 'microsoft'

// Handle callback (in AuthCallbackView.vue)
const token = route.query.token
await handleOAuthCallback(token)
const redirect = getOAuthRedirect()
router.push(redirect)
```

### Token Management

```javascript
const { 
  getToken, 
  isTokenExpired, 
  refreshAccessToken 
} = useAuth()

// Get current token
const token = getToken()

// Check if expired
if (isTokenExpired()) {
  await refreshAccessToken()
}

// Manual refresh
await refreshAccessToken()
```

### Session Recovery

```javascript
const { initializeAuth, waitForInit } = useAuth()

// Initialize on app startup
await initializeAuth()

// Or wait for initialization
await waitForInit()
if (isAuthenticated.value) {
  // User is logged in
}
```

## Configuration

### Environment Variables

```bash
# API Base URL
VITE_API_BASE_URL=/api/v1

# WebSocket URL
VITE_WS_URL=ws://localhost:3000
```

### Route Configuration

Edit `frontend/src/router/index.js`:

```javascript
{
  path: '/protected',
  component: () => import('../views/ProtectedView.vue'),
  meta: { requiresAuth: true }
}

{
  path: '/admin',
  component: () => import('../views/AdminView.vue'),
  meta: { requiresAuth: true, requiresAdmin: true }
}
```

## Extending / modifying

### Custom Auth State

```javascript
// In useAuth.js
const customField = ref(null)

const setCustomField = (value) => {
  customField.value = value
  sessionStorage.setItem('customField', value)
}

return {
  // ... existing exports
  customField,
  setCustomField
}
```

### Custom Route Guards

```javascript
// In router/index.js
router.beforeEach((to, from, next) => {
  const { isAuthenticated, user } = getAuthState()
  
  // Custom logic
  if (to.meta.requiresCustomPermission) {
    if (!user.value?.customPermission) {
      return next({ name: 'unauthorized' })
    }
  }
  
  next()
})
```

## Troubleshooting

### Token not persisting

- **Check sessionStorage**: Ensure browser allows sessionStorage
- **Check token refresh**: Token may have expired, check refresh logic
- **Check API interceptor**: Ensure interceptor is handling 401s

### OAuth callback not working

- **Check redirect URL**: Must match OAuth provider configuration
- **Check token in URL**: Ensure token is passed in query parameter
- **Check callback handler**: Ensure `handleOAuthCallback` is called

### Route guard redirects incorrectly

- **Check auth state**: Ensure `isAuthenticated` is updated after login
- **Check role**: Ensure user role is loaded from `/auth/me`
- **Check redirect logic**: Ensure `redirectAfterLogin` is handled

## Security considerations

1. **Token Storage**: Access tokens in sessionStorage (cleared on tab close)
2. **Refresh Tokens**: Never accessible to JavaScript (httpOnly cookies)
3. **Token Refresh**: Automatic refresh on 401 prevents token exposure
4. **Route Guards**: Client-side protection (server-side also required)

## Related docs

- [WebSocket](./websocket.md) - WebSocket authentication
- [API Client](./api-client.md) - Token refresh interceptors
- [Routing](./routing.md) - Route guards
