<!-- src/components/AppLayout.vue -->
<template>
  <div class="min-h-screen flex flex-col bg-primary text-primary">
    <!-- Skip to main content link -->
    <a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded">
      {{ $t('accessibility.skipToContent') }}
    </a>

    <!-- Top Bar / Menubar - FIXED/STICKY -->
    <div class="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-md h-16 px-4 flex items-center justify-between"
         role="navigation"
         :aria-label="$t('accessibility.mainNavigation')">
      <!-- Left side: Hamburger and Logo -->
      <div class="go-home flex items-center gap-3" @click="goHome">
        <!-- Hamburger Menu Button -->
        <Button
          icon="pi pi-bars"
          text
          rounded
          severity="secondary"
          size="small"
          @click.stop="sidebarVisible = true"
          class="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          :aria-label="$t('accessibility.toggleMenu')"
          :title="$t('accessibility.toggleMenu')"
        />
        <img src="@/assets/vue.svg" alt="Template Logo" class="h-10 w-10 drop-shadow-sm" />
        <span class="text-xl font-bold gradient-text hidden md:inline">
          {{ $t('common.appName') }}
        </span>
      </div>

      <!-- Center: Spacer for layout balance -->
      <div class="flex-1"></div>

      <!-- Right side: Controls -->
      <div>
        <div class="flex items-center gap-2">
          <!-- WebSocket Connection Indicator -->
          <div v-if="isLoggedIn" class="ws-indicator" :class="{ connected: wsConnected, disconnected: !wsConnected }">
            <span class="indicator-dot"></span>
            <span class="text-xs hidden sm:inline">{{ wsConnected ? $t('common.wsConnected') : $t('common.wsDisconnected') }}</span>
          </div>

          <!-- Language Toggle Button -->
          <Button
            :label="currentLanguage === 'en' ? 'En' : 'Fr'"
            rounded
            text
            severity="secondary"
            size="small"
            @click="toggleLanguage"
            class="hover:bg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 font-semibold"
            :aria-label="$t('accessibility.languageSelector')"
            :title="currentLanguage === 'en' ? 'Switch to Français' : 'Switch to English'"
          />

          <!-- Theme Toggle -->
          <Button
            :icon="isDark ? 'pi pi-moon' : 'pi pi-sun'"
            rounded
            text
            severity="secondary"
            size="small"
            @click="toggleDarkMode"
            class="hover:bg-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            :aria-label="$t('accessibility.toggleTheme')"
            :title="isDark ? $t('common.lightMode') : $t('common.darkMode')"
          />

          <!-- User Menu Button (Logged In) -->
          <div v-if="isLoggedIn" class="relative">
            <button
              @click="toggleUserMenu"
              class="flex items-center gap-2 px-2 py-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              :aria-label="$t('common.profile')"
              :aria-haspopup="true"
              :aria-expanded="userMenuVisible"
            >
              <!-- User Avatar -->
              <div class="relative">
                <img 
                  v-if="user?.avatar_url"
                  :src="user.avatar_url" 
                  :alt="user.display_name"
                  class="w-8 h-8 rounded-full object-cover ring-2 ring-white dark:ring-slate-800"
                />
                <div 
                  v-else
                  class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold ring-2 ring-white dark:ring-slate-800"
                >
                  {{ userInitials }}
                </div>
                <!-- Online indicator -->
                <span class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
              </div>
              
              <!-- User Info (hidden on mobile) -->
              <div class="hidden md:flex flex-col items-start">
                <span class="text-sm font-medium text-gray-900 dark:text-white leading-tight">
                  {{ user?.display_name || 'User' }}
                </span>
                <div class="flex items-center gap-1">
                  <!-- Role Badge -->
                  <span :class="['text-xs px-1.5 py-0.5 rounded-full font-medium leading-none', roleColorClass]">
                    {{ roleLabel }}
                  </span>
                  <!-- Additional roles count -->
                  <span 
                    v-if="additionalRolesCount > 0"
                    class="text-xs text-gray-500 dark:text-gray-400"
                    :title="additionalRolesTitle"
                  >
                    +{{ additionalRolesCount }}
                  </span>
                </div>
              </div>
              
              <!-- Dropdown Arrow -->
              <i class="pi pi-chevron-down text-xs text-gray-500 dark:text-gray-400 hidden md:block"></i>
            </button>

            <!-- Custom Dropdown Menu -->
            <div 
              v-if="userMenuVisible"
              ref="dropdownMenu"
              class="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-2 z-50"
            >
              <!-- User Info Header -->
              <div class="px-4 py-3 border-b border-gray-200 dark:border-slate-700">
                <div class="font-medium text-gray-900 dark:text-white truncate">
                  {{ user?.display_name }}
                </div>
                <div class="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {{ user?.email }}
                </div>
                <div class="flex items-center gap-1 mt-1">
                  <span :class="['text-xs px-1.5 py-0.5 rounded-full font-medium', roleColorClass]">
                    {{ roleLabel }}
                  </span>
                </div>
              </div>

              <!-- Menu Items -->
              <div class="py-1">
                <button
                  @click="navigateFromMenu('/profile')"
                  class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-3"
                >
                  <i class="pi pi-user"></i>
                  {{ $t('common.profile', 'Profile') }}
                </button>
                <button
                  @click="navigateFromMenu('/settings')"
                  class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-3"
                >
                  <i class="pi pi-cog"></i>
                  {{ $t('common.settings', 'Settings') }}
                </button>
              </div>

              <!-- Admin Section -->
              <div v-if="isAdmin" class="border-t border-gray-200 dark:border-slate-700 py-1">
                <button
                  @click="navigateFromMenu('/users')"
                  class="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-3"
                >
                  <i class="pi pi-users"></i>
                  {{ $t('nav.users', 'User Management') }}
                  <span class="ml-auto text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                    Admin
                  </span>
                </button>
              </div>

              <!-- Logout -->
              <div class="border-t border-gray-200 dark:border-slate-700 py-1">
                <button
                  @click="handleSignOut"
                  class="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3"
                >
                  <i class="pi pi-sign-out"></i>
                  {{ $t('common.logout', 'Sign Out') }}
                </button>
              </div>
            </div>
          </div>

          <!-- Sign In Button - Icon on mobile, text on desktop -->
          <template v-else>
            <Button
              icon="pi pi-sign-in"
              rounded
              text
              severity="secondary"
              size="small"
              @click="goToAuth"
              class="md:hidden focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              :aria-label="$t('common.login')"
              :title="$t('common.login')"
            />
            <Button
              :label="$t('common.login')"
              severity="primary"
              size="small"
              @click="goToAuth"
              class="hidden md:inline-flex focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              :aria-label="$t('common.login')"
            />
          </template>
        </div>
      </div>
    </div>

    <div class="flex flex-1 overflow-hidden relative">
      <!-- Left Sidebar Drawer -->
      <Drawer
        v-model:visible="sidebarVisible"
        position="left"
        class="w-64 bg-primary border-r border-primary"
        :pt="{
          root: { class: 'bg-primary' },
          header: { class: 'bg-secondary border-b border-primary' },
          content: { class: 'bg-primary' }
        }"
        :aria-label="$t('accessibility.sidebarNavigation')"
      >
        <template #header>
          <div class="flex items-center gap-2">
            <i class="pi pi-bars text-lg"></i>
            <h2 class="m-0 text-lg font-semibold text-primary">{{ $t('common.menu') }}</h2>
          </div>
        </template>
        
        <!-- User Card in Sidebar (when logged in) -->
        <div v-if="isLoggedIn" class="p-4 border-b border-gray-200 dark:border-slate-700">
          <div class="flex items-center gap-3">
            <div class="relative">
              <img 
                v-if="user?.avatar_url"
                :src="user.avatar_url" 
                :alt="user.display_name"
                class="w-12 h-12 rounded-full object-cover"
              />
              <div 
                v-else
                class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold"
              >
                {{ userInitials }}
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-medium text-gray-900 dark:text-white truncate">
                {{ user?.display_name }}
              </div>
              <div class="text-sm text-gray-500 dark:text-gray-400 truncate">
                {{ user?.email }}
              </div>
              <div class="flex items-center gap-1 mt-1">
                <span :class="['text-xs px-1.5 py-0.5 rounded-full font-medium', roleColorClass]">
                  {{ roleLabel }}
                </span>
                <span 
                  v-if="additionalRolesCount > 0"
                  class="text-xs text-gray-500 dark:text-gray-400"
                >
                  +{{ additionalRolesCount }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Navigation list with proper keyboard navigation -->
        <nav class="p-4 space-y-1">
          <button
            v-for="item in sidebarNavItems"
            :key="item.path"
            @click="navigateTo(item.path)"
            class="w-full text-left px-4 py-2.5 rounded-lg text-primary hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-colors flex items-center gap-3"
            :class="{ 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400': isActiveRoute(item.path) }"
            :aria-label="item.label"
            :aria-current="isActiveRoute(item.path) ? 'page' : undefined"
          >
            <i :class="`pi ${item.icon} text-lg`"></i>
            <span>{{ item.label }}</span>
            <!-- Admin badge -->
            <span 
              v-if="item.adminOnly"
              class="ml-auto text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
            >
              Admin
            </span>
          </button>
        </nav>

        <!-- Sidebar Footer -->
        <div class="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-slate-700">
          <div class="text-xs text-gray-500 dark:text-gray-400 text-center">
            {{ $t('common.appName') }} v1.0.0
          </div>
        </div>
      </Drawer>

      <!-- Main Content Area -->
      <main class="flex-1 overflow-auto bg-primary" id="main-content" role="main" :aria-label="$t('accessibility.mainContent')">
        <div class="p-2 lg:p-2">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useDarkMode } from '@/composables/useDarkMode.js'
