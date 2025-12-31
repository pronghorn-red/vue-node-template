<template>
  <div class="max-w-4xl mx-auto p-4 sm:p-6">
    <!-- Page Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
        {{ $t('profile.title', 'My Profile') }}
      </h1>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        {{ $t('profile.subtitle', 'Manage your account settings and preferences') }}
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
      <!-- Profile Card -->
      <Card>
        <template #title>
          <div class="flex items-center gap-3">
            <i class="pi pi-user text-blue-500"></i>
            <span>{{ $t('profile.personalInfo', 'Personal Information') }}</span>
          </div>
        </template>
        <template #content>
          <div class="flex flex-col md:flex-row gap-6">
            <!-- Avatar Section -->
            <div class="flex flex-col items-center gap-3">
              <div class="relative">
                <Avatar 
                  v-if="profile.avatar_url"
                  :image="profile.avatar_url" 
                  size="xlarge" 
                  shape="circle"
                  class="w-24 h-24"
                />
                <div 
                  v-else
                  class="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold"
                >
                  {{ getUserInitials(profile) }}
                </div>
                <!-- Role Badge -->
                <span 
                  :class="['absolute -bottom-1 -right-1 px-2 py-0.5 text-xs font-medium rounded-full', getRoleColor(profile.role)]"
                >
                  {{ getRoleLabel(profile.role) }}
                </span>
              </div>
              <!-- Additional Roles -->
              <div v-if="profile.additional_roles?.length" class="flex flex-wrap gap-1 justify-center">
                <Tag 
                  v-for="role in profile.additional_roles" 
                  :key="role"
                  :value="role"
                  severity="secondary"
                  class="text-xs"
                />
              </div>
            </div>

            <!-- Profile Form -->
            <div class="flex-1 space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Display Name -->
                <div class="field">
                  <label for="display_name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {{ $t('profile.displayName', 'Display Name') }}
                  </label>
                  <InputText 
                    id="display_name"
                    v-model="editForm.display_name" 
                    class="w-full"
                    :placeholder="$t('profile.displayNamePlaceholder', 'Your name')"
                  />
                </div>

                <!-- Email (Read-only) -->
                <div class="field">
                  <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {{ $t('profile.email', 'Email') }}
                  </label>
                  <InputText 
                    id="email"
                    :value="profile.email" 
                    class="w-full"
                    disabled
                  />
                  <small class="text-gray-500">{{ $t('profile.emailReadOnly', 'Email cannot be changed') }}</small>
                </div>

                <!-- Avatar URL -->
                <div class="field md:col-span-2">
                  <label for="avatar_url" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {{ $t('profile.avatarUrl', 'Avatar URL') }}
                  </label>
                  <InputText 
                    id="avatar_url"
                    v-model="editForm.avatar_url" 
                    class="w-full"
                    :placeholder="$t('profile.avatarUrlPlaceholder', 'https://example.com/avatar.jpg')"
                  />
                </div>

                <!-- Language Preference -->
                <div class="field">
                  <label for="language" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {{ $t('profile.language', 'Language') }}
                  </label>
                  <Select 
                    id="language"
                    v-model="editForm.language_preference" 
                    :options="languageOptions"
                    optionLabel="label"
                    optionValue="value"
                    class="w-full"
                  />
                </div>
              </div>

              <!-- Save Button -->
              <div class="flex justify-end pt-4">
                <Button 
                  :label="$t('common.save', 'Save Changes')"
                  icon="pi pi-check"
                  :loading="saving"
                  @click="saveProfile"
                  :disabled="!hasProfileChanges"
                />
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- Account Info Card -->
      <Card>
        <template #title>
          <div class="flex items-center gap-3">
            <i class="pi pi-info-circle text-blue-500"></i>
            <span>{{ $t('profile.accountInfo', 'Account Information') }}</span>
          </div>
        </template>
        <template #content>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span class="text-gray-500 dark:text-gray-400">{{ $t('profile.accountType', 'Account Type') }}:</span>
              <span class="ml-2 font-medium">{{ profile.oauth_provider === 'local' ? 'Email/Password' : profile.oauth_provider }}</span>
            </div>
            <div>
              <span class="text-gray-500 dark:text-gray-400">{{ $t('profile.emailVerified', 'Email Verified') }}:</span>
              <span class="ml-2">
                <i :class="profile.email_verified ? 'pi pi-check-circle text-green-500' : 'pi pi-times-circle text-red-500'"></i>
              </span>
            </div>
            <div>
              <span class="text-gray-500 dark:text-gray-400">{{ $t('profile.memberSince', 'Member Since') }}:</span>
              <span class="ml-2 font-medium">{{ formatDate(profile.created_at) }}</span>
            </div>
            <div>
              <span class="text-gray-500 dark:text-gray-400">{{ $t('profile.lastLogin', 'Last Login') }}:</span>
              <span class="ml-2 font-medium">{{ formatDate(profile.last_login) }}</span>
            </div>
          </div>
        </template>
      </Card>

      <!-- Change Password Card (only for local accounts) -->
      <Card v-if="profile.oauth_provider === 'local'">
        <template #title>
          <div class="flex items-center gap-3">
            <i class="pi pi-lock text-blue-500"></i>
            <span>{{ $t('profile.changePassword', 'Change Password') }}</span>
          </div>
        </template>
        <template #content>
          <div class="max-w-md space-y-4">
            <div class="field">
              <label for="currentPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ $t('profile.currentPassword', 'Current Password') }}
              </label>
              <Password 
                id="currentPassword"
                v-model="passwordForm.currentPassword" 
                :feedback="false"
                toggleMask
                class="w-full"
                inputClass="w-full"
              />
            </div>
            <div class="field">
              <label for="newPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ $t('profile.newPassword', 'New Password') }}
              </label>
              <Password 
                id="newPassword"
                v-model="passwordForm.newPassword" 
                toggleMask
                class="w-full"
                inputClass="w-full"
              />
            </div>
            <div class="field">
              <label for="confirmPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ $t('profile.confirmPassword', 'Confirm New Password') }}
              </label>
              <Password 
                id="confirmPassword"
                v-model="passwordForm.confirmPassword" 
                :feedback="false"
                toggleMask
                class="w-full"
                inputClass="w-full"
              />
            </div>
            <div class="flex justify-end pt-2">
              <Button 
                :label="$t('profile.updatePassword', 'Update Password')"
                icon="pi pi-lock"
                :loading="changingPassword"
                @click="handleChangePassword"
                :disabled="!canChangePassword"
                severity="warning"
              />
            </div>
          </div>
        </template>
      </Card>

      <!-- Danger Zone -->
      <Card class="border-red-200 dark:border-red-800">
        <template #title>
          <div class="flex items-center gap-3 text-red-600 dark:text-red-400">
            <i class="pi pi-exclamation-triangle"></i>
            <span>{{ $t('profile.dangerZone', 'Danger Zone') }}</span>
          </div>
        </template>
        <template #content>
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-gray-900 dark:text-white">{{ $t('profile.deleteAccount', 'Delete Account') }}</p>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ $t('profile.deleteAccountWarning', 'Once deleted, your account cannot be recovered.') }}
              </p>
            </div>
            <Button 
              :label="$t('common.delete', 'Delete')"
              severity="danger"
              outlined
              @click="showDeleteDialog = true"
            />
          </div>
        </template>
      </Card>
    </div>

    <!-- Delete Confirmation Dialog -->
    <Dialog 
      v-model:visible="showDeleteDialog" 
      :header="$t('profile.deleteAccount', 'Delete Account')"
      :modal="true"
      :style="{ width: '400px' }"
    >
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
          <i class="pi pi-exclamation-triangle text-2xl text-red-500"></i>
        </div>
        <div>
          <p class="text-gray-700 dark:text-gray-300">
            {{ $t('profile.deleteConfirmMessage', 'Are you sure you want to delete your account? This action cannot be undone.') }}
          </p>
        </div>
      </div>
      <template #footer>
        <Button 
          :label="$t('common.cancel', 'Cancel')" 
          severity="secondary" 
          @click="showDeleteDialog = false" 
        />
        <Button 
          :label="$t('common.delete', 'Delete')" 
          severity="danger" 
          @click="handleDeleteAccount" 
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUsers } from '@/composables/useUsers'
import { useAuth } from '@/composables/useAuth'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Avatar from 'primevue/avatar'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import Dialog from 'primevue/dialog'

