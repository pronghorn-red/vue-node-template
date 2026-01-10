/**
 * @fileoverview useAuth Composable - v2
 * @description Authentication composable with JWT token management.
 * 
 * FIXES in v2:
 * - Calls triggerConnect() on WebSocket after successful login
 * - Ensures WebSocket connects immediately when auth completes
 * 
 * Token Storage Strategy:
 * - Access token: Stored in sessionStorage (accessible to JS for Authorization header)
 * - Refresh token: httpOnly cookie ONLY (not accessible to JS, handled by browser)
 * 
 * Session Recovery:
 * - On app startup, if sessionStorage is empty but httpOnly cookie exists,
 *   we can recover the session by calling /auth/refresh
 * - This allows users to return to the app after closing browser
 * 
 * WebSocket Integration:
 * - Provides token refresh callback to useWebSocket
 * - WebSocket can trigger token refresh on auth errors
 */

import { ref, computed, watch } from 'vue'
import api from '@/services/api'

// ============================================================================
// SINGLETON STATE
// ============================================================================

const user = ref(null)
const token = ref(null)
const isAuthenticated = ref(false)
const loading = ref(false)
const error = ref(null)
const isInitialized = ref(false)
const isRecoveringSession = ref(false)

// Storage keys (sessionStorage only - refresh token is in httpOnly cookie)
const STORAGE_KEYS = {
  user: 'user',
  accessToken: 'accessToken',
}

// API base URL for OAuth redirects
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

// WebSocket reference (set via setWebSocketRef)
let webSocketRef = null

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Initialize auth state from sessionStorage
 * Called once when the module loads
 */
