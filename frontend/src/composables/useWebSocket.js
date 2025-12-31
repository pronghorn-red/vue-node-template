/**
 * @fileoverview useWebSocket Composable
 * @description Central WebSocket connection manager with authentication,
 * domain-based message routing, and task management.
 * 
 * Token Strategy:
 * - Reads access token from sessionStorage (set by useAuth)
 * - Handles auth errors by triggering token refresh
 * - Reconnects automatically with new token after refresh
 * 
 * Follows the protocol: domain:action message format
 * Supports parallel task execution with client-generated taskIds
 */

import { ref, computed, shallowRef, reactive } from 'vue'

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:3000',
  wsPath: '/ws',
  heartbeatInterval: 30000,
  reconnectMaxAttempts: 5,
  reconnectBaseDelay: 1000,
  reconnectMaxDelay: 30000,
  authRetryDelay: 1000, // Delay before retrying after auth failure
}

// ============================================================================
// SINGLETON STATE
// ============================================================================

// Connection state
const ws = shallowRef(null)
const isConnected = ref(false)
const isAuthenticated = ref(false)
const connectionId = ref(null)
const reconnectAttempts = ref(0)
const isReconnecting = ref(false)

// Server info (from welcome message)
const availableProviders = ref([])
const serverTime = ref(null)

// User info (after authentication)
const wsUser = ref(null)
const wsClaims = ref(null)

// Task registry - reactive map of all active tasks
const tasks = reactive({})

// Domain message listeners
const domainListeners = new Map()

// Internal state
let heartbeatInterval = null
let reconnectTimeout = null
let isInitialized = false
let tokenRefreshCallback = null // Callback to refresh token

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

/**
 * Get auth token from sessionStorage
 * @returns {string|null}
 */
const getAuthToken = () => {
  // Primary: sessionStorage (set by useAuth)
  const token = sessionStorage.getItem('accessToken')
  if (token) return token
  
  // Fallback: Check if there's a user object with token (legacy support)
  try {
    const user = sessionStorage.getItem('user')
    if (user) {
      const parsed = JSON.parse(user)
      if (parsed.token) return parsed.token
    }
  } catch (e) {
    // Ignore parse errors
  }
  
  return null
}

/**
 * Set callback for token refresh
 * This should be called by useAuth to provide the refresh function
 * @param {Function} callback - Async function that refreshes the token
 */
const setTokenRefreshCallback = (callback) => {
  tokenRefreshCallback = callback
}

/**
 * Attempt to refresh token and reconnect
 * @returns {Promise<boolean>} Success status
 */
const refreshTokenAndReconnect = async () => {
  if (!tokenRefreshCallback) {
    console.error('No token refresh callback set')
    return false
  }
  
  try {
    console.log('🔄 Attempting token refresh for WebSocket...')
    const success = await tokenRefreshCallback()
    
    if (success) {
      console.log('✅ Token refreshed, reconnecting WebSocket...')
      // Disconnect and reconnect with new token
      disconnect()
      await connect()
      return true
    }
    
    console.error('❌ Token refresh failed')
    return false
  } catch (error) {
    console.error('Token refresh error:', error)
    return false
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generate a unique task ID
 * @param {string} [prefix='task'] - Prefix for the ID
 * @returns {string}
 */
const generateTaskId = (prefix = 'task') => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

/**
 * Send a message through WebSocket
 * @param {Object} message - Message object
 * @throws {Error} If not connected
 */
const sendMessage = (message) => {
  if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
    throw new Error('WebSocket not connected')
  }
  
  ws.value.send(JSON.stringify(message))
}

/**
 * Handle incoming WebSocket message
 * @param {MessageEvent} event
 */
const handleMessage = (event) => {
  let data
  try {
    data = JSON.parse(event.data)
  } catch (err) {
    console.error('Failed to parse WebSocket message:', err)
    return
  }
  
  const { type, taskId } = data
  
  // Extract domain from type (e.g., 'llm:chunk' -> 'llm')
  const [domain, action] = type?.split(':') || []
  
  // Handle connection-level messages
  switch (type) {
    case 'connection:welcome':
      connectionId.value = data.connectionId
      availableProviders.value = data.availableProviders || []
      serverTime.value = data.serverTime
      if (data.authenticated && data.user) {
        isAuthenticated.value = true
        wsUser.value = data.user
        wsClaims.value = data.claims
      }
      console.log('✅ WebSocket connected', { connectionId: data.connectionId })
      return
      
    case 'connection:blocked':
      console.error('Connection blocked:', data.reason)
      isConnected.value = false
      return
      
    case 'connection:shutdown':
      console.warn('Server shutting down:', data.message)
      return
      
    case 'auth:success':
      isAuthenticated.value = true
      wsUser.value = data.user
      wsClaims.value = data.claims
      console.log('✅ WebSocket authenticated', { user: data.user?.email })
      return
      
    case 'auth:error':
      isAuthenticated.value = false
      wsUser.value = null
      wsClaims.value = null
      console.error('WebSocket auth error:', data.error)
      
      // Attempt token refresh on auth error
      if (data.code === 'TOKEN_EXPIRED' || data.code === 'INVALID_TOKEN') {
        handleAuthError()
      }
      return
      
    case 'auth:logout':
      isAuthenticated.value = false
      wsUser.value = null
      wsClaims.value = null
      return
      
    case 'pong':
      // Heartbeat response - no action needed
      return
      
    case 'error':
      console.error('WebSocket error:', data.error, data.code)
      
      // Handle auth-related errors
      if (data.code === 'UNAUTHORIZED' || data.code === 'TOKEN_EXPIRED') {
        handleAuthError()
      }
      
      // If task-specific, update task state
      if (taskId && tasks[taskId]) {
        tasks[taskId].status = 'error'
        tasks[taskId].error = data.error
      }
      return
  }
  
  // Handle task-specific messages
  if (taskId && tasks[taskId]) {
    updateTaskFromMessage(taskId, data)
  }
  
  // Notify domain listeners
  if (domain) {
    const listeners = domainListeners.get(domain)
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data, action)
        } catch (err) {
          console.error(`Domain listener error (${domain}):`, err)
        }
      })
    }
  }
}

