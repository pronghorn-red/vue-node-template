/**
 * @fileoverview WebSocket Handler for LLM Interactions
 * @description Handles WebSocket connections for real-time LLM streaming
 * with support for all providers. Uses llmService for the actual streaming logic.
 *
 * Event types sent to client:
 * - connected: Initial connection with available providers
 * - chat_start: Chat request acknowledged
 * - chat_chunk: Content chunk received
 * - chat_thinking: Thinking content (for models that support it)
 * - chat_done: Chat completed with full content
 * - chat_error: Error occurred
 * - chat_cancelled: Request was cancelled
 *
 * @module websocket/llmHandler
 */

const WebSocket = require('ws');
const crypto = require('crypto');
const llmService = require('../services/llmService');
const logger = require('../utils/logger');

/**
 * Active connections map
 * @type {Map<string, Object>}
 */
const connections = new Map();

/**
 * Generate a unique ID
 * @returns {string} Unique identifier
 */
const generateId = () => {
  return `${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
};

/**
 * Verify JWT token (optional - allows anonymous connections if JWT_SECRET not set)
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded token or null
 */
const verifyToken = (token) => {
  if (!token) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    logger.debug('JWT_SECRET not configured, allowing anonymous WebSocket connections');
    return { anonymous: true };
  }

  try {
    const jwt = require('jsonwebtoken');
    return jwt.verify(token, secret);
  } catch (error) {
    logger.debug('WebSocket token verification failed', { error: error.message });
    return null;
  }
};

/**
 * Send a JSON message to a WebSocket client
 * @param {WebSocket} ws - WebSocket connection
 * @param {Object} message - Message object to send
 */
const sendMessage = (ws, message) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        ...message,
        timestamp: new Date().toISOString(),
      })
    );
  }
};

/**
 * Initialize WebSocket server
 * @param {Object} server - HTTP server instance
 * @returns {WebSocket.Server} WebSocket server instance
 */
const initializeWebSocket = (server) => {
  const wss = new WebSocket.Server({
    server,
    path: '/ws',
    verifyClient: ({ req }, callback) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      req.user = token ? verifyToken(token) : { anonymous: true };
      callback(true);
    },
  });

  wss.on('connection', (ws, req) => {
    const connectionId = generateId();
    const user = req.user;

    // Store connection
    connections.set(connectionId, {
      ws,
      user,
      connectedAt: new Date(),
      conversations: new Map(),
      currentRequest: null,
    });

    ws.connectionId = connectionId;

    logger.info('WebSocket client connected', {
      connectionId,
      userId: user?.id || 'anonymous',
      ip: req.socket.remoteAddress,
    });

    // Send welcome message
    sendMessage(ws, {
      type: 'connected',
      connectionId,
      authenticated: !!user && !user.anonymous,
      availableProviders: llmService.getAvailableProviders(),
      providerStatus: llmService.getProviderStatus(),
    });

    // Handle incoming messages
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await handleMessage(connectionId, message);
      } catch (error) {
        logger.error('WebSocket message error', { connectionId, error: error.message });
        sendMessage(ws, {
          type: 'error',
          error: 'Invalid message format',
          details: error.message,
        });
      }
    });

    // Handle connection close
    ws.on('close', (code, reason) => {
      connections.delete(connectionId);
      logger.info('WebSocket client disconnected', {
        connectionId,
        userId: user?.id || 'anonymous',
        code,
        reason: reason?.toString() || 'No reason',
      });
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error('WebSocket error', { connectionId, error: error.message });
    });

    // Heartbeat
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
  });

  // Heartbeat interval
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        logger.debug('Terminating inactive WebSocket', { connectionId: ws.connectionId });
        connections.delete(ws.connectionId);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  logger.info('✅ WebSocket server initialized on /ws');
  return wss;
};

/**
 * Handle incoming WebSocket message
 * @param {string} connectionId - Connection identifier
 * @param {Object} message - Parsed message object
 */
const handleMessage = async (connectionId, message) => {
  const connection = connections.get(connectionId);
  if (!connection) return;

  const { ws } = connection;

  switch (message.type) {
    case 'chat':
      await handleChatMessage(connectionId, message);
      break;

    case 'cancel':
      handleCancelRequest(connectionId, message);
      break;

    case 'ping':
      sendMessage(ws, { type: 'pong' });
      break;

    case 'get_providers':
      sendMessage(ws, {
        type: 'providers',
        providers: llmService.getProviderStatus(),
        available: llmService.getAvailableProviders(),
        default: process.env.DEFAULT_LLM_PROVIDER || 'google',
      });
      break;

    case 'get_models':
      const models = llmService.getAvailableModels(message.provider || null);
      sendMessage(ws, {
        type: 'models',
        requestId: message.requestId,
        models,
        count: models.length,
      });
      break;

    case 'get_model_config':
      const config = llmService.getModelConfig(message.modelId);
      sendMessage(ws, {
        type: 'model_config',
        requestId: message.requestId,
        config,
        found: !!config,
      });
      break;

    default:
      sendMessage(ws, {
        type: 'error',
        error: `Unknown message type: ${message.type}`,
        supportedTypes: ['chat', 'cancel', 'ping', 'get_providers', 'get_models', 'get_model_config'],
      });
  }
};

/**
 * Handle chat message with streaming response
 * Uses llmService.streamChat with callback pattern
 *
 * @param {string} connectionId - Connection identifier
 * @param {Object} message - Chat message object
 */
const handleChatMessage = async (connectionId, message) => {
  const connection = connections.get(connectionId);
  if (!connection) return;

  const { ws, user } = connection;
  const requestId = message.requestId || message.id || generateId();
  const conversationId = message.conversationId || generateId();

  // Extract options
  const {
    content,
    messages: inputMessages,
    provider,
    model,
    systemPrompt,
    temperature,
    maxTokens,
  } = message;

  // Validate input
  if (!content && !inputMessages) {
    sendMessage(ws, {
      type: 'chat_error',
      requestId,
      error: 'Either "content" or "messages" is required',
    });
    return;
  }

  // Determine model and provider
  const actualModel = model || process.env.DEFAULT_LLM_MODEL || 'gemini-2.0-flash';
  const modelConfig = llmService.getModelConfig(actualModel);
  const actualProvider = provider || modelConfig?.provider;

  // Check if provider is configured
  const providerStatus = llmService.getProviderStatus();
  if (actualProvider && !providerStatus[actualProvider]?.configured) {
    sendMessage(ws, {
      type: 'chat_error',
      requestId,
      error: `Provider '${actualProvider}' is not configured. Please set the API key in .env`,
      availableProviders: llmService.getAvailableProviders(),
    });
    return;
  }

  // Get or create conversation history
  let conversation = connection.conversations.get(conversationId);
  if (!conversation) {
    conversation = { messages: [], createdAt: new Date() };
    connection.conversations.set(conversationId, conversation);
  }

  // Build messages array
  let messagesToSend;
  if (inputMessages) {
    messagesToSend = inputMessages;
  } else {
    conversation.messages.push({ role: 'user', content });
    messagesToSend = conversation.messages.slice(-20);
  }

  logger.info('WebSocket chat request', {
    connectionId,
    requestId,
    provider: actualProvider,
    model: actualModel,
    messageCount: messagesToSend.length,
    userId: user?.id || 'anonymous',
  });

  // Send start acknowledgment
  sendMessage(ws, {
    type: 'chat_start',
    requestId,
    conversationId,
    provider: actualProvider,
    model: actualModel,
    modelConfig: modelConfig
      ? {
          name: modelConfig.name,
          maxTokens: modelConfig.maxTokens,
          thinkingEnabled: modelConfig.thinkingEnabled,
        }
      : null,
  });

  try {
    let fullContent = '';
    let chunkCount = 0;
    let aborted = false;

    // Store abort flag for potential cancellation
    connection.currentRequest = {
      requestId,
      abort: () => {
        aborted = true;
      },
    };

    // Set timeout
    const timeoutId = setTimeout(() => {
      if (!aborted) {
        aborted = true;
        sendMessage(ws, {
          type: 'chat_error',
          requestId,
          conversationId,
          error: 'Request timeout - no response after 5 minutes',
        });
      }
    }, 5 * 60 * 1000);

    // Stream using the service with callback
    await llmService.streamChat({
      provider: actualProvider,
      model: actualModel,
      messages: messagesToSend,
      systemPrompt,
      temperature,
      maxTokens,
      onChunk: (chunk) => {
        // Check if connection is still open
        if (ws.readyState !== WebSocket.OPEN || aborted) {
          return;
        }

        if (chunk.type === 'content' && chunk.content) {
          fullContent += chunk.content;
          chunkCount++;

          sendMessage(ws, {
            type: 'chat_chunk',
            requestId,
            conversationId,
            content: chunk.content,
            chunkIndex: chunkCount,
          });
        } else if (chunk.type === 'thinking' && chunk.content) {
          sendMessage(ws, {
            type: 'chat_thinking',
            requestId,
            conversationId,
            content: chunk.content,
          });
        } else if (chunk.type === 'done') {
          clearTimeout(timeoutId);

          // Add assistant response to conversation history
          if (!inputMessages) {
            conversation.messages.push({
              role: 'assistant',
              content: fullContent,
            });
          }

          sendMessage(ws, {
            type: 'chat_done',
            requestId,
            conversationId,
            fullContent,
            content: fullContent,
            chunkCount,
            finishReason: chunk.finishReason,
            model: actualModel,
          });

          logger.info('WebSocket chat completed', {
            connectionId,
            requestId,
            chunkCount,
            contentLength: fullContent.length,
            finishReason: chunk.finishReason,
          });
        }
      },
    });

    clearTimeout(timeoutId);

    // Handle cancellation
    if (aborted && ws.readyState === WebSocket.OPEN) {
      sendMessage(ws, {
        type: 'chat_cancelled',
        requestId,
        conversationId,
        partialContent: fullContent,
      });
    }
  } catch (error) {
    logger.error('WebSocket chat error', {
      connectionId,
      requestId,
      error: error.message,
      stack: error.stack,
      provider: actualProvider,
      model: actualModel,
    });

    sendMessage(ws, {
      type: 'chat_error',
      requestId,
      conversationId,
      error: error.message,
      code: error.code || 'STREAM_ERROR',
      provider: actualProvider,
      model: actualModel,
    });
  } finally {
    connection.currentRequest = null;
  }
};

/**
 * Handle request cancellation
 * @param {string} connectionId - Connection identifier
 * @param {Object} message - Cancel message object
 */
const handleCancelRequest = (connectionId, message) => {
  const connection = connections.get(connectionId);
  if (!connection || !connection.currentRequest) {
    return;
  }

  const { ws } = connection;
  const { requestId, abort } = connection.currentRequest;

  if (message.requestId === requestId || !message.requestId) {
    abort();

    sendMessage(ws, {
      type: 'cancel_acknowledged',
      requestId,
    });

    logger.info('Chat request cancelled', { connectionId, requestId });
  }
};

/**
 * Broadcast message to all connected clients
 * @param {Object} message - Message to broadcast
 * @param {Function} [filter] - Optional filter function
 */
const broadcast = (message, filter = null) => {
  connections.forEach((connection, connectionId) => {
    if (filter && !filter(connection, connectionId)) return;
    sendMessage(connection.ws, message);
  });
};

/**
 * Get connection statistics
 * @returns {Object} Connection statistics
 */
const getStats = () => ({
  totalConnections: connections.size,
  connections: Array.from(connections.entries()).map(([id, conn]) => ({
    id,
    userId: conn.user?.id || 'anonymous',
    authenticated: !!conn.user && !conn.user.anonymous,
    connectedAt: conn.connectedAt,
    conversationCount: conn.conversations.size,
    hasActiveRequest: !!conn.currentRequest,
  })),
});

/**
 * Get active connection count
 * @returns {number} Number of active connections
 */
const getConnectionCount = () => connections.size;

module.exports = {
  initializeWebSocket,
  broadcast,
  getStats,
  getConnectionCount,
  sendMessage,
};