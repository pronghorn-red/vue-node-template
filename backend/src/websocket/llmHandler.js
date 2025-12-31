/**
 * @fileoverview LLM WebSocket Handler
 * @description Handles LLM-specific WebSocket messages (llm:* domain).
 * Delegates streaming to llmService and manages per-connection task state.
 * 
 * Message Types:
 * - llm:start     - Start streaming LLM request
 * - llm:cancel    - Cancel specific task
 * - llm:cancel_all - Cancel all active tasks
 * - llm:providers - Get available providers
 * - llm:models    - Get available models
 * 
 * @module websocket/llmHandler
 */

const llmService = require('../services/llmService');
const logger = require('../utils/logger');
const { sendMessage, generateTaskId } = require('./socketController');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  defaultModel: process.env.DEFAULT_LLM_MODEL || 'gemini-2.0-flash',
  defaultProvider: process.env.DEFAULT_LLM_PROVIDER || 'google',
  taskTimeout: parseInt(process.env.LLM_TASK_TIMEOUT) || 5 * 60 * 1000, // 5 minutes
  maxConcurrentTasks: parseInt(process.env.LLM_MAX_CONCURRENT_TASKS) || 10,
};

// ============================================================================
// MESSAGE HANDLERS
// ============================================================================

/**
 * Handle incoming LLM domain message
 * @param {Object} connection - Connection state from socketController
 * @param {Object} message - Parsed message
 * @param {string} action - Action part of message type (e.g., 'start', 'cancel')
 */
const handleMessage = async (connection, message, action) => {
  console.log(`[llmHandler] Received action: ${action}`);
  
  switch (action) {
    case 'start':
      await handleStart(connection, message);
      break;
      
    case 'cancel':
      handleCancel(connection, message);
      break;
      
    case 'cancel_all':
      handleCancelAll(connection);
      break;
      
    case 'providers':
      handleGetProviders(connection, message);
      break;
      
    case 'models':
      handleGetModels(connection, message);
      break;
      
    default:
      sendMessage(connection.ws, {
        type: 'llm:error',
        taskId: message.taskId,
        code: 'UNKNOWN_ACTION',
        error: `Unknown LLM action: ${action}`,
        supportedActions: ['start', 'cancel', 'cancel_all', 'providers', 'models'],
      });
  }
};

/**
 * Handle llm:start - Start streaming LLM request
 * @param {Object} connection - Connection state
 * @param {Object} message - Start message
 */