const initializeFromStorage = () => {
  try {
    const savedUser = sessionStorage.getItem(STORAGE_KEYS.user)
    const savedToken = sessionStorage.getItem(STORAGE_KEYS.accessToken)
    
    if (savedUser && savedToken) {
      user.value = JSON.parse(savedUser)
      token.value = savedToken
      isAuthenticated.value = true
      
      // Set token in API defaults
      api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`
      return true
    }
    return false
  } catch (err) {
    console.error('Failed to initialize auth from storage:', err)
    clearAuth()
    return false
  }
}

/**
 * Save auth state after successful authentication
 * @param {Object} userData - User object from server
 * @param {string} accessToken - JWT access token
 */
const saveAuth = (userData, accessToken) => {
  user.value = userData
  token.value = accessToken
  isAuthenticated.value = true
  
  // Store in sessionStorage
  sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify(userData))
  sessionStorage.setItem(STORAGE_KEYS.accessToken, accessToken)
  
  // Set token in API defaults
  api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
  
  // Trigger WebSocket connection now that we have auth (v2)
  triggerWebSocketConnect()
}

/**
 * Clear all auth state (logout)
 */
const clearAuth = () => {
  user.value = null
  token.value = null
  isAuthenticated.value = false
  
  // Clear sessionStorage
  sessionStorage.removeItem(STORAGE_KEYS.user)
  sessionStorage.removeItem(STORAGE_KEYS.accessToken)
  
  // Remove Authorization header
  delete api.defaults.headers.common['Authorization']
}

/**
 * Decode JWT payload without verification
 * @param {string} tokenStr - JWT token
 * @returns {Object|null} Decoded payload or null
 */
const decodeToken = (tokenStr) => {
  try {
    const payload = tokenStr.split('.')[1]
    return JSON.parse(atob(payload))
  } catch {
    return null
  }
}

/**
 * Trigger WebSocket connection after auth (v2)
 * Called after successful login, signup, OAuth, or session recovery
 */
const triggerWebSocketConnect = () => {
  if (webSocketRef?.triggerConnect) {
    console.log('🔌 Triggering WebSocket connect after auth...')
    webSocketRef.triggerConnect().catch(err => {
      console.warn('WebSocket connect after auth failed:', err.message)
    })
  }
}

/**
 * Notify WebSocket of auth state change (legacy - kept for compatibility)
 * @deprecated Use triggerWebSocketConnect instead
 */
const notifyWebSocket = () => {
  // WebSocket will pick up new token from sessionStorage on next connect/auth
  // If we have a direct reference, we could trigger re-auth here
  if (webSocketRef?.value?.isConnected && token.value) {
    try {
      webSocketRef.value.authenticate(token.value)
    } catch (e) {
      console.debug('WebSocket re-auth skipped:', e.message)
    }
  }
}

/**
 * Fetch full user profile from /auth/me
 * This ensures we have all user fields including role
 * @returns {Promise<Object|null>} Full user object
 */
const fetchFullUserProfile = async () => {
  try {
    const response = await api.get('/auth/me')
    const userData = response.data.user
    
    // Update stored user with full profile
    user.value = userData
    sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify(userData))
    
    return userData
  } catch (err) {
    console.error('Failed to fetch full user profile:', err)
    return null
  }
}

// ============================================================================
// SESSION RECOVERY
// ============================================================================

/**
 * Attempt to recover session using httpOnly refresh token cookie
 * Called on app startup if sessionStorage is empty
 * 
 * @returns {Promise<boolean>} True if session was recovered
 */
const recoverSession = async () => {
  // Don't try if already authenticated or already recovering
  if (isAuthenticated.value || isRecoveringSession.value) {
    return isAuthenticated.value
  }
  
  isRecoveringSession.value = true
  
  try {
    // Try to refresh using httpOnly cookie
    // Browser automatically sends the cookie with withCredentials: true
    const refreshResponse = await api.post('/auth/refresh', {}, {
      withCredentials: true,
      // Don't trigger the interceptor's refresh logic
      _skipAuthRetry: true
    })
    
    const { token: newToken } = refreshResponse.data
    
    if (!newToken) {
      return false
    }
    
    // Temporarily set token to fetch user info
    api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
    
    // Fetch full user info from /auth/me (includes role)
    const userResponse = await api.get('/auth/me')
    const userData = userResponse.data.user
    
    // Save auth state (this will also trigger WebSocket connect)
    saveAuth(userData, newToken)
    
    console.log('✅ Session recovered from cookie')
    return true
    
  } catch (err) {
    // Session recovery failed - user needs to log in
    // This is expected if the refresh token has expired
    console.debug('Session recovery failed:', err.message)
    return false
  } finally {
    isRecoveringSession.value = false
  }
}

/**
 * Initialize auth - checks storage first, then attempts session recovery
 * @returns {Promise<boolean>} True if user is authenticated
 */
const initializeAuth = async () => {
  if (isInitialized.value) {
    return isAuthenticated.value
  }
  
  // First, try to load from sessionStorage
  const hasStoredAuth = initializeFromStorage()
  
  if (hasStoredAuth) {
    isInitialized.value = true
    
    // If we have stored auth but user doesn't have role, fetch fresh profile
    if (!user.value?.role) {
      console.log('User role missing, fetching fresh profile...')
      await fetchFullUserProfile()
    }
    
    // Trigger WebSocket connect for stored auth (v2)
    triggerWebSocketConnect()
    
    return true
  }
  
  // No stored auth - try to recover from httpOnly cookie
  const recovered = await recoverSession()
  
  isInitialized.value = true
  return recovered
}

// ============================================================================
// COMPOSABLE EXPORT
// ============================================================================

export function useAuth() {
  const isLoggedIn = computed(() => isAuthenticated.value)

  /**
   * Sign in with email and password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<boolean>} Success status
   */
  const signIn = async (email, password) => {
    loading.value = true
    error.value = null
    
    try {
      const response = await api.post('/auth/login', { email, password })
      const { user: userData, token: accessToken } = response.data
      
      // Set token first so we can make authenticated requests
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
      token.value = accessToken
      sessionStorage.setItem(STORAGE_KEYS.accessToken, accessToken)
      
      // If user data doesn't include role, fetch full profile
      let fullUserData = userData
      if (!userData?.role) {
        console.log('Login response missing role, fetching full profile...')
        const meResponse = await api.get('/auth/me')
        fullUserData = meResponse.data.user
      }
      
      // Save complete auth state (this will also trigger WebSocket connect)
      saveAuth(fullUserData, accessToken)
      
      return true
    } catch (err) {
      error.value = err.response?.data?.error || err.message || 'Invalid email or password'
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Sign up with email and password
   * @param {string} firstName
   * @param {string} lastName
   * @param {string} email
   * @param {string} password
   * @returns {Promise<boolean>} Success status
   */
  const signUp = async (firstName, lastName, email, password) => {
    loading.value = true
    error.value = null
    
    try {
      const response = await api.post('/auth/register', {
        email,
        password,
        display_name: `${firstName} ${lastName}`.trim(),
      })
      const { user: userData, token: accessToken } = response.data
      
      // Set token first
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
      token.value = accessToken
      sessionStorage.setItem(STORAGE_KEYS.accessToken, accessToken)
      
      // Fetch full profile to ensure we have all fields
      let fullUserData = userData
      if (!userData?.role) {
        const meResponse = await api.get('/auth/me')
        fullUserData = meResponse.data.user
      }
      
      // Save auth state (this will also trigger WebSocket connect)
      saveAuth(fullUserData, accessToken)
      return true
    } catch (err) {
      error.value = err.response?.data?.error || err.message || 'Failed to create account'
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Initiate SSO login by redirecting to the OAuth provider
   * @param {string} provider - 'google' | 'microsoft'
   */
  const signInWithSSO = (provider) => {
    loading.value = true
    error.value = null
    
    // Store the current URL to redirect back after OAuth
    const currentPath = window.location.pathname + window.location.search
    if (currentPath !== '/auth' && currentPath !== '/auth/callback') {
      sessionStorage.setItem('auth_redirect', currentPath)
    }
    
    // Redirect to backend OAuth endpoint
    const oauthUrl = `${API_BASE_URL}/auth/${provider}`
    window.location.href = oauthUrl
    
    return true
  }

  /**
   * Handle OAuth callback after redirect from provider
   * @param {string} accessToken - Token from URL query parameter
   * @returns {Promise<boolean>} Success status
   */
  const handleOAuthCallback = async (accessToken) => {
    loading.value = true
    error.value = null
    
    try {
      // Temporarily set the token
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
      
      // Fetch full user info (always from /auth/me to ensure complete data)
      const response = await api.get('/auth/me')
      const userData = response.data.user
      
      // Save auth state (this will also trigger WebSocket connect)
      saveAuth(userData, accessToken)
      
      return true
    } catch (err) {
      delete api.defaults.headers.common['Authorization']
      error.value = err.response?.data?.error || err.message || 'OAuth callback failed'
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Get the redirect path stored before OAuth flow
   * @returns {string} Redirect path or default '/'
   */
  const getOAuthRedirect = () => {
    const redirect = sessionStorage.getItem('auth_redirect')
    sessionStorage.removeItem('auth_redirect')
    return redirect || '/'
  }

  /**
   * Refresh the access token using httpOnly cookie
   * @returns {Promise<boolean>} Success status
   */
  const refreshAccessToken = async () => {
    try {
      const response = await api.post('/auth/refresh', {}, {
        withCredentials: true
      })
      
      const { token: newToken } = response.data
      
      if (newToken) {
        token.value = newToken
        sessionStorage.setItem(STORAGE_KEYS.accessToken, newToken)
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
        
        // Trigger WebSocket reconnect with new token (v2)
        triggerWebSocketConnect()
        
        return true
      }
      
      return false
    } catch (err) {
      console.error('Token refresh failed:', err)
      clearAuth()
      return false
    }
  }

  /**
   * Sign out the user
   */
  const signOut = async () => {
    try {
      await api.post('/auth/logout', {}, { withCredentials: true })
    } catch (err) {
      console.warn('Logout request failed:', err)
    }
    
    clearAuth()
    
    // Logout from WebSocket too
    if (webSocketRef?.logout) {
      webSocketRef.logout()
    }
    if (webSocketRef?.disconnect) {
      webSocketRef.disconnect()
    }
  }

  /**
   * Fetch current user from server
   * @returns {Promise<Object|null>} User object or null
   */
  const fetchCurrentUser = async () => {
    if (!token.value) {
      return null
    }
    
    try {
      const response = await api.get('/auth/me')
      user.value = response.data.user
      sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify(response.data.user))
      return response.data.user
    } catch (err) {
      if (err.response?.status === 401) {
        clearAuth()
      }
      return null
    }
  }

  /**
   * Check if the current token is expired
   * @returns {boolean} True if expired or no token
   */
  const isTokenExpired = () => {
    if (!token.value) return true
    
    const payload = decodeToken(token.value)
    if (!payload || !payload.exp) return true
    
    // Add 30-second buffer
    const expiryMs = payload.exp * 1000
    const bufferMs = 30 * 1000
    
    return Date.now() >= (expiryMs - bufferMs)
  }

  /**
   * Get the current access token
   * @returns {string|null}
   */
  const getToken = () => token.value

  /**
   * Update user data
   * @param {Object} userData
   */
  const setUser = (userData) => {
    user.value = userData
    if (userData) {
      sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify(userData))
    }
  }

  /**
   * Set error message
   * @param {string} errorMessage
   */
  const setError = (errorMessage) => {
    error.value = errorMessage
  }

  /**
   * Clear error message
   */
  const clearError = () => {
    error.value = null
  }

  /**
   * Set WebSocket reference for integration
   * @param {Object} wsRef - WebSocket composable reference
   */
  const setWebSocketRef = (wsRef) => {
    webSocketRef = wsRef
    
    // Provide token refresh callback to WebSocket
    if (wsRef?.setTokenRefreshCallback) {
      wsRef.setTokenRefreshCallback(refreshAccessToken)
    }
  }

  /**
   * Check if initialization is complete
   * Useful for showing loading state on app startup
   */
  const waitForInit = () => {
    return new Promise((resolve) => {
      if (isInitialized.value) {
        resolve(isAuthenticated.value)
        return
      }
      
      const unwatch = watch(isInitialized, (initialized) => {
        if (initialized) {
          unwatch()
          resolve(isAuthenticated.value)
        }
      })
    })
  }

  return {
    // Reactive state
    user,
    token: computed(() => token.value),
    isAuthenticated,
    isLoggedIn,
    loading,
    error,
    isInitialized: computed(() => isInitialized.value),
    isRecoveringSession: computed(() => isRecoveringSession.value),
    
    // Auth methods
    signIn,
    signUp,
    signInWithSSO,
    handleOAuthCallback,
    getOAuthRedirect,
    signOut,
    
    // Token management
    refreshAccessToken,
    isTokenExpired,
    getToken,
    
    // Session recovery
    initializeAuth,
    recoverSession,
    waitForInit,
    
    // User management
    fetchCurrentUser,
    setUser,
    
    // Error handling
    setError,
    clearError,
    
    // WebSocket integration
    setWebSocketRef,
  }
}

// ============================================================================
// AUTO-INITIALIZATION
// ============================================================================

// Start initialization when module loads (browser only)
if (typeof window !== 'undefined') {
  // Defer to allow app to set up first
  setTimeout(() => {
    initializeAuth().catch(err => {
      console.error('Auth initialization error:', err)
    })
  }, 0)
}