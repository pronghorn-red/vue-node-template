<template>
  <div class="max-w-4xl mx-auto p-4 sm:p-6">
    <!-- Page Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        Settings
      </h1>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Customize your application preferences
      </p>
    </div>

    <!-- Success Message -->
    <Message v-if="successMessage" severity="success" :closable="true" @close="successMessage = ''" class="mb-4">
      {{ successMessage }}
    </Message>

    <div class="space-y-6">
      <!-- Appearance Section -->
      <Card>
        <template #title>
          <div class="flex items-center gap-3">
            <i class="pi pi-palette text-blue-500"></i>
            <span>Appearance</span>
          </div>
        </template>
        <template #content>
          <div class="space-y-4">
            <!-- Dark Mode -->
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Dark Mode</div>
                <div class="text-sm text-gray-500 dark:text-gray-400">Use dark theme for the interface</div>
              </div>
              <ToggleSwitch v-model="settings.darkMode" @change="handleDarkModeChange" />
            </div>
            
            <!-- Compact Mode -->
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Compact Mode</div>
                <div class="text-sm text-gray-500 dark:text-gray-400">Reduce spacing for more content</div>
              </div>
              <ToggleSwitch v-model="settings.compactMode" @change="saveSettings" />
            </div>
          </div>
        </template>
      </Card>

      <!-- Language & Region Section -->
      <Card>
        <template #title>
          <div class="flex items-center gap-3">
            <i class="pi pi-globe text-blue-500"></i>
            <span>Language &amp; Region</span>
          </div>
        </template>
        <template #content>
          <div class="space-y-4">
            <!-- Language -->
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Language</div>
                <div class="text-sm text-gray-500 dark:text-gray-400">Select your preferred language</div>
              </div>
              <Select 
                v-model="settings.language" 
                :options="languageOptions"
                optionLabel="label"
                optionValue="value"
                class="w-40"
                @change="handleLanguageChange"
              />
            </div>
            
            <!-- Timezone -->
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Timezone</div>
                <div class="text-sm text-gray-500 dark:text-gray-400">Set your local timezone</div>
              </div>
              <Select 
                v-model="settings.timezone" 
                :options="timezoneOptions"
                optionLabel="label"
                optionValue="value"
                class="w-56"
                @change="saveSettings"
              />
            </div>
            
            <!-- Date Format -->
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Date Format</div>
                <div class="text-sm text-gray-500 dark:text-gray-400">Choose how dates are displayed</div>
              </div>
              <Select 
                v-model="settings.dateFormat" 
                :options="dateFormatOptions"
                optionLabel="label"
                optionValue="value"
                class="w-40"
                @change="saveSettings"
              />
            </div>
          </div>
        </template>
      </Card>

      <!-- Notifications Section -->
      <Card>
        <template #title>
          <div class="flex items-center gap-3">
            <i class="pi pi-bell text-blue-500"></i>
            <span>Notifications</span>
          </div>
        </template>
        <template #content>
          <div class="space-y-4">
            <!-- Email Notifications -->
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Email Notifications</div>
                <div class="text-sm text-gray-500 dark:text-gray-400">Receive email updates and alerts</div>
              </div>
              <ToggleSwitch v-model="settings.emailNotifications" @change="saveSettings" />
            </div>
            
            <!-- Browser Notifications -->
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Browser Notifications</div>
                <div class="text-sm text-gray-500 dark:text-gray-400">Show desktop notifications</div>
              </div>
              <div class="flex items-center gap-2">
                <Tag v-if="notificationPermission === 'denied'" value="Blocked" severity="danger" class="text-xs" />
                <ToggleSwitch 
                  v-model="settings.browserNotifications" 
                  :disabled="notificationPermission === 'denied'"
                  @change="handleBrowserNotificationsChange" 
                />
              </div>
            </div>
            
            <!-- Sound Effects -->
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Sound Effects</div>
                <div class="text-sm text-gray-500 dark:text-gray-400">Play sounds for notifications</div>
              </div>
              <ToggleSwitch v-model="settings.soundEffects" @change="saveSettings" />
            </div>
          </div>
        </template>
      </Card>

      <!-- Privacy & Security Section -->
      <Card>
        <template #title>
          <div class="flex items-center gap-3">
            <i class="pi pi-shield text-blue-500"></i>
            <span>Privacy &amp; Security</span>
          </div>
        </template>
        <template #content>
          <div class="space-y-4">
            <!-- Show Activity Status -->
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Show Activity Status</div>
                <div class="text-sm text-gray-500 dark:text-gray-400">Let others see when you are online</div>
              </div>
              <ToggleSwitch v-model="settings.showActivityStatus" @change="saveSettings" />
            </div>
            
            <!-- Session Timeout -->
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Session Timeout</div>
                <div class="text-sm text-gray-500 dark:text-gray-400">Auto-logout after inactivity</div>
              </div>
              <Select 
                v-model="settings.sessionTimeout" 
                :options="sessionTimeoutOptions"
                optionLabel="label"
                optionValue="value"
                class="w-40"
                @change="saveSettings"
              />
            </div>
          </div>
        </template>
      </Card>

      <!-- Data & Storage Section -->
      <Card>
        <template #title>
          <div class="flex items-center gap-3">
            <i class="pi pi-database text-blue-500"></i>
            <span>Data &amp; Storage</span>
          </div>
        </template>
        <template #content>
          <div class="space-y-4">
            <!-- Clear Cache -->
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Clear Cache</div>
                <div class="text-sm text-gray-500 dark:text-gray-400">Remove cached data to free up space</div>
              </div>
              <Button 
                label="Clear" 
                severity="secondary" 
                size="small"
                @click="showClearCacheDialog = true"
              />
            </div>
            
            <!-- Export Data -->
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium text-gray-900 dark:text-white">Export Your Data</div>
                <div class="text-sm text-gray-500 dark:text-gray-400">Download a copy of your data</div>
              </div>
              <Button 
                label="Export" 
                severity="secondary" 
                size="small"
                @click="exportData"
              />
            </div>
          </div>
        </template>
      </Card>

      <!-- Reset Settings Section -->
      <Card class="border-orange-200 dark:border-orange-800">
        <template #title>
          <div class="flex items-center gap-3 text-orange-600 dark:text-orange-400">
            <i class="pi pi-refresh"></i>
            <span>Reset Settings</span>
          </div>
        </template>
        <template #content>
          <div class="flex items-center justify-between">
            <div>
              <div class="font-medium text-gray-900 dark:text-white">Reset to Default</div>
              <div class="text-sm text-gray-500 dark:text-gray-400">Restore all settings to their default values</div>
            </div>
            <Button 
              label="Reset" 
              severity="warning" 
              outlined
              size="small"
              @click="showResetDialog = true"
            />
          </div>
        </template>
      </Card>
    </div>

    <!-- Clear Cache Dialog -->
    <Dialog 
      v-model:visible="showClearCacheDialog" 
      header="Clear Cache"
      :modal="true"
      :style="{ width: '400px' }"
    >
      <p class="text-gray-700 dark:text-gray-300">
        Are you sure you want to clear the cache? This will remove temporary data but won't affect your account or settings.
      </p>
      <template #footer>
        <Button label="Cancel" severity="secondary" @click="showClearCacheDialog = false" />
        <Button label="Clear Cache" severity="warning" @click="clearCache" />
      </template>
    </Dialog>

    <!-- Reset Settings Dialog -->
    <Dialog 
      v-model:visible="showResetDialog" 
      header="Reset Settings"
      :modal="true"
      :style="{ width: '400px' }"
    >
      <p class="text-gray-700 dark:text-gray-300">
        Are you sure you want to reset all settings to their default values? This cannot be undone.
      </p>
      <template #footer>
        <Button label="Cancel" severity="secondary" @click="showResetDialog = false" />
        <Button label="Reset" severity="warning" @click="resetSettings" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useDarkMode } from '@/composables/useDarkMode'