const handleStart = async (connection, message) => {
  const { ws, activeTasks, connectionId, user } = connection;
  
  // Generate or use provided task ID
  const taskId = message.taskId || generateTaskId();
  
  // === WEBSOCKET BACKEND LOGGING ===
  console.log('\n========== WEBSOCKET REQUEST RECEIVED ==========');
  console.log('[llmHandler] llm:start message received:');
  console.log('  connectionId:', connectionId);
  console.log('  taskId:', taskId);
  console.log('  model:', message.model);
  console.log('  provider:', message.provider);
  console.log('  messageCount:', message.messages?.length);
  console.log('  systemPrompt:', message.systemPrompt ? `"${message.systemPrompt.substring(0, 100)}${message.systemPrompt.length > 100 ? '...' : ''}"` : null);
  console.log('  temperature:', message.temperature);
  console.log('  maxTokens:', message.maxTokens);
  console.log('  Full message object:', JSON.stringify(message, null, 2));
  console.log('=================================================\n');
  
  // Check concurrent task limit
  if (activeTasks.size >= CONFIG.maxConcurrentTasks) {
    sendMessage(ws, {
      type: 'llm:error',
      taskId,
      code: 'TOO_MANY_TASKS',
      error: `Maximum concurrent tasks (${CONFIG.maxConcurrentTasks}) exceeded`,
      retryable: true,
    });
    return;
  }
  
  // Extract parameters
  const {
    model = CONFIG.defaultModel,
    provider,
    messages,
    content,
    systemPrompt,
    temperature,
    maxTokens,
  } = message;

  // Validate input
  if (!messages && !content) {
    sendMessage(ws, {
      type: 'llm:error',
      taskId,
      code: 'INVALID_INPUT',
      error: 'Either "messages" or "content" is required',
    });
    return;
  }
  
  // Build messages array
  let messagesToSend;
  if (messages) {
    messagesToSend = messages;
  } else {
    messagesToSend = [{ role: 'user', content }];
  }
  
  // Get model configuration
  const modelConfig = llmService.getModelConfig(model);
  const actualProvider = provider || modelConfig?.provider || CONFIG.defaultProvider;
  
  // Check if provider is configured
  const providerStatus = llmService.getProviderStatus();
  if (!providerStatus[actualProvider]?.configured) {
    sendMessage(ws, {
      type: 'llm:error',
      taskId,
      code: 'PROVIDER_NOT_CONFIGURED',
      error: `Provider '${actualProvider}' is not configured`,
      availableProviders: llmService.getAvailableProviders(),
    });
    return;
  }
  
  // Create abort controller for this task
  const abortController = new AbortController();
  
  // Register task
  activeTasks.set(taskId, {
    abortController,
    startedAt: Date.now(),
    model,
    provider: actualProvider,
  });
  
  // === LOG WHAT WE'RE SENDING TO LLM SERVICE ===
  console.log('[llmHandler] Calling llmService.streamChat with:');
  console.log('  provider:', actualProvider);
  console.log('  model:', model);
  console.log('  messageCount:', messagesToSend.length);
  console.log('  systemPrompt:', systemPrompt ? `"${systemPrompt.substring(0, 100)}..."` : null);
  console.log('  temperature:', temperature);
  console.log('  maxTokens:', maxTokens);
  
  logger.info('LLM task started', {
    connectionId,
    taskId,
    model,
    provider: actualProvider,
    messageCount: messagesToSend.length,
    hasSystemPrompt: !!systemPrompt,
    systemPromptLength: systemPrompt?.length,
    userId: user?.id || 'anonymous',
  });
  
  // Send acknowledgment
  sendMessage(ws, {
    type: 'llm:started',
    taskId,
    model,
    provider: actualProvider,
    modelConfig: modelConfig ? {
      name: modelConfig.name,
      maxTokens: modelConfig.maxTokens,
      thinkingEnabled: modelConfig.thinkingEnabled,
    } : null,
  });
  
  // Set timeout
  const timeoutId = setTimeout(() => {
    if (activeTasks.has(taskId)) {
      const task = activeTasks.get(taskId);
      task.abortController.abort();
      activeTasks.delete(taskId);
      
      sendMessage(ws, {
        type: 'llm:error',
        taskId,
        code: 'TIMEOUT',
        error: 'Request timed out',
        retryable: true,
      });
      
      logger.warn('LLM task timed out', { connectionId, taskId });
    }
  }, CONFIG.taskTimeout);
  
  try {
    let chunkCount = 0;
    let fullContent = '';
    
    await llmService.streamChat({
      provider: actualProvider,
      model,
      messages: messagesToSend,
      systemPrompt,
      temperature,
      maxTokens,
      onChunk: (chunk) => {
        // Check if aborted
        if (abortController.signal.aborted) {
          return;
        }
        
        // Check if connection still open
        if (ws.readyState !== 1) { // WebSocket.OPEN
          return;
        }
        
        switch (chunk.type) {
          case 'content':
            if (chunk.content) {
              fullContent += chunk.content;
              chunkCount++;
              
              sendMessage(ws, {
                type: 'llm:chunk',
                taskId,
                content: chunk.content,
                chunkIndex: chunkCount,
              });
            }
            break;
            
          case 'thinking':
            if (chunk.content) {
              sendMessage(ws, {
                type: 'llm:thinking',
                taskId,
                content: chunk.content,
              });
            }
            break;
            
          case 'done':
            clearTimeout(timeoutId);
            activeTasks.delete(taskId);
            
            sendMessage(ws, {
              type: 'llm:done',
              taskId,
              finishReason: chunk.finishReason || 'stop',
              chunkCount,
              totalLength: fullContent.length,
            });
            
            logger.info('LLM task completed', {
              connectionId,
              taskId,
              chunkCount,
              contentLength: fullContent.length,
              finishReason: chunk.finishReason,
            });
            break;
        }
      },
    });
    
    // Clear timeout if not already done
    clearTimeout(timeoutId);
    
    // Handle cancellation during streaming
    if (abortController.signal.aborted) {
      sendMessage(ws, {
        type: 'llm:cancelled',
        taskId,
        partialContent: fullContent,
        chunkCount,
      });
    }
    
  } catch (error) {
    clearTimeout(timeoutId);
    activeTasks.delete(taskId);
    
    // Don't send error if aborted
    if (abortController.signal.aborted) {
      return;
    }
    
    logger.error('LLM task error', {
      connectionId,
      taskId,
      error: error.message,
      provider: actualProvider,
      model,
    });
    
    console.error('[llmHandler] LLM task error:', error.message);
    
    sendMessage(ws, {
      type: 'llm:error',
      taskId,
      code: 'STREAM_ERROR',
      error: error.message,
      provider: actualProvider,
      model,
      retryable: true,
    });
  } finally {
    // Ensure task is cleaned up
    if (activeTasks.has(taskId)) {
      activeTasks.delete(taskId);
    }
  }
};

