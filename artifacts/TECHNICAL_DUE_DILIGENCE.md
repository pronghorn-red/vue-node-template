# Technical Due Diligence & Enterprise Expansion Plan
## Vue-Node-Template Repository

**Date:** 2024  
**Version:** 1.0  
**Repository:** vue-node-template (Pronghorn v3.0.0)

---

## A) Executive Summary

### What's Good ✅

1. **Well-structured monorepo** with clear separation of concerns (frontend/backend)
2. **Resilient startup** - application boots successfully even with missing configuration
3. **Comprehensive authentication** - supports Local, Google OAuth, Microsoft Entra ID with JWT + sessions
4. **Role-based access control** - hierarchical roles (superadmin > admin > user) with proper middleware
5. **Structured logging** - Winston with daily rotation, JSON format, separate access/error logs
6. **Security middleware** - Helmet, CORS, rate limiting already implemented
7. **Health endpoints** - `/health`, `/health/ready`, `/health/live` for Kubernetes
8. **Database migrations** - proper migration system with version tracking
9. **Graceful shutdown** - handles SIGINT/SIGTERM, closes DB pool and WebSocket connections
10. **API documentation** - Swagger/OpenAPI with JSDoc comments

### What's Risky ⚠️

1. **No input validation library** - manual validation scattered across controllers (SQL injection risk)
2. **No CSRF protection** - state-changing operations vulnerable to CSRF attacks
3. **Secrets management** - auto-generated secrets on startup (not persistent, not secure for production)
4. **No file upload handling** - no malware scanning or safe file handling mechanisms
5. **Limited audit logging** - user_audit_log exists but not comprehensive event logging
6. **No dependency scanning** - no Dependabot/CodeQL/Snyk integration
7. **No structured compliance artifacts** - no STRA, PIA, InfoSec classification docs
8. **Weak typing** - JavaScript only, no TypeScript (maintainability risk)
9. **No RBAC configuration** - roles hardcoded, not configurable
10. **No data retention/disposition** - no lifecycle management for user data

### What to Fix First 🔥

**Phase 0 (Critical - Before Production):**
1. Add input validation library (Zod/Joi) to all API endpoints
2. Implement CSRF protection for state-changing operations
3. Replace auto-generated secrets with proper secrets management (Azure KeyVault/GitHub Secrets)
4. Add comprehensive audit logging for all security events
5. Add dependency scanning (Dependabot + CodeQL)
6. Document secrets management process

**Phase 1 (Alpha Compliance):**
1. Add file upload scanning/mitigation
2. Create STRA template and initial assessment
3. Document InfoSec classification
4. Implement OWASP ASVS Level 1 baseline
5. Add structured event logging schema
6. Create compliance artifacts directory structure

**Phase 2 (Production Hardening):**
1. Complete OWASP ASVS Level 2 alignment
2. Add configurable RBAC
3. Implement data retention/disposition schedules
4. Add consent/notification mechanisms
5. Complete PIA and Privacy Risk Assessment
6. Add SIEM-friendly log shipping

---

## B) Repo Facts

### Monorepo Structure

**Type:** npm Workspaces monorepo  
**Root:** `/Users/bart/Dev/vue-node-template`  
**Workspaces:** `frontend`, `backend`

**Key Directories:**
- `backend/src/` - Express.js API server
  - `config/` - Database, Passport, Swagger, models.json
  - `controllers/` - Route handlers (auth, llm, users)
  - `database/` - Migrations and seed scripts
  - `middleware/` - Auth, error handling, logging
  - `routes/` - API route definitions
  - `services/` - Business logic (LLM service)
  - `utils/` - Logger utility
  - `websocket/` - WebSocket handlers
- `frontend/src/` - Vue.js 3 SPA
  - `components/` - Reusable Vue components
  - `composables/` - Vue composition API hooks
  - `router/` - Vue Router with lazy loading
  - `services/` - API client (Axios)
  - `views/` - Page components
- `scripts/` - Utility scripts (secrets generator)

### Frontend Stack

**Framework:** Vue.js 3.5.24  
**Build Tool:** Vite 7.2.4  
**Router:** Vue Router 4.6.4  
**State Management:** None (sessionStorage-based)  
**UI Libraries:** 
- PrimeVue 4.5.3 (component library)
- Tailwind CSS 3.4.19 (utility CSS)
- Chart.js 4.5.1 (data visualization)
**i18n:** vue-i18n 9.13.1 (English/French)  
**TypeScript:** ❌ No TypeScript (JavaScript only)  
**Linting:** ESLint 9.39.2 + Prettier 3.7.4  
**Git Hooks:** Husky 9.1.7 + lint-staged 16.2.7

**Evidence:**
- `frontend/package.json` lines 17-32 (dependencies)
- `frontend/src/main.js` (Vue app initialization)
- `frontend/vite.config.js` (Vite configuration)

### Backend Stack

**Framework:** Express.js 5.2.1  
**API Style:** REST (no GraphQL)  
**Validation Library:** ❌ None (manual validation)  
**ORM/Database:** 
- PostgreSQL (pg 8.16.3)
- Raw SQL queries (no ORM)
- Connection pooling
- Migration system (`backend/src/database/migrate.js`)
**Authentication:** 
- Passport.js 0.7.0
- Strategies: Local, Google OAuth, Microsoft MSAL
- JWT (jsonwebtoken 9.0.3) + Express sessions
- Role-based access control (superadmin/admin/user)
**Security Middleware:**
- Helmet 8.1.0 (HTTP headers)
- CORS 2.8.5 (configured for FRONTEND_URL)
- express-rate-limit 8.2.1 (100 req/15min default)
**Logging:** Winston 3.19.0 with daily rotation  
**API Documentation:** Swagger/OpenAPI (swagger-jsdoc 6.2.8)  
**WebSocket:** ws 8.18.3 (native WebSocket server)

**Evidence:**
- `backend/package.json` lines 17-45 (dependencies)
- `backend/src/server.js` lines 17-22, 99-166 (middleware setup)
- `backend/src/middleware/auth.js` (RBAC implementation)
- `backend/src/config/passport.js` (auth strategies)

### Authentication Architecture

**Current Implementation:**
- **Local Auth:** Email/password with bcryptjs hashing
- **OAuth:** Google OAuth 2.0, Microsoft Entra ID (MSAL)
- **Session Management:** 
  - PostgreSQL session store (if DB configured)
  - Memory store fallback (if no DB)
