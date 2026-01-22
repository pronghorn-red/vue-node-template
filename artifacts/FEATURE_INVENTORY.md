# Feature Inventory Checklist

This document lists all major features in the template, organized by backend and frontend, with proposed documentation filenames and key code references.

## Backend Features

### 1. Authentication & Authorization
- **Proposed doc filename**: `backend/docs/authentication.md`
- **Key code references**:
  - `backend/src/controllers/authController.js` - Auth business logic
  - `backend/src/config/passport.js` - Passport strategies (Local, Google, Microsoft)
  - `backend/src/middleware/auth.js` - JWT verification, role checks, token generation
  - `backend/src/routes/auth.js` - Auth routes
  - `backend/src/database/migrate.js` - User table schema
- **Features**: Local auth, Google OAuth, Microsoft SSO, JWT tokens, refresh tokens, password reset

### 2. Database & Migrations
- **Proposed doc filename**: `backend/docs/database.md`
- **Key code references**:
  - `backend/src/config/database.js` - Connection pooling, query helpers
  - `backend/src/database/migrate.js` - Migration system and schema
  - `backend/src/database/seed.js` - Seed data for development
- **Features**: PostgreSQL connection, connection pooling, migrations, seeding, optional database mode

### 3. WebSockets
- **Proposed doc filename**: `backend/docs/websockets.md` ✅ (Already exists)
- **Key code references**:
  - `backend/docs/websockets.md` - Complete documentation
  - `backend/src/websocket/index.js` - WebSocket server setup
  - `backend/src/websocket/socketController.js` - Connection management
  - `backend/src/websocket/llmHandler.js` - LLM message handling

### 4. LLM Service
- **Proposed doc filename**: `backend/docs/llm-service.md`
- **Key code references**:
  - `backend/src/services/llmService.js` - Multi-provider streaming service
  - `backend/src/controllers/llmController.js` - SSE streaming controller
  - `backend/src/routes/llm.js` - LLM API routes
  - `backend/src/config/models.json` - Model configuration
- **Features**: Multi-provider support (OpenAI, Anthropic, Google, xAI, Groq), SSE streaming, embeddings

### 5. User Management
- **Proposed doc filename**: `backend/docs/user-management.md`
- **Key code references**:
  - `backend/src/controllers/usersController.js` - User CRUD, role management, blocking
  - `backend/src/routes/users.js` - User management routes
  - `backend/src/middleware/auth.js` - Role hierarchy, permission checks
  - `backend/src/database/migrate.js` - User schema, audit log, blocking fields
- **Features**: User CRUD, role management, user blocking, audit logging, password reset admin tools

### 6. Error Handling & Logging
- **Proposed doc filename**: `backend/docs/error-handling-logging.md`
- **Key code references**:
  - `backend/src/middleware/errorHandler.js` - ApiError class, error middleware
  - `backend/src/utils/logger.js` - Winston logger configuration
  - `backend/src/middleware/logging.js` - Request/response logging
- **Features**: Structured error responses, Winston logging, daily rotation, request tracking

### 7. API Documentation (Swagger)
- **Proposed doc filename**: `backend/docs/api-documentation.md`
- **Key code references**:
  - `backend/src/config/swagger.js` - Swagger configuration
  - `backend/src/server.js` - Swagger UI setup (`/api-docs`)
  - Route files with JSDoc comments
- **Features**: OpenAPI 3.0, auto-generated from JSDoc, interactive UI

### 8. Health Checks
- **Proposed doc filename**: `backend/docs/health-checks.md`
- **Key code references**:
  - `backend/src/routes/health.js` - Health check endpoints
  - `backend/src/config/database.js` - Database connection checks
- **Features**: Basic health, detailed health, readiness/liveness probes

### 9. Server Configuration & Middleware
- **Proposed doc filename**: `backend/docs/server-configuration.md`
- **Key code references**:
  - `backend/src/server.js` - Express server setup, middleware configuration
  - `backend/src/middleware/auth.js` - Authentication middleware
  - `backend/src/middleware/logging.js` - Logging middleware
  - `backend/src/middleware/errorHandler.js` - Error handling
