/**
 * @fileoverview useWebSocket Composable
 * @description Composable for managing WebSocket connection with automatic reconnection,
 * heartbeat functionality, and chat message handling with event-based architecture.
 */

import { ref, computed, onMounted, onUnmounted, shallowRef } from 'vue'

// Event emitter for chat messages (singleton)
const chatEventListeners = new Map()
let listenerIdCounter = 0

/**
 * Add a listener for chat events
 * @param {string} requestId - The request ID to listen for
 * @param {Function} callback - Callback function
 * @returns {Function} Cleanup function to remove listener
 */
const addChatListener = (requestId, callback) => {
  const listenerId = ++listenerIdCounter
  if (!chatEventListeners.has(requestId)) {
    chatEventListeners.set(requestId, new Map())
  }
  chatEventListeners.get(requestId).set(listenerId, callback)
  
  return () => {
    const listeners = chatEventListeners.get(requestId)
    if (listeners) {
      listeners.delete(listenerId)
      if (listeners.size === 0) {
        chatEventListeners.delete(requestId)
      }
    }
  }
}

/**
 * Emit a chat event to listeners
 * @param {string} requestId - The request ID
 * @param {Object} data - Event data
 */
const emitChatEvent = (requestId, data) => {
  const listeners = chatEventListeners.get(requestId)
  if (listeners) {
    listeners.forEach(callback => {
      try {
        callback(data)
      } catch (err) {
        console.error('Chat event listener error:', err)
      }
    })
  }
}

// Shared WebSocket state (singleton)
const ws = shallowRef(null)
const isConnected = ref(false)
const reconnectAttempts = ref(0)
const maxReconnectAttempts = 5
const reconnectDelay = ref(1000)
let heartbeatInterval = null
let reconnectTimeout = null
let isInitialized = false

export const useWebSocket = () => {
  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      
      // Handle heartbeat
      if (data.type === 'pong') {
        console.debug('Heartbeat pong received')
        return
      }
      
      // Handle chat-related messages
      if (data.requestId) {
        emitChatEvent(data.requestId, data)
      }
      
      // Log unhandled message types for debugging
      if (!data.requestId && data.type !== 'pong') {
        console.debug('Unhandled WebSocket message:', data.type)
      }
    } catch (err) {
      console.error('Error parsing WebSocket message:', err)
    }
  }

  /**
   * Connect to WebSocket server
   */
  const connect = () => {
    return new Promise((resolve, reject) => {
      // Don't create duplicate connections
      if (ws.value && ws.value.readyState === WebSocket.OPEN) {
        resolve()
        return
      }
      
      // Close existing connection if in wrong state
      if (ws.value && ws.value.readyState !== WebSocket.CLOSED) {
        ws.value.close()
      }
      
      try {
        const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000'
        ws.value = new WebSocket(wsUrl)

        ws.value.onopen = () => {
          console.log('✅ WebSocket connected')
          isConnected.value = true
          reconnectAttempts.value = 0
          reconnectDelay.value = 1000
          startHeartbeat()
          resolve()
        }

        ws.value.onclose = (event) => {
          console.log('❌ WebSocket disconnected', { code: event.code, reason: event.reason })
          isConnected.value = false
          stopHeartbeat()
          
          // Only attempt reconnect if not intentionally closed
          if (event.code !== 1000) {
            attemptReconnect()
          }
        }

        ws.value.onerror = (error) => {
          console.error('WebSocket error:', error)
          isConnected.value = false
        }

        ws.value.onmessage = handleMessage
        
      } catch (error) {
        console.error('WebSocket connection error:', error)
        reject(error)
      }
    })
  }

  /**
   * Send message through WebSocket
   * @param {Object} message - Message object to send
   * @throws {Error} If WebSocket not connected
   */
  const sendMessage = (message) => {
    if (!isConnected.value || !ws.value || ws.value.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected')
    }
    ws.value.send(JSON.stringify(message))
  }

  /**
   * Start heartbeat to keep connection alive
   */
  const startHeartbeat = () => {
    stopHeartbeat() // Clear any existing interval
    heartbeatInterval = setInterval(() => {
      if (isConnected.value && ws.value && ws.value.readyState === WebSocket.OPEN) {
        try {
          sendMessage({
            type: 'ping',
            timestamp: Date.now()
          })
        } catch (err) {
          console.error('Heartbeat error:', err)
        }
      }
    }, 30000) // Send heartbeat every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  const stopHeartbeat = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  const attemptReconnect = () => {
    if (reconnectAttempts.value < maxReconnectAttempts) {
      reconnectAttempts.value++
      const delay = Math.min(reconnectDelay.value * Math.pow(2, reconnectAttempts.value - 1), 30000)
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.value}/${maxReconnectAttempts})`)

      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
      }
      
      reconnectTimeout = setTimeout(() => {
        connect().catch((err) => {
          console.error('Reconnection failed:', err)
        })
      }, delay)
    } else {
      console.error('Max reconnection attempts reached')
    }
  }

  /**
   * Disconnect WebSocket
   */
  const disconnect = () => {
    stopHeartbeat()
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
    if (ws.value) {
      ws.value.close(1000, 'Client disconnect') // Normal closure
      ws.value = null
    }
    isConnected.value = false
  }

  /**
   * Initialize WebSocket connection on mount (only once)
   */
  onMounted(() => {
    if (!isInitialized) {
      isInitialized = true
      connect().catch((err) => {
        console.error('Initial WebSocket connection failed:', err)
      })
    }
  })

  /**
   * Note: We don't disconnect on unmount since this is a singleton
   * The connection persists across component lifecycles
   */

  return {
    ws: computed(() => ws.value),
    isConnected: computed(() => isConnected.value),
    reconnectAttempts: computed(() => reconnectAttempts.value),
    connect,
    disconnect,
    sendMessage,
    addChatListener,
    emitChatEvent
  }
}