- **Token Strategy:**
  - Access token: JWT (15min expiry, in Authorization header or cookie)
  - Refresh token: JWT (7d expiry, httpOnly cookie only)
- **Role Hierarchy:** superadmin (100) > admin (50) > user (10)
- **Account Blocking:** Users can be blocked with reason tracking

**Evidence:**
- `backend/src/config/passport.js` (all auth strategies)
- `backend/src/middleware/auth.js` lines 31-35 (role levels), 90-118 (token generation)
- `backend/src/database/migrate.js` lines 24-44 (users table schema)

**Gaps:**
- ❌ No CSRF protection
- ❌ No MFA/2FA
- ❌ No account lockout after failed attempts
- ❌ No password complexity requirements enforced
- ❌ No session timeout configuration

### Logging Architecture

**Current Implementation:**
- **Logger:** Winston 3.19.0
- **Transports:**
  - Console (JSON in prod, colored in dev)
  - Daily rotate file: `combined-%DATE%.log`, `error-%DATE%.log`
  - Access log: `access-%DATE%.log`
  - Exception/rejection handlers
- **Log Format:** 
  - JSON for files (structured)
  - Human-readable for console (dev)
- **Log Levels:** Configurable via `LOG_LEVEL` env var (default: 'info')
- **Request Logging:** 
  - Request ID generation (`x-request-id` header or auto-generated)
  - Logs method, URL, status, duration, IP, userAgent, userId
- **Audit Logging:** 
  - `user_audit_log` table exists (migration line 479-525)
  - Tracks user actions with actor_id, action, details, IP, user_agent
  - Function: `log_user_action()` available

**Evidence:**
- `backend/src/utils/logger.js` (Winston configuration)
- `backend/src/middleware/logging.js` (request/error logging)
- `backend/src/database/migrate.js` lines 479-525 (audit log table)

**Gaps:**
- ❌ No correlation ID propagation to external services
- ❌ No SIEM integration (no log shipping)
- ❌ No structured event schema for compliance events
- ❌ Audit logging not used consistently across all security events

### Testing

**Unit Tests:** 
- Framework: Jest 30.2.0
- Script: `npm run test` (runs `jest --coverage`)
- **Status:** ❌ No test files found in codebase

**Integration Tests:** ❌ None  
**E2E Tests:** ❌ None  
**Test Coverage:** ❌ Unknown (no tests exist)

**Evidence:**
- `backend/package.json` line 15: `"test": "jest --coverage"`
- `glob_file_search` for `*.test.js` and `*.spec.js` returned 0 files

### Development/Production Environment

**Environment Configuration:**
- **Dotenv:** dotenv 17.2.3
- **Config Location:** Root `.env` file (shared by frontend and backend)
- **Config Loading:** 
  - Backend: `require("dotenv").config({ path: path.resolve(__dirname, "../../.env") })`
  - Frontend: Vite reads from root via `envDir: path.resolve(__dirname, '..')`
- **Secrets Management:**
  - Auto-generated secrets on startup if not configured (⚠️ NOT SECURE)
  - Script: `scripts/generate-secrets.js` (generates SESSION_SECRET, JWT_SECRET, JWT_REFRESH_SECRET)
  - Secrets can be written to `.env` with `--write` flag
- **Resilient Startup:** App runs without DB, without auth config, with warnings

**Evidence:**
- `backend/src/server.js` lines 12-13, 56-94 (secret generation)
- `scripts/generate-secrets.js` (secrets generator)
- `frontend/vite.config.js` line 16 (envDir configuration)

**Docker:** ❌ No Dockerfile or docker-compose.yml  
**Kubernetes:** ❌ No k8s manifests  
**Deploy Scripts:** ❌ None

### Security Tooling

**SAST (Static Analysis):**
- ESLint 9.39.2 (code quality)
- ❌ No CodeQL
- ❌ No SonarQube

**DAST (Dynamic Analysis):** ❌ None  
**Dependency Scanning:**
- ❌ No Dependabot
- ❌ No Snyk
- ❌ No npm audit automation

**Linting:** ESLint + Prettier (configured)  
**Formatting:** Prettier 3.7.4 (configured)

**Evidence:**
- `backend/package.json` lines 47-52 (devDependencies)
- No `.github/dependabot.yml` or similar files found

---

## C) How to Run/Build/Test

### Installation

**Prerequisites:**
- Node.js >= 20.0.0
- npm >= 10.0.0
- PostgreSQL 17/18 (optional, but recommended)

**Steps:**
```bash
# 1. Install all dependencies (root + workspaces)
npm run install:all
# OR manually:
npm install
npm --prefix frontend install
npm --prefix backend install

# 2. Copy environment template
cp .env.example .env

# 3. Generate secrets (recommended)
npm run generate:secrets -- --write

# 4. Edit .env with your configuration
# Minimum: Add LLM API keys if using LLM features
# Optional: Add DB credentials, OAuth credentials
```

**Evidence:**
- `package.json` lines 23-24 (`install:all` script)
- `README.md` lines 98-119 (installation instructions)
- `scripts/generate-secrets.js` (secrets generator)

**Status:** ✅ Verified - scripts exist and are documented

### Run Frontend + Backend Locally

**Development Mode (Concurrent):**
```bash
npm run dev
# Runs: concurrently "npm run dev:frontend" "npm run dev:backend"
```

**Individual Services:**
```bash
# Frontend only (Vite dev server)
npm run dev:frontend
# OR: npm --prefix frontend run dev

# Backend only (Nodemon)
npm run dev:backend
# OR: npm --prefix backend run dev
```

**Access Points:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api/v1
- Swagger Docs: http://localhost:3000/api-docs
- Health Check: http://localhost:3000/api/v1/health
- WebSocket: ws://localhost:3000/ws

**Evidence:**
- `package.json` lines 11-13 (dev scripts)
- `backend/nodemon.json` (nodemon configuration)
- `backend/src/server.js` lines 364-386 (server startup)

**Status:** ✅ Verified - scripts exist, documented in README

### Run Tests

**Command:**
```bash
npm run test
# Runs: npm --prefix frontend run test && npm --prefix backend run test
```

**Backend Tests:**
```bash
npm --prefix backend run test
# Runs: jest --coverage
```

**Frontend Tests:**
```bash
npm --prefix frontend run test
# ⚠️ No test script defined in frontend/package.json
```

**Evidence:**
- `package.json` line 21 (`test` script)
- `backend/package.json` line 15 (`test: "jest --coverage"`)
- `frontend/package.json` - ❌ No test script found