- **Features**: Express setup, CORS, Helmet, rate limiting, compression, session management

## Frontend Features

### 1. Authentication (Frontend)
- **Proposed doc filename**: `frontend/docs/authentication.md`
- **Key code references**:
  - `frontend/src/composables/useAuth.js` - Auth composable with token management
  - `frontend/src/services/api.js` - API client with token refresh
  - `frontend/src/router/index.js` - Route guards
  - `frontend/src/views/AuthView.vue` - Login/register UI
- **Features**: JWT token management, session recovery, OAuth callbacks, route guards

### 2. WebSocket (Frontend)
- **Proposed doc filename**: `frontend/docs/websocket.md`
- **Key code references**:
  - `frontend/src/composables/useWebSocket.js` - WebSocket connection manager
  - `frontend/src/components/AppLayout.vue` - Connection monitoring
- **Features**: Connection management, automatic reconnection, domain-based routing, task management

### 3. LLM Integration (Frontend)
- **Proposed doc filename**: `frontend/docs/llm-integration.md`
- **Key code references**:
  - `frontend/src/composables/useLlm.js` - LLM composable
  - `frontend/src/components/Chat.vue` - Chat UI component
  - `frontend/src/views/ChatView.vue` - Chat view
- **Features**: Model selection, streaming (WebSocket/SSE), parallel requests, task cancellation

### 4. User Management (Frontend)
- **Proposed doc filename**: `frontend/docs/user-management.md`
- **Key code references**:
  - `frontend/src/composables/useUsers.js` - User management composable
  - `frontend/src/views/UsersView.vue` - Admin user management UI
  - `frontend/src/views/ProfileView.vue` - User profile UI
- **Features**: Profile management, admin user operations, role management UI

### 5. Routing & Navigation
- **Proposed doc filename**: `frontend/docs/routing.md`
- **Key code references**:
  - `frontend/src/router/index.js` - Vue Router configuration
  - `frontend/src/components/AppLayout.vue` - Navigation layout
- **Features**: Route guards, role-based access, navigation guards, redirect handling

### 6. Layout & UI Components
- **Proposed doc filename**: `frontend/docs/layout-ui.md`
- **Key code references**:
  - `frontend/src/components/AppLayout.vue` - Main layout component
  - `frontend/src/composables/useDarkMode.js` - Dark mode composable
  - `frontend/src/i18n/index.js` - Internationalization setup
  - `frontend/src/main.js` - App initialization, PrimeVue setup
- **Features**: Responsive layout, dark mode, i18n (en/fr), PrimeVue components, sidebar navigation

### 7. API Client
- **Proposed doc filename**: `frontend/docs/api-client.md`
- **Key code references**:
  - `frontend/src/services/api.js` - Axios instance with interceptors
- **Features**: Automatic token refresh, request/response interceptors, error handling, cookie support

### 8. Dark Mode
- **Proposed doc filename**: `frontend/docs/dark-mode.md`
- **Key code references**:
  - `frontend/src/composables/useDarkMode.js` - Dark mode composable
  - `frontend/src/main.js` - Dark mode initialization
  - `frontend/src/utils/chartDarkModePlugin.js` - Chart.js dark mode plugin
- **Features**: System preference detection, session persistence, Chart.js integration

### 9. Internationalization
- **Proposed doc filename**: `frontend/docs/internationalization.md`
- **Key code references**:
  - `frontend/src/i18n/index.js` - i18n configuration
  - `frontend/src/i18n/locales/en.json` - English translations
  - `frontend/src/i18n/locales/fr.json` - French translations
- **Features**: Vue I18n, language switching, locale persistence

## Summary

**Total Backend Docs**: 9 (1 already exists = 8 new)
**Total Frontend Docs**: 9 (all new)

**Total New Docs to Create**: 17
