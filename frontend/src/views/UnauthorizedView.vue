<template>
  <div class="min-h-[60vh] flex items-center justify-center p-4">
    <div class="text-center max-w-md">
      <!-- Icon -->
      <div class="mx-auto w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
        <i class="pi pi-lock text-5xl text-red-500 dark:text-red-400"></i>
      </div>
      
      <!-- Title -->
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        Access Denied
      </h1>
      
      <!-- Description -->
      <p class="text-gray-600 dark:text-gray-400 mb-8">
        You don't have permission to access this page. Please contact an administrator if you believe this is an error.
      </p>
      
      <!-- Actions -->
      <div class="flex flex-col sm:flex-row gap-3 justify-center">
        <Button 
          label="Go Back"
          icon="pi pi-arrow-left"
          severity="secondary"
          @click="goBack"
        />
        <Button 
          label="Dashboard"
          icon="pi pi-home"
          @click="goHome"
        />
      </div>
      
      <!-- Current User Info -->
      <div v-if="user" class="mt-8 p-4 bg-gray-100 dark:bg-slate-800 rounded-lg text-left">
        <div class="text-sm text-gray-500 dark:text-gray-400 mb-2">
          Logged in as:
        </div>
        <div class="flex items-center gap-3">
          <div 
            class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold"
          >
            {{ userInitials }}
          </div>
          <div>
            <div class="font-medium text-gray-900 dark:text-white">
              {{ user.display_name }}
            </div>
            <div class="text-sm text-gray-500 dark:text-gray-400">
              {{ user.email }} • {{ roleLabel }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import Button from 'primevue/button'

const router = useRouter()
const { user } = useAuth()

const ROLE_LABELS = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  user: 'User'
}

const userInitials = computed(() => {
  if (!user.value?.display_name) return '?'
  const parts = user.value.display_name.trim().split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return parts[0].substring(0, 2).toUpperCase()
})

const roleLabel = computed(() => {
  return ROLE_LABELS[user.value?.role] || 'User'
})

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/dashboard')
  }
}

const goHome = () => {
  router.push('/dashboard')
}
</script>