import { useAuth } from '@/composables/useAuth'
import { useWebSocket } from '@/composables/useWebSocket'
import Drawer from 'primevue/drawer'
import Button from 'primevue/button'

import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const route = useRoute()
const { user, isLoggedIn, signOut } = useAuth()
const { isConnected: wsConnected, triggerConnect, shouldBeConnected } = useWebSocket()
const { locale } = useI18n()
const { isDark, toggle: toggleDarkMode } = useDarkMode()
const { t } = useI18n()

const sidebarVisible = ref(false)
const isMobile = ref(false)
const userMenuVisible = ref(false)
const dropdownMenu = ref(null)
const currentLanguage = ref(locale.value)

// ============================================================================
// WEBSOCKET CONNECTION MONITOR
// Progressive backoff: 1s, 3s, 5s, 10s, then every 30s
// ============================================================================

/** @type {number[]} Reconnection delay schedule in milliseconds */
const RECONNECT_DELAYS = [1000, 3000, 5000, 10000, 30000]

/** @type {number} Current reconnect attempt index */
let reconnectAttempt = 0

/** @type {number|null} Timer ID for scheduled reconnect */
let reconnectTimer = null

/**
 * Get the next reconnect delay based on attempt number
 * @returns {number} Delay in milliseconds
 */
