/**
 * @fileoverview useUsers Composable
 * @description Provides user management functionality for profile and admin operations.
 * 
 * Profile Operations (self):
 * - Get/update own profile
 * - Change password
 * 
 * Admin Operations:
 * - List, view, update, delete users
 * - Manage roles
 * - Block/unblock users
 * - Generate password reset tokens
 * - View audit logs
 */

import { ref, computed } from 'vue'
import api from '@/services/api'

// =============================================================================
// SINGLETON STATE
// =============================================================================

const users = ref([])
const currentUser = ref(null)
const pagination = ref({
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0
})
const loading = ref(false)
const error = ref(null)

// =============================================================================
// CONSTANTS
// =============================================================================

const VALID_ROLES = ['superadmin', 'admin', 'user']

const ROLE_LEVELS = {
  superadmin: 100,
  admin: 50,
  user: 10
}

const ROLE_COLORS = {
  superadmin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  user: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
}

const ROLE_LABELS = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  user: 'User'
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get role display color classes
 * @param {string} role - Role name
 * @returns {string} Tailwind classes
 */
const getRoleColor = (role) => ROLE_COLORS[role] || ROLE_COLORS.user

/**
 * Get role display label
 * @param {string} role - Role name
 * @returns {string} Display label
 */
const getRoleLabel = (role) => ROLE_LABELS[role] || role

/**
 * Get role hierarchy level
 * @param {string} role - Role name
 * @returns {number} Level (higher = more permissions)
 */
const getRoleLevel = (role) => ROLE_LEVELS[role] || 0

/**
 * Check if actor can modify target's role
 * @param {string} actorRole - Actor's role
 * @param {string} targetRole - Target's current role
 * @returns {boolean}
 */
const canModifyRole = (actorRole, targetRole) => {
  return getRoleLevel(actorRole) > getRoleLevel(targetRole)
}

/**
 * Get user initials for avatar
 * @param {Object} user - User object
 * @returns {string} Initials (1-2 characters)
 */
const getUserInitials = (user) => {
  if (!user?.display_name) return '?'
  const parts = user.display_name.trim().split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return parts[0].substring(0, 2).toUpperCase()
}

/**
 * Format date for display
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date
 */
