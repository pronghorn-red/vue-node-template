# API Client

## What it is

The API client provides an Axios instance with automatic token refresh, request/response interceptors, error handling, and cookie support for httpOnly refresh tokens.

## Where it lives (code map)

- **`frontend/src/services/api.js`** - Axios instance with interceptors

## How it works

### Request Interceptor

- Reads access token from `sessionStorage`
- Adds `Authorization: Bearer <token>` header
- Sends cookies for refresh token

### Response Interceptor

- Catches 401 Unauthorized responses
- Automatically calls `/auth/refresh` with httpOnly cookie
- Retries original request with new token
- Queues multiple requests during refresh

### Token Refresh Flow

```
Request → 401 → Refresh Token → New Access Token → Retry Request
```

## How to use it

### Basic Usage

```javascript
import api from '@/services/api'

// GET request
const response = await api.get('/users/profile')
console.log(response.data)

// POST request
const response = await api.post('/users', {
  email: 'user@example.com',
  display_name: 'John Doe'
})

// PUT request
const response = await api.put('/users/profile', {
  display_name: 'Jane Doe'
})

// DELETE request
await api.delete('/users/123')
```

### With Query Parameters

```javascript
const response = await api.get('/users', {
  params: {
    page: 1,
    limit: 20,
    search: 'john'
  }
})
```

### Error Handling

```javascript
try {
  const response = await api.get('/users/123')
} catch (error) {
  if (error.response?.status === 404) {
    console.log('User not found')
  } else if (error.response?.status === 401) {
    // Token refresh handled automatically
    // If refresh fails, user is redirected to login
  }
}
```

## Configuration

### Environment Variables

```bash
VITE_API_BASE_URL=/api/v1
```

### Axios Configuration

Edit `frontend/src/services/api.js`:

```javascript
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true  // Required for httpOnly cookies
})
```

## Extending / modifying

### Custom Interceptors

```javascript
// Request interceptor
api.interceptors.request.use((config) => {
  // Add custom header
  config.headers['X-Custom-Header'] = 'value'
  return config
})

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Custom error handling
    return Promise.reject(error)
  }
)
```

### Custom Error Handling

```javascript
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 403) {
      // Handle forbidden
      router.push('/unauthorized')
    }
    return Promise.reject(error)
  }
)
```

## Troubleshooting

### Token refresh not working

- **Check cookies**: Ensure `withCredentials: true` is set
- **Check CORS**: Ensure server allows credentials
- **Check refresh endpoint**: Ensure `/auth/refresh` is accessible

### Requests failing

- **Check base URL**: Ensure `VITE_API_BASE_URL` is correct
- **Check network**: Ensure API server is running
- **Check CORS**: Ensure server allows frontend origin

## Security considerations

1. **Token Storage**: Access tokens in sessionStorage (not localStorage)
2. **Refresh Tokens**: Never accessible to JavaScript (httpOnly cookies)
3. **Automatic Refresh**: Prevents token exposure in error messages

## Related docs

- [Authentication](./authentication.md) - Token management
- [User Management](./user-management.md) - User API usage
