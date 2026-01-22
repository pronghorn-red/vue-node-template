# Server Configuration

## What it is

The Express server is configured with comprehensive middleware for security, performance, and functionality. The server is designed to be resilient, starting even when some services (database, OAuth) are unavailable.

## Where it lives (code map)

- **`backend/src/server.js`** - Main server file with all middleware configuration
- **`backend/src/middleware/auth.js`** - Authentication middleware
- **`backend/src/middleware/logging.js`** - Request logging
- **`backend/src/middleware/errorHandler.js`** - Error handling

## How it works

### Middleware Stack

```
1. Helmet (security headers)
2. CORS
3. Compression
4. Rate Limiting
5. Body Parsing (JSON, URL-encoded)
6. Cookie Parser
7. Session (PostgreSQL or memory)
8. Passport (authentication)
9. Request Logging
10. API Routes
11. Static File Serving (production)
12. Error Handling
```

### Resilient Startup

The server starts even if:
- Database is not configured
- OAuth providers are not configured
- Some services fail to initialize

Logs indicate which services are available/unavailable.

## How to use it

### Environment Variables

```bash
# Server
PORT=3000
HOST=localhost
NODE_ENV=development

# API
API_BASE_PATH=/api/v1
FRONTEND_URL=http://localhost:5173

# Security
SESSION_SECRET=your_session_secret
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# CORS
FRONTEND_URL=http://localhost:5173

# Cookies
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
COOKIE_DOMAIN=
```

### Server Startup

```bash
# Development
npm run dev

# Production
npm start
```

Server logs show:
- Available authentication methods
- Database connection status
- LLM provider status
- WebSocket initialization
- API endpoints

## Configuration

### Security Middleware

**Helmet**: Security headers (CSP, HSTS, etc.)
- Disabled in development for easier debugging
- Configured for Vue.js in production

**CORS**: Cross-origin resource sharing
- Configured for `FRONTEND_URL`
- Credentials enabled for cookies

**Rate Limiting**: Request throttling
- Applied to all `/api/v1/*` routes
- Default: 100 requests per 15 minutes

### Session Management

**PostgreSQL Store** (if database configured):
- Persistent sessions across restarts
- Automatic table creation

**Memory Store** (if database not configured):
- Sessions lost on restart
- Suitable for development only

### Static File Serving

In production, serves `frontend/dist` with:
- Compression
- Caching headers
- SPA history fallback

## Extending / modifying

### Adding Middleware

```javascript
// In server.js, after existing middleware
app.use(customMiddleware);
```

### Custom Rate Limiting

```javascript
const customLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10
});

app.use('/api/v1/sensitive', customLimiter);
```

### Custom CORS

```javascript
app.use(cors({
  origin: ['http://localhost:5173', 'https://app.example.com'],
  credentials: true
}));
```

## Troubleshooting

### Server won't start

- **Check PORT**: Ensure port is not in use
- **Check environment**: Ensure `.env` file exists
- **Check logs**: Look for initialization errors

### CORS errors

- **Check FRONTEND_URL**: Must match frontend origin exactly
- **Check credentials**: Ensure `withCredentials: true` in frontend
- **Check headers**: Ensure allowed headers include Authorization

### Rate limiting too aggressive

- **Adjust limits**: Increase `RATE_LIMIT_MAX_REQUESTS`
- **Check window**: Adjust `RATE_LIMIT_WINDOW_MS`
- **Whitelist IPs**: Add IP whitelist to rate limiter

## Security considerations

1. **Secrets**: Never commit secrets to version control
2. **HTTPS**: Use HTTPS in production (`COOKIE_SECURE=true`)
3. **Rate Limiting**: Prevents abuse and DoS
4. **CORS**: Restrict to known origins
5. **Headers**: Helmet provides security headers

## Related docs

- [Authentication](./authentication.md) - Auth middleware
- [Error Handling](./error-handling-logging.md) - Error middleware
- [Database](./database.md) - Session store
