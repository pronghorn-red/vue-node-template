<template>
  <div class="max-w-4xl mx-auto p-4 sm:p-6">
    <!-- Page Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        My Profile
      </h1>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Manage your account settings and preferences
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="loading && !profile" class="flex justify-center py-12">
      <i class="pi pi-spinner pi-spin text-4xl text-blue-500"></i>
    </div>

    <!-- Error State -->
    <Message v-if="error" severity="error" :closable="true" @close="clearError" class="mb-4">
      {{ error }}
    </Message>

    <!-- Success Message -->
    <Message v-if="successMessage" severity="success" :closable="true" @close="successMessage = ''" class="mb-4">
      {{ successMessage }}
    </Message>

    <div v-if="profile" class="space-y-6">
      <!-- Personal Information Card -->
      <Card>
        <template #title>
          <div class="flex items-center gap-3">
            <i class="pi pi-user text-blue-500"></i>
            <span>Personal Information</span>
          </div>
        </template>
        <template #content>
          <div class="flex flex-col md:flex-row gap-6">
            <!-- Avatar Section -->
            <div class="flex flex-col items-center">
              <div class="relative">
                <Avatar 
                  v-if="profile.avatar_url"
                  :image="profile.avatar_url" 
                  shape="circle"
                  class="w-24 h-24"
                />
                <div 
                  v-else
                  class="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold"
                >
                  {{ userInitials }}
                </div>
              </div>
              <Tag :value="getRoleLabel(profile.role)" :severity="getRoleSeverity(profile.role)" class="mt-2" />
              <div v-if="profile.additional_roles?.length" class="flex flex-wrap gap-1 mt-1 justify-center">
                <Tag 
                  v-for="role in profile.additional_roles" 
                  :key="role"
                  :value="role"
                  severity="secondary"
                  class="text-xs"
                />
              </div>
            </div>

            <!-- Form Fields -->
            <div class="flex-1 space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Display Name -->
                <div class="field">
                  <label class="block text-sm font-medium mb-1">Display Name</label>
                  <InputText v-model="editForm.display_name" class="w-full" />
                </div>

                <!-- Email (Read-only) -->
                <div class="field">
                  <label class="block text-sm font-medium mb-1">Email</label>
                  <InputText :value="profile.email" disabled class="w-full" />
                  <small class="text-gray-500">Email cannot be changed</small>
                </div>
              </div>

              <!-- Avatar URL -->
              <div class="field">
                <label class="block text-sm font-medium mb-1">Avatar URL</label>
                <InputText v-model="editForm.avatar_url" class="w-full" placeholder="https://example.com/avatar.jpg" />
              </div>

              <!-- Language Preference -->
              <div class="field">
                <label class="block text-sm font-medium mb-1">Language</label>
                <Select 
                  v-model="editForm.language_preference" 
                  :options="languageOptions"
                  optionLabel="label"
                  optionValue="value"
                  class="w-full md:w-48"
                />
              </div>

              <!-- Save Button -->
              <div class="flex justify-end pt-4">
                <Button 
                  label="Save" 
                  icon="pi pi-check" 
                  @click="saveProfile" 
                  :loading="saving"
                />
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- Account Information Card -->
      <Card>
        <template #title>
          <div class="flex items-center gap-3">
            <i class="pi pi-info-circle text-blue-500"></i>
            <span>Account Information</span>
          </div>
        </template>
        <template #content>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span class="text-sm text-gray-500 dark:text-gray-400">Account Type</span>
              <p class="font-medium text-gray-900 dark:text-white capitalize">
                {{ profile.oauth_provider === 'local' ? 'Email/Password' : profile.oauth_provider || 'Email/Password' }}
              </p>
            </div>
            <div>
              <span class="text-sm text-gray-500 dark:text-gray-400">Email Verified</span>
              <p>
                <Tag :value="profile.email_verified ? 'Verified' : 'Not Verified'" :severity="profile.email_verified ? 'success' : 'warning'" />
              </p>
            </div>
            <div>
              <span class="text-sm text-gray-500 dark:text-gray-400">Member Since</span>
              <p class="font-medium text-gray-900 dark:text-white">
                {{ formatDate(profile.created_at) }}
              </p>
            </div>
            <div>
              <span class="text-sm text-gray-500 dark:text-gray-400">Last Login</span>
              <p class="font-medium text-gray-900 dark:text-white">
                {{ formatDate(profile.last_login) }}
              </p>
            </div>
          </div>
        </template>
      </Card>

      <!-- Change Password Card (only for users with password) -->
      <Card v-if="!profile.oauth_provider || profile.oauth_provider === 'local'">
        <template #title>
          <div class="flex items-center gap-3">
            <i class="pi pi-lock text-blue-500"></i>
            <span>Change Password</span>
          </div>
        </template>
        <template #content>
          <div class="space-y-4 max-w-md">
            <div class="field">
              <label class="block text-sm font-medium mb-1">Current Password</label>
              <Password v-model="passwordForm.currentPassword" :feedback="false" toggleMask class="w-full" />
            </div>
            <div class="field">
              <label class="block text-sm font-medium mb-1">New Password</label>
              <Password v-model="passwordForm.newPassword" toggleMask class="w-full" />
            </div>
            <div class="field">
              <label class="block text-sm font-medium mb-1">Confirm New Password</label>
              <Password v-model="passwordForm.confirmPassword" :feedback="false" toggleMask class="w-full" />
            </div>
            <div class="flex justify-end pt-2">
              <Button 
                label="Update Password" 
                icon="pi pi-key"
                severity="warning"
                @click="handleChangePassword" 
                :loading="changingPassword"
                :disabled="!canChangePassword"
              />
            </div>
          </div>
        </template>
      </Card>

      <!-- Danger Zone Card (hidden for superadmins) -->
      <Card v-if="profile.role !== 'superadmin'" class="border-red-200 dark:border-red-800">
        <template #title>
          <div class="flex items-center gap-3 text-red-600 dark:text-red-400">
            <i class="pi pi-exclamation-triangle"></i>
            <span>Danger Zone</span>
          </div>
        </template>
        <template #content>
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-gray-900 dark:text-white">Delete Account</p>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
            </div>
            <Button 
              label="Delete Account" 
              severity="danger" 
              outlined
              @click="confirmDeleteAccount"
            />
          </div>
        </template>
      </Card>

      <!-- Superadmin notice -->
      <Card v-else class="border-blue-200 dark:border-blue-800">
        <template #content>
          <div class="flex items-center gap-3 text-blue-600 dark:text-blue-400">
            <i class="pi pi-shield text-2xl"></i>
            <div>
              <p class="font-medium">Superadmin Account Protected</p>
              <p class="text-sm opacity-75">
                Superadmin accounts cannot be self-deleted for security reasons. 
                Contact another superadmin if you need to transfer or remove this account.
              </p>
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- ConfirmDialog - Required for useConfirm() -->
    <ConfirmDialog />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'
