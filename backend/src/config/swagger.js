/**
 * @fileoverview Swagger/OpenAPI Configuration
 * @description Configures swagger-jsdoc for automatic API documentation generation
 * from JSDoc comments in route files.
 * @module config/swagger
 */

const swaggerJsdoc = require('swagger-jsdoc');

/**
 * Swagger definition options
 * @type {Object}
 */
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Pronghorn API',
      version: process.env.APP_VERSION || '2.0.0',
      description: `
## Pronghorn Vue/Node/Postgres Monorepo API

A production-ready API server with the following features:

- **Authentication**: Local (username/password), Google OAuth 2.0, Microsoft Entra ID SSO
- **Authorization**: JWT-based with cookie support and token refresh
- **Database**: PostgreSQL with connection pooling
- **WebSocket**: Real-time LLM interactions (OpenAI, Anthropic Claude, Google Gemini)
- **Logging**: Winston with daily rotation
- **Security**: Helmet, CORS, rate limiting

### Authentication Flow

1. **Local Auth**: POST to \`/auth/login\` with email/password
2. **Google SSO**: Redirect to \`/auth/google\`
3. **Microsoft SSO**: Redirect to \`/auth/microsoft\`

All authenticated endpoints require a valid JWT token in the Authorization header or session cookie.
      `,
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.API_BASE_PATH || '/api/v1',
        description: 'API Server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token'
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'pronghorn.sid',
          description: 'Session cookie authentication'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'User unique identifier'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            display_name: {
              type: 'string',
              description: 'User display name'
            },
            oauth_provider: {
              type: 'string',
              enum: ['local', 'google', 'microsoft'],
              description: 'Authentication provider'
            },
            email_verified: {
              type: 'boolean',
              description: 'Whether email is verified'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp'
            },
            last_login: {
              type: 'string',
              format: 'date-time',
              description: 'Last login timestamp'
            }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com'
            },
            password: {
              type: 'string',
              format: 'password',
              minLength: 8,
              example: 'securePassword123'
            }
          }
        },
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password', 'display_name'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com'
            },
            password: {
              type: 'string',
              format: 'password',
              minLength: 8,
              example: 'securePassword123'
            },
            display_name: {
              type: 'string',
              minLength: 2,
              maxLength: 100,
              example: 'John Doe'
            }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Login successful'
            },
            user: {
              $ref: '#/components/schemas/User'
            },
            token: {
              type: 'string',
              description: 'JWT access token'
            },
            refreshToken: {
              type: 'string',
              description: 'JWT refresh token'
            }
          }
        },
        LLMRequest: {
          type: 'object',
          required: ['message'],
          properties: {
            message: {
              type: 'string',
              description: 'User message to send to LLM',
              example: 'Hello, how are you?'
            },
            provider: {
              type: 'string',
              enum: ['openai', 'anthropic', 'google'],
              default: 'openai',
              description: 'LLM provider to use'
            },
            model: {
              type: 'string',
              description: 'Specific model to use',
              example: 'gpt-4o'
            },
            stream: {
              type: 'boolean',
              default: false,
              description: 'Whether to stream the response'
            }
          }
        },
        LLMResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            provider: {
              type: 'string',
              example: 'openai'
            },
            model: {
              type: 'string',
              example: 'gpt-4o'
            },
            response: {
              type: 'string',
              description: 'LLM response text'
            },
            usage: {
              type: 'object',
              properties: {
                prompt_tokens: { type: 'integer' },
                completion_tokens: { type: 'integer' },
                total_tokens: { type: 'integer' }
              }
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              description: 'Error message'
            },
            code: {
              type: 'string',
              description: 'Error code'
            }
          }
        },
        HealthCheck: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'degraded', 'unhealthy'],
              example: 'healthy'
            },
            timestamp: {
              type: 'string',
              format: 'date-time'
            },
            version: {
              type: 'string',
              example: '2.0.0'
            },
            uptime: {
              type: 'number',
              description: 'Server uptime in seconds'
            },
            database: {
              type: 'object',
              properties: {
                connected: { type: 'boolean' },
                poolStats: {
                  type: 'object',
                  properties: {
                    totalCount: { type: 'integer' },
                    idleCount: { type: 'integer' },
                    waitingCount: { type: 'integer' }
                  }
                }
              }
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Access token is missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Health',
        description: 'Health check and status endpoints'
      },
      {
        name: 'Authentication',
        description: 'User authentication and authorization'
      },
      {
        name: 'Users',
        description: 'User management endpoints'
      },
      {
        name: 'LLM',
        description: 'Large Language Model interactions'
      }
    ]
  },
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js'
  ]
};

/**
 * Generated Swagger specification
 * @type {Object}
 */
const swaggerSpec = swaggerJsdoc(swaggerOptions);

module.exports = swaggerSpec;
