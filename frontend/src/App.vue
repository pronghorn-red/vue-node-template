<!-- src/App.vue -->
<template>
  <!-- Loading state while auth initializes -->
  <div v-if="!isReady" class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
    <div class="text-center">
      <svg 
        class="animate-spin h-10 w-10 mx-auto text-blue-600" 
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24"
      >
        <circle 
          class="opacity-25" 
          cx="12" 
          cy="12" 
          r="10" 
          stroke="currentColor" 
          stroke-width="4"
        />
        <path 
          class="opacity-75" 
          fill="currentColor" 
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <p class="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
    </div>
  </div>

  <!-- Main app content -->
  <div v-else>
    <AppLayout v-if="!isBlankLayout">
      <RouterView />
    </AppLayout>
    <RouterView v-else />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import { useAuth } from '@/composables/useAuth'
import { useWebSocket } from '@/composables/useWebSocket'

const route = useRoute()

// Auth composable
const { 
  initializeAuth, 
  setWebSocketRef 
} = useAuth()

// WebSocket composable
const ws = useWebSocket()

// App ready state - true when auth initialization is complete
const isReady = ref(false)

// Check if current route should use blank layout (no nav/sidebar)
const isBlankLayout = computed(() => {
  return route.meta.layout === 'blank' || 
         route.path.startsWith('/auth')
})

/**
 * Initialize the application
 * - Initialize auth (check sessionStorage, attempt cookie recovery)
 * - WebSocket connects automatically in background (don't block on it)
 */
onMounted(async () => {
  try {
    // Wire up auth and WebSocket for token refresh coordination
    setWebSocketRef(ws)
    
    // Initialize auth (may recover session from httpOnly cookie)
    // This is the only thing we wait for
    await initializeAuth()
    
  } catch (error) {
    console.error('App initialization error:', error)
  } finally {
    // Show the app once auth is initialized
    // WebSocket connects in background via its own auto-init
    isReady.value = true
  }
})
</script>

<style>
/* Spinner animation */
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