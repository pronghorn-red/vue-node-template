# WebSocket (Frontend)

## What it is

The frontend WebSocket composable (`useWebSocket`) manages the WebSocket connection to the server, handles authentication, domain-based message routing, task management, and automatic reconnection with exponential backoff.

## Where it lives (code map)

- **`frontend/src/composables/useWebSocket.js`** - WebSocket connection manager, message routing, task management
- **`frontend/src/components/AppLayout.vue`** - Connection monitoring and reconnection logic
- **`frontend/src/composables/useAuth.js`** - Token refresh callback integration

## How it works

### Connection Lifecycle

1. **Initialization**: Reads token from sessionStorage
2. **Connection**: Connects to `ws://host/ws?token=<jwt>` or sends `auth:login` message
3. **Authentication**: Server validates token, sends `connection:welcome`
4. **Message Routing**: Messages use `domain:action` format (e.g., `llm:start`)
5. **Reconnection**: Automatic reconnection with exponential backoff on disconnect

### Task Management

Each WebSocket request creates a task with:
- Unique task ID (client-generated)
- Domain (e.g., 'llm', 'tool')
- Status (pending, streaming, done, error)
- Content accumulation
- Promise resolution

## How to use it

### Basic Usage

```javascript
import { useWebSocket } from '@/composables/useWebSocket'

const {
  isConnected,
  isAuthenticated,
  sendMessage,
  createTask,
  waitForTask,
  tasks
} = useWebSocket()

// Send a message
sendMessage({
  type: 'llm:start',
  taskId: 'task-123',
  model: 'gpt-4.1',
  messages: [{ role: 'user', content: 'Hello' }]
})

// Create and track a task
const taskId = createTask('llm', {
  taskId: 'custom-id',
  model: 'gpt-4.1',
  onChunk: (content) => console.log('Chunk:', content)
})

// Wait for task completion
const result = await waitForTask(taskId)
```

### Domain Listeners

```javascript
const { addDomainListener } = useWebSocket()

// Listen to all messages in a domain
addDomainListener('llm', (message) => {
  console.log('LLM message:', message)
})
```

### Manual Connection

```javascript
const { connect, disconnect, triggerConnect } = useWebSocket()

// Connect manually
await connect()

// Disconnect
disconnect()

// Trigger reconnection
await triggerConnect()
```

## Configuration

### Environment Variables

```bash
VITE_WS_URL=ws://localhost:3000
```

### Connection Settings

Edit `frontend/src/composables/useWebSocket.js`:

```javascript
const CONFIG = {
  wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:3000',
  wsPath: '/ws',
  heartbeatInterval: 30000,
  reconnectMaxAttempts: 5,
  reconnectBaseDelay: 1000,
  reconnectMaxDelay: 30000
}
```

## Extending / modifying

### Custom Domain Handler

```javascript
// In useWebSocket.js
const handleCustomDomain = (message) => {
  if (message.type === 'custom:action') {
    // Handle custom action
  }
}

// Register handler
socketController.registerHandler('custom', handleCustomDomain)
```

### Custom Reconnection Logic

```javascript
// In AppLayout.vue
const customReconnect = () => {
  // Custom reconnection logic
  if (shouldReconnect()) {
    triggerConnect()
  }
}
```

## Troubleshooting

### WebSocket not connecting

- **Check token**: Ensure access token is in sessionStorage
- **Check URL**: Ensure `VITE_WS_URL` is correct
- **Check server**: Ensure WebSocket server is running
- **Check CORS**: Ensure WebSocket endpoint allows origin

### Messages not received

- **Check connection**: Ensure `isConnected.value === true`
- **Check domain**: Ensure message type matches domain format
- **Check task ID**: Ensure task is created before sending message

### Reconnection not working

- **Check backoff**: Reconnection uses exponential backoff
- **Check auth**: Ensure token is still valid
- **Check network**: Ensure network connection is stable

## Security considerations

1. **Token in URL**: Token passed in WebSocket URL query parameter
2. **Token Refresh**: WebSocket triggers token refresh on auth errors
3. **Connection Isolation**: Each connection has isolated state

## Related docs

- [WebSocket Architecture](../backend/docs/websockets.md) - Server-side WebSocket docs
- [Authentication](./authentication.md) - Token management
- [LLM Integration](./llm-integration.md) - LLM WebSocket usage
