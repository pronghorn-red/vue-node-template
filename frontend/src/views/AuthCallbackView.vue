<!-- src/views/AuthCallbackView.vue -->
<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div class="text-center max-w-md px-4">
      <!-- Loading spinner -->
      <div v-if="status === 'processing'" class="mb-4">
        <svg class="animate-spin h-12 w-12 mx-auto text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
      
      <!-- Success icon -->
      <div v-else-if="status === 'success'" class="mb-4">
        <svg class="h-12 w-12 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
      </div>
      
      <!-- Error icon -->
      <div v-else-if="status === 'error'" class="mb-4">
        <svg class="h-12 w-12 mx-auto text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </div>
      
      <p class="text-lg text-gray-700 dark:text-gray-300">{{ message }}</p>
      
      <!-- Manual redirect button (shows if auto-redirect is slow) -->
      <button 
        v-if="status === 'success' && showManualRedirect"
        @click="doRedirect"
        class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Continue to Dashboard
      </button>
      
      <!-- Return to login button on error -->
      <button 
        v-if="status === 'error'"
        @click="goToLogin"
        class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Return to Login
      </button>
    </div>
  </div>
</template>

<script setup>
/**
 * @fileoverview Auth Callback View
 * @description Handles OAuth callback redirects from Google/Microsoft SSO.
 * 
 * Flow:
 * 1. User clicks SSO button on AuthView
 * 2. Browser redirects to backend OAuth endpoint
 * 3. Backend handles OAuth with provider
 * 4. Backend redirects here with ?token=xxx
 * 5. This component stores the token and fetches user info
 * 6. Redirects to dashboard or original destination
 */

import { onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const route = useRoute()
const { handleOAuthCallback, getOAuthRedirect, isAuthenticated } = useAuth()

const status = ref('processing')
const message = ref('Completing sign in...')
const showManualRedirect = ref(false)

/**
 * Redirect to the appropriate destination
 */
const doRedirect = () => {
  const redirect = getOAuthRedirect()
  router.push(redirect)
}

/**
 * Return to login page on error
 */
const goToLogin = () => {
  router.push({ name: 'auth' })
}

onMounted(async () => {
  try {
    const token = route.query.token
    const error = route.query.error
    
    // Handle OAuth error from provider
    if (error) {
      status.value = 'error'
      message.value = getErrorMessage(error)
      return
    }
    
    // No token received
    if (!token) {
      status.value = 'error'
      message.value = 'No authentication token received. Please try again.'
      return
    }
    
    // Process the OAuth callback
    message.value = 'Verifying your account...'
    const success = await handleOAuthCallback(token)
    
    if (success) {
      status.value = 'success'
      message.value = 'Sign in successful! Redirecting...'
      
      // Short delay before redirect for UX
      setTimeout(() => {
        doRedirect()
      }, 800)
      
      // Show manual redirect button if auto-redirect takes too long
      setTimeout(() => {
        if (status.value === 'success') {
          showManualRedirect.value = true
        }
      }, 3000)
    } else {
      status.value = 'error'
      message.value = 'Failed to complete sign in. Please try again.'
    }
    
  } catch (err) {
    console.error('Auth callback error:', err)
    status.value = 'error'
    message.value = 'An unexpected error occurred. Please try again.'
  }
})

/**
 * Get user-friendly error message
 */
const getErrorMessage = (error) => {
  const errorMessages = {
    'access_denied': 'Access was denied. Please try again or use a different sign in method.',
    'microsoft_failed': 'Microsoft sign in failed. Please try again.',
    'google_failed': 'Google sign in failed. Please try again.',
    'invalid_request': 'Invalid authentication request. Please try again.',
    'server_error': 'Server error during authentication. Please try again later.',
    'temporarily_unavailable': 'Authentication service is temporarily unavailable. Please try again later.',
  }
  
  return errorMessages[error] || `Authentication failed: ${error}`
}
</script>

<style scoped>
/* Animation for the spinner */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>