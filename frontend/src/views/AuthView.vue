<!-- src/views/AuthView.vue -->
<template>
  <div class="min-h-screen flex items-center justify-center bg-primary px-4 py-12">
    <div class="w-full max-w-md">
      <!-- Skip to main content link for accessibility -->
      <a href="#auth-form" class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded">
        {{ $t('accessibility.skipToContent') }}
      </a>

      <!-- Logo Section -->
      <div class="text-center mb-8">
        <img src="@/assets/vue.svg" alt="Template Logo" class="h-16 w-16 mx-auto mb-4" />
        <h1 class="text-3xl font-bold gradient-text">{{ $t('common.appName') }}</h1>
      </div>

      <!-- Tab Navigation for Sign In / Sign Up -->
      <div class="flex gap-4 mb-6 border-b border-primary" role="tablist">
        <button
          id="signin-tab"
          role="tab"
          :aria-selected="activeTab === 'signin'"
          :aria-controls="activeTab === 'signin' ? 'signin-panel' : undefined"
          @click="activeTab = 'signin'"
          :class="[
            'flex-1 pb-4 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 rounded-t',
            activeTab === 'signin'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-secondary hover:text-primary'
          ]"
        >
          {{ $t('auth.signIn') }}
        </button>
        <button
          id="signup-tab"
          role="tab"
          :aria-selected="activeTab === 'signup'"
          :aria-controls="activeTab === 'signup' ? 'signup-panel' : undefined"
          @click="activeTab = 'signup'"
          :class="[
            'flex-1 pb-4 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 rounded-t',
            activeTab === 'signup'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-secondary hover:text-primary'
          ]"
        >
          {{ $t('auth.signUp') }}
        </button>
      </div>

      <!-- Sign In Form -->
      <form
        v-if="activeTab === 'signin'"
        id="signin-panel"
        role="tabpanel"
        aria-labelledby="signin-tab"
        @submit.prevent="handleSignIn"
        class="card-base p-6 space-y-4"
        :aria-label="$t('auth.accessibilitySignIn')"
      >
        <p class="text-secondary text-sm mb-6">{{ $t('auth.signInDescription') }}</p>

        <!-- Email Field -->
        <div class="space-y-2">
          <label for="signin-email" class="block text-sm font-medium text-primary">
            {{ $t('auth.email') }}
            <span class="text-red-600 dark:text-red-400" aria-label="required">*</span>
          </label>
          <input
            id="signin-email"
            v-model="signInForm.email"
            type="email"
            :placeholder="$t('auth.email')"
            :aria-label="$t('auth.accessibilityEmail')"
            :aria-required="true"
            :aria-invalid="emailError ? 'true' : 'false'"
            :aria-describedby="emailError ? 'signin-email-error' : undefined"
            class="input-base"
            @blur="validateEmail"
            @input="clearError('email')"
          />
          <p v-if="emailError" id="signin-email-error" class="text-sm text-red-600 dark:text-red-400" role="alert">
            {{ emailError }}
          </p>
        </div>

        <!-- Password Field -->
        <div class="space-y-2">
          <label for="signin-password" class="block text-sm font-medium text-primary">
            {{ $t('auth.password') }}
            <span class="text-red-600 dark:text-red-400" aria-label="required">*</span>
          </label>
          <input
            id="signin-password"
            v-model="signInForm.password"
            type="password"
            :placeholder="$t('auth.password')"
            :aria-label="$t('auth.accessibilityPassword')"
            :aria-required="true"
            :aria-invalid="passwordError ? 'true' : 'false'"
            :aria-describedby="passwordError ? 'signin-password-error' : undefined"
            class="input-base"
            @input="clearError('password')"
          />
          <p v-if="passwordError" id="signin-password-error" class="text-sm text-red-600 dark:text-red-400" role="alert">
            {{ passwordError }}
          </p>
        </div>

        <!-- Error Message -->
        <div v-if="authError" class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" role="alert">
          <p class="text-sm text-red-700 dark:text-red-300">{{ authError }}</p>
        </div>

        <!-- Submit Button -->
        <Button
          type="submit"
          :label="$t('auth.signIn')"
          :loading="authLoading"
          class="w-full"
          :aria-label="$t('auth.accessibilitySubmit')"
        />

        <!-- Forgot Password Link -->
        <div class="text-center">
          <a href="#" class="text-sm text-blue-600 dark:text-blue-400 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1">
            {{ $t('auth.forgotPassword') }}
          </a>
        </div>
      </form>

      <!-- Sign Up Form -->
      <form
        v-if="activeTab === 'signup'"
        id="signup-panel"
        role="tabpanel"
        aria-labelledby="signup-tab"
        @submit.prevent="handleSignUp"
        class="card-base p-6 space-y-4"
        :aria-label="$t('auth.accessibilitySignUp')"
      >
        <p class="text-secondary text-sm mb-6">{{ $t('auth.signUpDescription') }}</p>

        <!-- First Name Field -->
        <div class="space-y-2">
          <label for="signup-firstname" class="block text-sm font-medium text-primary">
            {{ $t('auth.firstName') }}
            <span class="text-red-600 dark:text-red-400" aria-label="required">*</span>
          </label>
          <input
            id="signup-firstname"
            v-model="signUpForm.firstName"
            type="text"
            :placeholder="$t('auth.firstName')"
            :aria-required="true"
            class="input-base"
            @input="clearError('firstName')"
          />
        </div>

        <!-- Last Name Field -->
        <div class="space-y-2">
          <label for="signup-lastname" class="block text-sm font-medium text-primary">
            {{ $t('auth.lastName') }}
            <span class="text-red-600 dark:text-red-400" aria-label="required">*</span>
          </label>
          <input
            id="signup-lastname"
            v-model="signUpForm.lastName"
            type="text"
            :placeholder="$t('auth.lastName')"
            :aria-required="true"
            class="input-base"
            @input="clearError('lastName')"
          />
        </div>

        <!-- Email Field -->
        <div class="space-y-2">
          <label for="signup-email" class="block text-sm font-medium text-primary">
            {{ $t('auth.email') }}
            <span class="text-red-600 dark:text-red-400" aria-label="required">*</span>
          </label>
          <input
            id="signup-email"
            v-model="signUpForm.email"
            type="email"
            :placeholder="$t('auth.email')"
            :aria-required="true"
            :aria-invalid="emailError ? 'true' : 'false'"
            :aria-describedby="emailError ? 'signup-email-error' : undefined"
            class="input-base"
            @blur="validateEmail"
            @input="clearError('email')"
          />
          <p v-if="emailError" id="signup-email-error" class="text-sm text-red-600 dark:text-red-400" role="alert">
            {{ emailError }}
          </p>
        </div>

        <!-- Password Field -->
        <div class="space-y-2">
          <label for="signup-password" class="block text-sm font-medium text-primary">
            {{ $t('auth.password') }}
            <span class="text-red-600 dark:text-red-400" aria-label="required">*</span>
          </label>
          <input
            id="signup-password"
            v-model="signUpForm.password"
            type="password"
            :placeholder="$t('auth.password')"
            :aria-required="true"
            :aria-invalid="passwordError ? 'true' : 'false'"
            :aria-describedby="passwordError ? 'signup-password-error' : undefined"
            class="input-base"
            @input="clearError('password')"
          />
          <p v-if="passwordError" id="signup-password-error" class="text-sm text-red-600 dark:text-red-400" role="alert">
            {{ passwordError }}
          </p>
        </div>

        <!-- Confirm Password Field -->
        <div class="space-y-2">
          <label for="signup-confirm" class="block text-sm font-medium text-primary">
            {{ $t('auth.confirmPassword') }}
            <span class="text-red-600 dark:text-red-400" aria-label="required">*</span>
          </label>
          <input
            id="signup-confirm"
            v-model="signUpForm.confirmPassword"
            type="password"
            :placeholder="$t('auth.confirmPassword')"
            :aria-required="true"
            :aria-invalid="confirmPasswordError ? 'true' : 'false'"
            :aria-describedby="confirmPasswordError ? 'signup-confirm-error' : undefined"
            class="input-base"
            @input="clearError('confirmPassword')"
          />
          <p v-if="confirmPasswordError" id="signup-confirm-error" class="text-sm text-red-600 dark:text-red-400" role="alert">
            {{ confirmPasswordError }}
          </p>
        </div>

        <!-- Error Message -->
        <div v-if="authError" class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" role="alert">
          <p class="text-sm text-red-700 dark:text-red-300">{{ authError }}</p>
        </div>

        <!-- Submit Button -->
        <Button
          type="submit"
          :label="$t('auth.signUp')"
          :loading="authLoading"
          class="w-full"
          :aria-label="$t('auth.accessibilitySubmit')"
        />
      </form>

      <!-- SSO Section -->
      <div class="mt-6">
        <div class="relative">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-primary"></div>
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="px-2 bg-primary text-secondary">{{ $t('auth.orContinueWith') }}</span>
          </div>
        </div>

        <div class="mt-6 grid grid-cols-2 gap-4">
          <!-- Google SSO -->
          <button
            @click="handleSSO('google')"
            :aria-label="`${$t('auth.signInWith')} ${$t('auth.google')}`"
            class="flex items-center justify-center gap-2 px-4 py-2 border border-primary rounded-lg hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-colors"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            <span class="text-sm font-medium">Google</span>
          </button>

          <!-- Microsoft SSO -->
          <button
            @click="handleSSO('microsoft')"
            :aria-label="`${$t('auth.signInWith')} ${$t('auth.microsoft')}`"
            class="flex items-center justify-center gap-2 px-4 py-2 border border-primary rounded-lg hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-colors"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" />
            </svg>
            <span class="text-sm font-medium">Microsoft</span>
          </button>
        </div>
      </div>

      <!-- Sign In / Sign Up Toggle -->
      <p class="mt-6 text-center text-sm text-secondary">
        <span v-if="activeTab === 'signin'">
          {{ $t('auth.noAccount') }}
          <button
            @click="activeTab = 'signup'"
            class="text-blue-600 dark:text-blue-400 hover:underline font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
          >
            {{ $t('auth.signUp') }}
          </button>
        </span>
        <span v-else>
          {{ $t('auth.haveAccount') }}
          <button
            @click="activeTab = 'signin'"
            class="text-blue-600 dark:text-blue-400 hover:underline font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
          >
            {{ $t('auth.signIn') }}
          </button>
        </span>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { signIn, signUp, signInWithSSO, error: authError, loading: authLoading } = useAuth()
