<!-- src/views/Auth.vue -->
<template>
  <div class="auth-container">
    <div class="auth-card">
      <!-- Logo/Title -->
      <div class="auth-header">
        <h1>{{ $t('auth.title') }}</h1>
        <p>{{ $t('auth.subtitle') }}</p>
      </div>

      <!-- Tab Navigation -->
      <div class="auth-tabs">
        <button
          @click="activeTab = 'login'"
          :class="['tab-button', { active: activeTab === 'login' }]"
        >
          {{ $t('auth.login') }}
        </button>
        <button
          @click="activeTab = 'register'"
          :class="['tab-button', { active: activeTab === 'register' }]"
        >
          {{ $t('auth.register') }}
        </button>
      </div>

      <!-- Login Form -->
      <form v-if="activeTab === 'login'" @submit.prevent="handleLogin" class="auth-form">
        <div class="form-group">
          <label>{{ $t('auth.email') }}</label>
          <input
            v-model="loginForm.email"
            type="email"
            :placeholder="$t('auth.emailPlaceholder')"
            required
          />
        </div>

        <div class="form-group">
          <label>{{ $t('auth.password') }}</label>
          <input
            v-model="loginForm.password"
            type="password"
            :placeholder="$t('auth.passwordPlaceholder')"
            required
          />
        </div>

        <div class="form-actions">
          <button type="submit" :disabled="isLoading" class="btn-primary">
            <span v-if="!isLoading">{{ $t('auth.login') }}</span>
            <span v-else>{{ $t('auth.loading') }}</span>
          </button>
        </div>

        <div class="form-link">
          <router-link to="/auth/reset">{{ $t('auth.forgotPassword') }}</router-link>
        </div>
      </form>

      <!-- Register Form -->
      <form v-if="activeTab === 'register'" @submit.prevent="handleRegister" class="auth-form">
        <div class="form-group">
          <label>{{ $t('auth.displayName') }}</label>
          <input
            v-model="registerForm.display_name"
            type="text"
            :placeholder="$t('auth.displayNamePlaceholder')"
            required
          />
        </div>

        <div class="form-group">
          <label>{{ $t('auth.email') }}</label>
          <input
            v-model="registerForm.email"
            type="email"
            :placeholder="$t('auth.emailPlaceholder')"
            required
          />
        </div>

        <div class="form-group">
          <label>{{ $t('auth.password') }}</label>
          <input
            v-model="registerForm.password"
            type="password"
            :placeholder="$t('auth.passwordPlaceholder')"
            required
          />
        </div>

        <div class="form-group">
          <label>{{ $t('auth.confirmPassword') }}</label>
          <input
            v-model="registerForm.confirmPassword"
            type="password"
            :placeholder="$t('auth.confirmPasswordPlaceholder')"
            required
          />
        </div>

        <div class="form-actions">
          <button type="submit" :disabled="isLoading" class="btn-primary">
            <span v-if="!isLoading">{{ $t('auth.register') }}</span>
            <span v-else>{{ $t('auth.loading') }}</span>
          </button>
        </div>
      </form>

      <!-- Error Message -->
      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <!-- Success Message -->
      <div v-if="success" class="success-message">
        {{ success }}
      </div>

      <!-- Divider -->
      <div class="divider">
        <span>{{ $t('auth.or') }}</span>
      </div>

      <!-- SSO Buttons -->
      <div class="sso-buttons">
        <button 
          type="button"
          @click="loginWithGoogle" 
          :disabled="isLoading || ssoLoading" 
          class="btn-sso btn-google"
        >
          <img src="https://www.gstatic.com/firebaseui/image/social/google_icon_24x24.png" alt="Google" />
          {{ $t('auth.google') }}
        </button>

        <button 
          type="button"
          @click="loginWithMicrosoft" 
          :disabled="isLoading || ssoLoading" 
          class="btn-sso btn-microsoft"
        >
          <svg class="microsoft-icon" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
            <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
            <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
          </svg>
          {{ $t('auth.microsoft') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()
const { signIn, signUp: authSignUp, signInWithSSO } = useAuth()

// State
const activeTab = ref('login')
const isLoading = ref(false)
const ssoLoading = ref(false)
const error = ref(null)
const success = ref(null)

const loginForm = ref({
  email: '',
  password: ''
})

const registerForm = ref({
  display_name: '',
  email: '',
  password: '',
  confirmPassword: ''
})

/**
 * Check for error query params on mount (from failed OAuth)
 */
onMounted(() => {
  const errorParam = route.query.error
  if (errorParam) {
    if (errorParam === 'microsoft_failed') {
      error.value = t('auth.microsoftFailed') || 'Microsoft sign in failed. Please try again.'
    } else if (errorParam === 'google_failed') {
      error.value = t('auth.googleFailed') || 'Google sign in failed. Please try again.'
    } else if (errorParam === 'session_expired') {
      error.value = t('auth.sessionExpired') || 'Your session has expired. Please sign in again.'
    }
    // Clear error from URL
    router.replace({ query: { ...route.query, error: undefined } })
  }
})

/**
 * Handle login
 */
const handleLogin = async () => {
  error.value = null
  success.value = null

  if (!loginForm.value.email || !loginForm.value.password) {
    error.value = t('auth.fillAllFields')
    return
  }

  isLoading.value = true

  try {
    const result = await signIn(loginForm.value.email, loginForm.value.password)

    if (result) {
      success.value = t('auth.loginSuccess')

      // Redirect after a short delay
      setTimeout(() => {
        const redirect = route.query.redirect || '/dashboard'
        router.push(redirect)
      }, 500)
    } else {
      error.value = t('auth.loginFailed')
    }
  } catch (err) {
    error.value = err.response?.data?.error || t('auth.loginFailed')
  } finally {
    isLoading.value = false
  }
}

/**
 * Handle registration
 */
const handleRegister = async () => {
  error.value = null
  success.value = null

  if (
    !registerForm.value.display_name ||
    !registerForm.value.email ||
    !registerForm.value.password ||
    !registerForm.value.confirmPassword
  ) {
    error.value = t('auth.fillAllFields')
    return
  }

  if (registerForm.value.password !== registerForm.value.confirmPassword) {
    error.value = t('auth.passwordsDoNotMatch')
    return
  }

  if (registerForm.value.password.length < 8) {
    error.value = t('auth.passwordTooShort')
    return
  }

  isLoading.value = true

  try {
    // Split display_name into first and last name for the API
    const nameParts = registerForm.value.display_name.trim().split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    const result = await authSignUp(
      firstName,
      lastName,
      registerForm.value.email,
      registerForm.value.password
    )

    if (result) {
      success.value = t('auth.registerSuccess')

      // Redirect after a short delay
      setTimeout(() => {
        router.push('/dashboard')
      }, 500)
    } else {
      error.value = t('auth.registerFailed')
    }
  } catch (err) {
    error.value = err.response?.data?.error || t('auth.registerFailed')
  } finally {
    isLoading.value = false
  }
}

/**
 * Login with Google SSO
 * Redirects to backend OAuth endpoint
 */
const loginWithGoogle = () => {
  ssoLoading.value = true
  error.value = null
  signInWithSSO('google')
  // Page will redirect - ssoLoading will reset on page reload
}

/**
 * Login with Microsoft SSO
 * Redirects to backend OAuth endpoint
 */
const loginWithMicrosoft = () => {
  ssoLoading.value = true
  error.value = null
  signInWithSSO('microsoft')
  // Page will redirect - ssoLoading will reset on page reload
}
</script>

<style scoped>
.auth-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-600) 100%);
  padding: 1rem;
}

