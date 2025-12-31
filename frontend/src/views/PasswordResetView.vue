<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700 p-4">
    <Card class="w-full max-w-md">
      <template #header>
        <div class="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4 rounded-t-lg">
          <router-link 
            to="/auth" 
            class="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm mb-3 transition-colors"
          >
            <i class="pi pi-arrow-left"></i>
            {{ $t('reset.back', 'Back to Login') }}
          </router-link>
          <h1 class="text-2xl font-bold text-white">
            {{ showResetForm ? $t('reset.titleReset', 'Reset Password') : $t('reset.title', 'Forgot Password') }}
          </h1>
          <p class="text-white/80 text-sm mt-1">
            {{ showResetForm 
              ? $t('reset.subtitleReset', 'Enter your new password below') 
              : $t('reset.subtitle', "Enter your email and we'll send you a reset link") 
            }}
          </p>
        </div>
      </template>

      <template #content>
        <!-- Error Message -->
        <Message v-if="error" severity="error" :closable="true" @close="error = null" class="mb-4">
          {{ error }}
        </Message>

        <!-- Success Message -->
        <Message v-if="success" severity="success" class="mb-4">
          <div class="flex flex-col gap-2">
            <span>{{ success }}</span>
            <router-link 
              v-if="showResetForm && resetComplete" 
              to="/auth" 
              class="text-green-700 dark:text-green-300 font-medium hover:underline"
            >
              {{ $t('reset.backToLogin', 'Back to Login') }} →
            </router-link>
          </div>
        </Message>

        <!-- Request Reset Form -->
        <form v-if="!showResetForm" @submit.prevent="handleRequestReset" class="space-y-4">
          <div class="field">
            <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {{ $t('reset.email', 'Email Address') }}
            </label>
            <InputText 
              id="email"
              v-model="requestForm.email" 
              type="email"
              class="w-full"
              :placeholder="$t('reset.emailPlaceholder', 'Enter your email')"
              :disabled="isLoading"
              required
            />
          </div>

          <Button 
            type="submit"
            :label="isLoading ? $t('reset.sending', 'Sending...') : $t('reset.sendLink', 'Send Reset Link')"
            :loading="isLoading"
            :disabled="!requestForm.email"
            class="w-full"
            icon="pi pi-envelope"
          />
        </form>

        <!-- Reset Password Form -->
        <form v-else-if="!resetComplete" @submit.prevent="handleResetPassword" class="space-y-4">
          <div class="field">
            <label for="newPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {{ $t('reset.newPassword', 'New Password') }}
            </label>
            <Password 
              id="newPassword"
              v-model="resetForm.newPassword" 
              class="w-full"
              inputClass="w-full"
              :placeholder="$t('reset.newPasswordPlaceholder', 'Enter new password')"
              :disabled="isLoading"
              toggleMask
              required
            />
            <small class="text-gray-500 dark:text-gray-400">
              {{ $t('reset.passwordRequirements', 'Minimum 8 characters') }}
            </small>
          </div>

          <div class="field">
            <label for="confirmPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {{ $t('reset.confirmPassword', 'Confirm Password') }}
            </label>
            <Password 
              id="confirmPassword"
              v-model="resetForm.confirmPassword" 
              class="w-full"
              inputClass="w-full"
              :placeholder="$t('reset.confirmPasswordPlaceholder', 'Confirm new password')"
              :disabled="isLoading"
              :feedback="false"
              toggleMask
              required
            />
          </div>

          <!-- Password Match Indicator -->
          <div v-if="resetForm.newPassword && resetForm.confirmPassword" class="flex items-center gap-2 text-sm">
            <i :class="passwordsMatch ? 'pi pi-check-circle text-green-500' : 'pi pi-times-circle text-red-500'"></i>
            <span :class="passwordsMatch ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
              {{ passwordsMatch ? $t('reset.passwordsMatch', 'Passwords match') : $t('reset.passwordsDoNotMatch', 'Passwords do not match') }}
            </span>
          </div>

          <Button 
            type="submit"
            :label="isLoading ? $t('reset.resetting', 'Resetting...') : $t('reset.resetPassword', 'Reset Password')"
            :loading="isLoading"
            :disabled="!canSubmitReset"
            class="w-full"
            icon="pi pi-lock"
          />
        </form>

        <!-- Token Error State -->
        <div v-if="tokenError" class="text-center py-4">
          <div class="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
            <i class="pi pi-exclamation-triangle text-3xl text-red-500"></i>
          </div>
          <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {{ $t('reset.invalidToken', 'Invalid or Expired Link') }}
          </h3>
          <p class="text-gray-600 dark:text-gray-400 mb-4">
            {{ $t('reset.invalidTokenDesc', 'This password reset link is invalid or has expired. Please request a new one.') }}
          </p>
          <Button 
            :label="$t('reset.requestNew', 'Request New Link')"
            @click="resetToRequestForm"
            outlined
          />
        </div>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import api from '@/services/api'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Message from 'primevue/message'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()

