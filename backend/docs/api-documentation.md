# API Documentation

## What it is

The template uses Swagger/OpenAPI 3.0 for automatic API documentation generation from JSDoc comments in route files. Interactive API documentation is available at `/api-docs` with a full Swagger UI interface.

## Where it lives (code map)

- **`backend/src/config/swagger.js`** - Swagger configuration, schema definitions
- **`backend/src/server.js`** - Swagger UI setup (`/api-docs` endpoint)
- **Route files** - JSDoc comments with `@swagger` tags (e.g., `routes/auth.js`, `routes/users.js`)

## How it works

### Documentation Generation

1. **JSDoc Comments**: Route files contain `@swagger` annotations
2. **swagger-jsdoc**: Scans route files for annotations
3. **OpenAPI Spec**: Generates OpenAPI 3.0 specification
4. **Swagger UI**: Serves interactive documentation at `/api-docs`

### Schema Definitions

Common schemas are defined in `swagger.js`:
- User, AuthResponse, Error, HealthCheck, etc.
- Referenced in route annotations via `$ref`

## How to use it

### Access Documentation

```
http://localhost:3000/api-docs
```

### API Specification (JSON)

```
http://localhost:3000/api-docs.json
```

### Example Route Documentation

```javascript
/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 */
router.post('/login', asyncHandler(authController.login));
```

## Configuration

### Swagger Config

Edit `backend/src/config/swagger.js`:

```javascript
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Your API Name',
      version: '1.0.0',
      description: 'API description'
    },
    servers: [
      {
        url: process.env.API_BASE_PATH || '/api/v1',
        description: 'API Server'
      }
    ]
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js']
};
```

## Extending / modifying

### Adding New Schemas

```javascript
// In swagger.js
schemas: {
  CustomSchema: {
    type: 'object',
    properties: {
      field1: { type: 'string' },
      field2: { type: 'integer' }
    }
  }
}
```

### Documenting New Routes

Add `@swagger` comments above route definitions:

```javascript
/**
 * @swagger
 * /custom/endpoint:
 *   get:
 *     summary: Custom endpoint
 *     tags: [Custom]
 *     responses:
 *       200:
 *         description: Success
 */
router.get('/custom/endpoint', handler);
```

## Troubleshooting

### Documentation not updating

- **Restart server**: Swagger spec is generated on startup
- **Check JSDoc syntax**: Ensure `@swagger` tags are correct
- **Check file paths**: Ensure route files are in `apis` array

### Schemas not appearing

- **Check $ref syntax**: Must match schema name exactly
- **Check schema definition**: Ensure schema is defined in `swagger.js`

## Related docs

- [Authentication](./authentication.md) - Auth endpoints
- [User Management](./user-management.md) - User endpoints
