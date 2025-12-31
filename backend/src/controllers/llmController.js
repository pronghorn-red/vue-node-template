/**
 * @fileoverview LLM Controller
 * @description Controller for handling LLM API requests with Server-Sent Events (SSE)
 * streaming support. Uses llmService for the actual streaming logic.
 *
 * @module controllers/llmController
 */

const llmService = require('../services/llmService');
const logger = require('../utils/logger');

// ============================================================================
// SSE SETUP
// ============================================================================

/**
 * Sets up SSE headers and returns helper functions for streaming.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} SSE helper functions
 */
const setupSSE = (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Content-Encoding', 'identity');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  req.on('close', () => {
    logger.info('Client disconnected during SSE stream');
  });
  req.on('error', (err) => {
    logger.error('Request error:', err);
  });

  const writeEvent = (eventName, data) => {
    if (!res.writable || res.writableEnded) {
      return false;
    }

    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    res.write(payload);

    if (typeof res.flush === 'function') {
      res.flush();
    }
    if (res.socket && typeof res.socket.setNoDelay === 'function') {
      res.socket.setNoDelay(true);
    }
    return true;
  };

  return {
    writeEvent,
    isConnected: () => res.writable && !res.writableEnded,
    end: () => res.end(),
  };
};

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

/**
 * Handle streaming chat completion via Server-Sent Events (SSE)
 * POST /api/llm/stream or POST /api/llm/chat/stream
 */
const handleStreamChat = async (req, res) => {
  const sse = setupSSE(req, res);

  try {
    // Send connection confirmation
    sse.writeEvent('connected', { status: 'connected', timestamp: Date.now() });

    // Extract request parameters
    const { model, provider, messages, systemPrompt, temperature, maxTokens } = req.body;

    // === SSE BACKEND LOGGING ===
    console.log('\n========== SSE REQUEST RECEIVED ==========');
    console.log('[llmController] SSE /llm/chat/stream request:');
    console.log('  model:', model);
    console.log('  provider:', provider);
    console.log('  messageCount:', messages?.length);
    console.log('  systemPrompt:', systemPrompt ? `"${systemPrompt.substring(0, 100)}${systemPrompt.length > 100 ? '...' : ''}"` : null);
    console.log('  temperature:', temperature);
    console.log('  maxTokens:', maxTokens);
    console.log('  Full messages:', JSON.stringify(messages, null, 2));
    console.log('==========================================\n');
    
    logger.info('SSE stream request', { 
      model, 
      provider, 
      messageCount: messages?.length,
      hasSystemPrompt: !!systemPrompt,
      systemPromptLength: systemPrompt?.length,
      temperature,
    });

    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      sse.writeEvent('error', { error: 'Messages array is required' });
      sse.end();
      return;
    }

    // Stream using the service with callback
    await llmService.streamChat({
      model: model || 'gemini-2.0-flash',
      provider,
      messages,
      systemPrompt,
      temperature,
      maxTokens,
      onChunk: (chunk) => {
        if (!sse.isConnected()) return;

        if (chunk.type === 'content') {
          sse.writeEvent('content', { content: chunk.content });
        } else if (chunk.type === 'thinking') {
          sse.writeEvent('thinking', { content: chunk.content });
        } else if (chunk.type === 'done') {
          sse.writeEvent('end', {
            status: 'complete',
            totalChunks: chunk.chunkCount,
            finishReason: chunk.finishReason || 'stop',
          });
        }
      },
    });
  } catch (err) {
    logger.error('Stream error', { error: err.message });
    console.error('[llmController] SSE stream error:', err.message);
    if (sse.isConnected()) {
      sse.writeEvent('error', {
        error: 'Stream failed',
        message: err.message,
      });
    }
  } finally {
    sse.end();
  }
};

/**
 * Get available models
 * GET /api/llm/models
 */
const getModels = async (req, res) => {
  try {
    const { provider } = req.query;
    const models = llmService.getAvailableModels(provider || null);

    res.json({
      success: true,
      data: {
        models,
        count: models.length,
      },
    });
  } catch (error) {
    logger.error('Get models error', { error: error.message });
    res.status(500).json({
      error: 'Failed to get models',
      message: error.message,
    });
  }
};

/**
 * Get provider status
 * GET /api/llm/providers
 */
const getProviders = async (req, res) => {
  try {
    const status = llmService.getProviderStatus();
    const available = llmService.getAvailableProviders();

    res.json({
      success: true,
      data: {
        providers: status,
        available,
        default: process.env.DEFAULT_LLM_PROVIDER || 'google',
      },
    });
  } catch (error) {
    logger.error('Get providers error', { error: error.message });
    res.status(500).json({
      error: 'Failed to get providers',
      message: error.message,
    });
  }
};

/**
 * Get model configuration by ID
 * GET /api/llm/models/:modelId
 */
const getModelConfig = async (req, res) => {
  try {
    const { modelId } = req.params;
    const config = llmService.getModelConfig(modelId);

    if (!config) {
      return res.status(404).json({
        error: 'Model not found',
        message: `Model '${modelId}' not found in configuration`,
      });
    }

    res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    logger.error('Get model config error', { error: error.message });
    res.status(500).json({
      error: 'Failed to get model config',
      message: error.message,
    });
  }
};

/**
 * Generate embeddings
 * POST /api/llm/embeddings
 */
const generateEmbeddings = async (req, res) => {
  try {
    const { model, input } = req.body;

    if (!input) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Input text is required',
      });
    }

    const result = await llmService.generateEmbeddings({ model, input });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Embeddings error', { error: error.message });
    res.status(500).json({
      error: 'Embeddings generation failed',
      message: error.message,
    });
  }
};

/**
 * Health check / status endpoint
 * GET /api/llm/health
 */
const getHealth = async (req, res) => {
  const status = llmService.getProviderStatus();
  const configuredCount = Object.values(status).filter((p) => p.configured).length;

  res.json({
    success: true,
    data: {
      status: configuredCount > 0 ? 'healthy' : 'degraded',
      providers: status,
      configuredCount,
      timestamp: Date.now(),
    },
  });
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  handleStreamChat,
  getModels,
  getProviders,
  getModelConfig,
  generateEmbeddings,
  getHealth,
};