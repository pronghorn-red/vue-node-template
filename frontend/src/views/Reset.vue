<!-- src/views/Reset.vue -->
<template>
  <div class="reset-container">
    <div class="reset-card">
      <!-- Header -->
      <div class="reset-header">
        <router-link to="/auth" class="back-link">
          <i class="pi-arrow-left" />
          {{ $t('reset.back') }}
        </router-link>
        <h1>{{ $t('reset.title') }}</h1>
        <p>{{ $t('reset.subtitle') }}</p>
      </div>

      <!-- Request Reset Form -->
      <form v-if="!resetToken && !showResetForm" @submit.prevent="handleRequestReset" class="reset-form">
        <div class="form-group">
          <label>{{ $t('reset.email') }}</label>
          <input
            v-model="requestForm.email"
            type="email"
            :placeholder="$t('reset.emailPlaceholder')"
            required
          />
        </div>

        <button type="submit" :disabled="isLoading" class="btn-primary">
          <span v-if="!isLoading">{{ $t('reset.sendLink') }}</span>
          <span v-else>{{ $t('reset.sending') }}</span>
        </button>
      </form>

      <!-- Reset Password Form -->
      <form v-if="showResetForm" @submit.prevent="handleResetPassword" class="reset-form">
        <div class="form-group">
          <label>{{ $t('reset.newPassword') }}</label>
          <input
            v-model="resetForm.newPassword"
            type="password"
            :placeholder="$t('reset.newPasswordPlaceholder')"
            required
          />
        </div>

        <div class="form-group">
          <label>{{ $t('reset.confirmPassword') }}</label>
          <input
            v-model="resetForm.confirmPassword"
            type="password"
            :placeholder="$t('reset.confirmPasswordPlaceholder')"
            required
          />
        </div>

        <button type="submit" :disabled="isLoading" class="btn-primary">
          <span v-if="!isLoading">{{ $t('reset.resetPassword') }}</span>
          <span v-else>{{ $t('reset.resetting') }}</span>
        </button>
      </form>

      <!-- Error Message -->
      <div v-if="error" class="error-message">
        <i class="pi-exclamation-circle" />
        {{ error }}
      </div>

      <!-- Success Message -->
      <div v-if="success" class="success-message">
        <i class="pi-check-circle" />
        {{ success }}
        <router-link v-if="showResetForm" to="/auth" class="success-link">
          {{ $t('reset.backToLogin') }}
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import api from '@/services/api'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()

// State
const isLoading = ref(false)
const error = ref(null)
const success = ref(null)
const resetToken = ref(null)
const showResetForm = ref(false)

const requestForm = ref({
  email: ''
})

const resetForm = ref({
  newPassword: '',
  confirmPassword: ''
})

/**
 * Handle password reset request
 */
const handleRequestReset = async () => {
  error.value = null
  success.value = null

  if (!requestForm.value.email) {
    error.value = t('reset.emailRequired')
    return
  }

  isLoading.value = true

  try {
    const response = await api.post('/auth/password-reset', {
      email: requestForm.value.email
    })

    if (response.data.success) {
      success.value = t('reset.emailSent')
    }
  } catch (err) {
    error.value = err.response?.data?.error || t('reset.requestFailed')
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

  if (!resetForm.value.newPassword || !resetForm.value.confirmPassword) {
    error.value = t('reset.fillAllFields')
    return
  }

  if (resetForm.value.newPassword !== resetForm.value.confirmPassword) {
    error.value = t('reset.passwordsDoNotMatch')
    return
  }

  if (resetForm.value.newPassword.length < 8) {
    error.value = t('reset.passwordTooShort')
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
      success.value = t('reset.resetSuccess')

      // Redirect to login after a delay
      setTimeout(() => {
        router.push('/auth')
      }, 2000)
    }
  } catch (err) {
    error.value = err.response?.data?.error || t('reset.resetFailed')
  } finally {
    isLoading.value = false
  }
}

/**
 * Initialize component
 */
onMounted(() => {
  // Check if reset token is provided in query params
  resetToken.value = route.query.resetToken

  if (resetToken.value) {
    showResetForm.value = true
  }
})
</script>

<style scoped>
.reset-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-600) 100%);
  padding: 1rem;
}

.reset-card {
  width: 100%;
  max-width: 400px;
  background: var(--surface-card);
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.reset-header {
  margin-bottom: 2rem;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 500;
  margin-bottom: 1rem;
  transition: all 0.3s ease;
}

.back-link:hover {
  gap: 0.75rem;
}

.reset-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-color);
  margin: 0.5rem 0 0.5rem 0;
}

.reset-header p {
  color: var(--text-color-secondary);
  margin: 0;
  font-size: 0.875rem;
}

.reset-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 500;
  color: var(--text-color);
  font-size: 0.875rem;
}

.form-group input {
  padding: 0.75rem;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  background: var(--surface-ground);
  color: var(--text-color);
  font-size: 1rem;
  transition: all 0.3s ease;
}

.form-group input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.1);
}

.form-group input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  padding: 0.75rem;
  background: var(--primary-color);
  color: var(--primary-color-text);
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 0.5rem;
}

.btn-primary:hover:not(:disabled) {
  background: var(--primary-600);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(var(--primary-color-rgb), 0.3);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border-left: 3px solid rgb(239, 68, 68);
  border-radius: 4px;
  color: rgb(239, 68, 68);
  font-size: 0.875rem;
  margin-top: 1rem;
}

.success-message {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  background: rgba(34, 197, 94, 0.1);
  border-left: 3px solid rgb(34, 197, 94);
  border-radius: 4px;
  color: rgb(34, 197, 94);
  font-size: 0.875rem;
  margin-top: 1rem;
}

.success-link {
  color: rgb(34, 197, 94);
  text-decoration: none;
  font-weight: 500;
  transition: all 0.3s ease;
}

.success-link:hover {
  text-decoration: underline;
}

/* Dark mode support */
:global(.dark) {
  --surface-card: #2d2d2d;
  --surface-ground: #1e1e1e;
  --surface-border: #404040;
  --text-color: #ffffff;
  --text-color-secondary: #b0b0b0;
}

/* Responsive */
@media (max-width: 480px) {
  .reset-card {
    padding: 1.5rem;
  }

  .reset-header h1 {
    font-size: 1.5rem;
  }
}
</style>
