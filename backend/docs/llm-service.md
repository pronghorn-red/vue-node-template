# LLM Service

## What it is

The LLM service provides a unified interface for streaming chat completions from multiple LLM providers (OpenAI, Anthropic Claude, Google Gemini, xAI Grok, and Groq). It supports both Server-Sent Events (SSE) for REST API streaming and WebSocket streaming, with automatic provider detection and model configuration.

## Where it lives (code map)

- **`backend/src/services/llmService.js`** - Core streaming service, provider initialization, model configuration
- **`backend/src/controllers/llmController.js`** - SSE streaming controller, REST API endpoints
- **`backend/src/routes/llm.js`** - LLM API route definitions
- **`backend/src/config/models.json`** - Model configuration with provider mappings, capabilities, and limits
- **`backend/src/websocket/llmHandler.js`** - WebSocket message handler for LLM requests (see [WebSockets](./websockets.md))

## How it works

### Provider Initialization

On server startup, the service initializes clients for each configured provider:

```javascript
// Checks environment variables for API keys
if (isValidKey(process.env.OPENAI_API_KEY)) {
  clients.openai.instance = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  clients.openai.configured = true;
}
```

Providers are only initialized if valid API keys are present (not empty, not placeholder values).

### Streaming Architecture

The service uses a callback-based streaming pattern that works with both SSE and WebSocket:

```javascript
await streamChat({
  model: 'gpt-4.1',
  messages: [{ role: 'user', content: 'Hello' }],
  onChunk: ({ type, content, finishReason }) => {
    if (type === 'content') {
      // Handle content chunk
    } else if (type === 'done') {
      // Handle completion
    }
  }
});
```

### Model Configuration

Models are defined in `backend/src/config/models.json` with:

- **Provider mapping**: Which provider owns the model
- **Capabilities**: Vision, streaming, thinking, JSON mode
- **Limits**: Max tokens, output tokens, thinking budget
- **Recommended settings**: Temperature, JSON mode type

The service automatically detects the provider from the model ID.

### Provider-Specific Handling

Each provider has unique streaming implementations:

- **Google Gemini**: Uses `generateContentStream` with role mapping (assistant → model)
- **OpenAI/xAI/Groq**: Uses OpenAI-compatible `chat.completions.create` with streaming
- **Anthropic**: Uses `messages.stream` with separate system prompt handling

## How to use it

### SSE Streaming (REST API)

```javascript
POST /api/v1/llm/chat/stream
Content-Type: application/json
Authorization: Bearer <token>  # Optional

{
  "model": "gpt-4.1",
  "messages": [
    { "role": "user", "content": "Hello, how are you?" }
  ],
  "systemPrompt": "You are a helpful assistant.",
  "temperature": 0.7,
  "maxTokens": 1000
}

Response: text/event-stream
event: connected
data: {"status":"connected","timestamp":1234567890}

event: start
data: {"model":"gpt-4.1","provider":"openai"}

event: content
data: {"content":"I'm doing well"}

event: content
data: {"content":", thank you"}

event: done
data: {"finishReason":"stop","chunkCount":15}

event: end
```

### WebSocket Streaming

