# Routing & Navigation

## What it is

Vue Router configuration with authentication guards, role-based access control, and navigation management. Routes are protected based on authentication status and user roles.

## Where it lives (code map)

- **`frontend/src/router/index.js`** - Router configuration, route guards
- **`frontend/src/components/AppLayout.vue`** - Navigation UI

## How it works

### Route Guards

Routes can have meta properties:
- `requiresAuth: true` - Requires authenticated user
- `requiresAdmin: true` - Requires admin or superadmin role
- `guest: true` - Only for unauthenticated users

### Navigation Flow

```
Route Change → beforeEach Guard → Check Auth → Check Role → Allow/Redirect
```

## How to use it

### Route Definition

```javascript
{
  path: '/dashboard',
  name: 'dashboard',
  component: () => import('../views/DashboardView.vue'),
  meta: { requiresAuth: true }
}

{
  path: '/users',
  name: 'users',
  component: () => import('../views/UsersView.vue'),
  meta: { requiresAuth: true, requiresAdmin: true }
}
```

### Programmatic Navigation

```javascript
import { useRouter } from 'vue-router'

const router = useRouter()

// Navigate
router.push('/dashboard')

// Navigate with query
router.push({ 
  path: '/dashboard', 
  query: { tab: 'settings' } 
})

// Navigate with params
router.push({ 
  name: 'user', 
  params: { id: '123' } 
})
```

### Route Guards

```javascript
// In router/index.js
router.beforeEach((to, from, next) => {
  const { isAuthenticated, user } = getAuthState()
  
  if (to.meta.requiresAuth && !isAuthenticated) {
    return next({ name: 'auth', query: { redirect: to.fullPath } })
  }
  
  if (to.meta.requiresAdmin && !isAdmin(user)) {
    return next({ name: 'unauthorized' })
  }
  
  next()
})
```

## Configuration

### Router Configuration

Edit `frontend/src/router/index.js`:

```javascript
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
```

## Extending / modifying

### Custom Route Guards

```javascript
router.beforeEach((to, from, next) => {
  // Custom logic
  if (to.meta.requiresCustomPermission) {
    const hasPermission = checkCustomPermission()
    if (!hasPermission) {
      return next({ name: 'unauthorized' })
    }
  }
  next()
})
```

### Dynamic Routes

```javascript
// Add route programmatically
router.addRoute({
  path: '/dynamic',
  component: () => import('../views/DynamicView.vue')
})
```

## Troubleshooting

### Route guard not working

- **Check auth state**: Ensure `isAuthenticated` is updated after login
- **Check role**: Ensure user role is loaded
- **Check meta**: Ensure route has correct meta properties

### Redirect loops

- **Check redirect logic**: Ensure redirect doesn't point to protected route
- **Check auth state**: Ensure auth state is initialized before guards run

## Security considerations

1. **Client-Side Only**: Route guards are client-side (server-side also required)
2. **Role Checks**: Verify roles on server for sensitive operations
3. **Redirect Handling**: Store intended destination for post-login redirect

## Related docs

- [Authentication](./authentication.md) - Auth state management
- [Layout & UI](./layout-ui.md) - Navigation UI