import { useI18n } from 'vue-i18n'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import Dialog from 'primevue/dialog'

const { isDark, toggle: toggleDarkMode } = useDarkMode()
const { locale } = useI18n()

// State
const successMessage = ref('')
const showClearCacheDialog = ref(false)
const showResetDialog = ref(false)
const notificationPermission = ref('default')

// Settings
const settings = ref({
  darkMode: false,
  compactMode: false,
  language: 'en',
  timezone: 'America/New_York',
  dateFormat: 'MM/DD/YYYY',
  emailNotifications: true,
  browserNotifications: false,
  soundEffects: true,
  showActivityStatus: true,
  sessionTimeout: '30'
})

// Default settings
const defaultSettings = {
  darkMode: false,
  compactMode: false,
  language: 'en',
  timezone: 'America/New_York',
  dateFormat: 'MM/DD/YYYY',
  emailNotifications: true,
  browserNotifications: false,
  soundEffects: true,
  showActivityStatus: true,
  sessionTimeout: '30'
}

// Options
const languageOptions = [
  { label: 'English', value: 'en' },
  { label: 'Français', value: 'fr' }
]

const timezoneOptions = [
  { label: 'Pacific Time (PT)', value: 'America/Los_Angeles' },
  { label: 'Mountain Time (MT)', value: 'America/Denver' },
  { label: 'Central Time (CT)', value: 'America/Chicago' },
  { label: 'Eastern Time (ET)', value: 'America/New_York' },
  { label: 'Atlantic Time (AT)', value: 'America/Halifax' },
  { label: 'UTC', value: 'UTC' },
  { label: 'London (GMT)', value: 'Europe/London' },
  { label: 'Paris (CET)', value: 'Europe/Paris' },
  { label: 'Berlin (CET)', value: 'Europe/Berlin' },
  { label: 'Moscow (MSK)', value: 'Europe/Moscow' },
  { label: 'Tokyo (JST)', value: 'Asia/Tokyo' },
  { label: 'Shanghai (CST)', value: 'Asia/Shanghai' },
  { label: 'Sydney (AEST)', value: 'Australia/Sydney' },
  { label: 'Auckland (NZST)', value: 'Pacific/Auckland' }
]

