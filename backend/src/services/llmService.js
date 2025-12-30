/**
 * @fileoverview LLM Service
 * @description Unified streaming service for multiple LLM providers.
 * Uses callback pattern so it can be consumed by both SSE (controller) and WebSocket (handler).
 *
 * @module services/llmService
 */

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenAI } = require('@google/genai');
const logger = require('../utils/logger');

// ============================================================================
// CONFIGURATION
// ============================================================================

const modelsConfigPath = path.join(__dirname, '../config/models.json');
let modelsConfig = null;

const loadModelsConfig = () => {
  if (!modelsConfig) {
    try {
      modelsConfig = JSON.parse(fs.readFileSync(modelsConfigPath, 'utf8'));
      logger.info('Models config loaded', { count: modelsConfig.models?.length });
    } catch (error) {
      logger.error('Failed to load models config', { error: error.message });
      modelsConfig = { models: [] };
    }
  }
  return modelsConfig;
};

const getModelConfig = (modelId) => {
  const config = loadModelsConfig();
  return config.models?.find((m) => m.id === modelId) || null;
};

const getAvailableModels = (provider = null) => {
  const config = loadModelsConfig();
  let models = config.models || [];
  if (provider) {
    models = models.filter((m) => m.provider === provider);
  }
  return models.map((m) => ({
    ...m,
    available: clients[m.provider]?.configured || false,
  }));
};

// ============================================================================
// CLIENT INITIALIZATION
// ============================================================================

const clients = {
  google: { instance: null, configured: false },
  openai: { instance: null, configured: false },
  anthropic: { instance: null, configured: false },
  xai: { instance: null, configured: false },
  groq: { instance: null, configured: false },
};

const isValidKey = (key) => {
  return key && key.trim() !== '' && !key.includes('your_') && key !== 'sk-xxx';
};

const initializeClients = () => {
  // Google Gemini
  if (isValidKey(process.env.GOOGLE_AI_API_KEY)) {
    clients.google.instance = new GoogleGenAI({
      apiKey: process.env.GOOGLE_AI_API_KEY,
    });
    clients.google.configured = true;
    logger.info('✅ Google AI configured');
  }

  // OpenAI
  if (isValidKey(process.env.OPENAI_API_KEY)) {
    clients.openai.instance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    clients.openai.configured = true;
    logger.info('✅ OpenAI configured');
  }

  // Anthropic
  if (isValidKey(process.env.ANTHROPIC_API_KEY)) {
    clients.anthropic.instance = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    clients.anthropic.configured = true;
    logger.info('✅ Anthropic configured');
  }

  // xAI (Grok) - OpenAI-compatible
  if (isValidKey(process.env.XAI_API_KEY)) {
    clients.xai.instance = new OpenAI({
      apiKey: process.env.XAI_API_KEY,
      baseURL: 'https://api.x.ai/v1',
    });
    clients.xai.configured = true;
    logger.info('✅ xAI configured');
  }

  // Groq - OpenAI-compatible
  if (isValidKey(process.env.GROQ_API_KEY)) {
    clients.groq.instance = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    });
    clients.groq.configured = true;
    logger.info('✅ Groq configured');
  }
};

const getProviderStatus = () => {
  return Object.fromEntries(
    Object.entries(clients).map(([k, v]) => [k, { configured: v.configured }])
  );
};

const getAvailableProviders = () => {
  return Object.entries(clients)
    .filter(([_, v]) => v.configured)
    .map(([k]) => k);
};

// Initialize clients on module load
initializeClients();

// ============================================================================
// PROVIDER-SPECIFIC STREAMING FUNCTIONS
// ============================================================================

/**
 * Stream from Google Gemini
 * @param {Object} options - Streaming options
 * @param {Function} onChunk - Callback for each chunk: ({ type: 'content'|'done', content?, finishReason? })
 */
async function streamGoogle(options, onChunk) {
  const { model, messages, systemPrompt, temperature, maxTokens } = options;
  const client = clients.google.instance;

  if (!client) throw new Error('Google AI not configured');

  // Build contents array for Gemini
  const contents = messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  // Build request options
  const requestOptions = {
    model: model || 'gemini-2.0-flash',
    contents,
  };

  if (systemPrompt) {
    requestOptions.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  if (temperature !== undefined) {
    requestOptions.generationConfig = {
      ...requestOptions.generationConfig,
      temperature,
    };
  }

  if (maxTokens) {
    requestOptions.generationConfig = {
      ...requestOptions.generationConfig,
      maxOutputTokens: maxTokens,
    };
  }

  logger.info('Google stream request', { model: requestOptions.model });

  const response = await client.models.generateContentStream(requestOptions);

  let chunkCount = 0;
  for await (const chunk of response) {
    const part = chunk.candidates?.[0]?.content?.parts?.[0];

    if (part?.text) {
      onChunk({ type: 'content', content: part.text });
      chunkCount++;
    }
  }

  onChunk({ type: 'done', finishReason: 'stop', chunkCount });
}

/**
 * Stream from OpenAI-compatible APIs (OpenAI, xAI, Groq)
 * @param {Object} options - Streaming options
 * @param {Function} onChunk - Callback for each chunk
 * @param {string} providerName - Provider name
 */
async function streamOpenAICompatible(options, onChunk, providerName) {
  const { model, messages, systemPrompt, temperature, maxTokens } = options;
  const client = clients[providerName].instance;

  if (!client) throw new Error(`${providerName} not configured`);

  // Build messages array with system prompt
  const apiMessages = [];
  if (systemPrompt) {
    apiMessages.push({ role: 'system', content: systemPrompt });
  }
  apiMessages.push(...messages);

  logger.info(`${providerName} stream request`, {
    model,
    messageCount: apiMessages.length,
  });

  const stream = await client.chat.completions.create({
    model,
    messages: apiMessages,
    temperature: temperature ?? 0.7,
    max_tokens: maxTokens,
    stream: true,
  });

  let chunkCount = 0;
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    const finishReason = chunk.choices[0]?.finish_reason;

    if (content) {
      onChunk({ type: 'content', content });
      chunkCount++;
    }

    if (finishReason) {
      onChunk({ type: 'done', finishReason, chunkCount });
      return;
    }
  }

  onChunk({ type: 'done', finishReason: 'stop', chunkCount });
}