See [WebSockets Documentation](./websockets.md#llm-domain) for WebSocket usage.

### Get Available Models

```javascript
GET /api/v1/llm/models

Response:
{
  "success": true,
  "data": {
    "models": [
      {
        "id": "gpt-4.1",
        "provider": "openai",
        "name": "GPT-4.1",
        "available": true,
        "maxTokens": 128000,
        "supportsVision": true,
        "supportsStreaming": true
      },
      ...
    ],
    "count": 25
  }
}
```

### Get Provider Status

```javascript
GET /api/v1/llm/providers

Response:
{
  "success": true,
  "data": {
    "providers": {
      "openai": { "configured": true },
      "anthropic": { "configured": true },
      "google": { "configured": false }
    },
    "available": ["openai", "anthropic"],
    "default": "openai"
  }
}
```

### Generate Embeddings

```javascript
POST /api/v1/llm/embeddings
Authorization: Bearer <token>

{
  "model": "text-embedding-3-large",
  "input": "Text to embed"  // or ["text1", "text2"]
}

Response:
{
  "success": true,
  "data": {
    "embeddings": [[0.123, -0.456, ...]],
    "usage": {
      "prompt_tokens": 5,
      "total_tokens": 5
    }
  }
}
```

## Configuration

### Environment Variables

```bash
# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Google AI
GOOGLE_AI_API_KEY=...

# xAI (Grok)
XAI_API_KEY=xai-...

# Groq
GROQ_API_KEY=gsk_...
```

### Model Configuration

Edit `backend/src/config/models.json` to add/modify models:

```json
{
  "models": [
    {
      "id": "custom-model-id",
      "provider": "openai",
      "name": "Custom Model Name",
      "maxTokens": 128000,
      "maxOutputTokens": 32768,
      "thinkingEnabled": false,
      "recommendedTemperature": 0.7,
      "jsonMode": "response_format",
      "supportsVision": true,
      "supportsStreaming": true
    }
  ]
}
```

### Provider Configuration

Providers are defined in `backend/src/config/models.json`:

```json
{
  "providers": {
    "openai": {
      "name": "OpenAI",
      "baseUrl": "https://api.openai.com/v1",
      "envKey": "OPENAI_API_KEY",
      "sdkType": "openai"
    }
  }
}
```

## Extending / modifying

### Adding a New Provider

1. Install the provider's SDK:
   ```bash
   npm install @provider/sdk
   ```

2. Add provider config in `backend/src/config/models.json`:
   ```json
   {
     "providers": {
       "newprovider": {
         "name": "New Provider",
         "baseUrl": "https://api.newprovider.com",
         "envKey": "NEWPROVIDER_API_KEY",
         "sdkType": "newprovider"
       }
     }
   }
   ```

3. Initialize client in `backend/src/services/llmService.js`:
   ```javascript
   const clients = {
     // ... existing clients
     newprovider: { instance: null, configured: false }
   };

   if (isValidKey(process.env.NEWPROVIDER_API_KEY)) {
     clients.newprovider.instance = new NewProviderSDK({
       apiKey: process.env.NEWPROVIDER_API_KEY
     });
     clients.newprovider.configured = true;
   }
   ```

4. Add streaming function:
   ```javascript
   async function streamNewProvider(options, onChunk) {
     const { model, messages, systemPrompt, temperature, maxTokens } = options;
     const client = clients.newprovider.instance;
     
     if (!client) throw new Error("New Provider not configured");
     
     // Implement provider-specific streaming
     const stream = await client.chat.stream({
       model,
       messages,
       system: systemPrompt,
       temperature,
       max_tokens: maxTokens
     });
     
     for await (const chunk of stream) {
       if (chunk.content) {
         onChunk({ type: "content", content: chunk.content });
       }
       if (chunk.finishReason) {
         onChunk({ type: "done", finishReason: chunk.finishReason });
         return;
       }
     }
   }
   ```

5. Add to switch statement in `streamChat()`:
   ```javascript
   switch (actualProvider) {
     // ... existing cases
     case "newprovider":
       return streamNewProvider(options, onChunk);
   }
   ```

### Custom Model Capabilities

Add custom fields to model config in `models.json`:

```json
{
  "id": "custom-model",
  "provider": "openai",
  "customCapability": true,
  "customSettings": {
    "setting1": "value1"
  }
}
```

Access in code:
```javascript
const modelConfig = getModelConfig('custom-model');
if (modelConfig.customCapability) {
  // Use custom capability
}
```

### Custom Streaming Logic

Modify provider-specific streaming functions in `llmService.js`:

```javascript
async function streamGoogle(options, onChunk) {
  // Add custom pre-processing
  const processedMessages = preprocessMessages(options.messages);
  
  // Add custom error handling
  try {
    const response = await client.models.generateContentStream({
      model: options.model,
      contents: processedMessages
    });
    // ... existing streaming logic
  } catch (error) {
    onChunk({ type: "error", error: error.message });
    throw error;
  }
}
```

## Troubleshooting

### "Provider not configured" errors

- **Check API key**: Ensure environment variable is set and not a placeholder
- **Check key format**: Some providers require specific prefixes (e.g., `sk-` for OpenAI)
- **Check initialization**: Look for provider initialization logs on server startup
- **Check environment**: Ensure `.env` file is loaded correctly

### Streaming not working

- **Check model availability**: Use `GET /api/v1/llm/models` to see available models
- **Check provider status**: Use `GET /api/v1/llm/providers` to see configured providers
- **Check model ID**: Ensure model ID matches exactly (case-sensitive)
- **Check logs**: Server logs show streaming errors and provider responses

### SSE connection drops

- **Check timeout**: Some proxies/timeouts may close long-lived SSE connections
- **Check network**: Ensure stable network connection
- **Check client**: Ensure client properly handles SSE events
- **Use WebSocket**: WebSocket may be more reliable for long streams

### Rate limiting errors

- **Check provider limits**: Each provider has different rate limits
- **Check API key tier**: Free tier keys have lower limits
- **Implement backoff**: Add exponential backoff for retries
- **Check usage**: Monitor provider dashboard for usage limits

### Model not found errors

- **Check model.json**: Ensure model is defined in `backend/src/config/models.json`
- **Check provider**: Ensure model's provider is configured
- **Check model ID**: Use exact model ID from configuration
- **Check availability**: Some models may be region-specific or require special access

## Security considerations

1. **API Key Security**:
   - Never commit API keys to version control
   - Use environment variables or secret management
   - Rotate API keys regularly
   - Use separate keys for development/production

2. **Input Validation**:
   - Validate message content length
   - Sanitize user input before sending to providers
   - Implement content filtering if needed

3. **Rate Limiting**:
   - Implement per-user rate limiting
   - Monitor provider rate limits
   - Handle rate limit errors gracefully

4. **Cost Management**:
   - Monitor token usage
   - Set max token limits per request
   - Implement usage quotas if needed
   - Log all requests for cost tracking

5. **Error Handling**:
   - Don't expose provider API keys in error messages
   - Log errors securely (no sensitive data)
   - Handle provider outages gracefully

## Related docs

- [WebSockets](./websockets.md) - WebSocket LLM streaming
- [Authentication](./authentication.md) - Optional auth for LLM endpoints
- [Error Handling](./error-handling-logging.md) - Error handling patterns
