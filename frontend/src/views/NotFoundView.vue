<template>
  <div class="min-h-[70vh] flex items-center justify-center p-4">
    <div class="text-center max-w-lg">
      <!-- 404 Illustration -->
      <div class="relative mb-8">
        <!-- Large 404 Text -->
        <div class="text-[150px] sm:text-[200px] font-black text-gray-100 dark:text-slate-800 leading-none select-none">
          404
        </div>
        <!-- Floating Icon -->
        <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div class="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg animate-bounce-slow">
            <i class="pi pi-question text-4xl text-white"></i>
          </div>
        </div>
      </div>
      
      <!-- Title -->
      <h1 class="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
        {{ $t('errors.notFound', 'Page Not Found') }}
      </h1>
      
      <!-- Description -->
      <p class="text-gray-600 dark:text-gray-400 mb-8 text-lg">
        {{ $t('errors.notFoundDesc', "Oops! The page you're looking for doesn't exist or has been moved.") }}
      </p>
      
      <!-- Suggestions -->
      <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-4 mb-8 text-left">
        <p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ $t('errors.suggestions', 'Here are some helpful links:') }}
        </p>
        <ul class="space-y-2">
          <li>
            <router-link 
              to="/dashboard" 
              class="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              <i class="pi pi-home"></i>
              {{ $t('nav.dashboard', 'Dashboard') }}
            </router-link>
          </li>
          <li>
            <router-link 
              to="/chat" 
              class="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              <i class="pi pi-comments"></i>
              {{ $t('nav.chat', 'Chat') }}
            </router-link>
          </li>
          <li>
            <router-link 
              to="/about" 
              class="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              <i class="pi pi-info-circle"></i>
              {{ $t('nav.about', 'About') }}
            </router-link>
          </li>
        </ul>
      </div>
      
      <!-- Actions -->
      <div class="flex flex-col sm:flex-row gap-3 justify-center">
        <Button 
          :label="$t('common.goBack', 'Go Back')"
          icon="pi pi-arrow-left"
          severity="secondary"
          @click="goBack"
        />
        <Button 
          :label="$t('nav.dashboard', 'Dashboard')"
          icon="pi pi-home"
          @click="goHome"
        />
      </div>
      
      <!-- Attempted Path (for debugging) -->
      <div class="mt-8 text-xs text-gray-400 dark:text-gray-500">
        {{ $t('errors.attemptedPath', 'Attempted path') }}: 
        <code class="bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded">{{ currentPath }}</code>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Button from 'primevue/button'

const router = useRouter()
const route = useRoute()

const currentPath = computed(() => route.fullPath)

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

<style scoped>
@keyframes bounce-slow {
  0%, 100% {
    transform: translate(-50%, -50%) translateY(0);
  }
  50% {
    transform: translate(-50%, -50%) translateY(-10px);
  }
}

.animate-bounce-slow {
  animation: bounce-slow 2s ease-in-out infinite;
}
</style>