.auth-card {
  width: 100%;
  max-width: 400px;
  background: var(--surface-card);
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.auth-header {
  text-align: center;
  margin-bottom: 2rem;
}

.auth-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-color);
  margin: 0 0 0.5rem 0;
}

.auth-header p {
  color: var(--text-color-secondary);
  margin: 0;
  font-size: 0.875rem;
}

.auth-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 2rem;
  border-bottom: 1px solid var(--surface-border);
}

.tab-button {
  flex: 1;
  padding: 0.75rem;
  background: transparent;
  border: none;
  color: var(--text-color-secondary);
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.3s ease;
}

.tab-button.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
}

.tab-button:hover {
  color: var(--text-color);
}

.auth-form {
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

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
}

.btn-primary {
  flex: 1;
  padding: 0.75rem;
  background: var(--primary-color);
  color: var(--primary-color-text);
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
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

.form-link {
  text-align: center;
  margin-top: 0.5rem;
}

.form-link a {
  color: var(--primary-color);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.3s ease;
}

.form-link a:hover {
  text-decoration: underline;
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
  margin-bottom: 1rem;
}

.success-message {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  background: rgba(34, 197, 94, 0.1);
  border-left: 3px solid rgb(34, 197, 94);
  border-radius: 4px;
  color: rgb(34, 197, 94);
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.divider {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 1.5rem 0;
  color: var(--text-color-secondary);
  font-size: 0.875rem;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--surface-border);
}

.sso-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.btn-sso {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  background: var(--surface-ground);
  color: var(--text-color);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-sso:hover:not(:disabled) {
  background: var(--surface-card);
  border-color: var(--primary-color);
  transform: translateY(-2px);
}

.btn-sso:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-sso img {
  width: 20px;
  height: 20px;
}

.btn-sso .microsoft-icon {
  width: 20px;
  height: 20px;
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
  .auth-card {
    padding: 1.5rem;
  }

  .auth-header h1 {
    font-size: 1.5rem;
  }
}
</style>