<script setup>
/**
 * @fileoverview Auth Callback View
 * @description Handles OAuth callback redirects and token storage
 */

import { onMounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const status = ref('processing')
const message = ref('Processing authentication...')

onMounted(async () => {
  try {
    const token = route.query.token
    const error = route.query.error
    
    if (error) {
      status.value = 'error'
      message.value = `Authentication failed: ${error}`
      setTimeout(() => {
        router.push({ name: 'auth', query: { error } })
      }, 2000)
      return
    }
    
    if (token) {
      // Store the token
      localStorage.setItem('accessToken', token)
      
      status.value = 'success'
      message.value = 'Authentication successful! Redirecting...'
      
      // Redirect to dashboard or original destination
      const redirect = route.query.redirect || '/dashboard'
      setTimeout(() => {
        router.push(redirect)
      }, 1000)
    } else {
      status.value = 'error'
      message.value = 'No authentication token received'
      setTimeout(() => {
        router.push({ name: 'auth' })
      }, 2000)
    }
  } catch (err) {
    status.value = 'error'
    message.value = 'An error occurred during authentication'
    console.error('Auth callback error:', err)
    setTimeout(() => {
      router.push({ name: 'auth' })
    }, 2000)
  }
})
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div class="text-center">
      <!-- Loading spinner -->
      <div v-if="status === 'processing'" class="mb-4">
        <svg class="animate-spin h-12 w-12 mx-auto text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
    </div>
  </div>
</template>
