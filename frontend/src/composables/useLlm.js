/**
 * @fileoverview useLlm Composable
 * @description Composable for managing LLM models, providers, and chat interactions
 * with support for both WebSocket and SSE streaming methods.
 * Supports full conversation history and system prompts.
 * 
 * IMPORTANT: Install @microsoft/fetch-event-source for SSE support:
 * npm install @microsoft/fetch-event-source
 */

import { ref, computed, onMounted, watch } from 'vue'
import { fetchEventSource } from '@microsoft/fetch-event-source'
import api from '@/services/api'
import { useWebSocket } from '@/composables/useWebSocket'

// Shared state (singleton pattern for state persistence across components)
const models = ref([])
const providers = ref({})
const availableProviders = ref([])
const selectedModel = ref(null)
const streamMethod = ref(localStorage.getItem('llmStreamMethod') || 'sse') // 'sse' or 'ws'
const loading = ref(false)
const error = ref(null)
const isInitialized = ref(false)

export const useLlm = () => {
  // WebSocket integration
  const { isConnected, sendMessage, addChatListener } = useWebSocket()

  /**
   * Fetch all available models
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
   * Fetch provider status
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
   * @returns {Array} Models for the provider
   */
  const getModelsByProvider = (provider) => {
    return models.value.filter(m => m.provider === provider)
  }

  /**
   * Stream chat via SSE (Server-Sent Events) using @microsoft/fetch-event-source
   * This properly handles POST requests with SSE responses
   * @param {Array} messages - Array of message objects with role and content
   * @param {string|null} systemPrompt - Optional system prompt
   * @param {number|null} temperature - Optional temperature
   * @param {Function|null} onChunk - Callback for streaming chunks
   * @returns {Promise<Object>} Chat response
   */
  const streamChatSSE = async (messages, systemPrompt = null, temperature = null, onChunk = null) => {
    const requestBody = {
      messages,
      model: selectedModel.value?.id || 'gpt-4.1',
      ...(systemPrompt && { systemPrompt }),
      ...(temperature !== null && { temperature })
    }

    const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
    const chunks = []
    let fullContent = ''
    let finishReason = 'stop'

    return new Promise((resolve, reject) => {
      const ctrl = new AbortController()
      
      fetchEventSource(`${baseUrl}/llm/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: ctrl.signal,
        openWhenHidden: true, 
        
        onopen: async (response) => {
          if (response.ok) {
            console.debug('SSE connection opened')
            return
          }
          
          // Try to get error message from response
          let errorMessage = `HTTP ${response.status}`
          try {
            const errorData = await response.json()
            errorMessage = errorData.message || errorData.error || errorMessage
          } catch (e) {
            // Ignore parse errors
          }
          
          throw new Error(errorMessage)
        },
        
        onmessage: (event) => {
          // event.event is the event type (connected, start, content, done, end, error)
          // event.data is the JSON string
          
          if (!event.data) return
          
          try {
            const data = JSON.parse(event.data)
            
            switch (event.event) {
              case 'error':
                ctrl.abort()
                reject(new Error(data.error || 'Stream error'))
                break
                
              case 'content':
                if (data.content) {
                  chunks.push(data.content)
                  fullContent += data.content
                  if (onChunk) {
                    onChunk(data.content)
                  }
                }
                break
                
              case 'thinking':
                // Handle thinking content for models that support it
                console.debug('Thinking:', data.content)
                break
                
              case 'done':
                finishReason = data.finishReason || 'stop'
                // Don't resolve yet - wait for 'end' event
                break
                
              case 'end':
                ctrl.abort() // Clean close
                resolve({
                  content: fullContent,
                  finishReason
                })
                break
                
              case 'start':
              case 'connected':
                console.debug(`SSE ${event.event}:`, data)
                break
                
              default:
                console.debug(`Unknown SSE event: ${event.event}`, data)
            }
          } catch (parseErr) {
            console.warn('SSE parse error:', parseErr.message, 'Data:', event.data)
          }
        },
        
        onclose: () => {
          // Stream closed - resolve with what we have if not already resolved
          if (chunks.length > 0) {
            resolve({
              content: fullContent,
              finishReason
            })
          }
        },
        
        onerror: (err) => {
          // Don't retry on errors - just reject
          ctrl.abort()
          reject(err)
          throw err // This prevents retry
        }
      }).catch(reject)
    })
  }

  /**
   * Stream chat via WebSocket
   * @param {Array} messages - Array of message objects with role and content
   * @param {string|null} systemPrompt - Optional system prompt
   * @param {number|null} temperature - Optional temperature
   * @param {Function|null} onChunk - Callback for streaming chunks
   * @returns {Promise<Object>} Chat response
   */
  const streamChatWebSocket = async (messages, systemPrompt = null, temperature = null, onChunk = null) => {
    if (!isConnected.value) {
      throw new Error('WebSocket not connected. Please wait for connection or use SSE method.')
    }

    const requestId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const chunks = []
    let fullContent = ''

    return new Promise((resolve, reject) => {
      // Set timeout
      const timeoutId = setTimeout(() => {
        cleanup()
        reject(new Error('WebSocket timeout - no response received after 5 minutes'))
      }, 5 * 60 * 1000) // 5 minutes
      
      // Add listener for this specific request
      const cleanup = addChatListener(requestId, (data) => {
        console.debug('WS received:', data.type, data)
        
        switch (data.type) {
          case 'chat_start':
            console.debug('Chat started:', data.model, data.provider)
            break
            
          case 'chat_chunk':
            if (data.content) {
              chunks.push(data.content)
              fullContent += data.content
              if (onChunk) {
                onChunk(data.content)
              }
            }
            break
            
          case 'chat_thinking':
            console.debug('WS Thinking:', data.content)
            break
            
          case 'chat_done':
            clearTimeout(timeoutId)
            cleanup()
            resolve({
              content: data.fullContent || fullContent,
              finishReason: data.finishReason || 'stop'
            })
            break
            
          case 'chat_error':
          case 'error':
            clearTimeout(timeoutId)
            cleanup()
            reject(new Error(data.error || 'WebSocket chat error'))
            break
        }
      })

      // Send the chat request
      try {
        sendMessage({
          type: 'chat',
          requestId,
          messages,
          model: selectedModel.value?.id || 'gpt-4.1',
          ...(systemPrompt && { systemPrompt }),
          ...(temperature !== null && { temperature })
        })
        console.debug('WS chat request sent:', requestId)
      } catch (err) {
        clearTimeout(timeoutId)
        cleanup()
        reject(err)
      }
    })
  }

  /**
   * Stream chat using selected method
   * @param {Array|string} messages - Array of message objects or single message string
   * @param {string|null} systemPrompt - Optional system prompt
   * @param {number|null} temperature - Optional temperature
   * @param {Function|null} onChunk - Callback for streaming chunks
   * @returns {Promise<Object>} Chat response
   */
  const streamChat = async (messages, systemPrompt = null, temperature = null, onChunk = null) => {
    if (!selectedModel.value) {
      throw new Error('No model selected')
    }

    if (!selectedModel.value.available) {
      throw new Error(`Model ${selectedModel.value.name} is not available. Please configure the required API key.`)
    }

    // Normalize messages to array format
    const normalizedMessages = typeof messages === 'string'
      ? [{ role: 'user', content: messages }]
      : messages

    if (streamMethod.value === 'ws') {
      // Fall back to SSE if WebSocket not connected
      if (!isConnected.value) {
        console.warn('WebSocket not connected, falling back to SSE')
        return streamChatSSE(normalizedMessages, systemPrompt, temperature, onChunk)
      }
      return streamChatWebSocket(normalizedMessages, systemPrompt, temperature, onChunk)
    } else {
      return streamChatSSE(normalizedMessages, systemPrompt, temperature, onChunk)
    }
  }

  /**
   * Send a non-streaming chat message
   * @param {Array|string} messages - Array of message objects or single message string
   * @param {string|null} systemPrompt - Optional system prompt
   * @param {number|null} temperature - Optional temperature
   * @returns {Promise<Object>} Chat response
   */
  const chat = async (messages, systemPrompt = null, temperature = null) => {
    if (!selectedModel.value) {
      throw new Error('No model selected')
    }

    if (!selectedModel.value.available) {
      throw new Error(`Model ${selectedModel.value.name} is not available. Please configure the required API key.`)
    }

    // Normalize messages to array format
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
      throw new Error(err.response?.data?.message || err.response?.data?.error || err.message || 'Chat error')
    }
  }

  /**
   * Set stream method and persist to localStorage
   * @param {string} method - 'sse' or 'ws'
   */
  const setStreamMethod = (method) => {
    if (method === 'sse' || method === 'ws') {
      streamMethod.value = method
      localStorage.setItem('llmStreamMethod', method)
    }
  }

  /**
   * Select a model by ID or model object
   * @param {string|Object} modelOrId - Model ID or model object
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
   * Initialize composable - only fetch once
   */
  const initialize = async () => {
    if (!isInitialized.value) {
      isInitialized.value = true
      await Promise.all([
        fetchModels(),
        fetchProviders()
      ])
    }
  }

  // Initialize on mount
  onMounted(() => {
    initialize()
  })

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

    // Methods
    fetchModels,
    fetchProviders,
    getModelsByProvider,
    streamChat,
    streamChatSSE,
    streamChatWebSocket,
    chat,
    setStreamMethod,
    selectModel,
    initialize
  }
}