/**
 * Stream from Anthropic Claude
 * @param {Object} options - Streaming options
 * @param {Function} onChunk - Callback for each chunk
 */
async function streamAnthropic(options, onChunk) {
  const { model, messages, systemPrompt, temperature, maxTokens } = options;
  const client = clients.anthropic.instance;

  if (!client) throw new Error('Anthropic not configured');

  // Filter out system messages (handled separately)
  const apiMessages = messages.filter((m) => m.role !== 'system');

  logger.info('Anthropic stream request', {
    model,
    messageCount: apiMessages.length,
  });

  const stream = await client.messages.stream({
    model,
    messages: apiMessages,
    system: systemPrompt,
    temperature: temperature ?? 0.7,
    max_tokens: maxTokens || 4096,
  });

  let chunkCount = 0;
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta?.text) {
      onChunk({ type: 'content', content: event.delta.text });
      chunkCount++;
    } else if (event.type === 'message_stop') {
      onChunk({ type: 'done', finishReason: 'stop', chunkCount });
      return;
    } else if (event.type === 'message_delta' && event.delta?.stop_reason) {
      onChunk({ type: 'done', finishReason: event.delta.stop_reason, chunkCount });
      return;
    }
  }

  onChunk({ type: 'done', finishReason: 'stop', chunkCount });
}

// ============================================================================
// MAIN STREAMING FUNCTION
// ============================================================================

/**
 * Stream chat completion from any provider
 * 
 * @param {Object} options - Streaming options
 * @param {string} options.model - Model ID
 * @param {string} [options.provider] - Provider name (auto-detected from model if not provided)
 * @param {Array} options.messages - Array of { role, content } messages
 * @param {string} [options.systemPrompt] - System prompt
 * @param {number} [options.temperature] - Temperature (0-1)
 * @param {number} [options.maxTokens] - Max tokens
 * @param {Function} options.onChunk - Callback for each chunk: ({ type: 'content'|'done', content?, finishReason? })
 * 
 * @returns {Promise<void>}
 * 
 * @example
 * await streamChat({
 *   model: 'gemini-2.0-flash',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   onChunk: (chunk) => {
 *     if (chunk.type === 'content') {
 *       console.log(chunk.content);
 *     } else if (chunk.type === 'done') {
 *       console.log('Done!', chunk.finishReason);
 *     }
 *   }
 * });
 */
async function streamChat(options) {
  const { model, provider, onChunk } = options;

  if (typeof onChunk !== 'function') {
    throw new Error('onChunk callback is required');
  }

  // Determine provider from model config or explicit provider
  const modelConfig = getModelConfig(model);
  const actualProvider = provider || modelConfig?.provider;

  if (!actualProvider) {
    throw new Error(
      `Unknown model '${model}'. Specify a provider or use a known model ID.`
    );
  }

  if (!clients[actualProvider]?.configured) {
    throw new Error(`Provider '${actualProvider}' is not configured`);
  }

  logger.info('streamChat starting', { provider: actualProvider, model });

  // Route to appropriate streaming function
  switch (actualProvider) {
    case 'google':
      return streamGoogle(options, onChunk);
    case 'openai':
      return streamOpenAICompatible(options, onChunk, 'openai');
    case 'xai':
      return streamOpenAICompatible(options, onChunk, 'xai');
    case 'groq':
      return streamOpenAICompatible(options, onChunk, 'groq');
    case 'anthropic':
      return streamAnthropic(options, onChunk);
    default:
      throw new Error(`Unsupported provider: ${actualProvider}`);
  }
}

// ============================================================================
// EMBEDDINGS
// ============================================================================

/**
 * Generate embeddings using OpenAI
 * @param {Object} options - Embedding options
 * @param {string} [options.model] - Model ID
 * @param {string|Array} options.input - Input text(s)
 * @returns {Promise<Object>} Embedding result
 */
async function generateEmbeddings(options) {
  const { model, input } = options;

  if (!clients.openai.configured) {
    throw new Error('OpenAI is not configured for embeddings');
  }

  return clients.openai.instance.embeddings.create({
    model: model || 'text-embedding-3-large',
    input,
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Main streaming function
  streamChat,

  // Embeddings
  generateEmbeddings,

  // Configuration
  initializeClients,
  getModelConfig,
  getAvailableModels,
  getProviderStatus,
  getAvailableProviders,

  // For advanced usage
  clients,
};