const router = useRouter()
const { signOut, user: authUser } = useAuth()
const { 
  getProfile, 
  updateProfile, 
  changePassword,
  loading, 
  error, 
  clearError,
  getUserInitials,
  getRoleColor,
  getRoleLabel,
  formatDate
} = useUsers()

// State
const profile = ref(null)
const saving = ref(false)
const changingPassword = ref(false)
const successMessage = ref('')
const showDeleteDialog = ref(false)

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
const hasProfileChanges = computed(() => {
  if (!profile.value) return false
  return (
    editForm.value.display_name !== profile.value.display_name ||
    editForm.value.avatar_url !== (profile.value.avatar_url || '') ||
    editForm.value.language_preference !== profile.value.language_preference
  )
})

const canChangePassword = computed(() => {
  return (
    passwordForm.value.currentPassword &&
    passwordForm.value.newPassword &&
    passwordForm.value.newPassword.length >= 8 &&
    passwordForm.value.newPassword === passwordForm.value.confirmPassword
  )
})

// Methods
const loadProfile = async () => {
  try {
    profile.value = await getProfile()
    resetEditForm()
  } catch (err) {
    console.error('Failed to load profile:', err)
  }
}

const resetEditForm = () => {
  if (profile.value) {
    editForm.value = {
      display_name: profile.value.display_name,
      avatar_url: profile.value.avatar_url || '',
      language_preference: profile.value.language_preference || 'en'
    }
  }
}

const saveProfile = async () => {
  saving.value = true
  try {
    const updated = await updateProfile(editForm.value)
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
  changingPassword.value = true
  try {
    await changePassword(passwordForm.value)
    successMessage.value = 'Password changed successfully'
    passwordForm.value = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
  } catch (err) {
    console.error('Failed to change password:', err)
  } finally {
    changingPassword.value = false
  }
}

const handleDeleteAccount = () => {
  // TODO: Implement account deletion API
  console.log('Account deletion not yet implemented')
  showDeleteDialog.value = false
}

// Lifecycle
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
:deep(.p-password input),
:deep(.p-select) {
  @apply bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600;
}

:deep(.p-inputtext:disabled) {
  @apply bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400;
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