const toast = useToast()
const { t } = useI18n()

const activeTab = ref('signin')

const signInForm = ref({
  email: '',
  password: ''
})

const signUpForm = ref({
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: ''
})

const emailError = ref(null)
const passwordError = ref(null)
const confirmPasswordError = ref(null)

const validateEmail = () => {
  const email = activeTab.value === 'signin' ? signInForm.value.email : signUpForm.value.email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!email) {
    emailError.value = t('common.required')
  } else if (!emailRegex.test(email)) {
    emailError.value = t('auth.invalidEmail')
  } else {
    emailError.value = null
  }
}

const clearError = (field) => {
  if (field === 'email') emailError.value = null
  if (field === 'password') passwordError.value = null
  if (field === 'confirmPassword') confirmPasswordError.value = null
}

const handleSignIn = async () => {
  validateEmail()
  
  if (!signInForm.value.password) {
    passwordError.value = t('common.required')
    return
  }

  if (emailError.value || passwordError.value) {
    return
  }

  const success = await signIn(signInForm.value.email, signInForm.value.password)

  if (success) {
    toast.add({ severity: 'success', summary: t('common.success'), detail: t('auth.signInSuccess'), life: 3000 })
    router.push('/')
  } else {
    emailError.value = authError.value || t('auth.invalidCredentials')
  }
}