const getReconnectDelay = () => {
  const index = Math.min(reconnectAttempt, RECONNECT_DELAYS.length - 1)
  return RECONNECT_DELAYS[index]
}

/**
 * Attempt to reconnect WebSocket if needed
 * Only reconnects if user is logged in and WebSocket is not connected
 */
const attemptReconnect = async () => {
  // Only reconnect if logged in and not connected
  if (!isLoggedIn.value || wsConnected.value) {
    reconnectAttempt = 0
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    return
  }
  
  console.log(`🔄 WebSocket reconnect attempt ${reconnectAttempt + 1}`)
  
  try {
    await triggerConnect()
    // Success - reset counter
    reconnectAttempt = 0
    console.log('✅ WebSocket reconnected successfully')
  } catch (err) {
    console.warn('WebSocket reconnect failed:', err.message)
    reconnectAttempt++
    scheduleReconnect()
  }
}

/**
 * Schedule the next reconnect attempt
 * Clears any existing timer before scheduling
 */
const scheduleReconnect = () => {
  // Clear any existing timer
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
  }
  
  // Don't schedule if not logged in
  if (!isLoggedIn.value) {
    return
  }
  
  const delay = getReconnectDelay()
  reconnectTimer = setTimeout(() => {
    attemptReconnect()
  }, delay)
}

/**
 * Start monitoring WebSocket connection
 * Checks immediately if connection is needed
 */
const startConnectionMonitor = () => {
  // Check immediately if we should connect
  if (shouldBeConnected()) {
    attemptReconnect()
  }
}

/**
 * Stop monitoring and clear all timers
 * Called on logout or component unmount
 */
const stopConnectionMonitor = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  reconnectAttempt = 0
}

// Watch for login state changes
// Note: useAuth already triggers WebSocket connect after login,
// so we only need to handle logout and disconnection recovery
watch(isLoggedIn, (loggedIn) => {
  if (loggedIn) {
    // User just logged in - reset attempt counter
    // Don't call startConnectionMonitor here as useAuth already triggers connect
    reconnectAttempt = 0
  } else {
    // User logged out - stop monitoring
    stopConnectionMonitor()
  }
})

// Watch for disconnections while logged in
// This handles cases where connection drops after initial connect
watch(wsConnected, (connected) => {
  if (!connected && isLoggedIn.value) {
    // Disconnected while logged in - schedule reconnect
    // Add small delay to avoid race with other reconnect attempts
    setTimeout(() => {
      if (!wsConnected.value && isLoggedIn.value) {
        scheduleReconnect()
      }
    }, 100)
  } else if (connected) {
    // Connected - reset attempt counter and clear any pending timers
    reconnectAttempt = 0
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }
})