/**
 * Handle authentication errors by attempting token refresh
 */
const handleAuthError = async () => {
  if (isReconnecting.value) return // Already handling
  
  isReconnecting.value = true
  
  try {
    const success = await refreshTokenAndReconnect()
    if (!success) {
      // Notify listeners that auth failed permanently
      const listeners = domainListeners.get('auth')
      if (listeners) {
        listeners.forEach(callback => {
          try {
            callback({ type: 'auth:failed', error: 'Token refresh failed' }, 'failed')
          } catch (err) {
            console.error('Auth listener error:', err)
          }
        })
      }
    }
  } finally {
    isReconnecting.value = false
  }
}

/**
 * Update task state from incoming message
 * @param {string} taskId
 * @param {Object} data
 */
const updateTaskFromMessage = (taskId, data) => {
  const task = tasks[taskId]
  if (!task) return
  
  const { type } = data
  const [domain, action] = type?.split(':') || []
  
  switch (action) {
    case 'started':
      task.status = 'streaming'
      task.model = data.model
      task.provider = data.provider
      break
      
    case 'chunk':
      task.status = 'streaming'
      task.content += data.content || ''
      task.chunkCount = data.chunkIndex || (task.chunkCount + 1)
      // Call onChunk callback if provided
      if (task.onChunk && data.content) {
        task.onChunk(data.content)
      }
      break
      
    case 'thinking':
      task.thinking += data.content || ''
      if (task.onThinking && data.content) {
        task.onThinking(data.content)
      }
      break
      
    case 'done':
      task.status = 'done'
      task.finishReason = data.finishReason
      task.completedAt = Date.now()
      // Resolve promise if waiting
      if (task._resolve) {
        task._resolve({
          content: task.content,
          finishReason: task.finishReason,
        })
      }
      break
      
    case 'error':
      task.status = 'error'
      task.error = data.error
      task.completedAt = Date.now()
      // Reject promise if waiting
      if (task._reject) {
        task._reject(new Error(data.error))
      }
      break
      
    case 'cancelled':
      task.status = 'cancelled'
      task.completedAt = Date.now()
      if (task._reject) {
        task._reject(new Error('Task cancelled'))
      }
      break
  }
}

// ============================================================================
// TASK MANAGEMENT
// ============================================================================

/**
 * Create a new task
 * @param {string} domain - Domain (e.g., 'llm', 'tool')
 * @param {Object} options - Task options
 * @returns {string} Task ID
 */
const createTask = (domain, options = {}) => {
  const taskId = options.taskId || generateTaskId(domain)
  
  tasks[taskId] = reactive({
    taskId,
    domain,
    status: 'pending', // pending | streaming | done | error | cancelled
    content: '',
    thinking: '',
    error: null,
    chunkCount: 0,
    model: options.model || null,
    provider: options.provider || null,
    startedAt: Date.now(),
    completedAt: null,
    onChunk: options.onChunk || null,
    onThinking: options.onThinking || null,
    _resolve: null,
    _reject: null,
  })
  
  return taskId
}

/**
 * Cancel a specific task
 * @param {string} taskId
 * @param {string} [domain='llm']
 */