// State
const isLoading = ref(false)
const error = ref(null)
const success = ref(null)
const resetToken = ref(null)
const showResetForm = ref(false)
const resetComplete = ref(false)
const tokenError = ref(false)

const requestForm = ref({
  email: ''
})

const resetForm = ref({
  newPassword: '',
  confirmPassword: ''
})

// Computed
const passwordsMatch = computed(() => {
  return resetForm.value.newPassword === resetForm.value.confirmPassword
})

const canSubmitReset = computed(() => {
  return (
    resetForm.value.newPassword &&
    resetForm.value.newPassword.length >= 8 &&
    passwordsMatch.value
  )
})

/**
 * Handle password reset request
 */
const handleRequestReset = async () => {
  error.value = null
  success.value = null

  if (!requestForm.value.email) {
    error.value = t('reset.emailRequired', 'Email is required')
    return
  }

  isLoading.value = true

  try {
    const response = await api.post('/auth/password-reset', {
      email: requestForm.value.email
    })

    if (response.data.success) {
      success.value = t('reset.emailSent', 'If an account exists with that email, you will receive a password reset link shortly.')
      requestForm.value.email = ''
    }
  } catch (err) {
    // Don't reveal if email exists or not for security
    success.value = t('reset.emailSent', 'If an account exists with that email, you will receive a password reset link shortly.')
  } finally {
    isLoading.value = false
  }
}

/**
 * Handle password reset confirmation
 */
const handleResetPassword = async () => {
  error.value = null
  success.value = null

  if (!canSubmitReset.value) {
    error.value = t('reset.fillAllFields', 'Please fill all fields correctly')
    return
  }

  isLoading.value = true

  try {
    const response = await api.post('/auth/password-reset/confirm', {
      resetToken: resetToken.value,
      newPassword: resetForm.value.newPassword,
      confirmPassword: resetForm.value.confirmPassword
    })

    if (response.data.success) {
      success.value = t('reset.resetSuccess', 'Your password has been reset successfully!')
      resetComplete.value = true

      // Redirect to login after a delay
      setTimeout(() => {
        router.push('/auth')
      }, 3000)
    }
  } catch (err) {
    const errorCode = err.response?.data?.code
    if (errorCode === 'TOKEN_EXPIRED' || errorCode === 'TOKEN_INVALID' || errorCode === 'TOKEN_USED') {
      tokenError.value = true
      showResetForm.value = false
    } else {
      error.value = err.response?.data?.error || t('reset.resetFailed', 'Failed to reset password. Please try again.')
    }
  } finally {
    isLoading.value = false
  }
}

/**
 * Reset to request form
 */
const resetToRequestForm = () => {
  tokenError.value = false
  showResetForm.value = false
  resetToken.value = null
  error.value = null
  success.value = null
}

/**
 * Initialize component
 */
onMounted(() => {
  // Check if reset token is provided in query params
  const token = route.query.token || route.query.resetToken
  
  if (token) {
    resetToken.value = token
    showResetForm.value = true
  }
})
</script>

<style scoped>
:deep(.p-card) {
  @apply bg-white dark:bg-slate-800 border-0 shadow-2xl;
}

:deep(.p-card .p-card-content) {
  @apply px-6 pb-6;
}

:deep(.p-inputtext),
:deep(.p-password input) {
  @apply bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600;
}

:deep(.p-password-panel) {
  @apply bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700;
}
</style>