**Status:** ⚠️ **PARTIALLY BROKEN** - Frontend has no test script, backend has no test files

### Build for Production

**Frontend Build:**
```bash
npm run build
# Runs: npm --prefix frontend run build
# Output: frontend/dist/
```

**Build Configuration:**
- Vite build with code splitting
- Terser minification (drops console.log)
- Manual chunks: vue-vendor, primevue-vendor, chart-vendor, dashboard

**Evidence:**
- `package.json` line 14 (`build` script)
- `frontend/vite.config.js` lines 24-47 (build configuration)

**Status:** ✅ Verified - build script exists and configured

### Run Production Mode

**Production Server:**
```bash
npm run start
# Runs: npm --prefix backend run start
# Executes: cross-env NODE_ENV=production node src/server.js
```

**Secure Production Mode:**
```bash
npm run start:secure
# Runs: cross-env NODE_ENV=production node --permission --allow-fs-read='../*' --allow-fs-write='./*' src/server.js
```

**Production Behavior:**
- Serves static files from `frontend/dist/`
- History API fallback for SPA routing
- Compression enabled
- Helmet CSP enabled (production mode)
- JSON logging to console (for container logs)

**Evidence:**
- `package.json` line 15-16 (`start` and `start:secure` scripts)
- `backend/src/server.js` lines 286-329 (production static file serving)

**Status:** ✅ Verified - production scripts exist

### Database Setup (Optional)

**Run Migrations:**
```bash
npm run db:migrate
# Runs: npm --prefix backend run db:migrate
# Executes: node src/database/migrate.js
```

**Seed Database:**
```bash
npm run db:seed
# Runs: npm --prefix backend run db:seed
# Executes: node src/database/seed.js
```

**Evidence:**
- `package.json` lines 19-20 (db scripts)
- `backend/src/database/migrate.js` (migration system)

**Status:** ✅ Verified - migration system exists and is documented

---

## D) Architecture Map

### Request Flow

```
┌─────────────┐
│   Browser   │
│  (Vue SPA)  │
└──────┬───────┘
       │ HTTP/HTTPS
       │ WebSocket
       ▼
┌─────────────────────────────────────┐
│         Express Server              │
│  (backend/src/server.js)            │
│                                     │
│  Middleware Stack (in order):      │
│  1. Helmet (security headers)       │
│  2. CORS                            │
│  3. Compression                     │
│  4. Rate Limiting                   │
│  5. Body Parser (JSON/URL-encoded) │
│  6. Cookie Parser                  │
│  7. Session (PostgreSQL or memory) │
│  8. Passport (auth)                 │
│  9. Request Logger                  │
│  10. Routes                         │
│  11. Error Logger                   │
│  12. Error Handler                 │
└──────┬──────────────────────────────┘
       │
       ├───► /api/v1/auth ────────► authController
       │     /api/v1/health ──────► healthRoutes
       │     /api/v1/llm ─────────► llmController
       │     /api/v1/users ────────► usersController
       │
       └───► /ws ──────────────────► WebSocket Server
                                      └─► socketController
                                          └─► llmHandler
```

**Evidence:**
- `backend/src/server.js` lines 99-336 (middleware order)
- `backend/src/routes/index.js` (route mounting)

### API Boundaries

**Base Path:** `/api/v1` (configurable via `API_BASE_PATH` env var)

**Route Organization:**
- `/api/v1/` - Root (API info)
- `/api/v1/auth` - Authentication routes
  - POST `/register` - User registration
  - POST `/login` - Local login
  - POST `/logout` - Logout
  - POST `/refresh` - Refresh token
  - GET `/google` - Google OAuth initiation
  - GET `/google/callback` - Google OAuth callback
  - GET `/microsoft` - Microsoft SSO initiation
  - GET `/microsoft/callback` - Microsoft SSO callback
- `/api/v1/health` - Health checks
  - GET `/` - Basic health
  - GET `/detailed` - Detailed health
  - GET `/ready` - Readiness probe
  - GET `/live` - Liveness probe
- `/api/v1/llm` - LLM routes
  - GET `/providers` - List providers
  - GET `/models` - List models
  - GET `/models/:modelId` - Model config
  - POST `/chat/stream` - SSE streaming
  - POST `/embeddings` - Generate embeddings
- `/api/v1/users` - User management
  - GET `/profile` - Current user profile
  - PUT `/profile` - Update profile
  - GET `/` - List users (admin)
  - GET `/:id` - Get user (admin)
  - PUT `/:id` - Update user (admin)
  - DELETE `/:id` - Delete user (admin)

**Evidence:**
- `backend/src/routes/index.js` (route mounting)
- `backend/src/routes/auth.js`, `health.js`, `llm.js`, `users.js` (route definitions)

### Data Model Layer

**Database:** PostgreSQL (optional - app runs without DB)

**Connection:**
- Connection string: `DB_CONNECTION_STRING` (takes precedence)
- Individual params: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- Connection pooling (min: 2, max: 20, configurable)
- SSL support via `DB_SSL=true` or connection string `sslmode=require`

**Tables (from migrations):**
1. `users` - User accounts
   - id (UUID), email, password_hash, display_name
   - oauth_provider, oauth_id
   - role (superadmin/admin/user), additional_roles (JSONB)
   - is_blocked, blocked_at, blocked_by, blocked_reason
   - email_verified, last_login, created_at, updated_at
2. `session` - Express sessions (connect-pg-simple)
3. `refresh_tokens` - JWT refresh tokens
4. `conversations` - LLM conversation history
5. `messages` - LLM messages within conversations
6. `websocket_connections` - WebSocket connection tracking
7. `password_reset_requests` - Password reset tracking
8. `user_audit_log` - Audit log for user actions
9. `migrations` - Migration tracking

**Query Pattern:**
- Raw SQL with parameterized queries (prevents SQL injection)
- Helper: `query(text, params)` from `config/database.js`
- Transactions: `transaction(callback)` helper
- No ORM (direct SQL)

**Evidence:**
- `backend/src/config/database.js` (connection and query helpers)
- `backend/src/database/migrate.js` (all table schemas)
- `backend/src/middleware/auth.js` line 269 (example query usage)

### Error Handling Strategy

**Error Flow:**
1. Route handler throws error (or uses `ApiError` class)
2. `asyncHandler` wrapper catches async errors
3. `errorLogger` middleware logs error
4. `errorHandler` middleware formats response

