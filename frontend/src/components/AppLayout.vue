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
      <div class="flex items-center gap-3">
        <!-- Hamburger Menu Button -->
        <Button
          icon="pi pi-bars"
          text
          rounded
          severity="secondary"
          size="small"
          @click="sidebarVisible = true"
          class="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          :aria-label="$t('accessibility.toggleMenu')"
          :title="$t('accessibility.toggleMenu')"
        />
        <img src="@/assets/vue.svg" alt="Pronghorn Logo" class="h-10 w-10 drop-shadow-sm" />
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

          <!-- User Menu -->
          <Button
            v-if="isLoggedIn"
            :icon="userMenuIcon"
            rounded
            text
            severity="secondary"
            @click="toggleUserMenu"
            class="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            :aria-label="$t('common.profile')"
            :aria-haspopup="true"
            :aria-expanded="userMenuVisible"
          />

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

        <!-- User Dropdown Menu -->
        <Menu
          v-if="isLoggedIn"
          ref="userMenu"
          :model="userMenuItems"
          :popup="true"
          class="w-48"
        />
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
        <!-- Navigation list with proper keyboard navigation -->
        <nav class="p-4 space-y-2">
          <button
            v-for="item in sidebarNavItems"
            :key="item.label"
            @click="navigateTo(item.path)"
            class="w-full text-left px-4 py-2 rounded-lg text-primary hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-colors flex items-center gap-2"
            :aria-label="item.label"
          >
            <i :class="`pi ${item.icon}`"></i>
            <span>{{ item.label }}</span>
          </button>
        </nav>
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
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useDarkMode } from '@/composables/useDarkMode.js'
import { useAuth } from '@/composables/useAuth'
import { useWebSocket } from '@/composables/useWebSocket'
import Drawer from 'primevue/drawer'
import Menu from 'primevue/menu'
import Button from 'primevue/button'

import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { user, isLoggedIn, signOut } = useAuth()
const { isConnected: wsConnected } = useWebSocket()
const { locale } = useI18n()
const { isDark, toggle: toggleDarkMode } = useDarkMode()
const { t } = useI18n()

const sidebarVisible = ref(false)
const isMobile = ref(false)
const userMenuVisible = ref(false)
const userMenu = ref(null)
const currentLanguage = ref(locale.value)

const userMenuIcon = computed(() => user.value?.avatar ? 'pi pi-user' : 'pi pi-user-circle')

const languages = [
  { label: 'English', code: 'en' },
  { label: 'Français', code: 'fr' }
]

// Sidebar navigation items with i18n
const sidebarNavItems = computed(() => [
  { label: t('nav.dashboard'), icon: 'pi-home', path: '/dashboard' },
  { label: t('nav.about'), icon: 'pi-info-circle', path: '/about' },
  { label: t('nav.chat'), icon: 'pi-comments', path: '/chat' },
])

// Check if mobile on mount and on resize
const checkMobile = () => {
  isMobile.value = window.innerWidth < 1024
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

// Top menu items with i18n
const topMenuItems = computed(() => [
  { label: t('nav.dashboard'), icon: 'pi pi-home', command: () => router.push('/dashboard') },
  { label: t('nav.about'), icon: 'pi pi-info-circle', command: () => router.push('/about') },
  { label: t('nav.documentation'), icon: 'pi pi-book', url: 'https://primevue.org', target: '_blank' }
])

const userMenuItems = computed(() => [
  { label: user.value?.email || 'User', icon: 'pi pi-envelope', disabled: true },
  { separator: true },
  { label: t('common.profile'), icon: 'pi pi-cog', command: () => router.push('/profile') },
  { label: t('common.settings'), icon: 'pi pi-sliders-v', command: () => router.push('/settings') },
  { separator: true },
  { label: t('common.logout'), icon: 'pi pi-sign-out', command: handleSignOut }
])

const toggleLanguage = () => {
  const newLanguage = currentLanguage.value === 'en' ? 'fr' : 'en'
  currentLanguage.value = newLanguage
  locale.value = newLanguage
  localStorage.setItem('language', newLanguage)
}

const toggleUserMenu = (event) => {
  if (userMenu.value) {
    userMenu.value.toggle(event)
  }
}

const handleSignOut = () => {
  signOut()
  router.push('/auth')
}

const goToAuth = () => {
  router.push('/auth')
}

const navigateTo = (path) => {
  sidebarVisible.value = false
  router.push(path)
}
</script>

<style scoped>
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

:deep(.p-menubar) {
  background: var(--p-surface-0);
  border-color: var(--p-surface-border);
}

:deep(.p-menubar .p-menubar-root-list > .p-menuitem > .p-menuitem-content) {
  color: var(--text-color);
}

:deep(.p-menubar .p-menubar-root-list > .p-menuitem > .p-menuitem-content:hover) {
  background-color: var(--p-surface-100);
}

:deep(.p-drawer) {
  background: var(--p-surface-0);
}

:deep(.p-drawer .p-drawer-header) {
  background: var(--p-surface-100);
  border-color: var(--p-surface-border);
}

:deep(.p-menu) {
  background: transparent;
  border: none;
}

:deep(.p-menu .p-menuitem-content) {
  color: var(--text-color);
}

:deep(.p-menu .p-menuitem-content:hover) {
  background-color: var(--p-surface-100);
}
</style>
