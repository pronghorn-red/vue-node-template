import { ref, computed } from 'vue'

// Global auth state
const user = ref(null)
const isAuthenticated = ref(false)
const loading = ref(false)
const error = ref(null)

// Initialize auth from localStorage
const initializeAuth = () => {
  const savedUser = localStorage.getItem('user')
  if (savedUser) {
    try {
      user.value = JSON.parse(savedUser)
      isAuthenticated.value = true
    } catch (err) {
      clearUser()
    }
  }
}

// Initialize on first import
initializeAuth()

export function useAuth() {
  const isLoggedIn = computed(() => isAuthenticated.value)

  const setUser = (userData) => {
    user.value = userData
    isAuthenticated.value = true
    localStorage.setItem('user', JSON.stringify(userData))
  }

  const clearUser = () => {
    user.value = null
    isAuthenticated.value = false
    localStorage.removeItem('user')
  }

  const setError = (errorMessage) => {
    error.value = errorMessage
  }

  const clearError = () => {
    error.value = null
  }

  const signIn = async (email, password) => {
    loading.value = true
    error.value = null
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const userData = {
        id: '1',
        email,
        firstName: email.split('@')[0],
        lastName: 'User',
        avatar: `https://ui-avatars.com/api/?name=${email}&background=random`,
        provider: 'email'
      }
      
      setUser(userData)
      return true
    } catch (err) {
      error.value = 'Invalid email or password'
      return false
    } finally {
      loading.value = false
    }
  }

  const signUp = async (firstName, lastName, email, password) => {
    loading.value = true
    error.value = null
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const userData = {
        id: Date.now().toString(),
        email,
        firstName,
        lastName,
        avatar: `https://ui-avatars.com/api/?name=${firstName}+${lastName}&background=random`,
        provider: 'email'
      }
      
      setUser(userData)
      return true
    } catch (err) {
      error.value = 'Failed to create account'
      return false
    } finally {
      loading.value = false
    }
  }

  const signInWithSSO = async (provider, token) => {
    loading.value = true
    error.value = null
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const userData = {
        id: Date.now().toString(),
        email: `user@${provider}.com`,
        firstName: 'SSO',
        lastName: 'User',
        avatar: `https://ui-avatars.com/api/?name=SSO+User&background=random`,
        provider
      }
      
      setUser(userData)
      return true
    } catch (err) {
      error.value = `Failed to sign in with ${provider}`
      return false
    } finally {
      loading.value = false
    }
  }

  const signOut = () => {
    clearUser()
    clearError()
  }

  return {
    user,
    isAuthenticated,
    isLoggedIn,
    loading,
    error,
    setUser,
    clearUser,
    setError,
    clearError,
    signIn,
    signUp,
    signInWithSSO,
    signOut,
    initializeAuth
  }
}
