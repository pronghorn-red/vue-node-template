# WebSocket Architecture

## Overview

This document describes the WebSocket-based real-time communication system for the Pronghorn template. The WebSocket protocol is the primary transport for:

- **LLM streaming** - Real-time AI responses with parallel request support
- **Tool execution** - Server-side tool calls with streaming results
- **Future extensions** - Any real-time bidirectional communication

## Design Principles

1. **Resilient Startup** - System boots even without database or authentication configured
2. **Domain-Based Routing** - Messages use `domain:action` format for clear separation
3. **Connection-Scoped Isolation** - Each connection has isolated state; no cross-user data leakage
4. **Client-Generated Task IDs** - Enables immediate tracking without server round-trip
5. **Parallel Request Support** - Unlimited concurrent requests per connection
6. **Unified Authentication** - Same JWT validation as REST API endpoints

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENT                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  useWebSocket()     - Connection management, auth, reconnection         │
│  useLlm()           - Single chat interface (uses batch internally)     │
│  useLlmBatch()      - Parallel LLM requests with reactive state         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ WebSocket (wss://host/ws)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         socketController.js                              │
├─────────────────────────────────────────────────────────────────────────┤
│  • Connection lifecycle management                                       │
│  • Authentication (JWT token validation)                                 │
│  • Message routing by domain prefix                                      │
│  • Connection tracking (database or in-memory)                          │
│  • Rate limiting and blocking                                            │
│  • Heartbeat/keepalive                                                   │
└─────────────────────────────────────────────────────────────────────────┘
                    │                           │
          ┌─────────┴─────────┐       ┌─────────┴─────────┐
          ▼                   ▼       ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  llmHandler.js  │  │ toolHandler.js  │  │ futureHandler   │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ • llm:start     │  │ • tool:execute  │  │ • domain:action │
│ • llm:cancel    │  │ • tool:cancel   │  │ • ...           │
│ • llm:cancel_all│  │ • tool:list     │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Connection Lifecycle

### 1. Connection Establishment

```
Client                                  Server
   │                                       │
   │──── WebSocket Connect (/ws) ─────────>│
   │     ?token=<JWT> (optional)           │
   │                                       │
   │<─── connection:welcome ──────────────│
   │     { connectionId, authenticated,    │
   │       availableProviders, ... }       │
```

### 2. Authentication (if not in URL)

```
   │──── auth:login ──────────────────────>│
   │     { token: "<JWT>" }                │
   │                                       │
   │<─── auth:success ────────────────────│
   │     { user: { id, email, claims } }   │
   │                                       │
   │     OR                                │
   │                                       │
   │<─── auth:error ──────────────────────│
   │     { error: "Invalid token" }        │
```

### 3. Task Execution (e.g., LLM)

```
   │──── llm:start ───────────────────────>│
   │     { taskId, model, messages, ... }  │
   │                                       │
   │<─── llm:started ─────────────────────│
   │     { taskId, model, provider }       │
   │                                       │
   │<─── llm:chunk ───────────────────────│
   │     { taskId, content }               │
   │<─── llm:chunk ───────────────────────│
   │     { taskId, content }               │
   │     ... (streaming)                   │
   │                                       │
   │<─── llm:done ────────────────────────│
   │     { taskId, finishReason }          │
```

### 4. Cancellation

```
   │──── llm:cancel ──────────────────────>│
   │     { taskId }                        │
   │                                       │
   │<─── llm:cancelled ───────────────────│
   │     { taskId }                        │
```

### 5. Disconnection

```
   │──── connection:close ────────────────>│
   │     (or network disconnect)           │
   │                                       │
   │     [Server aborts all active tasks]  │
   │     [Server updates connection record]│
```

## Message Protocol

### Message Format

All messages are JSON with the following structure:

```typescript
// Client → Server
{
  type: string;        // "domain:action" format
  taskId?: string;     // Client-generated UUID for tracking
  ...payload          // Action-specific data
}

// Server → Client
{
  type: string;        // "domain:action" or "domain:event"
  taskId?: string;     // Echoed from client for correlation
  timestamp: string;   // ISO 8601 timestamp
  ...payload          // Response-specific data
}
```

### Domain Namespaces

| Domain | Description | Authentication Required |
|--------|-------------|------------------------|
| `connection` | Connection lifecycle events | No |
| `auth` | Authentication operations | No |
| `llm` | LLM streaming operations | Configurable |
| `tool` | Tool execution (future) | Yes |
| `admin` | Administrative operations | Yes (admin role) |

### Message Types Reference

#### Connection Domain

| Type | Direction | Description |
|------|-----------|-------------|
| `connection:welcome` | S→C | Sent on successful connection |
| `connection:error` | S→C | Connection-level error |
| `connection:blocked` | S→C | Connection blocked by admin |

#### Auth Domain

| Type | Direction | Description |
|------|-----------|-------------|
| `auth:login` | C→S | Authenticate with JWT token |
| `auth:success` | S→C | Authentication successful |
| `auth:error` | S→C | Authentication failed |
| `auth:logout` | C→S | Explicitly logout |
| `auth:refresh` | C→S | Refresh authentication token |

#### LLM Domain

| Type | Direction | Description |
|------|-----------|-------------|
| `llm:start` | C→S | Start streaming LLM request |
| `llm:started` | S→C | Request acknowledged |
| `llm:chunk` | S→C | Content chunk received |
| `llm:thinking` | S→C | Thinking content (Claude, etc.) |
| `llm:done` | S→C | Request completed |
| `llm:error` | S→C | Request failed |
| `llm:cancel` | C→S | Cancel specific request |
| `llm:cancel_all` | C→S | Cancel all active requests |
| `llm:cancelled` | S→C | Request was cancelled |
| `llm:providers` | S→C | Available providers list |
| `llm:models` | S→C | Available models list |

#### System Messages

| Type | Direction | Description |
|------|-----------|-------------|
| `ping` | C→S | Keepalive ping |
| `pong` | S→C | Keepalive response |
| `error` | S→C | Generic error |

## Authentication

### Token Validation

The WebSocket system uses the same JWT validation as REST API endpoints:

```javascript
// Token can be provided via:
// 1. URL query parameter: ws://host/ws?token=<JWT>
// 2. First message: { type: "auth:login", token: "<JWT>" }
// 3. Cookie (same-origin only)
```

### Claims Structure

Upon successful authentication, the server extracts claims:

```javascript
{
  validated: true,
  claims: {
    id: "user-uuid",
    email: "user@example.com",
    displayName: "User Name",
    isAdmin: false,
    isSuperAdmin: false,
    isSubscriber: true,
    accountStatus: "active",
    projects: ["proj-1", "proj-2"],
    domain: "example.com",
    // ... extensible
  }
}
```

### Permission Checking

Each message type can require specific permissions:

```javascript
// Configuration in socketController
const MESSAGE_PERMISSIONS = {
  'llm:start': { requireAuth: false },      // Anonymous allowed
  'llm:cancel': { requireAuth: false },
  'tool:execute': { requireAuth: true },    // Must be authenticated
  'admin:connections': { 
    requireAuth: true, 
    requireClaim: 'isAdmin' 
  },
};
```

## Connection Tracking

### Database Mode (PostgreSQL)

When database is configured, connections are tracked in the `websocket_connections` table:

```sql
CREATE TABLE websocket_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id VARCHAR(64) UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  ip_address INET,
  user_agent TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  disconnected_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  is_authenticated BOOLEAN DEFAULT FALSE,
  is_blocked BOOLEAN DEFAULT FALSE,
  blocked_reason TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_ws_conn_user ON websocket_connections(user_id);
CREATE INDEX idx_ws_conn_active ON websocket_connections(disconnected_at) 
  WHERE disconnected_at IS NULL;
CREATE INDEX idx_ws_conn_blocked ON websocket_connections(is_blocked) 
  WHERE is_blocked = TRUE;
```

### In-Memory Mode

When database is not configured, connections are tracked in-memory:

```javascript
const connections = new Map();
// Key: connectionId
// Value: {
//   ws: WebSocket,
//   user: Object | null,
//   claims: Object,
//   connectedAt: Date,
//   lastActivityAt: Date,
//   messageCount: number,
//   isAuthenticated: boolean,
//   isBlocked: boolean,
//   activeTasks: Map<taskId, AbortController>,
//   metadata: Object
// }
```

### Blocking Connections

Administrators can block connections:

```javascript
// Via admin message
{ type: "admin:block_connection", connectionId: "xxx", reason: "Abuse" }

// Via database (if configured)
UPDATE websocket_connections SET is_blocked = TRUE WHERE connection_id = 'xxx';
```

Blocked connections receive:
```javascript
{ type: "connection:blocked", reason: "Your connection has been blocked" }
```

## Rate Limiting

### Per-Connection Limits

```javascript
const RATE_LIMITS = {
  messagesPerMinute: 60,
  llmRequestsPerMinute: 20,
  maxConcurrentTasks: 10,
  maxMessageSize: 1024 * 1024, // 1MB
};
```

### Exceeded Limits Response

```javascript
{
  type: "error",
  code: "RATE_LIMIT_EXCEEDED",
  error: "Too many requests",
  retryAfter: 60 // seconds
}
```

## Error Handling

### Error Response Format

```javascript
{
  type: "error" | "llm:error" | "auth:error",
  taskId?: string,         // If related to a specific task
  code: string,            // Machine-readable error code
  error: string,           // Human-readable message
  details?: any,           // Additional context (dev mode only)
  retryable: boolean       // Whether client should retry
}
```

### Error Codes

| Code | Description | Retryable |
|------|-------------|-----------|
| `UNAUTHORIZED` | Authentication required | No |
| `FORBIDDEN` | Insufficient permissions | No |
| `INVALID_MESSAGE` | Malformed message | No |
| `UNKNOWN_TYPE` | Unknown message type | No |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Yes |
| `PROVIDER_ERROR` | LLM provider error | Yes |
| `TASK_NOT_FOUND` | Task ID not found | No |
| `CONNECTION_BLOCKED` | Connection is blocked | No |
| `INTERNAL_ERROR` | Server error | Yes |

## Parallel Request Handling

### Client-Side Pattern

```javascript
// Dispatch multiple requests
const taskIds = ['task-1', 'task-2', 'task-3'].map(id => {
  sendMessage({
    type: 'llm:start',
    taskId: id,
    model: 'gemini-2.0-flash',
    messages: [{ role: 'user', content: `Request ${id}` }]
  });
  return id;
});

// Track in reactive state
const tasks = reactive({
  'task-1': { status: 'pending', content: '' },
  'task-2': { status: 'pending', content: '' },
  'task-3': { status: 'pending', content: '' },
});

// Single listener routes all responses
onMessage((msg) => {
  if (msg.taskId && tasks[msg.taskId]) {
    switch (msg.type) {
      case 'llm:chunk':
        tasks[msg.taskId].content += msg.content;
        break;
      case 'llm:done':
        tasks[msg.taskId].status = 'done';
        break;
      case 'llm:error':
        tasks[msg.taskId].status = 'error';
        tasks[msg.taskId].error = msg.error;
        break;
    }
  }
});
```

### Server-Side Isolation

Each connection maintains independent task state:

```javascript
// Per-connection task registry
connection.activeTasks = new Map();

// Task lifecycle
connection.activeTasks.set(taskId, {
  abortController: new AbortController(),
  startedAt: Date.now(),
  type: 'llm'
});

// On completion/cancellation
connection.activeTasks.delete(taskId);

// On disconnect - cleanup all
connection.activeTasks.forEach((task) => {
  task.abortController.abort();
});
```

## Binary/Multimodal Support

### Image Input (Base64)

```javascript
{
  type: "llm:start",
  taskId: "task-123",
  model: "gemini-2.0-flash",
  messages: [{
    role: "user",
    content: [
      { type: "text", text: "What's in this image?" },
      { 
        type: "image", 
        data: "<base64-encoded-image>",
        mediaType: "image/png"
      }
    ]
  }]
}
```

### Large File Handling

For files > 1MB, use URL references:

```javascript
{
  type: "llm:start",
  taskId: "task-123",
  model: "gemini-2.0-flash",
  messages: [{
    role: "user",
    content: [
      { type: "text", text: "Analyze this document" },
      { 
        type: "document", 
        url: "https://storage.example.com/doc.pdf",
        mediaType: "application/pdf"
      }
    ]
  }]
}
```

## Load Balancing Considerations

### Sticky Sessions

WebSocket connections require sticky sessions (session affinity) when running multiple server instances:

**nginx configuration:**
```nginx
upstream backend {
    ip_hash;  # Or use cookie-based
    server backend1:3000;
    server backend2:3000;
}

location /ws {
    proxy_pass http://backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 86400;
}
```

### Cross-Server Communication (Future)

For features requiring cross-server state (e.g., admin broadcasting), implement Redis pub/sub:

```javascript
// Not implemented in base template
// Add if needed for multi-server deployments
```

## Configuration

### Environment Variables

```bash
# WebSocket-specific settings (optional)
WS_PATH=/ws                          # WebSocket endpoint path
WS_HEARTBEAT_INTERVAL=30000          # Heartbeat interval (ms)
WS_MESSAGE_SIZE_LIMIT=1048576        # Max message size (bytes)
WS_REQUIRE_AUTH=false                # Require auth for all messages
WS_ALLOW_ANONYMOUS=true              # Allow unauthenticated connections
```

### Runtime Configuration

```javascript
// In socketController.js
const CONFIG = {
  path: process.env.WS_PATH || '/ws',
  heartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL) || 30000,
  messageSizeLimit: parseInt(process.env.WS_MESSAGE_SIZE_LIMIT) || 1024 * 1024,
  requireAuth: process.env.WS_REQUIRE_AUTH === 'true',
  allowAnonymous: process.env.WS_ALLOW_ANONYMOUS !== 'false',
};
```

## Security Considerations

1. **Never broadcast messages** - Always send only to originating connection
2. **Validate all input** - Check message structure before processing
3. **Connection-scoped state** - No shared state between connections
4. **Task ownership validation** - Can only cancel own tasks
5. **Rate limiting** - Prevent abuse and resource exhaustion
6. **Token expiration** - Respect JWT expiration during long connections
7. **Cleanup on disconnect** - Abort orphaned tasks, release resources

## Monitoring & Debugging

### Connection Statistics

```javascript
// GET /api/v1/admin/websocket/stats
{
  totalConnections: 42,
  authenticatedConnections: 38,
  anonymousConnections: 4,
  activeTasksCount: 12,
  messagesPerMinute: 156,
  topUsers: [...]
}
```

### Debug Mode

Enable verbose logging:
```bash
LOG_LEVEL=debug
```

### Health Check

```javascript
// Included in /api/v1/health response
{
  websocket: {
    status: "healthy",
    connections: 42,
    uptime: "2h 15m"
  }
}
```

## Migration Guide

### From Previous llmHandler.js

The previous implementation is replaced by the new architecture:

| Old | New |
|-----|-----|
| `llmHandler.initializeWebSocket()` | `socketController.initialize()` |
| `type: 'chat'` | `type: 'llm:start'` |
| `type: 'cancel'` | `type: 'llm:cancel'` |
| `type: 'chat_chunk'` | `type: 'llm:chunk'` |
| `type: 'chat_done'` | `type: 'llm:done'` |
| `type: 'chat_error'` | `type: 'llm:error'` |

### Client-Side Updates

```javascript
// Old
sendMessage({ type: 'chat', content: 'Hello', requestId: '123' });

// New
sendMessage({ type: 'llm:start', taskId: '123', messages: [{ role: 'user', content: 'Hello' }] });
```