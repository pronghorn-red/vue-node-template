<!-- src/App.vue -->
<template>
  <div>
    <AppLayout v-if="!isBlankLayout">
      <RouterView />
    </AppLayout>
    <RouterView v-else />
  </div>
</template>

<script setup>
import AppLayout from '@/components/AppLayout.vue'
import { RouterView, useRoute } from 'vue-router'
import { computed, onMounted } from 'vue'
import { useAuth } from '@/composables/useAuth'

const route = useRoute()
const { initializeAuth } = useAuth()

const isBlankLayout = computed(() => route.meta.layout === 'blank')

onMounted(() => {
  initializeAuth()
})
</script>
