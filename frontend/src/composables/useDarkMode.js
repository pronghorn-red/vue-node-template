// src/composables/useDarkMode.js
import { ref, onMounted, watch } from 'vue'

export function useDarkMode() {
  const isDark = ref(false)

  const init = () => {
    const saved = localStorage.getItem('dark-mode')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    isDark.value = saved === 'true' || (!saved && prefersDark)
    applyTheme(isDark.value)
  }

  const applyTheme = (dark) => {
    // Apply to document root
    document.documentElement.classList.toggle('dark', dark)
    
    // Apply to body as well for comprehensive coverage
    document.body.classList.toggle('dark', dark)
    
    // Persist to localStorage
    localStorage.setItem('dark-mode', dark)
    
    // Dispatch custom event for any component that needs to react
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: { isDark: dark } }))
  }

  const toggle = () => {
    isDark.value = !isDark.value
    applyTheme(isDark.value)
  }

  const setDark = (dark) => {
    isDark.value = dark
    applyTheme(dark)
  }

  // Watch for system theme changes
  onMounted(() => {
    init()
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e) => {
      if (!localStorage.getItem('dark-mode')) {
        isDark.value = e.matches
        applyTheme(e.matches)
      }
    }
    
    mediaQuery.addEventListener('change', handleChange)
    
    return () => mediaQuery.removeEventListener('change', handleChange)
  })

  return { isDark, toggle, setDark, applyTheme }
}
