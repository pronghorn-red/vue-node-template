// src/main.js
import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import i18n from './i18n'

import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import 'primeicons/primeicons.css'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import Chart from 'chart.js/auto'
import { chartDarkModePlugin, canvasBackgroundPlugin } from './utils/chartDarkModePlugin'

// Register Chart.js plugins
Chart.register(chartDarkModePlugin, canvasBackgroundPlugin)

const app = createApp(App)

// Initialize dark mode from localStorage or system preference
const initDarkMode = () => {
  const saved = localStorage.getItem('dark-mode')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = saved === 'true' || (!saved && prefersDark)
  
  if (isDark) {
    document.documentElement.classList.add('dark')
    document.body.classList.add('dark')
  }
}

initDarkMode()

app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      prefix: 'p',
      darkModeSelector: '.dark',
      cssLayer: {
        name: 'primevue',
        order: 'tailwind-base, primevue, tailwind-utilities'
      }
    }
  }
})

app.use(i18n)
app.use(router)
app.use(ToastService)
app.directive('tooltip', Tooltip)

app.mount('#app')