const handleSignUp = async () => {
  validateEmail()

  if (!signUpForm.value.firstName) {
    emailError.value = 'First name is required'
    return
  }

  if (!signUpForm.value.lastName) {
    emailError.value = 'Last name is required'
    return
  }

  if (!signUpForm.value.password) {
    passwordError.value = t('common.required')
    return
  }

  if (signUpForm.value.password.length < 8) {
    passwordError.value = t('auth.passwordTooShort')
    return
  }

  if (signUpForm.value.password !== signUpForm.value.confirmPassword) {
    confirmPasswordError.value = t('auth.passwordMismatch')
    return
  }

  if (emailError.value || passwordError.value || confirmPasswordError.value) {
    return
  }

  const success = await signUp(
    signUpForm.value.firstName,
    signUpForm.value.lastName,
    signUpForm.value.email,
    signUpForm.value.password
  )

  if (success) {
    toast.add({ severity: 'success', summary: t('common.success'), detail: t('auth.signUpSuccess'), life: 3000 })
    router.push('/')
  } else {
    emailError.value = authError.value || 'Failed to create account'
  }
}

const handleSSO = async (provider) => {
  const success = await signInWithSSO(provider, 'mock-token')

  if (success) {
    toast.add({ severity: 'success', summary: t('common.success'), detail: t('auth.signInSuccess'), life: 3000 })
    router.push('/')
  } else {
    emailError.value = authError.value || `Failed to sign in with ${provider}`
  }
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
</style>
