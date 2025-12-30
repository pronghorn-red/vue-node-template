<script setup>
/**
 * @fileoverview Profile View
 * @description User profile management page
 */

import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

const router = useRouter()

// State
const user = ref(null)
const isLoading = ref(true)
const isSaving = ref(false)
const error = ref(null)
const success = ref(null)

// Form data
const displayName = ref('')
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

// Fetch user profile
const fetchProfile = async () => {
  try {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      router.push({ name: 'auth' })
      return
    }
    
    const response = await axios.get('/api/v1/users/profile', {
      headers: { Authorization: `Bearer ${token}` }
    })
    
    user.value = response.data.user
    displayName.value = user.value.display_name
  } catch (err) {
    if (err.response?.status === 401) {
      localStorage.removeItem('accessToken')
      router.push({ name: 'auth' })
    } else {
      error.value = err.response?.data?.error || 'Failed to load profile'
    }
  } finally {
    isLoading.value = false
  }
}

// Update profile
const updateProfile = async () => {
  error.value = null
  success.value = null
  isSaving.value = true
  
  try {
    const token = localStorage.getItem('accessToken')
    await axios.put('/api/v1/users/profile', 
      { display_name: displayName.value },
      { headers: { Authorization: `Bearer ${token}` } }
    )
    
    user.value.display_name = displayName.value
    success.value = 'Profile updated successfully'
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to update profile'
  } finally {
    isSaving.value = false
  }
}

// Change password
const changePassword = async () => {
  error.value = null
  success.value = null
  
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Passwords do not match'
    return
  }
  
  if (newPassword.value.length < 8) {
    error.value = 'Password must be at least 8 characters'
    return
  }
  
  isSaving.value = true
  
  try {
    const token = localStorage.getItem('accessToken')
    await axios.put('/api/v1/users/password',
      { 
        currentPassword: currentPassword.value,
        newPassword: newPassword.value 
      },
      { headers: { Authorization: `Bearer ${token}` } }
    )
    
    success.value = 'Password changed successfully'
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (err) {
    error.value = err.response?.data?.error || 'Failed to change password'
  } finally {
    isSaving.value = false
  }
}

// Logout
const logout = () => {
  localStorage.removeItem('accessToken')
  router.push({ name: 'auth' })
}

onMounted(fetchProfile)
</script>

<template>
  <div class="max-w-2xl mx-auto p-6">
    <h1 class="text-2xl font-bold mb-6 dark:text-white">Profile Settings</h1>
    
    <!-- Loading state -->
    <div v-if="isLoading" class="text-center py-8">
      <div class="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto"></div>
    </div>
    
    <template v-else>
      <!-- Alerts -->
      <div v-if="error" class="mb-4 p-4 bg-red-100 text-red-800 rounded-lg dark:bg-red-900 dark:text-red-200">
        {{ error }}
      </div>
      
      <div v-if="success" class="mb-4 p-4 bg-green-100 text-green-800 rounded-lg dark:bg-green-900 dark:text-green-200">
        {{ success }}
      </div>
      
      <!-- Profile Info -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 class="text-lg font-semibold mb-4 dark:text-white">Account Information</h2>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input 
              type="email" 
              :value="user?.email" 
              disabled
              class="w-full px-4 py-2 border rounded-lg bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Display Name
            </label>
            <input 
              v-model="displayName"
              type="text"
              class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Authentication Provider
            </label>
            <input 
              type="text" 
              :value="user?.oauth_provider?.charAt(0).toUpperCase() + user?.oauth_provider?.slice(1)" 
              disabled
              class="w-full px-4 py-2 border rounded-lg bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
            />
          </div>
          
          <button 
            @click="updateProfile"
            :disabled="isSaving"
            class="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {{ isSaving ? 'Saving...' : 'Update Profile' }}
          </button>
        </div>
      </div>
      
      <!-- Change Password (only for local accounts) -->
      <div v-if="user?.oauth_provider === 'local'" class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 class="text-lg font-semibold mb-4 dark:text-white">Change Password</h2>
        
        <form @submit.prevent="changePassword" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Current Password
            </label>
            <input 
              v-model="currentPassword"
              type="password"
              class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              New Password
            </label>
            <input 
              v-model="newPassword"
              type="password"
              class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Confirm New Password
            </label>
            <input 
              v-model="confirmPassword"
              type="password"
              class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          
          <button 
            type="submit"
            :disabled="isSaving"
            class="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {{ isSaving ? 'Changing...' : 'Change Password' }}
          </button>
        </form>
      </div>
      
      <!-- Logout -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 class="text-lg font-semibold mb-4 dark:text-white">Session</h2>
        <button 
          @click="logout"
          class="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Sign Out
        </button>
      </div>
    </template>
  </div>
</template>
