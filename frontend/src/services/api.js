/**
 * @fileoverview API Service
 * @description Axios-based API client with authentication and automatic token refresh.
 * 
 * Token Strategy:
 * - Access token: Read from sessionStorage, sent in Authorization header
 * - Refresh token: httpOnly cookie (handled automatically by browser)
 * 
 * The interceptor automatically refreshes expired tokens using the httpOnly cookie.
 */

import axios from 'axios'
import router from '@/router'

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

/**
 * Create axios instance with base configuration
 */
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  },
  // Always send cookies (needed for httpOnly refresh token)
  withCredentials: true
})

// ============================================================================
// STATE FOR REFRESH HANDLING
// ============================================================================

// Track if we're currently refreshing to prevent multiple simultaneous refreshes
let isRefreshing = false

// Queue of requests waiting for token refresh
let refreshSubscribers = []

/**
 * Add a request to the refresh queue
 * @param {Function} callback - Called with new token when refresh completes
 */
const subscribeToRefresh = (callback) => {
  refreshSubscribers.push(callback)
}

/**
 * Process all queued requests with the new token
 * @param {string} newToken - The new access token
 */
const onRefreshSuccess = (newToken) => {
  refreshSubscribers.forEach(callback => callback(newToken))
  refreshSubscribers = []
}

/**
 * Reject all queued requests (refresh failed)
 * @param {Error} error - The error to reject with
 */
const onRefreshFailure = (error) => {
  refreshSubscribers.forEach(callback => callback(null, error))
  refreshSubscribers = []
}

// ============================================================================
// REQUEST INTERCEPTOR
// ============================================================================

/**
 * Request interceptor to add auth token
 */
api.interceptors.request.use(
  (config) => {
    // Get token from sessionStorage
    const token = sessionStorage.getItem('accessToken')
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// ============================================================================
// RESPONSE INTERCEPTOR
// ============================================================================

/**
 * Response interceptor for error handling and automatic token refresh
 * 
 * When a 401 is received:
 * 1. If not already refreshing, attempt to refresh the token
 * 2. Queue the failed request to retry after refresh
 * 3. If refresh succeeds, retry all queued requests
 * 4. If refresh fails, redirect to login
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    
    // Don't retry if there's no response (network error)
    if (!error.response) {
      return Promise.reject(error)
    }
    
    const status = error.response.status
    
    // Handle 401 Unauthorized
    if (status === 401 && !originalRequest._retry) {
      // Don't retry auth endpoints to avoid infinite loops
      if (originalRequest.url?.includes('/auth/refresh') || 
          originalRequest.url?.includes('/auth/login')) {
        return Promise.reject(error)
      }
      
      // Mark this request as retried
      originalRequest._retry = true
      
      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeToRefresh((newToken, refreshError) => {
            if (refreshError) {
              reject(refreshError)
            } else if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`
              resolve(api(originalRequest))
            } else {
              reject(new Error('Token refresh failed'))
            }
          })
        })
      }
      
      // Start refreshing
      isRefreshing = true
      
      try {
        // Call refresh endpoint
        // The httpOnly cookie containing the refresh token is sent automatically
        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {}, // Empty body - refresh token is in cookie
          { withCredentials: true }
        )
        
        const { token: newToken } = response.data
        
        if (newToken) {
          // Update stored token
          sessionStorage.setItem('accessToken', newToken)
          
          // Update default header
          api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
          
          // Notify queued requests
          onRefreshSuccess(newToken)
          
          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return api(originalRequest)
        }
        
        throw new Error('No token in refresh response')
        
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError)
        
        // Clear auth state
        sessionStorage.removeItem('accessToken')
        sessionStorage.removeItem('user')
        delete api.defaults.headers.common['Authorization']
        
        // Notify queued requests of failure
        onRefreshFailure(refreshError)
        
        // Redirect to login with the intended destination
        const currentPath = router.currentRoute.value.fullPath
        router.push({
          name: 'auth',
          query: { 
            redirect: currentPath,
            error: 'session_expired'
          }
        })
        
        return Promise.reject(refreshError)
        
      } finally {
        isRefreshing = false
      }
    }
    
    // Handle 403 Forbidden (insufficient permissions)
    if (status === 403) {
      console.error('Access forbidden:', error.response.data)
    }
    
    // Handle 500+ Server errors
    if (status >= 500) {
      console.error('Server error:', error.response.data)
    }
    
    return Promise.reject(error)
  }
)

// ============================================================================
// API METHODS
// ============================================================================

/**
 * Auth API methods
 */
export const authApi = {
  /**
   * Login with email and password
   */
  login: (email, password) => 
    api.post('/auth/login', { email, password }),
  
  /**
   * Register a new user
   */
  register: (email, password, display_name) => 
    api.post('/auth/register', { email, password, display_name }),
  
  /**
   * Logout (clears cookies on server)
   */
  logout: () => 
    api.post('/auth/logout'),
  
  /**
   * Refresh access token using httpOnly cookie
   * Note: Usually handled automatically by interceptor
   */
  refresh: () => 
    api.post('/auth/refresh'),
  
  /**
   * Get current user info
   */
  me: () => 
    api.get('/auth/me'),
  
  /**
   * Initiate Google OAuth (redirect)
   */
  googleAuth: () => {
    window.location.href = `${API_BASE_URL}/auth/google`
  },
  
  /**
   * Initiate Microsoft OAuth (redirect)
   */
  microsoftAuth: () => {
    window.location.href = `${API_BASE_URL}/auth/microsoft`
  },
  
  /**
   * Request password reset email
   */
  requestPasswordReset: (email) =>
    api.post('/auth/password-reset/request', { email }),
  
  /**
   * Reset password with token
   */
  resetPassword: (resetToken, newPassword, confirmPassword) =>
    api.post('/auth/password-reset', { resetToken, newPassword, confirmPassword })
}

/**
 * User API methods
 */
export const userApi = {
  /**
   * Get current user's profile
   */
  getProfile: () => 
    api.get('/users/profile'),
  
  /**
   * Update user profile
   */
  updateProfile: (data) => 
    api.put('/users/profile', data),
  
  /**
   * Change password
   */
  changePassword: (currentPassword, newPassword) => 
    api.put('/users/password', { currentPassword, newPassword }),
  
  /**
   * Delete account
   */
  deleteAccount: (password) => 
    api.delete('/users/account', { data: { password } })
}

/**
 * LLM API methods
 */
export const llmApi = {
  /**
   * Get available LLM providers
   */
  getProviders: () => 
    api.get('/llm/providers'),
  
  /**
   * Get available models
   */
  getModels: () => 
    api.get('/llm/models'),
  
  /**
   * Send a chat message (non-streaming)
   */
  chat: (message, options = {}) => 
    api.post('/llm/chat', { message, ...options })
}

/**
 * Health API methods
 */
export const healthApi = {
  /**
   * Basic health check
   */
  check: () => 
    api.get('/health'),
  
  /**
   * Detailed health check
   */
  detailed: () => 
    api.get('/health/detailed')
}

export default api