import { useUsers } from '@/composables/useUsers'
import { useAuth } from '@/composables/useAuth'
import Card from 'primevue/card'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Avatar from 'primevue/avatar'
import Message from 'primevue/message'
import ConfirmDialog from 'primevue/confirmdialog'

const router = useRouter()
const confirm = useConfirm()
const { user: authUser, signOut } = useAuth()
const {
  loading,
  error,
  clearError,
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
  deleteMyAccount,
  getUserInitials,
  getRoleLabel,
  formatDate
} = useUsers()

// Local state
const profile = ref(null)
const saving = ref(false)
const changingPassword = ref(false)
const successMessage = ref('')

// Form state
const editForm = ref({
  display_name: '',
  avatar_url: '',
  language_preference: 'en'
})

const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

// Options
const languageOptions = [
  { label: 'English', value: 'en' },
  { label: 'Français', value: 'fr' }
]

// Computed
const userInitials = computed(() => {
  if (!profile.value?.display_name) return '?'
  return profile.value.display_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
})

const canChangePassword = computed(() => {
  return passwordForm.value.currentPassword &&
         passwordForm.value.newPassword &&
         passwordForm.value.confirmPassword &&
         passwordForm.value.newPassword === passwordForm.value.confirmPassword &&
         passwordForm.value.newPassword.length >= 8
})

// Role severity
const getRoleSeverity = (role) => {
  switch (role) {
    case 'superadmin': return 'danger'
    case 'admin': return 'warning'
    default: return 'info'
  }
}

// Sync form with profile
watch(profile, (newProfile) => {
  if (newProfile) {
    editForm.value = {
      display_name: newProfile.display_name || '',
      avatar_url: newProfile.avatar_url || '',
      language_preference: newProfile.language_preference || 'en'
    }
  }
}, { immediate: true })

// Actions
const loadProfile = async () => {
  try {
    const data = await getMyProfile()
    profile.value = data
  } catch (err) {
    console.error('Failed to load profile:', err)
  }
}

const saveProfile = async () => {
  saving.value = true
  try {
    const updated = await updateMyProfile(editForm.value)
    profile.value = updated
    successMessage.value = 'Profile updated successfully'
    
    // Update auth user state AND sessionStorage
    if (authUser.value) {
      // Update reactive state
      authUser.value.display_name = updated.display_name
      authUser.value.avatar_url = updated.avatar_url
      authUser.value.language_preference = updated.language_preference
      
      // Update sessionStorage to persist the change
      const storedUser = sessionStorage.getItem('user')
      if (storedUser) {
        try {
          const userObj = JSON.parse(storedUser)
          userObj.display_name = updated.display_name
          userObj.avatar_url = updated.avatar_url
          userObj.language_preference = updated.language_preference
          sessionStorage.setItem('user', JSON.stringify(userObj))
        } catch (e) {
          console.error('Failed to update sessionStorage:', e)
        }
      }
    }
  } catch (err) {
    console.error('Failed to save profile:', err)
  } finally {
    saving.value = false
  }
}

const handleChangePassword = async () => {
  if (!canChangePassword.value) return
  
  changingPassword.value = true
  try {
    await changeMyPassword(passwordForm.value.currentPassword, passwordForm.value.newPassword)
    successMessage.value = 'Password changed successfully'
    passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' }
  } catch (err) {
    console.error('Failed to change password:', err)
  } finally {
    changingPassword.value = false
  }
}

const confirmDeleteAccount = () => {
  // Double check - superadmins should never see this button, but safety first
  if (profile.value?.role === 'superadmin') {
    return
  }
  
  confirm.require({
    message: 'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed.',
    header: 'Delete Account',
    icon: 'pi pi-exclamation-triangle',
    rejectClass: 'p-button-secondary p-button-outlined',
    rejectLabel: 'Cancel',
    acceptClass: 'p-button-danger',
    acceptLabel: 'Delete My Account',
    accept: async () => {
      try {
        await deleteMyAccount()
        await signOut()
        router.push('/auth')
      } catch (err) {
        console.error('Failed to delete account:', err)
      }
    }
  })
}

// Load profile on mount
onMounted(() => {
  loadProfile()
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

:deep(.p-inputtext),
:deep(.p-select),
:deep(.p-password input) {
  @apply bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600;
}

:deep(.p-password) {
  @apply w-full;
}

:deep(.p-password input) {
  @apply w-full;
}
</style>