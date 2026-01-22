# Backend Documentation

This directory contains feature documentation for the backend template. Each document covers a specific feature or system component.

## Available Documentation

### Core Features

- **[Authentication](./authentication.md)** - JWT authentication, OAuth (Google, Microsoft), password reset, token management
- **[Database](./database.md)** - PostgreSQL connection, migrations, seeding, query helpers, transactions
- **[WebSockets](./websockets.md)** - Real-time communication, LLM streaming, connection management
- **[LLM Service](./llm-service.md)** - Multi-provider LLM integration (OpenAI, Anthropic, Google, xAI, Groq), SSE streaming

### User & Admin Features

- **[User Management](./user-management.md)** - User CRUD, role management, blocking, audit logging, password reset administration

### Infrastructure

- **[Error Handling & Logging](./error-handling-logging.md)** - Structured error responses, Winston logging, daily rotation
- **[API Documentation](./api-documentation.md)** - Swagger/OpenAPI documentation generation
- **[Health Checks](./health-checks.md)** - Health check endpoints for monitoring and Kubernetes probes
- **[Server Configuration](./server-configuration.md)** - Express middleware, security, CORS, rate limiting, session management

## Quick Links

- [Authentication Flow](./authentication.md#how-it-works)
- [Database Migrations](./database.md#how-to-use-it)
- [WebSocket Protocol](./websockets.md#message-protocol)
- [LLM Provider Setup](./llm-service.md#configuration)
- [User Role Hierarchy](./user-management.md#role-hierarchy)

## Getting Started

1. **Setup Database**: See [Database](./database.md#configuration)
2. **Configure Authentication**: See [Authentication](./authentication.md#configuration)
3. **Setup LLM Providers**: See [LLM Service](./llm-service.md#configuration)
4. **Review API Docs**: Visit `/api-docs` after starting server

## Related Documentation

- [Frontend Documentation](../frontend/docs/README.md) - Frontend feature docs
- [Main README](../../README.md) - Project overview and setup