**Error Response Format:**
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {...},  // Optional, only in dev or for client errors
  "requestId": "xxx" // If available
}
```

**Error Types Handled:**
- `ValidationError` → 400 BAD_REQUEST
- `JsonWebTokenError` → 401 INVALID_TOKEN
- `TokenExpiredError` → 401 TOKEN_EXPIRED
- PostgreSQL unique violation (23505) → 409 DUPLICATE_ENTRY
- PostgreSQL foreign key (23503) → 400 INVALID_REFERENCE
- Custom `ApiError` with statusCode

**Evidence:**
- `backend/src/middleware/errorHandler.js` (error handling implementation)
- `backend/src/middleware/logging.js` lines 79-90 (error logging)

### Authn/Authz Insertion Points

**Authentication Middleware:**
- `authenticate` / `authenticateJWT` - Requires valid JWT or session
- `optionalAuth` - Optional authentication (sets req.user if token present)

**Authorization Middleware:**
- `requireRole(roles)` - Requires user has ANY of specified roles
- `requireMinRole(minRole)` - Requires user has role >= minRole (hierarchy)
- `requireAdmin()` - Requires admin or superadmin
- `requireSuperAdmin()` - Requires superadmin
- `canAccessUser(options)` - Checks if user can access/modify target user

**Usage Pattern:**
```javascript
router.get('/admin-only', authenticate, requireAdmin, handler);
router.get('/users/:id', authenticate, canAccessUser({ allowSelf: true }), handler);
```

**Evidence:**
- `backend/src/middleware/auth.js` lines 305-580 (all middleware)
- `backend/src/routes/users.js` (example usage)

### Observability Hooks

**Logging:**
- Request logging: `requestLogger` middleware (logs all requests)
- Access logging: `logAccess()` function (separate access log file)
- Error logging: `errorLogger` middleware (logs all errors)
- Structured logging: Winston with JSON format

**Metrics:**
- Health endpoint: `/api/v1/health/detailed` (includes memory, CPU, DB stats)
- WebSocket stats: Available via `getStats()` function
- Database pool stats: `getPoolStats()` function

**Tracing:**
- Request ID: Generated per request, logged in all log entries
- Correlation: Request ID available in `req.requestId`

**Evidence:**
- `backend/src/middleware/logging.js` (request/error logging)
- `backend/src/utils/logger.js` (Winston configuration)
- `backend/src/routes/health.js` (health endpoints)

**Gaps:**
- ❌ No distributed tracing (OpenTelemetry/Jaeger)
- ❌ No metrics export (Prometheus)
- ❌ No APM integration

---

## E) Risk Assessment Table

| Risk Category | Severity | Risk Description | Evidence | Remediation |
|--------------|----------|-----------------|----------|------------|
| **Security** | 🔴 HIGH | No input validation library - SQL injection risk | Manual validation in controllers (`usersController.js` line 130-158), no library like Zod/Joi | Add Zod or Joi, validate all inputs before DB queries |
| **Security** | 🔴 HIGH | No CSRF protection | No CSRF middleware found, state-changing operations vulnerable | Add `csurf` or `csrf` middleware, implement CSRF tokens |
| **Security** | 🔴 HIGH | Auto-generated secrets on startup | `server.js` lines 56-94 generate secrets if not configured | Use Azure KeyVault/GitHub Secrets, fail startup if secrets missing |
| **Security** | 🟡 MEDIUM | No file upload handling | No multer/upload endpoints found | Add file upload with malware scanning (ClamAV integration) |
| **Security** | 🟡 MEDIUM | No dependency scanning | No Dependabot/CodeQL/Snyk | Add Dependabot, CodeQL, npm audit in CI |
| **Security** | 🟡 MEDIUM | Weak password requirements | No password complexity validation in `authController.js` | Add password policy (min length, complexity, common passwords) |
| **Security** | 🟡 MEDIUM | No account lockout | No failed login attempt tracking | Add account lockout after N failed attempts |
| **Security** | 🟡 MEDIUM | CORS configured but permissive | `server.js` line 128 allows single origin, but no validation | Validate CORS origin against allowlist |
| **Maintainability** | 🔴 HIGH | No TypeScript | JavaScript only, no type safety | Migrate to TypeScript (gradual migration possible) |
| **Maintainability** | 🟡 MEDIUM | No test coverage | No test files found | Add unit tests for critical paths (auth, validation) |
| **Maintainability** | 🟡 MEDIUM | Manual input validation | Validation logic scattered across controllers | Centralize validation with Zod schema |
| **Maintainability** | 🟡 MEDIUM | Hardcoded roles | Roles hardcoded in `auth.js` line 31-35 | Make roles configurable via database/env |
| **Operational** | 🟡 MEDIUM | No graceful shutdown timeout | `server.js` line 419 has 30s timeout, but no config | Make timeout configurable, add health check during shutdown |
| **Operational** | 🟡 MEDIUM | No structured config validation | Env vars loaded but not validated | Add config schema validation (Zod) |
| **Operational** | 🟡 MEDIUM | No log shipping | Logs only to files, no SIEM integration | Add Winston transport for log shipping (Winston CloudWatch/Azure Monitor) |
| **Compliance** | 🔴 HIGH | No audit event logging | `user_audit_log` exists but not used consistently | Log all security events (login, logout, role changes, data access) |
| **Compliance** | 🔴 HIGH | No compliance artifacts | No STRA, PIA, InfoSec classification docs | Create `/compliance` directory, add template artifacts |
| **Compliance** | 🟡 MEDIUM | No data retention policy | No automatic data deletion/archival | Implement retention schedules, add archival process |
| **Compliance** | 🟡 MEDIUM | No consent mechanism | No user consent tracking | Add consent table, consent UI, audit trail |
| **Compliance** | 🟡 MEDIUM | No data classification | No functional classification tagging | Add data classification fields to tables, tagging system |

---

## F) Requirements Fit Matrix

### CYBER REQUIREMENTS - ALPHA (Baseline)

| Requirement | Current Status | Evidence | Integration Approach | Files to Modify | Data/Config Required | Effort | Template Suitability |
|-------------|----------------|----------|----------------------|-----------------|----------------------|--------|---------------------|
| **Application logging (all events, structured logs)** | ✅ Partial | Winston with JSON format, but not all events logged | Enhance existing logger, add event schema | `utils/logger.js`, all controllers | Event schema definition | M | ✅ Good template default |
| **Upload malware mitigation** | ❌ Missing | No file upload endpoints | Add multer + ClamAV integration | New: `middleware/upload.js`, `services/clamav.js` | ClamAV service URL, file size limits | L | ⚠️ Project-specific (needs ClamAV) |
| **Authentication (Digital Identity Gateway style)** | ✅ Partial | Passport with OAuth, but no DIG integration | Add DIG adapter/wrapper | `config/passport.js`, new: `config/dig.js` | DIG client ID, secret, endpoints | M | ⚠️ Project-specific (DIG) |
| **Draft InfoSec Classification** | ❌ Missing | No classification docs | Create template document | New: `compliance/infosec-classification.md` | Classification level, data types | S | ✅ Good template default |
| **Draft STRA** | ❌ Missing | No STRA document | Create template with threats/risks | New: `compliance/stra-template.md` | Threat assessment, risk matrix | M | ✅ Good template default |
| **OWASP ASVS Level 1 alignment** | ⚠️ Partial | Helmet, CORS, rate limiting exist, but missing validation, CSRF | Add validation library, CSRF protection | `middleware/validation.js`, `middleware/csrf.js` | Validation schemas | M | ✅ Good template default |
| **REST security baseline** | ✅ Partial | CORS, headers (Helmet), rate limiting exist, but missing input validation | Add input validation to all endpoints | All route files, new: `middleware/validation.js` | Validation schemas | M | ✅ Good template default |
| **SAST/DAST hooks** | ❌ Missing | No CodeQL, Dependabot | Add GitHub Actions workflows | New: `.github/workflows/codeql.yml`, `.github/dependabot.yml` | GitHub token | S | ✅ Good template default |
| **Secrets management** | ⚠️ Partial | Auto-generated secrets, script exists | Integrate Azure KeyVault or GitHub Secrets | `server.js`, new: `services/secrets.js` | KeyVault URL, credentials | M | ⚠️ Project-specific (KeyVault) |
| **Integrity controls** | ❌ Missing | No change feed or record hashing | Add hash column to critical tables, change feed | `database/migrate.js`, new: `services/integrity.js` | Hash algorithm, change feed config | M | ✅ Good template default |
| **Basic RBAC** | ✅ Already | Role hierarchy exists (superadmin/admin/user) | Enhance with configurable roles | `middleware/auth.js`, `database/migrate.js` | Role configuration table | S | ✅ Good template default |

### CYBER REQUIREMENTS - PRODUCTION (Hardening)

| Requirement | Current Status | Evidence | Integration Approach | Files to Modify | Data/Config Required | Effort | Template Suitability |
|-------------|----------------|----------|----------------------|-----------------|----------------------|--------|---------------------|
| **Web app logging (prod posture)** | ✅ Partial | Winston with daily rotation, but no log shipping | Add SIEM transport | `utils/logger.js` | SIEM endpoint, credentials | M | ⚠️ Project-specific (SIEM) |
| **Cloudflare/WAF integration** | ❌ Missing | No WAF configuration | Document WAF rules, Cloudflare setup | New: `docs/waf-configuration.md` | WAF rules, Cloudflare config | S | ⚠️ Project-specific (Cloudflare) |
| **Vulnerability scan readiness** | ⚠️ Partial | No dependency scanning, no pen test docs | Add scanning, create pen test checklist | New: `compliance/pen-test-checklist.md` | Scanning tools config | M | ✅ Good template default |
| **Bot/fraud protection** | ❌ Missing | No bot detection | Add Shape/Cloudflare Bot Management | New: `middleware/botProtection.js` | Shape API key, config | M | ⚠️ Project-specific (Shape) |
| **Microsoft Defender integration** | ❌ Missing | No endpoint scanning | Document Defender requirements | New: `docs/defender-requirements.md` | Defender config | S | ⚠️ Project-specific (Defender) |
| **Log shipping (SIEM-friendly)** | ❌ Missing | Logs only to files | Add Winston Azure Monitor/CloudWatch transport | `utils/logger.js` | SIEM credentials, endpoint | M | ⚠️ Project-specific (SIEM) |
| **Final InfoSec classification** | ❌ Missing | No classification | Complete classification document | `compliance/infosec-classification.md` | Final classification | S | ✅ Good template default |
| **Completed STRA** | ❌ Missing | No STRA | Complete STRA with all threats/risks | `compliance/stra.md` | Complete threat assessment | L | ✅ Good template default |
| **Service owner readiness** | ⚠️ Partial | Health endpoints exist, but no runbooks | Create runbooks, incident response | New: `docs/runbooks/`, `docs/incident-response.md` | Runbook templates | M | ✅ Good template default |
| **CMDB/config management hooks** | ❌ Missing | No CMDB integration | Document CMDB requirements, add metadata | New: `docs/cmdb-integration.md` | CMDB schema | S | ⚠️ Project-specific (CMDB) |
| **Basic DR plan** | ❌ Missing | No DR documentation | Create DR plan template | New: `compliance/dr-plan.md` | DR procedures, RTO/RPO | M | ✅ Good template default |
| **Basic BC plan** | ❌ Missing | No BC documentation | Create BC plan template | New: `compliance/bc-plan.md` | BC procedures | M | ✅ Good template default |
| **OWASP ASVS Level 2 alignment** | ❌ Missing | Level 1 partial, Level 2 not started | Complete Level 1, add Level 2 controls | All security middleware, validation | ASVS Level 2 checklist | L | ✅ Good template default |
| **Vulnerability remediation workflow** | ❌ Missing | No workflow | Add GitHub Issues templates, SLA tracking | New: `.github/ISSUE_TEMPLATE/vulnerability.md` | SLA definitions | S | ✅ Good template default |
| **Configurable RBAC** | ⚠️ Partial | Hardcoded roles | Make roles database-driven | `middleware/auth.js`, `database/migrate.js` | Role config table | M | ✅ Good template default |
| **Secure Azure prod environment** | ❌ Missing | No Azure-specific config | Document Azure requirements | New: `docs/azure-production.md` | Azure config, network, identity | M | ⚠️ Project-specific (Azure) |
| **Access management process** | ⚠️ Partial | RBAC exists, but no process docs | Document access management process | New: `docs/access-management.md` | Process documentation | S | ✅ Good template default |
| **Incident management process** | ❌ Missing | No incident process | Create incident response plan | New: `docs/incident-response.md` | Incident procedures | M | ✅ Good template default |
| **Electronic signature** | ❌ Missing | No e-signature integration | Add e-signature service (DocuSign/Adobe Sign) | New: `services/esignature.js`, `routes/signature.js` | E-signature API credentials | L | ⚠️ Project-specific (e-signature) |

### IM & PRIVACY REQUIREMENTS - ALPHA

| Requirement | Current Status | Evidence | Integration Approach | Files to Modify | Data/Config Required | Effort | Template Suitability |
|-------------|----------------|----------|----------------------|-----------------|----------------------|--------|---------------------|
| **Identified Info Controller** | ❌ Missing | No documentation | Create template document | New: `compliance/info-controller.md` | Controller name, contact | S | ✅ Good template default |
| **Identified Info Custodian** | ❌ Missing | No documentation | Create template document | New: `compliance/info-custodian.md` | Custodian name, contact | S | ✅ Good template default |
| **SharePoint integration point** | ❌ Missing | No SharePoint integration | Document SharePoint requirements | New: `docs/sharepoint-integration.md` | SharePoint site, credentials | S | ⚠️ Project-specific (SharePoint) |
| **Privacy Risk Assessment** | ❌ Missing | No PRA template | Create PRA template | New: `compliance/pra-template.md` | PRA framework | M | ✅ Good template default |

### IM & PRIVACY REQUIREMENTS - PRODUCTION

| Requirement | Current Status | Evidence | Integration Approach | Files to Modify | Data/Config Required | Effort | Template Suitability |
|-------------|----------------|----------|----------------------|-----------------|----------------------|--------|---------------------|
| **Consent/notification mechanism** | ❌ Missing | No consent tracking | Add consent table, UI, audit trail | New: `database/migrate.js` (consent table), `routes/consent.js`, frontend components | Consent types, UI | M | ✅ Good template default |
| **Retention & disposition schedules** | ❌ Missing | No data lifecycle | Add retention policies, archival, deletion | `database/migrate.js`, new: `services/retention.js`, scheduled job | Retention periods, archival config | L | ✅ Good template default |
| **PIA (Privacy Impact Assessment)** | ❌ Missing | No PIA | Create PIA template and completion plan | New: `compliance/pia-template.md`, `compliance/pia-completion-plan.md` | PIA framework | M | ✅ Good template default |
| **Functional classification** | ❌ Missing | No data classification | Add classification fields to tables | `database/migrate.js`, all tables | Classification schema | M | ✅ Good template default |

---

## G) Implementation Plan

### Phase 0: "Make it Runnable + Safe Defaults"

**Goal:** Fix critical security issues and establish safe defaults before any production deployment.

#### Task 0.1: Add Input Validation Library
- **Description:** Integrate Zod for input validation across all API endpoints
- **Files:** 
  - New: `backend/src/middleware/validation.js`
  - Modify: All route files (`routes/auth.js`, `routes/users.js`, `routes/llm.js`)
  - New: `backend/src/schemas/` (validation schemas)
- **Acceptance Criteria:**
  - All POST/PUT/PATCH endpoints have Zod validation
  - Validation errors return 400 with structured error details
  - SQL injection risk eliminated (parameterized queries already used, but validate inputs)
- **Test Plan:** Unit tests for validation schemas, integration tests for invalid inputs
- **Effort:** M (3-5 days)

#### Task 0.2: Implement CSRF Protection
- **Description:** Add CSRF middleware for state-changing operations
- **Files:**
  - New: `backend/src/middleware/csrf.js`
  - Modify: `backend/src/server.js` (add CSRF middleware)
  - Modify: Frontend API client to include CSRF token
- **Acceptance Criteria:**
  - CSRF token required for POST/PUT/DELETE/PATCH
  - Token validation on all state-changing routes
  - Frontend automatically includes CSRF token in requests
- **Test Plan:** Test CSRF token validation, test missing/invalid token rejection
- **Effort:** S (2-3 days)

#### Task 0.3: Replace Auto-Generated Secrets with Proper Secrets Management
- **Description:** Integrate Azure KeyVault or GitHub Secrets, fail startup if secrets missing
- **Files:**
  - New: `backend/src/services/secrets.js` (secrets service)
  - Modify: `backend/src/server.js` (remove auto-generation, use secrets service)
  - New: `backend/src/config/secrets.js` (secrets configuration)
- **Acceptance Criteria:**
  - Startup fails if required secrets are missing
  - Secrets loaded from KeyVault/GitHub Secrets (configurable)
  - No secrets in code or logs
  - Documentation for secrets setup
- **Test Plan:** Test startup with missing secrets (should fail), test with valid secrets
- **Effort:** M (3-4 days)

#### Task 0.4: Add Comprehensive Audit Logging
- **Description:** Log all security events (login, logout, role changes, data access, failures)
- **Files:**
  - Modify: `backend/src/middleware/auth.js` (log auth events)
  - Modify: `backend/src/controllers/authController.js` (log login/logout)
  - Modify: `backend/src/controllers/usersController.js` (log role changes)
  - New: `backend/src/services/audit.js` (audit service)
- **Acceptance Criteria:**
  - All security events logged to `user_audit_log` table
  - Events include: actor_id, action, target_user_id, IP, user_agent, timestamp
  - Audit log queryable via admin API
- **Test Plan:** Verify all security events are logged, test audit log query
- **Effort:** M (3-4 days)

#### Task 0.5: Add Dependency Scanning
- **Description:** Add Dependabot and CodeQL to GitHub
- **Files:**
  - New: `.github/dependabot.yml`
  - New: `.github/workflows/codeql.yml`
  - Modify: `package.json` (add npm audit script)
- **Acceptance Criteria:**
  - Dependabot creates PRs for vulnerable dependencies
  - CodeQL runs on every push
  - npm audit runs in CI
- **Test Plan:** Verify Dependabot creates PR, verify CodeQL runs
- **Effort:** S (1-2 days)

#### Task 0.6: Document Secrets Management Process
- **Description:** Create documentation for secrets setup and rotation
- **Files:**
  - New: `docs/secrets-management.md`
- **Acceptance Criteria:**
  - Document how to set secrets in KeyVault/GitHub Secrets
  - Document secrets rotation process
  - Document which secrets are required
- **Test Plan:** Review documentation for completeness
- **Effort:** S (1 day)

**Phase 0 Total Effort:** ~15-20 days

---

### Phase 1: "Alpha Compliance Baseline"

**Goal:** Establish baseline compliance capabilities for alpha/prototype deployment.

#### Task 1.1: Add File Upload with Malware Scanning
- **Description:** Implement file upload endpoint with ClamAV scanning
- **Files:**
  - New: `backend/src/middleware/upload.js` (multer configuration)
  - New: `backend/src/services/clamav.js` (ClamAV client)
  - New: `backend/src/routes/upload.js` (upload routes)
  - New: `backend/src/controllers/uploadController.js`
- **Acceptance Criteria:**
  - File upload endpoint with size limits
  - All uploads scanned by ClamAV
  - Malicious files rejected
  - Upload metadata logged
- **Test Plan:** Test file upload, test malware detection, test size limits
- **Effort:** L (5-7 days)

#### Task 1.2: Create STRA Template and Initial Assessment
- **Description:** Create Security Threat and Risk Assessment template and complete initial assessment
- **Files:**
  - New: `compliance/stra-template.md`
  - New: `compliance/stra-initial.md` (initial assessment)
- **Acceptance Criteria:**
  - STRA template includes: threats, vulnerabilities, risks, mitigations
  - Initial assessment identifies top 10 risks
  - Risk matrix with severity and likelihood
- **Test Plan:** Review STRA with security team
- **Effort:** M (3-4 days)

#### Task 1.3: Document InfoSec Classification
- **Description:** Create InfoSec classification document
- **Files:**
  - New: `compliance/infosec-classification.md`
- **Acceptance Criteria:**
  - Document data classification levels (Protected A/B/C, etc.)
  - Document data types and their classifications
  - Document handling requirements
- **Test Plan:** Review with InfoSec team
- **Effort:** S (1-2 days)

#### Task 1.4: Implement OWASP ASVS Level 1 Baseline
- **Description:** Complete OWASP ASVS Level 1 requirements
- **Files:**
  - Modify: All security middleware
  - New: `compliance/owasp-asvs-level1-checklist.md`
- **Acceptance Criteria:**
  - All Level 1 requirements met
  - Checklist completed and signed off
- **Test Plan:** Security review against ASVS Level 1
- **Effort:** M (4-5 days)

#### Task 1.5: Add Structured Event Logging Schema
- **Description:** Define and implement structured event schema for compliance events
- **Files:**
  - New: `backend/src/schemas/events.js` (event schema definitions)
  - Modify: `backend/src/utils/logger.js` (add event logger)
  - New: `backend/src/services/eventLogger.js`
- **Acceptance Criteria:**
  - Event schema defined for all compliance events
  - Events logged in structured JSON format
  - Events queryable by type, user, time range
- **Test Plan:** Verify events logged with correct schema
- **Effort:** M (3-4 days)

#### Task 1.6: Create Compliance Artifacts Directory Structure
- **Description:** Create `/compliance` directory with template artifacts
- **Files:**
  - New: `compliance/README.md` (compliance index)
  - New: `compliance/info-controller.md` (template)
  - New: `compliance/info-custodian.md` (template)
  - New: `compliance/pra-template.md` (template)
- **Acceptance Criteria:**
  - All compliance templates created
  - README explains each artifact
  - Templates are fillable
- **Test Plan:** Review templates for completeness
- **Effort:** S (2 days)

**Phase 1 Total Effort:** ~20-25 days

---

### Phase 2: "Production Hardening"

**Goal:** Complete production-ready compliance and security hardening.

#### Task 2.1: Complete OWASP ASVS Level 2 Alignment
- **Description:** Implement all Level 2 requirements
- **Files:**
  - Modify: All security middleware
  - New: `compliance/owasp-asvs-level2-checklist.md`
- **Acceptance Criteria:**
  - All Level 2 requirements met
  - Security review passed
- **Test Plan:** Security review against ASVS Level 2
- **Effort:** L (7-10 days)

#### Task 2.2: Implement Configurable RBAC
- **Description:** Make roles database-driven instead of hardcoded
- **Files:**
  - New: `backend/src/database/migrate.js` (roles table)
  - Modify: `backend/src/middleware/auth.js` (load roles from DB)
  - New: `backend/src/routes/roles.js` (role management API)
- **Acceptance Criteria:**
  - Roles stored in database
  - Roles configurable via admin API
  - Role hierarchy maintained
- **Test Plan:** Test role creation, modification, deletion
- **Effort:** M (4-5 days)

#### Task 2.3: Implement Data Retention & Disposition Schedules
- **Description:** Add automatic data archival and deletion based on retention policies
- **Files:**
  - New: `backend/src/database/migrate.js` (retention_policies table)
  - New: `backend/src/services/retention.js` (retention service)
  - New: `backend/src/jobs/retention.js` (scheduled job)
- **Acceptance Criteria:**
  - Retention policies defined per data type
  - Automatic archival after retention period
  - Automatic deletion after disposition period
  - Audit log of all retention actions
- **Test Plan:** Test archival, test deletion, test audit logging
- **Effort:** L (6-8 days)

#### Task 2.4: Add Consent/Notification Mechanism
- **Description:** Implement user consent tracking with UI and audit trail
- **Files:**
  - New: `backend/src/database/migrate.js` (consents table)
  - New: `backend/src/routes/consent.js`
  - New: `backend/src/controllers/consentController.js`
  - New: Frontend components for consent UI
- **Acceptance Criteria:**
  - Users can view/update consent preferences
  - Consent changes logged to audit log
  - Consent required for data processing
  - Notification mechanism for consent changes
- **Test Plan:** Test consent creation, modification, revocation
- **Effort:** M (5-6 days)

#### Task 2.5: Complete PIA and Privacy Risk Assessment
- **Description:** Complete Privacy Impact Assessment and Privacy Risk Assessment
- **Files:**
  - New: `compliance/pia.md` (completed PIA)
  - New: `compliance/pia-completion-plan.md` (plan)
  - New: `compliance/pra.md` (completed PRA)
- **Acceptance Criteria:**
  - PIA completed and signed off
  - PRA completed with risk mitigation
  - Both documents stored in compliance directory
- **Test Plan:** Review with privacy team
- **Effort:** M (4-5 days)

#### Task 2.6: Add SIEM-Friendly Log Shipping
- **Description:** Configure Winston to ship logs to SIEM (Azure Monitor/CloudWatch)
- **Files:**
  - Modify: `backend/src/utils/logger.js` (add SIEM transport)
  - New: `backend/src/config/siem.js` (SIEM configuration)
- **Acceptance Criteria:**
  - Logs shipped to SIEM in real-time
  - Structured JSON format compatible with SIEM
  - Log shipping configurable (can disable for dev)
- **Test Plan:** Verify logs appear in SIEM, test log format
- **Effort:** M (3-4 days)

#### Task 2.7: Add Functional Data Classification
- **Description:** Add classification fields to all tables and implement tagging system
- **Files:**
  - Modify: `backend/src/database/migrate.js` (add classification columns)
  - New: `backend/src/services/classification.js` (classification service)
  - Modify: All controllers (set classification on data creation)
- **Acceptance Criteria:**
  - All data has classification tag
  - Classification enforced on data access
  - Classification changes logged
- **Test Plan:** Test classification assignment, test classification-based access control
- **Effort:** M (4-5 days)

#### Task 2.8: Create Runbooks and Incident Response Plan
- **Description:** Create operational runbooks and incident response procedures
- **Files:**
  - New: `docs/runbooks/` (directory)
  - New: `docs/runbooks/deployment.md`
  - New: `docs/runbooks/troubleshooting.md`
  - New: `docs/incident-response.md`
- **Acceptance Criteria:**
  - Runbooks cover common operational tasks
  - Incident response plan includes escalation, communication, recovery
  - Runbooks tested in practice
- **Test Plan:** Review runbooks with operations team, test incident response
- **Effort:** M (4-5 days)

**Phase 2 Total Effort:** ~40-50 days

---

## H) Template Productization Checklist

To make this repository reusable as an enterprise template, the following must be documented and templated:

### Documentation Requirements

- [ ] **Setup Guide** (`docs/setup.md`)
  - Prerequisites (Node.js, PostgreSQL versions)
  - Step-by-step installation
  - Environment variable reference
  - Secrets generation and management
  - Database setup and migrations

- [ ] **Architecture Documentation** (`docs/architecture.md`)
  - System architecture diagram
  - Request flow diagram
  - Database schema diagram
  - Authentication flow
  - WebSocket architecture

- [ ] **Security Documentation** (`docs/security.md`)
  - Security features overview
  - Security configuration
  - OWASP ASVS compliance status
  - Security best practices
  - Threat model

- [ ] **Deployment Guide** (`docs/deployment.md`)
  - Production deployment steps
  - Environment configuration
  - Secrets management in production
  - Health check configuration
  - Monitoring setup

- [ ] **API Documentation** (`docs/api.md`)
  - API endpoints reference
  - Authentication requirements
  - Request/response examples
  - Error codes reference
  - Rate limiting information

- [ ] **Development Guide** (`docs/development.md`)
  - Development setup
  - Code structure
  - Adding new routes/controllers
  - Testing guidelines
  - Git workflow

### Configuration Templates

- [ ] **Environment Template** (`.env.example`)
  - All required environment variables
  - Optional variables with defaults
  - Documentation for each variable
  - Security notes (which secrets are required)

- [ ] **Docker Configuration** (if applicable)
  - `Dockerfile` for backend
  - `Dockerfile` for frontend
  - `docker-compose.yml` for local development
  - Production Docker configuration

- [ ] **Kubernetes Manifests** (if applicable)
  - Deployment manifests
  - Service manifests
  - ConfigMap templates
  - Secret management (external secrets)

- [ ] **CI/CD Templates** (`.github/workflows/`)
  - Build and test workflow
  - Security scanning workflow
  - Deployment workflow template

### Compliance Templates

- [ ] **Compliance Directory** (`compliance/`)
  - STRA template
  - PIA template
  - PRA template
  - InfoSec classification template
  - Info Controller/Custodian templates
  - DR/BC plan templates

### Code Quality

- [ ] **Linting Configuration**
  - ESLint config with security rules
  - Prettier config
  - Pre-commit hooks (Husky)

- [ ] **Testing Framework**
  - Unit test examples
  - Integration test examples
  - Test utilities and helpers
  - Coverage configuration

- [ ] **Type Safety** (if migrating to TypeScript)
  - TypeScript configuration
  - Type definitions
  - Migration guide from JavaScript

### Security Defaults

- [ ] **Security Middleware**
  - Helmet configuration (secure defaults)
  - CORS configuration (secure defaults)
  - Rate limiting (secure defaults)
  - CSRF protection (enabled by default)
  - Input validation (required on all endpoints)

- [ ] **Secrets Management**
  - Secrets service with KeyVault/GitHub Secrets integration
  - Secrets validation on startup
  - Secrets rotation documentation

- [ ] **Audit Logging**
  - Audit event schema
  - Audit logging service
  - Audit log query API

### Customization Points

- [ ] **Configuration System**
  - Centralized config module
  - Config validation (Zod schema)
  - Environment-specific configs
  - Config documentation

- [ ] **Plugin/Adapter System** (for enterprise integrations)
  - Authentication adapter interface (for DIG integration)
  - Logging adapter interface (for SIEM integration)
  - Secrets adapter interface (for KeyVault integration)
  - File upload adapter interface (for ClamAV integration)

### Examples and Samples

- [ ] **Example Implementations**
  - Example route with validation
  - Example controller with error handling
  - Example service with logging
  - Example frontend component with API integration

- [ ] **Sample Data**
  - Seed data for development
  - Sample users with different roles
  - Sample conversations/messages

---

## Appendix: File Reference Index

### Key Configuration Files
- `package.json` - Root package.json with workspace scripts
- `backend/package.json` - Backend dependencies
- `frontend/package.json` - Frontend dependencies
- `.env.example` - Environment variable template (if exists)

### Core Backend Files
- `backend/src/server.js` - Express server entry point
- `backend/src/config/database.js` - Database configuration
- `backend/src/config/passport.js` - Authentication strategies
- `backend/src/middleware/auth.js` - Authentication/authorization middleware
- `backend/src/middleware/errorHandler.js` - Error handling
- `backend/src/middleware/logging.js` - Request/error logging
- `backend/src/utils/logger.js` - Winston logger configuration

### Route Files
- `backend/src/routes/index.js` - Route mounting
- `backend/src/routes/auth.js` - Authentication routes
- `backend/src/routes/health.js` - Health check routes
- `backend/src/routes/llm.js` - LLM routes
- `backend/src/routes/users.js` - User management routes

### Database Files
- `backend/src/database/migrate.js` - Database migrations
- `backend/src/database/seed.js` - Database seeding

### Frontend Files
- `frontend/src/main.js` - Vue app entry point
- `frontend/src/router/index.js` - Vue Router configuration
- `frontend/vite.config.js` - Vite build configuration

### Documentation
- `README.md` - Main README
- `backend/docs/websockets.md` - WebSocket documentation
- `frontend/STANDARDS.md` - Frontend coding standards

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Next Review:** After Phase 0 completion
