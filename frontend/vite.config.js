import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],

  base: process.env.BASE_PATH || '/',  // Dynamic base for GH Pages; defaults to '/' for local
  envDir: path.resolve(__dirname, '..'),  // Points to the monorepo root (one level up)

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },

  build: {
    // Optimize chunk splitting for better caching and loading
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks
          'vue-vendor': ['vue', 'vue-router', 'vue-i18n'],
          'primevue-vendor': ['primevue', '@primevue/themes'],
          'chart-vendor': ['chart.js'],
          // Separate heavy views into their own chunks
          'dashboard': ['./src/views/DashboardView.vue'],
        }
      }
    },
    // Increase chunk size warning limit since we're intentionally chunking
    chunkSizeWarningLimit: 1000,
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
      }
    }
  }
})
