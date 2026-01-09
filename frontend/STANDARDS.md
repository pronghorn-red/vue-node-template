# Project Pronghorn Development Standards

**Version:** 1.0  
**Last Updated:** December 2024  
**Status:** Living Document - Subject to Enhancement

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture & Performance](#architecture--performance)
4. [Build & Deployment](#build--deployment)
5. [Accessibility Standards](#accessibility-standards)
6. [Internationalization (i18n)](#internationalization-i18n)
7. [Theme & Styling](#theme--styling)
8. [Component Development](#component-development)
9. [PrimeVue Integration](#primevue-integration)
10. [Authentication & Security](#authentication--security)
11. [Error Management](#error-management)
12. [Mobile Responsiveness](#mobile-responsiveness)
13. [Code Quality & Best Practices](#code-quality--best-practices)
14. [File Structure](#file-structure)

---

## Project Overview

**Project Pronghorn** is a modern, accessible, internationalized Vue 3 dashboard application built with Vite, PrimeVue, and Tailwind CSS. The project prioritizes performance, accessibility (WCAG 2.x AA), and user experience across all devices.

### Core Principles

The project adheres to these fundamental principles:

- **Performance First**: Lazy loading, code splitting, and optimized bundling
- **Accessibility by Default**: WCAG 2.x AA compliance throughout
- **Internationalization Ready**: Full i18n support with English and French
- **Dark Mode Native**: Synchronized theme toggling with proper contrast
- **Mobile Optimized**: Responsive design with mobile-first approach
- **Clean Code**: Maintainable, well-documented, and testable code

---

## Technology Stack

### Core Framework

| Technology | Version | Purpose |
|-----------|---------|---------|
| Vue | 3.x | Progressive JavaScript framework |
| Vite | 7.x | Next-generation build tool |
| Vue Router | 4.x | Client-side routing |
| Vue i18n | 9.x | Internationalization |
| TypeScript | Optional | Type safety (can be enabled) |

### UI & Styling

| Technology | Version | Purpose |
|-----------|---------|---------|
| PrimeVue | 4.x | Enterprise UI components |
| Tailwind CSS | 3.x | Utility-first CSS framework |
| PrimeIcons | Latest | Icon library (342 KB SVG) |
| Inter Font | Latest | Professional typography |

### Build & Optimization

| Technology | Version | Purpose |
|-----------|---------|---------|
| Terser | Latest | JavaScript minification |
| PostCSS | Latest | CSS processing |
| ESLint | Latest | Code linting |
| Prettier | Latest | Code formatting |

### Development

| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 22.x | Runtime environment |
| npm | Latest | Package manager |
| Express.js | Latest | Production server |

---

## Architecture & Performance

### Bundle Size Optimization

The project implements aggressive code splitting to minimize initial load times:

**Initial Load (First Visit):**
- Main app: 143 KB (gzip: 25 KB)
- Vendor chunks load on demand
- Dashboard loads only when accessed

**Chunk Strategy:**

```
dist/assets/
├── index.js (143 KB gzip) - Main app core
├── vue-vendor.js (157 KB gzip) - Vue, Router, i18n
├── primevue-vendor.js (635 KB gzip) - PrimeVue components
├── chart-vendor.js (204 KB gzip) - Chart.js
├── dashboard.js (22 KB gzip) - DashboardView (lazy loaded)
├── AuthView.js (13 KB gzip) - Auth page (lazy loaded)
├── AboutView.js (6 KB gzip) - About page (lazy loaded)
└── primeicons.svg (342 KB gzip) - Icon library
```

### Lazy Loading Routes

All heavy views are lazy loaded using dynamic imports:

```javascript
// src/router/index.js
{
  path: '/dashboard',
  name: 'dashboard',
  component: () => import('../views/DashboardView.vue'),
}
```

### Performance Metrics

- **First Contentful Paint (FCP):** < 2 seconds
- **Largest Contentful Paint (LCP):** < 3 seconds
- **Time to Interactive (TTI):** < 4 seconds
- **Cumulative Layout Shift (CLS):** < 0.1

---

## Build & Deployment

### Build Configuration

**File:** `vite.config.js`

The build configuration implements manual chunk splitting for optimal performance:

```javascript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'vue-vendor': ['vue', 'vue-router', 'vue-i18n'],
        'primevue-vendor': ['primevue', '@primevue/themes'],
        'chart-vendor': ['chart.js'],
        'dashboard': ['./src/views/DashboardView.vue'],
      }
    }
  },
  minify: 'terser',
  terserOptions: {
    compress: {
      drop_console: true,
    }
  }
}
```

### Build Commands

```bash
# Development server with HMR
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint

# Format code
npm run format
```

### Production Deployment

**File:** `server.js`

The production server uses Express.js with gzip compression:

```bash
# Start production server
node server.js

# Server runs on port 3000
# Accessible at: https://3000-[sandbox-id].manusvm.computer
```

---

## Accessibility Standards

### WCAG 2.x AA Compliance

All components and pages must meet WCAG 2.x AA standards. This includes:

#### Keyboard Navigation

- **Tab Order:** Logical, sequential tab order throughout the application
- **Focus Indicators:** Clear 2px blue focus rings with 7:1 contrast ratio
- **Keyboard Shortcuts:** All functionality accessible via keyboard
- **Skip Links:** "Skip to main content" link at top of page

**Implementation:**

```vue
<!-- Skip link example -->
<a href="#main-content" class="sr-only focus:not-sr-only">
  {{ $t('accessibility.skipToContent') }}
</a>

<!-- Focus ring example -->
<button class="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900">
  Click me
</button>
```

#### Color Contrast

- **Text Contrast:** Minimum 4.5:1 for normal text (WCAG AA)
- **Large Text:** Minimum 3:1 for text 18pt+ or 14pt+ bold
- **Graphics:** Minimum 3:1 for graphical elements
- **Focus Indicators:** Minimum 7:1 contrast ratio

**Contrast Checker:** Use WebAIM Contrast Checker to verify all color combinations.

#### ARIA Labels & Attributes

All interactive elements must have proper ARIA attributes:

```vue
<!-- Button with label -->
<Button
  :label="$t('common.refresh')"
  icon="pi pi-refresh"
  :aria-label="$t('common.refresh')"
/>

<!-- Form field with description -->
<input
  type="email"
  :aria-label="$t('form.email')"
  :aria-describedby="emailError ? 'email-error' : null"
/>
<span v-if="emailError" id="email-error" class="text-red-600">
  {{ emailError }}
</span>

<!-- Progress bar with accessible name -->
<ProgressBar
  :value="progress"
  :aria-label="`Progress: ${progress}%`"
/>

<!-- Menu with proper role -->
<nav role="navigation" :aria-label="$t('accessibility.mainNavigation')">
  <!-- Navigation items -->
</nav>
```

#### Semantic HTML

Use semantic HTML elements for proper document structure:

```vue
<!-- Correct semantic structure -->
<header role="banner">
  <!-- Top navigation -->
</header>

<main id="main-content" role="main" :aria-label="$t('accessibility.mainContent')">
  <!-- Page content -->
</main>

<aside role="complementary">
  <!-- Sidebar content -->
</aside>

<footer role="contentinfo">
  <!-- Footer content -->
</footer>
```

#### Screen Reader Support

- **Heading Hierarchy:** H1 → H2 → H3 (no skipped levels)
- **List Structure:** Use `<ul>`, `<ol>`, `<li>` for lists
- **Form Labels:** Always associate labels with form fields
- **Alternative Text:** Provide meaningful alt text for images
- **Hidden Content:** Use `sr-only` class for screen reader-only content

```vue
<!-- Screen reader only content -->
<span class="sr-only">{{ $t('accessibility.loading') }}</span>

<!-- Proper form structure -->
<div class="form-group">
  <label for="email">{{ $t('form.email') }}</label>
  <input id="email" type="email" />
</div>
```

#### Motion & Animation

Respect user preferences for reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    @apply !transition-none !animate-none;
  }
}
```

#### High Contrast Mode

Support high contrast mode for users with visual impairments:

```css
@media (prefers-contrast: more) {
  .text-primary {
    @apply text-slate-950 dark:text-white;
  }
}
```

### Accessibility Testing

- Use Lighthouse DevTools audit regularly
- Test with screen readers (NVDA, JAWS, VoiceOver)
- Test keyboard navigation with Tab, Shift+Tab, Enter, Space, Arrows
- Verify color contrast with WebAIM Contrast Checker
- Test with browser zoom at 200%
- Test with text size increased to 200%

---

## Internationalization (i18n)

### i18n Setup

**File:** `src/i18n/index.js`

The application supports English and French with easy expansion for additional languages:

```javascript
import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import fr from './locales/fr.json'

const i18n = createI18n({
  legacy: false,
  locale: sessionStorage.getItem('language') || 'en',
  fallbackLocale: 'en',
  messages: { en, fr }
})
```

### Translation Files

**Location:** `src/i18n/locales/`

Translation files are organized by feature:

```json
{
  "common": {
    "appName": "Pronghorn",
    "login": "Sign In",
    "logout": "Sign Out"
  },
  "dashboard": {
    "title": "Dashboard",
    "welcome": "Welcome back! Here's your overview."
  },
  "accessibility": {
    "skipToContent": "Skip to main content",
    "toggleMenu": "Toggle menu",
    "toggleTheme": "Toggle theme"
  }
}
```

### Using Translations in Components

```vue
<template>
  <h1>{{ $t('dashboard.title') }}</h1>
  <p>{{ $t('dashboard.welcome') }}</p>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()

// Access translation programmatically
const title = t('dashboard.title')

// Change language
const changeLanguage = (lang) => {
  locale.value = lang
  sessionStorage.setItem('language', lang)
}
</script>
```

### Language Toggle

The language toggle button switches between English and French:

```vue
<Button
  :label="currentLanguage === 'en' ? 'En' : 'Fr'"
  rounded
  text
  severity="secondary"
  size="small"
  @click="toggleLanguage"
/>
```

### Adding New Languages

To add a new language (e.g., Spanish):

1. Create `src/i18n/locales/es.json` with all translations
2. Update `src/i18n/index.js` to import and register the language
3. Update language toggle button to include new language
4. Test all pages and components with new language

---

## Theme & Styling

### Color System

**File:** `tailwind.config.js`

The project uses a professional color palette with light and dark mode support:

#### Light Mode Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Primary | #ffffff | Background |
| Secondary | #f1f5f9 | Hover states |
| Text | #1f2937 | Text content |
| Border | #e2e8f0 | Borders |

#### Dark Mode Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Primary | #0f172a | Background |
| Secondary | #1e293b | Hover states |
| Text | #f1f5f9 | Text content |
| Border | #334155 | Borders |

### Dark Mode Implementation

**File:** `src/composables/useDarkMode.js`

Dark mode is managed through a composable with system preference detection:

```javascript
import { ref, watch } from 'vue'

export function useDarkMode() {
  const isDark = ref(document.documentElement.classList.contains('dark'))

  const toggle = () => {
    isDark.value = !isDark.value
    
    if (isDark.value) {
      document.documentElement.classList.add('dark')
      sessionStorage.setItem('dark-mode', 'true')
    } else {
      document.documentElement.classList.remove('dark')
      sessionStorage.setItem('dark-mode', 'false')
    }
  }

  return { isDark, toggle }
}
```

### Synchronized Theme Transitions

All components transition smoothly when theme changes:

```css
html,
html * {
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease !important;
}
```

### Tailwind CSS Classes

Common utility classes used throughout the project:

```css
/* Card styling */
.card-base {
  @apply bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm;
}

/* Button styling */
.btn-primary {
  @apply bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors;
}

/* Text gradients */
.gradient-text {
  @apply bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent;
}

/* Focus rings */
.focus-ring {
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900;
}
```

### Responsive Design Breakpoints

```css
/* Tailwind breakpoints */
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large desktop */
```

### Custom Styling Guidelines

When adding custom styles:

1. Use Tailwind classes first (utility-first approach)
2. Use CSS variables for theme-aware colors
3. Always test in both light and dark modes
4. Ensure sufficient contrast ratios
5. Use `@apply` directive for reusable utility combinations

---

## Component Development

### Component Structure

All Vue components follow this structure:

```vue
<template>
  <!-- Template with semantic HTML -->
  <div class="component-container">
    <h2 class="text-lg font-semibold text-primary">
      {{ $t('component.title') }}
    </h2>
    <!-- Component content -->
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'

const { t } = useI18n()
const toast = useToast()

// Reactive state
const isLoading = ref(false)

// Computed properties
const displayText = computed(() => t('component.text'))

// Methods
const handleAction = () => {
  // Action logic
}

// Lifecycle hooks
onMounted(() => {
  // Initialization
})
</script>

<style scoped>
.component-container {
  @apply p-4 rounded-lg;
}
</style>
```

### Naming Conventions

- **Components:** PascalCase (e.g., `UserProfile.vue`)
- **Files:** PascalCase for components, camelCase for utilities
- **Props:** camelCase (e.g., `isLoading`, `onSubmit`)
- **Events:** kebab-case (e.g., `@item-selected`)
- **CSS Classes:** kebab-case (e.g., `card-base`, `btn-primary`)

### Props & Events

```vue
<script setup>
defineProps({
  title: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: false
  }
})

defineEmits(['update', 'close'])
</script>

<template>
  <div>
    <h1>{{ title }}</h1>
    <button @click="$emit('close')">Close</button>
  </div>
</template>
```

### Reusable Composables

Create composables for shared logic:

```javascript
// src/composables/useFormValidation.js
import { ref, computed } from 'vue'

export function useFormValidation() {
  const errors = ref({})

  const isValid = computed(() => Object.keys(errors.value).length === 0)

  const validate = (data) => {
    errors.value = {}
    // Validation logic
    return isValid.value
  }

  return { errors, isValid, validate }
}
```

---

## PrimeVue Integration

### Component Import Strategy

Import only the components you use. Never import the entire library:

```vue
<script setup>
// ✓ Correct - Tree-shakeable
import Button from 'primevue/button'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'

// ✗ Incorrect - Imports entire library
// import * as PrimeVue from 'primevue'
</script>
```

### Approved Components

The following PrimeVue components are approved for use:

| Component | Use Case | Notes |
|-----------|----------|-------|
| Button | All clickable actions | Use `text` variant for secondary actions |
| Card | Content containers | Use for sections and panels |
| DataTable | Tabular data | Supports pagination, sorting, filtering |
| Tabs | Tab navigation | Use new `Tabs` component (not deprecated `TabView`) |
| Accordion | Collapsible sections | Use new `Accordion` structure |
| Message | Alert messages | Use for info, success, warning, error |
| ProgressBar | Progress indication | Always include aria-label |
| Rating | Star ratings | Use for user feedback |
| Chart | Data visualization | Supports line, bar, pie, doughnut charts |
| Drawer | Side panels | Use for navigation menus |
| Menu | Dropdown menus | Use for context menus |
| Tooltip | Hover hints | Use `v-tooltip` directive |
| Tag | Labels | Use for status indicators |
| Timeline | Event sequences | Use for process flows |
| Divider | Visual separators | Use to divide sections |

### Deprecated Components (Do Not Use)

- ~~Dropdown~~ → Use `Select` instead
- ~~TabView/TabPanel~~ → Use `Tabs/TabPanel` instead
- ~~AccordionTab~~ → Use `Accordion/AccordionPanel` instead

### PrimeVue Styling

All PrimeVue components are styled in `src/style.css` under the `@layer primevue` section:

```css
@layer primevue {
  /* Dark mode for DataTable */
  .p-datatable {
    @apply bg-transparent;
  }

  html.dark .p-datatable .p-datatable-thead > tr > th {
    background-color: #334155 !important;
    color: #f1f5f9 !important;
    border-color: #475569 !important;
  }
}
```

### PrimeVue Theme Configuration

**File:** `src/main.js`

```javascript
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      prefix: 'p',
      darkModeSelector: '.dark',
      cssLayer: {
        name: 'primevue',
        order: 'tailwind-base, primevue, tailwind-utilities'
      }
    }
  }
})
```

---

## Authentication & Security

### Current Implementation

The project uses a composable-based authentication system (no Pinia store):

**File:** `src/composables/useAuth.js`

```javascript
import { ref, computed } from 'vue'

export function useAuth() {
  const user = ref(null)
  const isLoggedIn = computed(() => !!user.value)
  const error = ref(null)
  const loading = ref(false)

  const signIn = async (email, password) => {
    loading.value = true
    error.value = null
    try {
      // Authentication logic
      sessionStorage.setItem('user', JSON.stringify(user.value))
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  const signOut = () => {
    user.value = null
    sessionStorage.removeItem('user')
  }

  return { user, isLoggedIn, error, loading, signIn, signOut }
}
```

### Google SSO Integration

**Status:** Placeholder - To be implemented

When implementing Google OAuth:

1. Register application at [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials (Web application)
3. Add redirect URI: `https://[your-domain]/auth/callback`
4. Install `@react-oauth/google` or similar Vue library
5. Implement sign-in button in `AuthView.vue`
6. Handle OAuth callback and token exchange
7. Store authentication token securely (httpOnly cookie recommended)
8. Implement token refresh mechanism

**Implementation Location:** `src/views/AuthView.vue`

```vue
<!-- Placeholder for Google SSO button -->
<Button
  label="Sign in with Google"
  icon="pi pi-google"
  @click="signInWithGoogle"
  class="w-full mb-2"
/>
```

### Microsoft SSO Integration

**Status:** Placeholder - To be implemented

When implementing Microsoft OAuth:

1. Register application at [Azure Portal](https://portal.azure.com/)
2. Create OAuth 2.0 credentials
3. Add redirect URI: `https://[your-domain]/auth/callback`
4. Install `@azure/msal-browser` or similar Vue library
5. Implement sign-in button in `AuthView.vue`
6. Handle OAuth callback and token exchange
7. Store authentication token securely
8. Implement token refresh mechanism

**Implementation Location:** `src/views/AuthView.vue`

```vue
<!-- Placeholder for Microsoft SSO button -->
<Button
  label="Sign in with Microsoft"
  icon="pi pi-microsoft"
  @click="signInWithMicrosoft"
  class="w-full mb-2"
/>
```

### Security Best Practices

- Store sensitive tokens in httpOnly cookies (not sessionStorage)
- Implement CSRF protection for state-changing operations
- Use HTTPS for all communications
- Implement rate limiting on authentication endpoints
- Validate all user inputs on both client and server
- Implement proper CORS headers
- Use Content Security Policy (CSP) headers
- Regularly rotate secrets and tokens

---

## Error Management

### Current Implementation

**Status:** Placeholder - To be enhanced

Error handling should follow these patterns:

### Error Types

```javascript
// API Errors
class APIError extends Error {
  constructor(message, status, data) {
    super(message)
    this.name = 'APIError'
    this.status = status
    this.data = data
  }
}

// Validation Errors
class ValidationError extends Error {
  constructor(message, fields) {
    super(message)
    this.name = 'ValidationError'
    this.fields = fields
  }
}

// Authentication Errors
class AuthenticationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'AuthenticationError'
  }
}
```

### Error Handling in Components

```vue
<script setup>
import { ref } from 'vue'
import { useToast } from 'primevue/usetoast'

const toast = useToast()
const error = ref(null)

const handleAction = async () => {
  try {
    // Action logic
  } catch (err) {
    error.value = err.message
    
    // Show user-friendly error message
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: err.message,
      life: 3000
    })
  }
}
</script>

<template>
  <Message v-if="error" severity="error" :text="error" />
</template>
```

### Axios Interceptors

**Status:** Placeholder - To be implemented

When implementing Axios for API calls:

```javascript
// src/utils/axiosConfig.js
import axios from 'axios'

const instance = axios.create({
  baseURL: process.env.VUE_APP_API_URL || 'http://localhost:3000/api'
})

// Request interceptor
instance.interceptors.request.use(
  (config) => {
    // Add authentication token
    const token = sessionStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      // Redirect to login
    }
    
    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      // Show permission denied message
    }
    
    return Promise.reject(error)
  }
)

export default instance
```

### Global Error Boundary

**Status:** Placeholder - To be implemented

Create an error boundary component for handling unexpected errors:

```vue
<!-- src/components/ErrorBoundary.vue -->
<template>
  <div v-if="hasError" class="error-boundary">
    <Message severity="error" :text="errorMessage" />
    <Button label="Reload" @click="reload" />
  </div>
  <slot v-else />
</template>

<script setup>
import { ref, onErrorCaptured } from 'vue'

const hasError = ref(false)
const errorMessage = ref('')

onErrorCaptured((err) => {
  hasError.value = true
  errorMessage.value = err.message
  return false
})

const reload = () => {
  location.reload()
}
</script>
```

---

## Mobile Responsiveness

### Mobile-First Approach

All components are designed mobile-first, then enhanced for larger screens:

```vue
<template>
  <!-- Mobile: Single column, full width -->
  <!-- Tablet (md): Two columns -->
  <!-- Desktop (lg): Four columns -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    <Card v-for="item in items" :key="item.id">
      <!-- Card content -->
    </Card>
  </div>
</template>
```

### Responsive Breakpoints

| Breakpoint | Width | Device | Usage |
|-----------|-------|--------|-------|
| Default | < 640px | Mobile | Base styles |
| sm | 640px | Mobile landscape | Minor adjustments |
| md | 768px | Tablet | Two-column layouts |
| lg | 1024px | Desktop | Multi-column layouts |
| xl | 1280px | Large desktop | Full-width content |
| 2xl | 1536px | Extra large | Maximum width containers |

### Mobile Navigation

The hamburger menu provides navigation on mobile:

```vue
<template>
  <!-- Hamburger button visible on mobile -->
  <Button
    icon="pi pi-bars"
    text
    rounded
    severity="secondary"
    size="small"
    @click="sidebarVisible = true"
    class="hidden sm:inline-flex"
  />

  <!-- Sidebar drawer opens on mobile -->
  <Drawer
    v-model:visible="sidebarVisible"
    position="left"
    class="w-64"
  >
    <!-- Navigation items -->
  </Drawer>
</template>
```

### Responsive Images

Always provide responsive images:

```vue
<template>
  <img
    src="image.png"
    alt="Description"
    class="w-full h-auto"
    loading="lazy"
  />
</template>
```

### Touch-Friendly Targets

All interactive elements must be at least 44x44px:

```css
/* Ensure minimum touch target size */
button,
a,
input[type="checkbox"],
input[type="radio"] {
  @apply min-h-[44px] min-w-[44px];
}
```

### Viewport Meta Tag

**File:** `index.html`

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

---

## Code Quality & Best Practices

### Code Style

- **Indentation:** 2 spaces
- **Line Length:** 100 characters (soft limit)
- **Semicolons:** Always use
- **Quotes:** Single quotes for strings
- **Trailing Commas:** Use in multiline objects/arrays

### ESLint Configuration

**File:** `.eslintrc.cjs`

```javascript
module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: [
    'plugin:vue/vue3-essential',
    'eslint:recommended'
  ],
  rules: {
    'vue/multi-word-component-names': 'off',
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off'
  }
}
```

### Prettier Configuration

**File:** `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2
}
```

### Git Workflow

1. Create feature branch: `git checkout -b feature/feature-name`
2. Make changes and commit: `git commit -m "Description"`
3. Push to remote: `git push origin feature/feature-name`
4. Create pull request for review
5. Merge after approval

### Documentation

- Add JSDoc comments to functions
- Document complex logic with inline comments
- Keep README.md up to date
- Update STANDARDS.md when adding new patterns

### Testing Considerations

While not currently implemented, plan for:

- Unit tests for utilities and composables
- Component tests for interactive elements
- E2E tests for critical user flows
- Accessibility tests with axe-core

---

## File Structure

```
project-pronghorn/
├── public/
│   ├── robots.txt
│   └── favicon.ico
├── src/
│   ├── assets/
│   │   └── vue.svg
│   ├── components/
│   │   ├── AppLayout.vue
│   │   ├── FeatureCard.vue
│   │   └── TechItem.vue
│   ├── composables/
│   │   ├── useDarkMode.js
│   │   └── useAuth.js
│   ├── i18n/
│   │   ├── index.js
│   │   └── locales/
│   │       ├── en.json
│   │       └── fr.json
│   ├── router/
│   │   └── index.js
│   ├── utils/
│   │   └── chartDarkModePlugin.js
│   ├── views/
│   │   ├── HomeView.vue
│   │   ├── DashboardView.vue
│   │   ├── AboutView.vue
│   │   └── AuthView.vue
│   ├── App.vue
│   ├── main.js
│   └── style.css
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
├── server.js
├── STANDARDS.md
└── README.md
```

---

## Development Workflow

### Starting Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open browser to http://localhost:5173
```

### Creating a New Page

1. Create component in `src/views/PageName.vue`
2. Add route in `src/router/index.js` with lazy loading
3. Add navigation link in `AppLayout.vue`
4. Add translations in `src/i18n/locales/*.json`
5. Implement with PrimeVue components
6. Test accessibility with keyboard and screen reader
7. Test dark mode toggle
8. Test mobile responsiveness

### Creating a New Component

1. Create component in `src/components/ComponentName.vue`
2. Follow component structure guidelines
3. Add proper ARIA labels and keyboard support
4. Add translations for all text
5. Test in both light and dark modes
6. Document props and events
7. Add to component library documentation

### Deploying Changes

```bash
# Build production version
npm run build

# Test production build locally
npm run preview

# Deploy to production
# Server automatically serves latest build from dist/
```

---

## Continuous Improvement

This document is a living standard. As the project evolves:

1. **Review quarterly** - Assess current practices and identify improvements
2. **Document decisions** - Add rationale for major architectural choices
3. **Update examples** - Keep code examples current with latest patterns
4. **Gather feedback** - Collect input from team members
5. **Version control** - Track changes to this document in git
6. **Communicate changes** - Notify team of significant updates

### Areas for Future Enhancement

- [ ] Google SSO Integration
- [ ] Microsoft SSO Integration
- [ ] Axios Interceptors Implementation
- [ ] Global Error Boundary
- [ ] Unit Testing Strategy
- [ ] Component Testing Strategy
- [ ] E2E Testing Strategy
- [ ] Performance Monitoring
- [ ] Analytics Integration
- [ ] Logging Strategy
- [ ] API Documentation
- [ ] Deployment Pipeline
- [ ] Database Schema (if applicable)
- [ ] WebSocket Implementation (if applicable)

---

## References & Resources

### Official Documentation

- [Vue 3 Documentation](https://vuejs.org/)
- [Vite Documentation](https://vitejs.dev/)
- [PrimeVue Documentation](https://primevue.org/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [Vue Router Documentation](https://router.vuejs.org/)
- [Vue i18n Documentation](https://vue-i18n.intlify.dev/)

### Accessibility Resources

- [WCAG 2.x Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Lighthouse Audits](https://developers.google.com/web/tools/lighthouse)

### Performance Resources

- [Web Vitals](https://web.dev/vitals/)
- [Vite Performance Guide](https://vitejs.dev/guide/ssr.html)
- [Bundle Analysis Tools](https://bundlephobia.com/)

---

**Document Version:** 1.0  
**Last Updated:** December 2024  
**Maintained By:** Project Pronghorn Team  
**Status:** Active - Living Document
