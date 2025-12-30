# 🦌 Pronghorn Vue/Node/Postgres Monorepo

**Version 3.0.0**

Welcome to the Pronghorn Monorepo, a robust, enterprise-grade, and scalable full-stack template designed for modern web applications. This monorepo integrates a **Vue.js 3** frontend with a **Node.js (Express)** backend, powered by a **PostgreSQL** database. It is architected to provide a seamless developer experience with high performance and security out of the box.

This template is built with a focus on real-world production requirements, including concurrent development, Single Sign-On (SSO), WebSocket-based real-time communication, multi-provider LLM support, and comprehensive API documentation.

---

## ✨ Features

This monorepo comes packed with a wide range of features to accelerate your development process:

| Feature                  | Description                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Monorepo Structure**   | A clean, organized monorepo using npm workspaces for managing frontend and backend packages.                                             |
| **Concurrent Development** | Run both frontend and backend services simultaneously with a single `npm run dev` command, featuring HMR for Vue and live-reloading for Node. |
| **Unified Environment**  | Centralized `.env` file at the root for managing environment variables for both frontend (Vite) and backend.                               |
| **Resilient Startup**    | Application boots successfully even with missing configuration. Missing services are disabled with clear warning messages.                 |
| **Secrets Generator**    | Built-in script to generate cryptographically secure secrets for production deployment.                                                    |
| **Authentication**       | Comprehensive auth system supporting Local (email/password), Google OAuth 2.0, and Microsoft Entra ID (MSAL) with JWT tokens and secure cookies. |
| **Database**             | **PostgreSQL (v17/18)** support with connection pooling. Supports both connection string and individual parameters. Optional - app runs without DB. |
| **Real-time Communication**| **WebSocket** and **Server-Sent Events (SSE)** for real-time, bidirectional communication with LLMs.                                       |
| **Multi-Provider LLM**   | Unified service supporting **OpenAI**, **Anthropic Claude**, **Google Gemini**, **xAI Grok**, and **Groq** with streaming support.         |
| **Dynamic Model Config** | All LLM models configured in `models.json` with token limits, thinking budgets, and JSON mode support.                                     |
| **API Documentation**    | Automatic generation of **Swagger/OpenAPI** documentation from JSDoc comments, available at `/api-docs`.                                   |
| **Production Optimization**| Gzip compression for static assets, advanced code splitting, and lazy loading in Vue Router.                                              |
| **Security**             | Production-ready security middleware including **Helmet**, **CORS**, and **rate limiting**.                                                  |
| **Logging**              | Enterprise-grade logging with **Winston**, featuring daily log rotation and structured JSON output.                                        |

## 🛠️ Tech Stack

