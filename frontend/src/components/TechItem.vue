<!-- src/components/TechItem.vue -->
<template>
  <div class="card-base rounded-xl p-6 text-center hover:shadow-lg hover:scale-105 transition-all duration-300 flex flex-col items-center justify-center">
    <div class="w-14 h-14 mx-auto mb-4 rounded-lg bg-gradient-to-br from-blue-600 to-emerald-600 dark:from-blue-500 dark:to-emerald-500 flex items-center justify-center shadow-md">
      <i v-if="iconClass" :class="iconClass" class="text-2xl text-white"></i>
      <span v-else class="text-2xl text-white font-bold">{{ iconText }}</span>
    </div>
    <h3 class="text-base font-semibold text-primary">{{ name }}</h3>
    <p v-if="version" class="text-xs text-secondary font-medium mt-1">{{ version }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: String,
  version: String,
  icon: String
})

// Map icon names to PrimeIcons classes
const iconClass = computed(() => {
  const iconMap = {
    'pi-code': 'pi pi-code',
    'pi-flash': 'pi pi-bolt',
    'pi-palette': 'pi pi-palette',
    'pi-prime': 'pi pi-prime',
    'pi-sitemap': 'pi pi-sitemap',
    'pi-database': 'pi pi-database'
  }
  return iconMap[props.icon] || null
})

// Simple fallback text using first letters
const iconText = computed(() => {
  if (props.icon === 'vue') return 'V'
  if (props.icon === 'vite') return 'Vite'
  if (props.icon === 'tailwind') return 'TW'
  if (props.icon === 'pinia') return 'P'
  if (props.icon === 'router') return 'R'
  if (props.icon === 'test') return 'T'
  if (props.icon === 'git') return 'G'
  return props.name ? props.name[0] : '?'
})
</script>
