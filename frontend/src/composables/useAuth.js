/**
 * @fileoverview useAuth Composable
 * @description Authentication composable with JWT token management.
 * Stores tokens in localStorage for WebSocket authentication.
 */

import { ref, computed } from 'vue'
import api from '@/services/api'

// Global auth state (singleton)
const user = ref(null)
const token = ref(null)
const refreshToken = ref(null)
const isAuthenticated = ref(false)
const loading = ref(false)
const error = ref(null)

// Storage keys
const STORAGE_KEYS = {
  user: 'user',
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
}

/**
 * Initialize auth from localStorage
 */
const initializeAuth = () => {
  try {
    const savedUser = localStorage.getItem(STORAGE_KEYS.user)
    const savedToken = localStorage.getItem(STORAGE_KEYS.accessToken)
    const savedRefreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken)
    
    if (savedUser && savedToken) {
      user.value = JSON.parse(savedUser)
      token.value = savedToken
      refreshToken.value = savedRefreshToken
      isAuthenticated.value = true
      
      // Set token in API defaults
      api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`
    }
  } catch (err) {
    console.error('Failed to initialize auth:', err)
    clearAuth()
  }
}

/**
 * Save auth state to localStorage
 */
const saveAuth = (userData, accessToken, refresh = null) => {
  user.value = userData
  token.value = accessToken
  refreshToken.value = refresh
  isAuthenticated.value = true
  
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(userData))
  localStorage.setItem(STORAGE_KEYS.accessToken, accessToken)
  if (refresh) {
    localStorage.setItem(STORAGE_KEYS.refreshToken, refresh)
  }
  
  // Set token in API defaults
  api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
}

/**
 * Clear auth state
 */
const clearAuth = () => {
  user.value = null
  token.value = null
  refreshToken.value = null
  isAuthenticated.value = false
  
  localStorage.removeItem(STORAGE_KEYS.user)
  localStorage.removeItem(STORAGE_KEYS.accessToken)
  localStorage.removeItem(STORAGE_KEYS.refreshToken)
  
  delete api.defaults.headers.common['Authorization']
}

// Initialize on first import
initializeAuth()

export function useAuth() {
  const isLoggedIn = computed(() => isAuthenticated.value)

  /**
   * Sign in with email and password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<boolean>}
   */
  const signIn = async (email, password) => {
    loading.value = true
    error.value = null
    
    try {
      const response = await api.post('/auth/login', { email, password })
      const { user: userData, token: accessToken, refreshToken: refresh } = response.data
      
      saveAuth(userData, accessToken, refresh)
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
   * @returns {Promise<boolean>}
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
      const { user: userData, token: accessToken, refreshToken: refresh } = response.data
      
      saveAuth(userData, accessToken, refresh)
      return true
    } catch (err) {
      error.value = err.response?.data?.error || err.message || 'Failed to create account'
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Sign in with SSO provider
   * @param {string} provider - 'google' | 'microsoft'
   * @param {string} [callbackToken] - Token from OAuth callback
   * @returns {Promise<boolean>}
   */
  const signInWithSSO = async (provider, callbackToken = null) => {
    loading.value = true
    error.value = null
    
    try {
      if (callbackToken) {
        // Handle OAuth callback with token
        // The token is typically passed via URL after redirect
        const response = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${callbackToken}` }
        })
        
        saveAuth(response.data.user, callbackToken)
        return true
      } else {
        // Redirect to OAuth provider
        const baseUrl = import.meta.env.VITE_API_BASE_URL || ''
        window.location.href = `${baseUrl}/auth/${provider}`
        return true
      }
    } catch (err) {
      error.value = err.response?.data?.error || err.message || `Failed to sign in with ${provider}`
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Handle OAuth callback (called from callback route)
   * @param {string} accessToken - Token from URL
   * @returns {Promise<boolean>}
   */
  const handleOAuthCallback = async (accessToken) => {
    loading.value = true
    error.value = null
    
    try {
      // Get user info with the token
      const response = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      
      saveAuth(response.data.user, accessToken)
      return true
    } catch (err) {
      error.value = err.response?.data?.error || err.message || 'OAuth callback failed'
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * Refresh the access token
   * @returns {Promise<boolean>}
   */
  const refreshAccessToken = async () => {
    if (!refreshToken.value) {
      return false
    }
    
    try {
      const response = await api.post('/auth/refresh', {
        refreshToken: refreshToken.value
      })
      
      const { token: newToken, refreshToken: newRefresh } = response.data
      
      token.value = newToken
      if (newRefresh) {
        refreshToken.value = newRefresh
      }
      
      localStorage.setItem(STORAGE_KEYS.accessToken, newToken)
      if (newRefresh) {
        localStorage.setItem(STORAGE_KEYS.refreshToken, newRefresh)
      }
      
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
      return true
    } catch (err) {
      console.error('Token refresh failed:', err)
      // If refresh fails, clear auth
      clearAuth()
      return false
    }
  }

  /**
   * Sign out
   */
  const signOut = async () => {
    try {
      await api.post('/auth/logout')
    } catch (err) {
      // Ignore logout errors
    }
    
    clearAuth()
  }

  /**
   * Get current user from server
   * @returns {Promise<Object|null>}
   */
  const fetchCurrentUser = async () => {
    if (!token.value) {
      return null
    }
    
    try {
      const response = await api.get('/auth/me')
      user.value = response.data.user
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(response.data.user))
      return response.data.user
    } catch (err) {
      // If unauthorized, clear auth
      if (err.response?.status === 401) {
        clearAuth()
      }
      return null
    }
  }

  /**
   * Check if token is expired (basic check)
   * @returns {boolean}
   */
  const isTokenExpired = () => {
    if (!token.value) return true
    
    try {
      // Decode JWT payload (without verification)
      const payload = JSON.parse(atob(token.value.split('.')[1]))
      const exp = payload.exp * 1000 // Convert to milliseconds
      return Date.now() >= exp
    } catch {
      return true
    }
  }

  /**
   * Get the current access token
   * Useful for WebSocket authentication
   * @returns {string|null}
   */
  const getToken = () => token.value

  /**
   * Set user data (for external updates)
   * @param {Object} userData
   */
  const setUser = (userData) => {
    user.value = userData
    if (userData) {
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(userData))
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

  return {
    // State
    user,
    token: computed(() => token.value),
    isAuthenticated,
    isLoggedIn,
    loading,
    error,
    
    // Methods
    signIn,
    signUp,
    signInWithSSO,
    handleOAuthCallback,
    signOut,
    refreshAccessToken,
    fetchCurrentUser,
    isTokenExpired,
    getToken,
    setUser,
    setError,
    clearError,
    initializeAuth,
  }
}