| Category      | Technology                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| **Monorepo**  | [npm Workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces), [Concurrently](https://www.npmjs.com/package/concurrently) |
| **Frontend**  | [Vue.js 3](https://vuejs.org/), [Vite](https://vitejs.dev/), [Vue Router](https://router.vuejs.org/), [Tailwind CSS](https://tailwindcss.com/), [PrimeVue](https://primevue.org/) |
| **Backend**   | [Node.js](https://nodejs.org/), [Express.js 5](https://expressjs.com/), [Passport.js](http://www.passportjs.org/), [MSAL Node](https://github.com/AzureAD/microsoft-authentication-library-for-js) |
| **Database**  | [PostgreSQL](https://www.postgresql.org/), [pg (node-postgres)](https://node-postgres.com/)               |
| **Real-time** | [ws (WebSocket)](https://www.npmjs.com/package/ws), Server-Sent Events (SSE)                             |
| **LLM SDKs**  | [openai](https://www.npmjs.com/package/openai) (also for xAI, Groq), [@anthropic-ai/sdk](https://www.npmjs.com/package/@anthropic-ai/sdk), [@google/genai](https://www.npmjs.com/package/@google/genai) |
| **Tooling**   | [Nodemon](https://nodemon.io/), [Dotenv](https://www.npmjs.com/package/dotenv), [Swagger-JSDoc](https://www.npmjs.com/package/swagger-jsdoc), [Winston](https://www.npmjs.com/package/winston) |

## 📂 Directory Structure

```
/vue-node-v3
├── .env                    # Root environment variables (shared)
├── .env.example            # Example environment file
├── .gitignore              # Standard git ignore file
├── package.json            # Root package.json with concurrent scripts
├── README.md               # This file
├── scripts/
│   ├── generate-secrets.js # Cryptographic secret generator
│   ├── secrets.sh          # Unix/Mac secret generation script
│   └── secrets.bat         # Windows secret generation script
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js # PostgreSQL with connection string support
│   │   │   ├── models.json # LLM model configurations
│   │   │   ├── passport.js # Auth strategies (resilient)
│   │   │   └── swagger.js  # OpenAPI configuration
│   │   ├── controllers/
│   │   │   └── llmController.js # SSE streaming controller
│   │   ├── database/       # Migrations and seed scripts
│   │   ├── middleware/     # Auth, error, logging middleware
│   │   ├── routes/         # API route definitions
│   │   ├── services/
│   │   │   └── llmService.js # Multi-provider LLM service
│   │   ├── utils/          # Logger and utilities
│   │   ├── websocket/
│   │   │   └── llmHandler.js # WebSocket streaming handler
│   │   └── server.js       # Main entry point (resilient startup)
│   ├── logs/               # Log files (auto-created)
│   ├── nodemon.json        # Nodemon configuration
│   └── package.json        # Backend dependencies
└── frontend/
    ├── src/
    │   ├── components/     # Reusable Vue components
    │   ├── router/         # Vue Router with lazy loading
    │   ├── services/       # API client (Axios)
    │   ├── views/          # Page components
    │   ├── App.vue         # Root Vue component
    │   └── main.js         # Vue app entry point
    ├── vite.config.js      # Vite config (reads root .env)
    └── package.json        # Frontend dependencies
```

## 🚀 Getting Started

### Prerequisites

Node.js 20+ and npm 10+ are required. PostgreSQL 17 or 18 is **optional** but recommended for full functionality.

### Installation

```bash
# 1. Extract and enter directory
unzip vue-node-v3.zip && cd vue-node-v3

# 2. Copy environment template
cp .env.example .env

# 3. Generate secure secrets (recommended for production)
npm run generate:secrets

# 4. Edit .env with your configuration (at minimum, add LLM API keys)

# 5. Install all dependencies
npm run install:all

# 6. (Optional) Setup database if PostgreSQL is available
npm run db:migrate
npm run db:seed

# 7. Start development servers
npm run dev
```

### Access Points

| Service | URL |
|---------|-----|
| Frontend (dev) | http://localhost:5173 |
| Backend API | http://localhost:3000/api/v1 |
| Swagger Docs | http://localhost:3000/api-docs |
| Health Check | http://localhost:3000/api/v1/health |
| WebSocket | ws://localhost:3000/ws |

## 🔧 Environment Configuration

The application is designed to be **resilient** - it will start and run even if some configuration is missing. Missing services will be disabled with clear warning messages.

### Database Configuration

Two methods are supported. Connection string takes precedence if both are provided:

```env
# Method 1: Connection String (recommended for production)
DB_CONNECTION_STRING=postgresql://user:password@localhost:5432/pronghorn?sslmode=require

# Method 2: Individual Parameters
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pronghorn
DB_USER=postgres
DB_PASSWORD=your_password
```

If neither is configured, the app runs without database functionality (no persistent sessions, no local auth).

### Security Secrets

If not provided, secrets are **auto-generated** at startup with warning messages. For production, generate persistent secrets:

```bash
# Using npm script
npm run generate:secrets

# Or on Unix/Mac
./scripts/secrets.sh

# Or on Windows
scripts\secrets.bat
```

### LLM Provider Configuration

| Provider | Environment Variable | Example Models |
|----------|---------------------|----------------|
| OpenAI | `OPENAI_API_KEY` | gpt-5.2-pro, gpt-4.1, gpt-4.1-mini |
| Anthropic | `ANTHROPIC_API_KEY` | claude-opus-4-5, claude-sonnet-4-5 |
| Google | `GOOGLE_AI_API_KEY` | gemini-2.5-pro, gemini-2.5-flash |
| xAI | `XAI_API_KEY` | grok-4-1-fast-reasoning, grok-code-fast-1 |
| Groq | `GROQ_API_KEY` | llama-4-maverick, qwen3-32b |

Only configure the providers you need. Unconfigured providers are disabled with informative messages.

## 🤖 LLM Integration

### Model Configuration

All models are defined in `backend/src/config/models.json` with comprehensive settings:

```json
{
  "id": "gemini-2.5-pro",
  "provider": "google",
  "name": "Gemini 2.5 Pro",
  "maxTokens": 1000000,
  "maxOutputTokens": 65536,
  "thinkingEnabled": true,
  "thinkingBudget": { "min": 1024, "max": 32768, "default": 8192 },
  "recommendedTemperature": 0.7,
  "jsonMode": "response_mime_type",
  "supportsVision": true,
  "supportsStreaming": true
}
```

### API Usage Examples

**REST API (Standard Response)**
```bash
curl -X POST http://localhost:3000/api/v1/llm/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!", "model": "gpt-4.1"}'
```

**REST API (SSE Streaming)**
```bash
curl -X POST http://localhost:3000/api/v1/llm/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Write a poem", "model": "claude-sonnet-4-5"}'
```

**WebSocket Streaming**
```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'chat',
    requestId: 'req-1',
    content: 'Explain quantum computing',
    model: 'gemini-2.5-pro'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'chat_chunk') {
    process.stdout.write(data.content);
  }
};
```

## 💻 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start frontend and backend concurrently |
| `npm run build` | Build frontend to `frontend/dist` |
| `npm run start` | Start production server (serves built frontend) |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed` | Seed database with test data |
| `npm run generate:secrets` | Generate secure secrets for .env |
| `npm run install:all` | Install all workspace dependencies |
| `npm run clean` | Remove all node_modules and dist |

## 🔒 Security

The application implements multiple security layers including Helmet for HTTP headers, CORS configured for the specified frontend URL, rate limiting on API endpoints, HTTPOnly cookies for tokens, and bcrypt password hashing. The `start:secure` script runs Node.js with experimental permissions for enhanced security.

## 📜 License

This project is licensed under the MIT License.

---

## 📋 Version History

| Version | Changes |
|---------|---------|
| 3.0.0 | Added xAI/Groq support, SSE streaming, resilient startup, secrets generator, DB connection string |
| 2.0.0 | Initial release with OpenAI, Anthropic, Google support |