const dateFormatOptions = [
  { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' },
  { label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' },
  { label: 'YYYY-MM-DD', value: 'YYYY-MM-DD' }
]

const sessionTimeoutOptions = [
  { label: '15 minutes', value: '15' },
  { label: '30 minutes', value: '30' },
  { label: '1 hour', value: '60' },
  { label: '4 hours', value: '240' },
  { label: 'Never', value: 'never' }
]

// Load settings from localStorage
const loadSettings = () => {
  try {
    const saved = localStorage.getItem('userSettings')
    if (saved) {
      const parsed = JSON.parse(saved)
      settings.value = { ...defaultSettings, ...parsed }
    }
    // Sync dark mode with global state
    settings.value.darkMode = isDark.value
  } catch (err) {
    console.error('Failed to load settings:', err)
  }
}

// Save settings to localStorage
const saveSettings = () => {
  try {
    localStorage.setItem('userSettings', JSON.stringify(settings.value))
    successMessage.value = 'Settings saved'
    setTimeout(() => { successMessage.value = '' }, 2000)
  } catch (err) {
    console.error('Failed to save settings:', err)
  }
}

// Handle dark mode change
const handleDarkModeChange = () => {
  toggleDarkMode()
  saveSettings()
}

// Handle language change
const handleLanguageChange = () => {
  locale.value = settings.value.language
  localStorage.setItem('language', settings.value.language)
  saveSettings()
}

// Handle browser notifications change
const handleBrowserNotificationsChange = async () => {
  if (settings.value.browserNotifications && notificationPermission.value !== 'granted') {
    try {
      const permission = await Notification.requestPermission()
      notificationPermission.value = permission
      if (permission !== 'granted') {
        settings.value.browserNotifications = false
      }
    } catch (err) {
      console.error('Failed to request notification permission:', err)
      settings.value.browserNotifications = false
    }
  }
  saveSettings()
}

// Clear cache
const clearCache = () => {
  // Clear various caches but preserve essentials
  const preserveKeys = ['user', 'accessToken', 'userSettings', 'language']
  const keysToRemove = []
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!preserveKeys.includes(key)) {
      keysToRemove.push(key)
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key))
  
  showClearCacheDialog.value = false
  successMessage.value = 'Cache cleared successfully'
}

// Export data
const exportData = () => {
  const data = {
    settings: settings.value,
    exportedAt: new Date().toISOString()
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `settings-export-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
  
  successMessage.value = 'Data exported successfully'
}

// Reset settings
const resetSettings = () => {
  settings.value = { ...defaultSettings }
  
  // Sync dark mode
  if (isDark.value !== settings.value.darkMode) {
    toggleDarkMode()
  }
  
  // Sync language
  locale.value = settings.value.language
  localStorage.setItem('language', settings.value.language)
  
  saveSettings()
  showResetDialog.value = false
  successMessage.value = 'Settings reset to default'
}

// Check notification permission
const checkNotificationPermission = () => {
  if ('Notification' in window) {
    notificationPermission.value = Notification.permission
  }
}

// Initialize
onMounted(() => {
  loadSettings()
  checkNotificationPermission()
})
</script>

<style scoped>
:deep(.p-card) {
  @apply bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700;
}

:deep(.p-card .p-card-title) {
  @apply text-gray-900 dark:text-white;
}

:deep(.p-card .p-card-content) {
  @apply text-gray-700 dark:text-gray-300;
}

:deep(.p-select) {
  @apply bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600;
}

:deep(.p-dialog) {
  @apply bg-white dark:bg-slate-800;
}

:deep(.p-dialog .p-dialog-header) {
  @apply bg-white dark:bg-slate-800 text-gray-900 dark:text-white;
}

:deep(.p-dialog .p-dialog-content) {
  @apply bg-white dark:bg-slate-800;
}

:deep(.p-dialog .p-dialog-footer) {
  @apply bg-white dark:bg-slate-800;
}
</style>