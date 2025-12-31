/**
 * @fileoverview Vue Router Configuration
 * @description Defines application routes with authentication and role-based guards.
 * 
 * Route Meta:
 * - requiresAuth: Route requires authenticated user
 * - requiresAdmin: Route requires admin or superadmin role
 * - guest: Route is only for unauthenticated users
 */

import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('../views/AboutView.vue')
  },
  {
    path: '/chat',
    name: 'chat',
    component: () => import('../views/ChatView.vue'),
    meta: { requiresAuth: true }
  },
  
  // =========================================================================
  // USER ROUTES (must come before /auth to avoid conflicts)
  // =========================================================================
  {
    path: '/profile',
    name: 'profile',
    component: () => import('../views/ProfileView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue'),
    meta: { requiresAuth: true }
  },
  
  // =========================================================================
  // ADMIN ROUTES
  // =========================================================================
  {
    path: '/users',
    name: 'users',
    component: () => import('../views/UsersView.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  },
  
  // =========================================================================
  // AUTH ROUTES
  // =========================================================================
  {
    path: '/auth',
    name: 'auth',
    component: () => import('../views/AuthView.vue'),
    meta: { guest: true }
  },
  {
    path: '/auth/callback',
    name: 'auth-callback',
    component: () => import('../views/AuthCallbackView.vue')
  },
  {
    path: '/auth/reset',
    name: 'password-reset',
    component: () => import('../views/PasswordResetView.vue'),
    meta: { guest: true }
  },
  
  // =========================================================================
  // ERROR ROUTES
  // =========================================================================
  {
    path: '/unauthorized',
    name: 'unauthorized',
    component: () => import('../views/UnauthorizedView.vue')
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFoundView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    return { top: 0 }
  }
})

// =============================================================================
// NAVIGATION GUARDS
// =============================================================================

/**
 * Get authentication state from sessionStorage
 * @returns {{ isAuthenticated: boolean, user: Object|null }}
 */
const getAuthState = () => {
  const token = sessionStorage.getItem('accessToken')
  const userStr = sessionStorage.getItem('user')
  
  let user = null
  try {
    user = userStr ? JSON.parse(userStr) : null
  } catch (e) {
    console.error('Failed to parse user from sessionStorage')
  }
  
  return {
    isAuthenticated: !!token,
    user
  }
}

/**
 * Check if user has admin role
 * @param {Object|null} user - User object
 * @returns {boolean}
 */
const isAdmin = (user) => {
  if (!user) return false
  const role = user.role
  return role === 'admin' || role === 'superadmin'
}

/**
 * Global navigation guard
 */
router.beforeEach((to, from, next) => {
  const { isAuthenticated, user } = getAuthState()
  
  console.log('Router guard:', { 
    to: to.path, 
    isAuthenticated, 
    userRole: user?.role,
    requiresAuth: to.meta.requiresAuth,
    requiresAdmin: to.meta.requiresAdmin
  })
  
  // Route requires authentication
  if (to.meta.requiresAuth && !isAuthenticated) {
    // Store intended destination for redirect after login
    sessionStorage.setItem('redirectAfterLogin', to.fullPath)
    return next({ 
      name: 'auth', 
      query: { redirect: to.fullPath } 
    })
  }
  
  // Route requires admin role
  if (to.meta.requiresAdmin) {
    if (!isAuthenticated) {
      sessionStorage.setItem('redirectAfterLogin', to.fullPath)
      return next({ 
        name: 'auth', 
        query: { redirect: to.fullPath } 
      })
    }
    
    if (!isAdmin(user)) {
      console.log('Access denied - user role:', user?.role)
      return next({ name: 'unauthorized' })
    }
  }
  
  // Guest-only routes (auth pages) - redirect authenticated users
  if (to.meta.guest && isAuthenticated) {
    return next({ name: 'dashboard' })
  }
  
  next()
})

/**
 * After each navigation
 */
router.afterEach((to) => {
  // Update document title
  const appName = 'Pronghorn'
  const pageTitle = to.meta.title || to.name
  if (pageTitle && typeof pageTitle === 'string') {
    document.title = `${pageTitle.charAt(0).toUpperCase() + pageTitle.slice(1)} | ${appName}`
  } else {
    document.title = appName
  }
})

export default router