/**
 * Handle llm:cancel - Cancel specific task
 * @param {Object} connection - Connection state
 * @param {Object} message - Cancel message
 */
const handleCancel = (connection, message) => {
  const { ws, activeTasks, connectionId } = connection;
  const { taskId } = message;
  
  if (!taskId) {
    sendMessage(ws, {
      type: 'llm:error',
      code: 'MISSING_TASK_ID',
      error: 'taskId is required for cancellation',
    });
    return;
  }
  
  const task = activeTasks.get(taskId);
  if (!task) {
    sendMessage(ws, {
      type: 'llm:error',
      taskId,
      code: 'TASK_NOT_FOUND',
      error: `Task ${taskId} not found or already completed`,
    });
    return;
  }
  
  // Abort the task
  task.abortController.abort();
  activeTasks.delete(taskId);
  
  logger.info('LLM task cancelled', { connectionId, taskId });
  
  sendMessage(ws, {
    type: 'llm:cancelled',
    taskId,
  });
};

/**
 * Handle llm:cancel_all - Cancel all active tasks
 * @param {Object} connection - Connection state
 */
const handleCancelAll = (connection) => {
  const { ws, activeTasks, connectionId } = connection;
  
  const cancelledTasks = [];
  
  activeTasks.forEach((task, taskId) => {
    task.abortController.abort();
    cancelledTasks.push(taskId);
  });
  
  activeTasks.clear();
  
  logger.info('All LLM tasks cancelled', {
    connectionId,
    count: cancelledTasks.length,
  });
  
  sendMessage(ws, {
    type: 'llm:cancelled_all',
    taskIds: cancelledTasks,
    count: cancelledTasks.length,
  });
};

/**
 * Handle llm:providers - Get available providers
 * @param {Object} connection - Connection state
 * @param {Object} message - Request message
 */
const handleGetProviders = (connection, message) => {
  const { ws } = connection;
  
  sendMessage(ws, {
    type: 'llm:providers',
    taskId: message.taskId,
    providers: llmService.getProviderStatus(),
    available: llmService.getAvailableProviders(),
    default: CONFIG.defaultProvider,
  });
};

/**
 * Handle llm:models - Get available models
 * @param {Object} connection - Connection state
 * @param {Object} message - Request message
 */
const handleGetModels = (connection, message) => {
  const { ws } = connection;
  const { provider } = message;
  
  const models = llmService.getAvailableModels(provider || null);
  
  sendMessage(ws, {
    type: 'llm:models',
    taskId: message.taskId,
    provider: provider || 'all',
    models,
    count: models.length,
    default: CONFIG.defaultModel,
  });
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get available providers (for socketController welcome message)
 * @returns {Array<string>}
 */
const getProviders = () => {
  return llmService.getAvailableProviders();
};

/**
 * Get handler statistics
 * @returns {Object}
 */
const getStats = () => {
  return {
    defaultModel: CONFIG.defaultModel,
    defaultProvider: CONFIG.defaultProvider,
    providers: llmService.getProviderStatus(),
    availableProviders: llmService.getAvailableProviders(),
    modelCount: llmService.getAvailableModels().length,
  };
};

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  handleMessage,
  getProviders,
  getStats,
  CONFIG,
};