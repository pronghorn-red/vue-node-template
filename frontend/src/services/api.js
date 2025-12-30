/**
 * @fileoverview API Service
 * @description Axios-based API client with authentication and error handling
 */

import axios from 'axios'
import router from '@/router'

/**
 * Create axios instance with base configuration
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

/**
 * Request interceptor to add auth token and handle cookies
 */
api.interceptors.request.use(
  (config) => {
    // Add token from localStorage
    const token = localStorage.getItem('accessToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    // Enable credentials for cookie-based auth
    config.withCredentials = true
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

/**
 * Response interceptor for error handling and token refresh
 * Supports both localStorage tokens and cookie-based authentication
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    
    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      
      // Try to refresh token from localStorage
      const refreshToken = localStorage.getItem('refreshToken')
      if (refreshToken) {
        try {
          const response = await axios.post(
            `${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/auth/refresh`,
            { refreshToken },
            { withCredentials: true }
          )
          
          const { token, refreshToken: newRefreshToken } = response.data
          
          // Update tokens in localStorage
          localStorage.setItem('accessToken', token)
          localStorage.setItem('refreshToken', newRefreshToken)
          
          // Update authorization header
          originalRequest.headers.Authorization = `Bearer ${token}`
          
          // Retry original request
          return api(originalRequest)
        } catch (refreshError) {
          // Refresh failed, clear tokens and redirect to login
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('user')
          
          // Redirect to login with redirect parameter
          router.push({
            name: 'auth',
            query: { redirect: router.currentRoute.value.fullPath }
          })
          
          return Promise.reject(refreshError)
        }
      } else {
        // No refresh token, redirect to login
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('user')
        
        router.push({
          name: 'auth',
          query: { redirect: router.currentRoute.value.fullPath }
        })
      }
    }
    
    return Promise.reject(error)
  }
)

/**
 * Auth API methods
 */
export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (email, password, display_name) => api.post('/auth/register', { email, password, display_name }),
  logout: () => api.post('/auth/logout'),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  me: () => api.get('/auth/me'),
  googleAuth: () => window.location.href = `${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/auth/google`,
  microsoftAuth: () => window.location.href = `${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/auth/microsoft`
}

/**
 * User API methods
 */
export const userApi = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  changePassword: (currentPassword, newPassword) => api.put('/users/password', { currentPassword, newPassword }),
  deleteAccount: (password) => api.delete('/users/account', { data: { password } })
}

/**
 * LLM API methods
 */
export const llmApi = {
  getProviders: () => api.get('/llm/providers'),
  getModels: () => api.get('/llm/models'),
  chat: (message, options = {}) => api.post('/llm/chat', { message, ...options })
}

/**
 * Health API methods
 */
export const healthApi = {
  check: () => api.get('/health'),
  detailed: () => api.get('/health/detailed')
}

export default api