const cancelTask = (taskId, domain = 'llm') => {
  if (!tasks[taskId]) return
  
  try {
    sendMessage({
      type: `${domain}:cancel`,
      taskId,
    })
  } catch (err) {
    console.error('Failed to send cancel:', err)
  }
  
  // Optimistically update state
  tasks[taskId].status = 'cancelled'
  tasks[taskId].completedAt = Date.now()
}

/**
 * Cancel all tasks for a domain
 * @param {string} [domain='llm']
 */
const cancelAllTasks = (domain = 'llm') => {
  try {
    sendMessage({
      type: `${domain}:cancel_all`,
    })
  } catch (err) {
    console.error('Failed to send cancel_all:', err)
  }
  
  // Optimistically update all tasks of this domain
  Object.values(tasks).forEach(task => {
    if (task.domain === domain && task.status === 'streaming') {
      task.status = 'cancelled'
      task.completedAt = Date.now()
    }
  })
}

/**
 * Wait for a task to complete
 * @param {string} taskId
 * @returns {Promise<Object>}
 */
const waitForTask = (taskId) => {
  const task = tasks[taskId]
  if (!task) {
    return Promise.reject(new Error(`Task ${taskId} not found`))
  }
  
  // Already completed
  if (['done', 'error', 'cancelled'].includes(task.status)) {
    if (task.status === 'done') {
      return Promise.resolve({ content: task.content, finishReason: task.finishReason })
    }
    return Promise.reject(new Error(task.error || 'Task failed'))
  }
  
  // Create promise that will be resolved/rejected by message handler
  return new Promise((resolve, reject) => {
    task._resolve = resolve
    task._reject = reject
  })
}

/**
 * Remove completed tasks (cleanup)
 * @param {number} [maxAge=300000] - Max age in ms (default 5 minutes)
 */
const cleanupTasks = (maxAge = 5 * 60 * 1000) => {
  const now = Date.now()
  Object.keys(tasks).forEach(taskId => {
    const task = tasks[taskId]
    if (task.completedAt && (now - task.completedAt) > maxAge) {
      delete tasks[taskId]
    }
  })
}

/**
 * Dismiss a specific task (remove from registry)
 * @param {string} taskId
 */
const dismissTask = (taskId) => {
  delete tasks[taskId]
}

// ============================================================================
// DOMAIN LISTENERS
// ============================================================================

/**
 * Add a listener for a specific domain
 * @param {string} domain - Domain to listen to (e.g., 'llm', 'tool', 'auth')
 * @param {Function} callback - Callback function (data, action) => void
 * @returns {Function} Cleanup function
 */
const addDomainListener = (domain, callback) => {
  if (!domainListeners.has(domain)) {
    domainListeners.set(domain, new Set())
  }
  domainListeners.get(domain).add(callback)
  
  return () => {
    const listeners = domainListeners.get(domain)
    if (listeners) {
      listeners.delete(callback)
      if (listeners.size === 0) {
        domainListeners.delete(domain)
      }
    }
  }
}

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

/**
 * Connect to WebSocket server
 * 
 * Security: Token is NOT sent in URL (would be logged by servers/proxies).
 * Instead, we connect first, then send token via message after connection opens.
 * 
 * @param {Object} options - Connection options
 * @param {boolean} options.autoAuth - Automatically authenticate after connecting
 * @returns {Promise<void>}
 */