// ============================================================================
// ROLE CONFIGURATION
// ============================================================================

// Role configuration
const ROLE_COLORS = {
  superadmin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
  admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  user: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
}

const ROLE_LABELS = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  user: 'User'
}

// ============================================================================
// COMPUTED PROPERTIES
// ============================================================================

// Computed properties
const userInitials = computed(() => {
  if (!user.value?.display_name) return '?'
  const parts = user.value.display_name.trim().split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return parts[0].substring(0, 2).toUpperCase()
})

const roleColorClass = computed(() => {
  return ROLE_COLORS[user.value?.role] || ROLE_COLORS.user
})

const roleLabel = computed(() => {
  return ROLE_LABELS[user.value?.role] || 'User'
})

const additionalRolesCount = computed(() => {
  return user.value?.additional_roles?.length || 0
})

const additionalRolesTitle = computed(() => {
  if (!user.value?.additional_roles?.length) return ''
  return user.value.additional_roles.join(', ')
})

const isAdmin = computed(() => {
  return ['admin', 'superadmin'].includes(user.value?.role)
})

// Sidebar navigation items with i18n
const sidebarNavItems = computed(() => {
  const items = [
    { label: t('nav.dashboard'), icon: 'pi-home', path: '/dashboard' },
    { label: t('nav.chat'), icon: 'pi-comments', path: '/chat' },
    { label: t('nav.about'), icon: 'pi-info-circle', path: '/about' },
  ]
  
  // Add admin items
  if (isAdmin.value) {
    items.push(
      { label: t('nav.users', 'User Management'), icon: 'pi-users', path: '/users', adminOnly: true }
    )
  }
  
  // Add login if not logged in
  if (!isLoggedIn.value) {
    items.unshift({ label: t('nav.login'), icon: 'pi-sign-in', path: '/auth' })
  }
  
  return items
})

// ============================================================================
// LIFECYCLE & EVENT HANDLERS
// ============================================================================

// Check if mobile on mount and on resize
const checkMobile = () => {
  isMobile.value = window.innerWidth < 1024
}

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  if (userMenuVisible.value && dropdownMenu.value && !dropdownMenu.value.contains(event.target)) {
    const button = event.target.closest('button')
    if (!button || !button.getAttribute('aria-haspopup')) {
      userMenuVisible.value = false
    }
  }
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  document.addEventListener('click', handleClickOutside)
  
  // Note: We don't call startConnectionMonitor() here because:
  // - useAuth.js triggers WebSocket connect after successful login
  // - The wsConnected watcher handles reconnection if connection drops
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  document.removeEventListener('click', handleClickOutside)
  
  // Stop WebSocket connection monitor
  stopConnectionMonitor()
})

// ============================================================================
// ACTIONS
// ============================================================================

// Check if route is active
const isActiveRoute = (path) => {
  return route.path === path || route.path.startsWith(path + '/')
}

const toggleLanguage = () => {
  const newLanguage = currentLanguage.value === 'en' ? 'fr' : 'en'
  currentLanguage.value = newLanguage
  locale.value = newLanguage
  sessionStorage.setItem('language', newLanguage)
}

const toggleUserMenu = (event) => {
  event.stopPropagation()
  userMenuVisible.value = !userMenuVisible.value
}

const navigateFromMenu = (path) => {
  userMenuVisible.value = false
  router.push(path)
}

const handleSignOut = () => {
  userMenuVisible.value = false
  signOut()
  router.push('/')
}

const goToAuth = () => {
  router.push('/auth')
}

const navigateTo = (path) => {
  sidebarVisible.value = false
  router.push(path)
}

const goHome = () => {
  router.push('/')
}
</script>

<style scoped>
.go-home:hover {
  cursor: pointer;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.focus\:not-sr-only:focus {
  position: static;
  width: auto;
  height: auto;
  padding: inherit;
  margin: inherit;
  overflow: visible;
  clip: auto;
  white-space: normal;
}

.ws-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
}

.ws-indicator.connected {
  background: rgba(34, 197, 94, 0.1);
  color: rgb(34, 197, 94);
}

.ws-indicator.disconnected {
  background: rgba(239, 68, 68, 0.1);
  color: rgb(239, 68, 68);
}

.indicator-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Gradient text for app name */
.gradient-text {
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Drawer styling */
:deep(.p-drawer) {
  background: var(--p-surface-0);
}

:deep(.p-drawer .p-drawer-header) {
  background: var(--p-surface-100);
  border-color: var(--p-surface-border);
}
</style>