const formatDate = (dateString) => {
  if (!dateString) return 'Never'
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// =============================================================================
// COMPOSABLE
// =============================================================================

export function useUsers() {
  // ===========================================================================
  // PROFILE OPERATIONS (Self)
  // ===========================================================================

  /**
   * Get current user's profile
   * @returns {Promise<Object>} User profile
   */
  const getProfile = async () => {
    loading.value = true
    error.value = null
    
    try {
      const response = await api.get('/users/profile')
      currentUser.value = response.data.user
      return response.data.user
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to fetch profile'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Update current user's profile
   * @param {Object} data - Profile data to update
   * @returns {Promise<Object>} Updated user
   */
  const updateProfile = async (data) => {
    loading.value = true
    error.value = null
    
    try {
      const response = await api.put('/users/profile', data)
      currentUser.value = response.data.user
      return response.data.user
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to update profile'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Change current user's password
   * @param {Object} data - Password change data
   * @returns {Promise<void>}
   */
  const changePassword = async (data) => {
    loading.value = true
    error.value = null
    
    try {
      await api.put('/users/password', data)
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to change password'
      throw err
    } finally {
      loading.value = false
    }
  }

  // ===========================================================================
  // ADMIN OPERATIONS
  // ===========================================================================

  /**
   * List all users (admin only)
   * @param {Object} params - Query parameters
   * @returns {Promise<Array>} Users list
   */
  const listUsers = async (params = {}) => {
    loading.value = true
    error.value = null
    
    try {
      const response = await api.get('/users', { params })
      users.value = response.data.users
      pagination.value = response.data.pagination
      return response.data.users
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to fetch users'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Get a specific user by ID (admin only)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User
   */
  const getUser = async (userId) => {
    loading.value = true
    error.value = null
    
    try {
      const response = await api.get(`/users/${userId}`)
      return response.data.user
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to fetch user'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Update a user (admin only)
   * @param {string} userId - User ID
   * @param {Object} data - User data to update
   * @returns {Promise<Object>} Updated user
   */
  const updateUser = async (userId, data) => {
    loading.value = true
    error.value = null
    
    try {
      const response = await api.put(`/users/${userId}`, data)
      // Update in local list if present
      const index = users.value.findIndex(u => u.id === userId)
      if (index !== -1) {
        users.value[index] = response.data.user
      }
      return response.data.user
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to update user'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Update a user's role (admin only)
   * @param {string} userId - User ID
   * @param {Object} data - Role data { role, additional_roles }
   * @returns {Promise<Object>} Updated user
   */
  const updateUserRole = async (userId, data) => {
    loading.value = true
    error.value = null
    
    try {
      const response = await api.put(`/users/${userId}/role`, data)
      // Update in local list if present
      const index = users.value.findIndex(u => u.id === userId)
      if (index !== -1) {
        users.value[index] = response.data.user
      }
      return response.data.user
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to update role'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Block a user (admin only)
   * @param {string} userId - User ID
   * @param {string} reason - Block reason
   * @returns {Promise<void>}
   */
  const blockUser = async (userId, reason = '') => {
    loading.value = true
    error.value = null
    
    try {
      await api.post(`/users/${userId}/block`, { reason })
      // Update in local list
      const index = users.value.findIndex(u => u.id === userId)
      if (index !== -1) {
        users.value[index].is_blocked = true
        users.value[index].blocked_reason = reason
      }
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to block user'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Unblock a user (admin only)
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  const unblockUser = async (userId) => {
    loading.value = true
    error.value = null
    
    try {
      await api.post(`/users/${userId}/unblock`)
      // Update in local list
      const index = users.value.findIndex(u => u.id === userId)
      if (index !== -1) {
        users.value[index].is_blocked = false
        users.value[index].blocked_reason = null
      }
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to unblock user'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Delete a user (admin only)
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  const deleteUser = async (userId) => {
    loading.value = true
    error.value = null
    
    try {
      await api.delete(`/users/${userId}`)
      // Remove from local list
      users.value = users.value.filter(u => u.id !== userId)
      pagination.value.total--
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to delete user'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Generate password reset token for a user (admin only)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Reset token data
   */
  const generateResetToken = async (userId) => {
    loading.value = true
    error.value = null
    
    try {
      const response = await api.post(`/users/${userId}/reset-token`)
      return response.data
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to generate reset token'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Get audit log for a user (admin only)
   * @param {string} userId - User ID
   * @param {number} limit - Max entries
   * @returns {Promise<Array>} Audit log entries
   */
  const getUserAuditLog = async (userId, limit = 50) => {
    loading.value = true
    error.value = null
    
    try {
      const response = await api.get(`/users/${userId}/audit`, { params: { limit } })
      return response.data.audit_log
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to fetch audit log'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * List pending password reset requests (admin only)
   * @returns {Promise<Array>} Reset requests
   */
  const listPasswordResets = async () => {
    loading.value = true
    error.value = null
    
    try {
      const response = await api.get('/users/admin/password-resets')
      return response.data.resets
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to fetch password resets'
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Clear error state
   */
  const clearError = () => {
    error.value = null
  }

  // ===========================================================================
  // RETURN
  // ===========================================================================

  return {
    // State
    users,
    currentUser,
    pagination,
    loading,
    error,
    
    // Constants
    VALID_ROLES,
    ROLE_LEVELS,
    ROLE_COLORS,
    ROLE_LABELS,
    
    // Helpers
    getRoleColor,
    getRoleLabel,
    getRoleLevel,
    canModifyRole,
    getUserInitials,
    formatDate,
    
    // Profile operations
    getProfile,
    updateProfile,
    changePassword,
    
    // Admin operations
    listUsers,
    getUser,
    updateUser,
    updateUserRole,
    blockUser,
    unblockUser,
    deleteUser,
    generateResetToken,
    getUserAuditLog,
    listPasswordResets,
    
    // Utilities
    clearError
  }
}