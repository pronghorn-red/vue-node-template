# Error Handling & Logging

## What it is

The template provides structured error handling with custom error classes and comprehensive logging using Winston with daily log rotation. All errors follow a consistent format, and all requests/responses are logged for monitoring and debugging.

## Where it lives (code map)

- **`backend/src/middleware/errorHandler.js`** - ApiError class, error middleware, async handler wrapper
- **`backend/src/utils/logger.js`** - Winston logger configuration, daily rotation, access logging
- **`backend/src/middleware/logging.js`** - Request/response logging middleware
- **`backend/src/server.js`** - Logger initialization, error middleware registration

## How it works

### Error Handling Flow

```
Route Handler → Throws ApiError → Error Middleware → Structured JSON Response
```

1. Controllers throw `ApiError` instances with status codes and messages
2. Error middleware catches all errors (including async errors via `asyncHandler`)
3. Errors are logged with appropriate log levels
4. Structured JSON response sent to client

### Logging Architecture

- **Console transport**: Development (colored) or Production (JSON)
- **File transports**: Daily rotation with retention policies
  - `combined-YYYY-MM-DD.log`: All logs
  - `error-YYYY-MM-DD.log`: Error-level logs only
  - `access-YYYY-MM-DD.log`: HTTP request logs
  - `exceptions-YYYY-MM-DD.log`: Uncaught exceptions
  - `rejections-YYYY-MM-DD.log`: Unhandled promise rejections

## How to use it

### Throwing Errors

```javascript
const { ApiError } = require('../middleware/errorHandler');

// Bad request
throw ApiError.badRequest('Email is required');

// Unauthorized
throw ApiError.unauthorized('Invalid token');

// Forbidden
throw ApiError.forbidden('Insufficient permissions');

// Not found
throw ApiError.notFound('User not found');

// Conflict
throw ApiError.conflict('Email already exists');

// With details
throw ApiError.badRequest('Validation failed', {
  fields: { email: 'Invalid format' }
});
```

### Async Route Handlers

```javascript
const { asyncHandler } = require('../middleware/errorHandler');

router.get('/users/:id', asyncHandler(async (req, res) => {
  const user = await getUser(req.params.id);
  if (!user) {
    throw ApiError.notFound('User not found');
  }
  res.json({ success: true, user });
}));
```

### Logging

```javascript
const logger = require('../utils/logger');

// Info
logger.info('User created', { userId: user.id, email: user.email });

// Warning
logger.warn('Rate limit approaching', { userId: user.id });

// Error
logger.error('Database query failed', { 
  error: error.message, 
  query: 'SELECT * FROM users' 
});

// Debug (only in development)
logger.debug('Cache hit', { key: 'user:123' });
```

### Request Logging

Request logging is automatic via middleware. Each request logs:
- Method, URL, IP, User-Agent
- Response status, duration
- User ID (if authenticated)
- Request ID for correlation

## Configuration

### Environment Variables

```bash
# Log level (error, warn, info, debug)
LOG_LEVEL=info

# Log directory
LOG_DIR=./logs

# Log file settings (configured in logger.js)
# - Max size: 20MB (combined, error, exceptions, rejections)
# - Max size: 50MB (access)
# - Retention: 14 days (combined), 30 days (error, exceptions, rejections), 7 days (access)
```

### Log Format

**Development (Console)**:
```
10:30:45 INFO: User created {"userId":"123","email":"user@example.com"}
```

**Production (JSON)**:
```json
{
  "timestamp": "2024-06-25 10:30:45.123",
  "level": "info",
  "message": "User created",
  "userId": "123",
  "email": "user@example.com",
  "service": "Pronghorn"
}
```

## Extending / modifying

### Custom Error Types

```javascript
class CustomError extends ApiError {
  constructor(message, customField) {
    super(400, message, 'CUSTOM_ERROR');
    this.customField = customField;
  }
}

// Usage
throw new CustomError('Custom error', 'customValue');
```

### Custom Log Transports

```javascript
const { createLogger } = require('winston');
const SlackTransport = require('winston-slack-webhook-transport');

const logger = createLogger({
  transports: [
    // ... existing transports
    new SlackTransport({
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
      level: 'error'
    })
  ]
});
```

### Skip Logging for Specific Paths

```javascript
const { skipPaths } = require('../middleware/logging');

app.use(skipPaths(['/health', '/metrics']), requestLogger);
```

## Troubleshooting

### Logs not appearing

- **Check LOG_DIR**: Ensure directory exists and is writable
- **Check LOG_LEVEL**: Set to 'debug' to see all logs
- **Check file permissions**: Ensure process can write to log directory
- **Check disk space**: Log rotation may fail if disk is full

### Error responses not formatted correctly

- **Check error middleware order**: Must be after routes, before 404 handler
- **Check asyncHandler**: Wrap async route handlers
- **Check error type**: Use ApiError for consistent formatting

### Log files growing too large

- **Check rotation settings**: Max size and retention in `logger.js`
- **Check log level**: Lower levels (debug) generate more logs
- **Check access logs**: May be large in high-traffic scenarios

## Security considerations

1. **Sensitive Data**:
   - Never log passwords, tokens, or secrets
   - Sanitize user input in logs
   - Use log levels appropriately (debug for sensitive info)

2. **Log Retention**:
   - Rotate logs regularly
   - Archive old logs securely
   - Comply with data retention policies

3. **Error Messages**:
   - Don't expose stack traces in production
   - Don't expose internal error details to clients
   - Use generic messages for security-related errors

## Related docs

- [Server Configuration](./server-configuration.md) - Middleware setup
- [Authentication](./authentication.md) - Auth error handling
