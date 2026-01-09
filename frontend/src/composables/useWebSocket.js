/**
 * @fileoverview useWebSocket Composable - v2
 * @description Central WebSocket connection manager with authentication,
 * domain-based message routing, and task management.
 * 
 * FIXES in v2:
 * - Replaced 500ms polling with Vue's reactive watch() for token changes
 * - Efficient event-driven token monitoring instead of interval polling
 * - WebSocket connects automatically when token becomes available after login
 * - Improved token refresh coordination with auth composable
 * 
 * Token Strategy:
 * - Reads access token from sessionStorage (set by useAuth)
 * - Handles auth errors by triggering token refresh
 * - Reconnects automatically with new token after refresh
 * 
 * Follows the protocol: domain:action message format
 * Supports parallel task execution with client-generated taskIds
 */

import { ref, computed, shallowRef, reactive, watch } from 'vue'

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
let tokenWatcher = null // Watch for token changes

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

/**
 * Watch for token changes using Vue's reactive system
 * This ensures WebSocket connects when user logs in
 */
const setupTokenWatcher = () => {
  if (tokenWatcher) return // Already watching
  
  // Create a reactive ref that tracks the token
  const currentToken = ref(getAuthToken())
  
  // Watch for changes to the token
  tokenWatcher = watch(
    () => getAuthToken(),
    (newToken) => {
      currentToken.value = newToken
      
      if (newToken && !isConnected.value) {
        // Token became available - connect WebSocket
        console.log('🔐 Token detected, connecting WebSocket...')
        connect().catch(err => {
          console.error('Failed to connect WebSocket after token:', err)
        })
      } else if (!newToken && isConnected.value) {
        // Token was removed - disconnect
        console.log('🔐 Token removed, disconnecting WebSocket...')
        disconnect()
      }
    },
    { immediate: false }
  )
}

/**
 * Stop watching for token changes
 */
const stopWatchingToken = () => {
  if (tokenWatcher) {
    tokenWatcher()
    tokenWatcher = null
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
// CONNECTION MANAGEMENT
// ============================================================================

/**
 * Connect to WebSocket server
 * @returns {Promise<void>}
 */
const connect = async () => {
  // Don't reconnect if already connected
  if (isConnected.value && ws.value?.readyState === WebSocket.OPEN) {
    console.log('WebSocket already connected')
    return
  }
  
  // Check for token
  const token = getAuthToken()
  if (!token) {
    console.log('⏳ No auth token available, WebSocket will connect after login')
    return
  }
  
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(`${CONFIG.wsUrl}${CONFIG.wsPath}`)
      url.searchParams.append('token', token)
      
      console.log('🔌 Connecting to WebSocket:', CONFIG.wsUrl + CONFIG.wsPath)
      
      ws.value = new WebSocket(url.toString())
      
      ws.value.onopen = () => {
        console.log('✅ WebSocket connected')
        isConnected.value = true
        reconnectAttempts.value = 0
        
        // Start heartbeat
        startHeartbeat()
        
        // Authenticate with token
        authenticate(token)
        
        resolve()
      }
      
      ws.value.onmessage = handleMessage
      
      ws.value.onerror = (error) => {
        console.error('❌ WebSocket error:', error)
        isConnected.value = false
        reject(error)
      }
      
      ws.value.onclose = () => {
        console.log('🔌 WebSocket disconnected')
        isConnected.value = false
        isAuthenticated.value = false
        stopHeartbeat()
        
        // Attempt reconnect
        attemptReconnect()
      }
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
      reject(error)
    }
  })
}

/**
 * Disconnect from WebSocket
 */
const disconnect = () => {
  if (ws.value) {
    ws.value.close()
    ws.value = null
  }
  
  isConnected.value = false
  isAuthenticated.value = false
  stopHeartbeat()
  
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = null
  }
}

/**
 * Attempt to reconnect with exponential backoff
 */
