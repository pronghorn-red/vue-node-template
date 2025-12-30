<!-- src/components/FeatureCard.vue -->
<template>
  <div class="card-base p-8 text-center hover:shadow-lg transition-all transform hover:-translate-y-1">
    <div class="inline-flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 mb-6">
      <svg class="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="iconPath" />
      </svg>
    </div>
    <h3 class="text-xl font-semibold text-primary mb-3">{{ title }}</h3>
    <p class="text-secondary">{{ description }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  icon: String,
  title: String,
  description: String
})

const icons = {
  zap: "M13 10V3L4 14h7v7l9-11h-7z",
  code: "M10 20l-6-6 6-6M14 20l6-6-6-6",
  palette: "M12 21a9 9 0 100-18 9 9 0 000 18z",
  layers: "M4 6h16M4 12h16M4 18h16",
  beaker: "M19 13V8h-4l-3-5-3 5H5v5l-2 9h18l-2-9z",
  "shield-check": "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
}

const iconPath = computed(() => icons[props.icon] || "")
</script>