const connect = (options = { autoAuth: true }) => {
  return new Promise((resolve, reject) => {
    // Already connected
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      resolve()
      return
    }
    
    // Close existing connection if in wrong state
    if (ws.value && ws.value.readyState !== WebSocket.CLOSED) {
      ws.value.close()
    }
    
    try {
      // Connect WITHOUT token in URL (security best practice)
      const url = `${CONFIG.wsUrl}${CONFIG.wsPath}`
      
      ws.value = new WebSocket(url)
      
      ws.value.onopen = () => {
        isConnected.value = true
        reconnectAttempts.value = 0
        startHeartbeat()
        
        // Auto-authenticate after connection if token available
        if (options.autoAuth) {
          const token = getAuthToken()
          if (token) {
            // Send auth message (not in URL - more secure)
            sendMessage({
              type: 'auth:login',
              token
            })
          }
        }
        
        resolve()
      }
      
      ws.value.onclose = (event) => {
        console.log('❌ WebSocket disconnected', { code: event.code, reason: event.reason })
        isConnected.value = false
        isAuthenticated.value = false
        connectionId.value = null
        stopHeartbeat()
        
        // Attempt reconnect if not intentional close
        if (event.code !== 1000 && !isReconnecting.value) {
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
 * Disconnect from WebSocket server
 */
const disconnect = () => {
  stopHeartbeat()
  
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = null
  }
  
  if (ws.value) {
    ws.value.close(1000, 'Client disconnect')
    ws.value = null
  }
  
  isConnected.value = false
  isAuthenticated.value = false
  connectionId.value = null
}

/**
 * Start heartbeat ping
 */
const startHeartbeat = () => {
  stopHeartbeat()
  heartbeatInterval = setInterval(() => {
    if (isConnected.value && ws.value?.readyState === WebSocket.OPEN) {
      try {
        sendMessage({ type: 'ping' })
      } catch (err) {
        console.error('Heartbeat error:', err)
      }
    }
  }, CONFIG.heartbeatInterval)
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
 * Attempt reconnection with exponential backoff
 */
const attemptReconnect = () => {
  if (reconnectAttempts.value >= CONFIG.reconnectMaxAttempts) {
    console.error('Max reconnection attempts reached')
    return
  }
  
  reconnectAttempts.value++
  const delay = Math.min(
    CONFIG.reconnectBaseDelay * Math.pow(2, reconnectAttempts.value - 1),
    CONFIG.reconnectMaxDelay
  )
  
  console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.value}/${CONFIG.reconnectMaxAttempts})`)
  
  reconnectTimeout = setTimeout(() => {
    connect().catch(err => {
      console.error('Reconnection failed:', err)
    })
  }, delay)
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Authenticate with token
 * @param {string} [token] - JWT token (uses sessionStorage if not provided)
 * @returns {Promise<Object>}
 */
const authenticate = (token) => {
  return new Promise((resolve, reject) => {
    if (!isConnected.value) {
      reject(new Error('Not connected'))
      return
    }
    
    const authToken = token || getAuthToken()
    if (!authToken) {
      reject(new Error('No auth token available'))
      return
    }
    
    // Set up one-time listener for auth response
    const cleanup = addDomainListener('auth', (data, action) => {
      cleanup()
      if (action === 'success') {
        resolve(data)
      } else if (action === 'error' || action === 'failed') {
        reject(new Error(data.error || 'Authentication failed'))
      }
    })
    
    // Send auth message
    sendMessage({
      type: 'auth:login',
      token: authToken,
    })
    
    // Timeout after 10 seconds
    setTimeout(() => {
      cleanup()
      reject(new Error('Authentication timeout'))
    }, 10000)
  })
}

/**
 * Logout from WebSocket
 */
const logout = () => {
  if (isConnected.value) {
    try {
      sendMessage({ type: 'auth:logout' })
    } catch (err) {
      // Ignore
    }
  }
  isAuthenticated.value = false
  wsUser.value = null
  wsClaims.value = null
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize WebSocket (called once on module load)
 */
const initWebSocket = () => {
  if (isInitialized) return
  isInitialized = true
  
  // Only connect if we have a token (user is logged in)
  const token = getAuthToken()
  if (token) {
    connect().catch(err => {
      console.error('Initial WebSocket connection failed:', err)
    })
  }
  
  // Periodic cleanup (only once)
  setInterval(cleanupTasks, 60000)
}

/**
 * Ensure WebSocket is connected and authenticated
 * Useful for components that need WebSocket
 * @returns {Promise<void>}
 */
const ensureConnected = async () => {
  if (!isConnected.value) {
    await connect()
  }
  
  if (!isAuthenticated.value) {
    const token = getAuthToken()
    if (token) {
      await authenticate(token)
    }
  }
}

// Auto-initialize when module loads (browser only)
if (typeof window !== 'undefined') {
  // Defer to next tick to avoid blocking
  setTimeout(initWebSocket, 0)
}

// ============================================================================
// COMPOSABLE EXPORT
// ============================================================================

export const useWebSocket = () => {
  return {
    // Connection state
    isConnected: computed(() => isConnected.value),
    isAuthenticated: computed(() => isAuthenticated.value),
    isReconnecting: computed(() => isReconnecting.value),
    connectionId: computed(() => connectionId.value),
    reconnectAttempts: computed(() => reconnectAttempts.value),
    
    // Server info
    availableProviders: computed(() => availableProviders.value),
    
    // User info
    wsUser: computed(() => wsUser.value),
    wsClaims: computed(() => wsClaims.value),
    
    // Tasks
    tasks,
    
    // Connection methods
    connect,
    disconnect,
    ensureConnected,
    sendMessage,
    
    // Auth methods
    authenticate,
    logout,
    setTokenRefreshCallback,
    
    // Task methods
    createTask,
    cancelTask,
    cancelAllTasks,
    waitForTask,
    dismissTask,
    cleanupTasks,
    generateTaskId,
    
    // Listener methods
    addDomainListener,
  }
}