const attemptReconnect = () => {
  if (reconnectAttempts.value >= CONFIG.reconnectMaxAttempts) {
    console.error('❌ Max reconnect attempts reached')
    return
  }
  
  reconnectAttempts.value++
  const delay = Math.min(
    CONFIG.reconnectBaseDelay * Math.pow(2, reconnectAttempts.value - 1),
    CONFIG.reconnectMaxDelay
  )
  
  console.log(`⏳ Reconnecting in ${delay}ms (attempt ${reconnectAttempts.value}/${CONFIG.reconnectMaxAttempts})`)
  
  reconnectTimeout = setTimeout(() => {
    connect().catch(err => {
      console.error('Reconnect failed:', err)
    })
  }, delay)
}

/**
 * Start heartbeat to keep connection alive
 */
const startHeartbeat = () => {
  stopHeartbeat()
  
  heartbeatInterval = setInterval(() => {
    if (isConnected.value && ws.value?.readyState === WebSocket.OPEN) {
      try {
        sendMessage({ type: 'ping' })
      } catch (err) {
        console.error('Failed to send heartbeat:', err)
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

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Authenticate with server
 * @param {string} token - JWT token
 * @returns {Promise<void>}
 */
const authenticate = async (token) => {
  if (!isConnected.value) {
    throw new Error('WebSocket not connected')
  }
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Authentication timeout'))
    }, 5000)
    
    try {
      sendMessage({
        type: 'auth:login',
        token
      })
      
      // Wait for auth:success message
      const checkAuth = setInterval(() => {
        if (isAuthenticated.value) {
          clearInterval(checkAuth)
          clearTimeout(timeout)
          resolve()
        }
      }, 100)
    } catch (err) {
      clearTimeout(timeout)
      reject(err)
    }
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
      console.warn('Failed to send logout message:', err)
    }
  }
  
  isAuthenticated.value = false
  wsUser.value = null
  wsClaims.value = null
}

// ============================================================================
// TASK MANAGEMENT
// ============================================================================

/**
 * Create a new task
 * @param {Object} options - Task options
 * @returns {string} Task ID
 */
const createTask = (options = {}) => {
  const taskId = generateTaskId(options.prefix)
  
  tasks[taskId] = {
    id: taskId,
    status: 'pending',
    content: '',
    thinking: '',
    chunkCount: 0,
    error: null,
    createdAt: Date.now(),
    completedAt: null,
    onChunk: options.onChunk,
    onThinking: options.onThinking,
    _resolve: null,
    _reject: null
  }
  
  return taskId
}

/**
 * Cancel a task
 * @param {string} taskId
 */
const cancelTask = (taskId) => {
  if (tasks[taskId]) {
    try {
      sendMessage({
        type: 'task:cancel',
        taskId
      })
    } catch (err) {
      console.error('Failed to cancel task:', err)
    }
  }
}

/**
 * Cancel all tasks
 */
const cancelAllTasks = () => {
  Object.keys(tasks).forEach(taskId => {
    cancelTask(taskId)
  })
}

/**
 * Wait for a task to complete
 * @param {string} taskId
 * @returns {Promise<Object>} Task result
 */
const waitForTask = (taskId) => {
  return new Promise((resolve, reject) => {
    const task = tasks[taskId]
    if (!task) {
      reject(new Error(`Task ${taskId} not found`))
      return
    }
    
    task._resolve = resolve
    task._reject = reject
  })
}

/**
 * Dismiss a completed task
 * @param {string} taskId
 */
const dismissTask = (taskId) => {
  delete tasks[taskId]
}

/**
 * Clean up old tasks
 */
const cleanupTasks = () => {
  const now = Date.now()
  const maxAge = 3600000 // 1 hour
  
  Object.entries(tasks).forEach(([taskId, task]) => {
    if (task.completedAt && now - task.completedAt > maxAge) {
      delete tasks[taskId]
    }
  })
}

/**
 * Add a domain listener
 * @param {string} domain
 * @param {Function} callback
 * @returns {Function} Unsubscribe function
 */
const addDomainListener = (domain, callback) => {
  if (!domainListeners.has(domain)) {
    domainListeners.set(domain, [])
  }
  
  domainListeners.get(domain).push(callback)
  
  // Return unsubscribe function
  return () => {
    const listeners = domainListeners.get(domain)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }
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
  
  // Start watching for token changes using Vue's reactive system
  setupTokenWatcher()
  
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
