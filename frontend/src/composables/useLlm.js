/**
 * @fileoverview useLlm Composable
 * @description LLM-specific composable for managing models, providers, and chat interactions.
 * Uses useWebSocket for WebSocket transport and supports SSE fallback.
 * 
 * Handles all llm:* domain messages and provides a clean API for:
 * - Single chat requests
 * - Parallel/batch requests
 * - Model and provider management
 */

import { ref, computed } from 'vue'
import { fetchEventSource } from '@microsoft/fetch-event-source'
import api from '@/services/api'
import { useWebSocket } from '@/composables/useWebSocket'

// ============================================================================
// SHARED STATE (Singleton)
// ============================================================================

const models = ref([])
const providers = ref({})
const availableProviders = ref([])
const selectedModel = ref(null)
const streamMethod = ref(sessionStorage.getItem('llmStreamMethod') || 'ws') // Default to WebSocket
const loading = ref(false)
const error = ref(null)
const isInitialized = ref(false)

// ============================================================================
// COMPOSABLE
// ============================================================================

export const useLlm = () => {
  // WebSocket integration
  const {
    isConnected,
    sendMessage,
    createTask,
    cancelTask,
    cancelAllTasks,
    waitForTask,
    tasks,
    addDomainListener,
    generateTaskId,
  } = useWebSocket()

  // ============================================================================
  // MODEL & PROVIDER MANAGEMENT
  // ============================================================================

  /**
   * Fetch all available models from API
   */
  const fetchModels = async () => {
    loading.value = true
    error.value = null
    try {
      const response = await api.get('/llm/models')
      models.value = response.data.data.models || []

      // Set default model if not selected
      if (!selectedModel.value && models.value.length > 0) {
        const availableModel = models.value.find(m => m.available)
        selectedModel.value = availableModel || models.value[0]
      }
    } catch (err) {
      error.value = err.message || 'Failed to fetch models'
      models.value = []
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch provider status from API
   */
  const fetchProviders = async () => {
    try {
      const response = await api.get('/llm/providers')
      providers.value = response.data.data.providers || {}
      availableProviders.value = response.data.data.available || []
    } catch (err) {
      error.value = err.message || 'Failed to fetch providers'
    }
  }

  /**
   * Get models for a specific provider
   * @param {string} provider - Provider name
   * @returns {Array}
   */
  const getModelsByProvider = (provider) => {
    return models.value.filter(m => m.provider === provider)
  }

  /**
   * Select a model by ID or model object
   * @param {string|Object} modelOrId
   */
  const selectModel = (modelOrId) => {
    if (typeof modelOrId === 'string') {
      const model = models.value.find(m => m.id === modelOrId)
      if (model) {
        selectedModel.value = model
      }
    } else {
      selectedModel.value = modelOrId
    }
  }

  /**
   * Set stream method and persist
   * @param {string} method - 'sse' or 'ws'
   */
  const setStreamMethod = (method) => {
    if (method === 'sse' || method === 'ws') {
      streamMethod.value = method
      sessionStorage.setItem('llmStreamMethod', method)
    }
  }

  // ============================================================================
  // SSE STREAMING
  // ============================================================================

  /**
   * Stream chat via SSE (Server-Sent Events)
   * Used as fallback when WebSocket is not available
   * @param {Object} options - Request options
   * @returns {Promise<Object>}
   */
  const streamChatSSE = async (options) => {
    const {
      taskId,
      messages,
      model,
      systemPrompt,
      temperature,
      maxTokens,
      onChunk,
      onThinking,
    } = options

    const requestBody = {
      messages,
      model: model || selectedModel.value?.id || 'gpt-4.1',
      ...(systemPrompt && { systemPrompt }),
      ...(temperature !== null && temperature !== undefined && { temperature }),
      ...(maxTokens && { maxTokens }),
    }

    const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
    
    // === SSE REQUEST LOGGING ===
    console.log('[useLlm] SSE request to:', `${baseUrl}/llm/chat/stream`)
    console.log('[useLlm] SSE request body:', {
      model: requestBody.model,
      messageCount: requestBody.messages?.length,
      messages: requestBody.messages?.map(m => ({ role: m.role, contentLength: m.content?.length })),
      systemPrompt: requestBody.systemPrompt ? `"${requestBody.systemPrompt.substring(0, 100)}${requestBody.systemPrompt.length > 100 ? '...' : ''}"` : null,
      temperature: requestBody.temperature,
      maxTokens: requestBody.maxTokens,
    })
    
    let fullContent = ''
    let finishReason = 'stop'

    return new Promise((resolve, reject) => {
      const ctrl = new AbortController()
      
      // Store abort controller in task if it exists
      if (taskId && tasks[taskId]) {
        tasks[taskId]._abortController = ctrl
      }
      
      fetchEventSource(`${baseUrl}/llm/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: ctrl.signal,
        openWhenHidden: true,
        
        onopen: async (response) => {
          console.log('[useLlm] SSE connection opened, status:', response.status)
          if (response.ok) {
            if (taskId && tasks[taskId]) {
              tasks[taskId].status = 'streaming'
            }
            return
          }
          
          let errorMessage = `HTTP ${response.status}`
          try {
            const errorData = await response.json()
            errorMessage = errorData.message || errorData.error || errorMessage
          } catch (e) {
            // Ignore
          }
          throw new Error(errorMessage)
        },
        
        onmessage: (event) => {
          if (!event.data) return
          
          try {
            const data = JSON.parse(event.data)
            
            switch (event.event) {
              case 'error':
                ctrl.abort()
                if (taskId && tasks[taskId]) {
                  tasks[taskId].status = 'error'
                  tasks[taskId].error = data.error
                }
                reject(new Error(data.error || 'Stream error'))
                break
                
              case 'content':
                if (data.content) {
                  fullContent += data.content
                  if (taskId && tasks[taskId]) {
                    tasks[taskId].content = fullContent
                    tasks[taskId].chunkCount++
                  }
                  if (onChunk) onChunk(data.content)
                }
                break
                
              case 'thinking':
                if (data.content) {
                  if (taskId && tasks[taskId]) {
                    tasks[taskId].thinking += data.content
                  }
                  if (onThinking) onThinking(data.content)
                }
                break
                
              case 'done':
                finishReason = data.finishReason || 'stop'
                break
                
              case 'end':
                ctrl.abort()
                if (taskId && tasks[taskId]) {
                  tasks[taskId].status = 'done'
                  tasks[taskId].finishReason = finishReason
                  tasks[taskId].completedAt = Date.now()
                }
                resolve({ content: fullContent, finishReason })
                break
            }
          } catch (parseErr) {
            console.warn('SSE parse error:', parseErr.message)
          }
        },
        
        onclose: () => {
          if (fullContent) {
            resolve({ content: fullContent, finishReason })
          }
        },
        
        onerror: (err) => {
          ctrl.abort()
          if (taskId && tasks[taskId]) {
            tasks[taskId].status = 'error'
            tasks[taskId].error = err.message
          }
          reject(err)
          throw err
        }
      }).catch(reject)
    })
  }

  // ============================================================================
  // WEBSOCKET STREAMING
  // ============================================================================

  /**
   * Stream chat via WebSocket
   * @param {Object} options - Request options
   * @returns {Promise<Object>}
   */
  const streamChatWebSocket = async (options) => {
    const {
      taskId: providedTaskId,
      messages,
      model,
      systemPrompt,
      temperature,
      maxTokens,
      onChunk,
      onThinking,
    } = options

    if (!isConnected.value) {
      throw new Error('WebSocket not connected')
    }

    // Create task (uses provided ID or generates new one)
    const taskId = createTask('llm', {
      taskId: providedTaskId,
      model: model || selectedModel.value?.id,
      onChunk,
      onThinking,
    })

    // Send the request
    sendMessage({
      type: 'llm:start',
      taskId,
      model: model || selectedModel.value?.id || 'gpt-4.1',
      messages,
      ...(systemPrompt && { systemPrompt }),
      ...(temperature !== null && temperature !== undefined && { temperature }),
      ...(maxTokens && { maxTokens }),
    })

    // Wait for completion
    return waitForTask(taskId)
  }

  // ============================================================================
  // MAIN API
  // ============================================================================

  /**
   * Start a streaming chat request
   * Returns immediately with taskId - use waitForTask or callbacks to get results
   * 
   * @param {Object} options - Request options
   * @param {Array} options.messages - Array of { role, content } messages
   * @param {string} [options.model] - Model ID (uses selectedModel if not provided)
   * @param {string} [options.systemPrompt] - System prompt
   * @param {number} [options.temperature] - Temperature (0-1)
   * @param {number} [options.maxTokens] - Max tokens
   * @param {Function} [options.onChunk] - Callback for each content chunk
   * @param {Function} [options.onThinking] - Callback for thinking content
   * @param {string} [options.taskId] - Custom task ID (auto-generated if not provided)
   * @param {string} [options.forceMethod] - Force 'ws' or 'sse' regardless of global setting
   * @returns {string} Task ID
   */
  const startChat = (options) => {
    const {
      messages,
      model,
      systemPrompt,
      temperature,
      maxTokens,
      onChunk,
      onThinking,
      taskId: providedTaskId,
      forceMethod,
    } = options

    // === FRONTEND LOGGING ===
    console.log('[useLlm] startChat called with:', {
      model: model || selectedModel.value?.id,
      messageCount: messages?.length,
      systemPrompt: systemPrompt ? `"${systemPrompt.substring(0, 50)}${systemPrompt.length > 50 ? '...' : ''}"` : null,
      temperature,
      maxTokens,
      hasOnChunk: !!onChunk,
      providedTaskId,
      forceMethod,
    })

    if (!selectedModel.value && !model) {
      throw new Error('No model selected')
    }

    const actualModel = model || selectedModel.value?.id
    const modelConfig = models.value.find(m => m.id === actualModel)
    
    if (modelConfig && !modelConfig.available) {
      throw new Error(`Model ${modelConfig.name} is not available`)
    }

    // Normalize messages
    const normalizedMessages = typeof messages === 'string'
      ? [{ role: 'user', content: messages }]
      : messages

    // Create task
    const taskId = createTask('llm', {
      taskId: providedTaskId,
      model: actualModel,
      onChunk,
      onThinking,
    })

    // Determine method and execute
    // forceMethod overrides the global streamMethod setting
    let useWebSocket
    if (forceMethod === 'ws') {
      useWebSocket = isConnected.value // Force WS if connected
    } else if (forceMethod === 'sse') {
      useWebSocket = false // Force SSE
    } else {
      useWebSocket = streamMethod.value === 'ws' && isConnected.value
    }

    console.log('[useLlm] startChat routing:', {
      taskId,
      useWebSocket,
      forceMethod,
      streamMethod: streamMethod.value,
      isConnected: isConnected.value,
    })

    if (useWebSocket) {
      const wsPayload = {
        type: 'llm:start',
        taskId,
        model: actualModel,
        messages: normalizedMessages,
        ...(systemPrompt && { systemPrompt }),
        ...(temperature !== null && temperature !== undefined && { temperature }),
        ...(maxTokens && { maxTokens }),
      }
      
      console.log('[useLlm] WebSocket payload:', {
        type: wsPayload.type,
        taskId: wsPayload.taskId,
        model: wsPayload.model,
        messages: wsPayload.messages,
        messageCount: wsPayload.messages?.length,
        systemPrompt: wsPayload.systemPrompt ? `"${wsPayload.systemPrompt.substring(0, 50)}..."` : null,
        temperature: wsPayload.temperature,
      })
      
      sendMessage(wsPayload)
    } else {
      // SSE fallback - start in background
      const ssePayload = {
        taskId,
        messages: normalizedMessages,
        model: actualModel,
        systemPrompt,
        temperature,
        maxTokens,
        onChunk,
        onThinking,
      }
      
      console.log('[useLlm] SSE payload:', {
        taskId: ssePayload.taskId,
        model: ssePayload.model,
        messageCount: ssePayload.messages?.length,
        systemPrompt: ssePayload.systemPrompt ? `"${ssePayload.systemPrompt.substring(0, 50)}..."` : null,
        temperature: ssePayload.temperature,
      })
      
      streamChatSSE(ssePayload).catch(err => {
        console.error('[useLlm] SSE stream error:', err)
      })
    }

    return taskId
  }

  /**
   * Stream chat and return promise (convenience wrapper)
   * Automatically chooses SSE or WebSocket based on streamMethod setting
   * @param {Array|string} messages - Messages or single message string
   * @param {string|null} systemPrompt - System prompt
   * @param {number|null} temperature - Temperature
   * @param {Function|null} onChunk - Chunk callback
   * @returns {Promise<Object>}
   */
  const streamChat = async (messages, systemPrompt = null, temperature = null, onChunk = null) => {
    // Normalize messages
    const normalizedMessages = typeof messages === 'string'
      ? [{ role: 'user', content: messages }]
      : messages

    // Determine if we should use WebSocket or SSE
    const useWebSocket = streamMethod.value === 'ws' && isConnected.value

    if (useWebSocket) {
      // WebSocket mode
      const taskId = startChat({
        messages: normalizedMessages,
        systemPrompt,
        temperature,
        onChunk,
      })
      return waitForTask(taskId)
    } else {
      // SSE mode - call streamChatSSE directly (no task management needed)
      return streamChatSSE({
        messages: normalizedMessages,
        systemPrompt,
        temperature,
        onChunk,
      })
    }
  }

  /**
   * Start multiple chat requests in parallel
   * @param {Array<Object>} requests - Array of request options
   * @returns {Array<string>} Array of task IDs
   */
  const startBatch = (requests) => {
    return requests.map(options => startChat(options))
  }

  /**
   * Start multiple chats and wait for all to complete
   * @param {Array<Object>} requests - Array of request options
   * @returns {Promise<Array>} Array of results (settled)
   */
  const streamBatch = async (requests) => {
    const taskIds = startBatch(requests)
    return Promise.allSettled(taskIds.map(id => waitForTask(id)))
  }

  /**
   * Cancel a chat request
   * @param {string} taskId
   */
  const cancel = (taskId) => {
    cancelTask(taskId, 'llm')
  }

  /**
   * Cancel all active chat requests
   */
  const cancelAll = () => {
    cancelAllTasks('llm')
  }

  /**
   * Get a specific task's state
   * @param {string} taskId
   * @returns {Object|null}
   */
  const getTask = (taskId) => {
    return tasks[taskId] || null
  }

  /**
   * Get all LLM tasks
   * @returns {Array}
   */
  const getAllTasks = () => {
    return Object.values(tasks).filter(t => t.domain === 'llm')
  }

  /**
   * Get active (streaming) tasks
   * @returns {Array}
   */
  const getActiveTasks = () => {
    return getAllTasks().filter(t => t.status === 'streaming' || t.status === 'pending')
  }

  // ============================================================================
  // NON-STREAMING API
  // ============================================================================

  /**
   * Send a non-streaming chat message (uses REST API)
   * @param {Array|string} messages - Messages
   * @param {string|null} systemPrompt - System prompt
   * @param {number|null} temperature - Temperature
   * @returns {Promise<Object>}
   */
  const chat = async (messages, systemPrompt = null, temperature = null) => {
    if (!selectedModel.value) {
      throw new Error('No model selected')
    }

    if (!selectedModel.value.available) {
      throw new Error(`Model ${selectedModel.value.name} is not available`)
    }

    const normalizedMessages = typeof messages === 'string'
      ? [{ role: 'user', content: messages }]
      : messages

    try {
      const response = await api.post('/llm/chat', {
        messages: normalizedMessages,
        model: selectedModel.value.id,
        ...(systemPrompt && { systemPrompt }),
        ...(temperature !== null && { temperature })
      })
      return response.data.data
    } catch (err) {
      throw new Error(
        err.response?.data?.message || 
        err.response?.data?.error || 
        err.message || 
        'Chat error'
      )
    }
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize composable - fetch models and providers
   * Call this explicitly from your component's onMounted
   */
  const initialize = async () => {
    if (isInitialized.value) return
    isInitialized.value = true
    
    await Promise.all([
      fetchModels(),
      fetchProviders()
    ])
  }

  // ============================================================================
  // EXPORTS
  // ============================================================================

  return {
    // State
    models,
    providers,
    availableProviders,
    selectedModel,
    streamMethod,
    loading,
    error,
    isConnected,
    tasks,

    // Model & Provider
    fetchModels,
    fetchProviders,
    getModelsByProvider,
    selectModel,
    setStreamMethod,
    initialize,

    // Streaming API
    startChat,
    streamChat,
    startBatch,
    streamBatch,
    cancel,
    cancelAll,

    // Task management
    getTask,
    getAllTasks,
    getActiveTasks,
    waitForTask,

    // Non-streaming API
    chat,

    // Utilities
    generateTaskId,
  }
}