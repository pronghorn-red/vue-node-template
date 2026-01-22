# LLM Integration (Frontend)

## What it is

The LLM integration composable (`useLlm`) provides a unified interface for interacting with LLM providers. It supports both WebSocket and SSE streaming, model selection, parallel requests, and task management.

## Where it lives (code map)

- **`frontend/src/composables/useLlm.js`** - LLM composable with streaming support
- **`frontend/src/components/Chat.vue`** - Chat UI component
- **`frontend/src/views/ChatView.vue`** - Chat view page
- **`frontend/src/composables/useWebSocket.js`** - WebSocket transport

## How it works

### Streaming Methods

1. **WebSocket** (default if connected): Real-time bidirectional communication
2. **SSE** (fallback): Server-Sent Events for one-way streaming

### Model Management

- Models loaded from `/api/v1/llm/models`
- Provider status from `/api/v1/llm/providers`
- Automatic model selection based on availability

### Task System

Each LLM request creates a task:
- Client-generated task ID
- Status tracking (pending, streaming, done, error)
- Content accumulation
- Promise-based completion

## How to use it

### Basic Usage

```javascript
import { useLlm } from '@/composables/useLlm'

const {
  models,
  selectedModel,
  streamChat,
  startChat,
  cancel,
  tasks
} = useLlm()

// Initialize (fetch models)
await initialize()

// Select a model
selectModel('gpt-4.1')

// Stream a chat
const result = await streamChat(
  [{ role: 'user', content: 'Hello' }],
  'You are a helpful assistant',
  0.7,
  (chunk) => console.log('Chunk:', chunk)
)

// Start chat with task tracking
const taskId = startChat({
  messages: [{ role: 'user', content: 'Hello' }],
  model: 'gpt-4.1',
  onChunk: (content) => console.log('Chunk:', content)
})

// Cancel a request
cancel(taskId)
```

### Parallel Requests

```javascript
const { startBatch, streamBatch } = useLlm()

// Start multiple requests
const taskIds = startBatch([
  { messages: [{ role: 'user', content: 'Question 1' }] },
  { messages: [{ role: 'user', content: 'Question 2' }] },
  { messages: [{ role: 'user', content: 'Question 3' }] }
])

// Wait for all
const results = await streamBatch([
  { messages: [{ role: 'user', content: 'Question 1' }] },
  { messages: [{ role: 'user', content: 'Question 2' }] }
])
```

### Model Selection

```javascript
const { models, selectModel, getModelsByProvider } = useLlm()

// Get all models
console.log(models.value)

// Get models by provider
const openaiModels = getModelsByProvider('openai')

// Select a model
selectModel('gpt-4.1')
```

### Stream Method Selection

```javascript
const { setStreamMethod, streamMethod } = useLlm()

// Force WebSocket
setStreamMethod('ws')

// Force SSE
setStreamMethod('sse')

// Use global setting
const taskId = startChat({
  messages: [...],
  forceMethod: 'sse'  // Override global setting
})
```

## Configuration

### Environment Variables

```bash
VITE_API_BASE_URL=/api/v1
VITE_WS_URL=ws://localhost:3000
```

### Model Configuration

Models are configured server-side in `backend/src/config/models.json`. The frontend fetches available models from the API.

## Extending / modifying

### Custom Streaming Logic

```javascript
// In useLlm.js
const customStreamChat = async (messages, options = {}) => {
  // Custom preprocessing
  const processedMessages = preprocessMessages(messages)
  
  // Custom streaming
  return streamChat(processedMessages, options.systemPrompt, options.temperature)
}
```

### Custom Task Handling

```javascript
const { createTask, tasks } = useLlm()

const taskId = createTask('llm', {
  customField: 'value',
  onCustomEvent: (data) => {
    // Handle custom event
  }
})
```

## Troubleshooting

### Models not loading

- **Check API**: Ensure `/api/v1/llm/models` endpoint is accessible
- **Check initialization**: Call `initialize()` before using models
- **Check network**: Ensure API requests are not blocked

### Streaming not working

- **Check WebSocket**: Ensure WebSocket is connected for WebSocket streaming
- **Check SSE**: Ensure SSE endpoint is accessible for SSE fallback
- **Check model**: Ensure selected model is available

### Tasks not completing

- **Check task ID**: Ensure task ID matches between start and completion
- **Check connection**: Ensure WebSocket/SSE connection is stable
- **Check errors**: Review task error state

## Security considerations

1. **Input Validation**: Validate message content before sending
2. **Rate Limiting**: Respect server-side rate limits
3. **Token Management**: Ensure tokens are valid for authenticated requests

## Related docs

- [WebSocket](./websocket.md) - WebSocket transport
- [LLM Service](../backend/docs/llm-service.md) - Server-side LLM service
- [API Client](./api-client.md) - REST API calls
