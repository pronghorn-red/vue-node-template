# Layout & UI Components

## What it is

The main application layout component (`AppLayout`) provides the shell for the application including navigation, user menu, dark mode toggle, language switcher, and WebSocket connection indicator.

## Where it lives (code map)

- **`frontend/src/components/AppLayout.vue`** - Main layout component
- **`frontend/src/composables/useDarkMode.js`** - Dark mode management
- **`frontend/src/i18n/index.js`** - Internationalization setup
- **`frontend/src/main.js`** - PrimeVue initialization, theme setup

## How it works

### Layout Structure

- **Top Bar**: Logo, hamburger menu, user menu, dark mode toggle, language switcher
- **Sidebar**: Navigation drawer with user card and menu items
- **Main Content**: Router view with slot for page content

### Dark Mode

- Detects system preference on first load
- Persists choice in sessionStorage
- Applies `.dark` class to document root
- Integrates with PrimeVue and Chart.js

### Internationalization

- Vue I18n with English and French
- Language preference stored in sessionStorage
- Dynamic language switching

## How to use it

### Using AppLayout

```vue
<template>
  <AppLayout>
    <YourPageContent />
  </AppLayout>
</template>
```

### Dark Mode

```javascript
import { useDarkMode } from '@/composables/useDarkMode'

const { isDark, toggle, setDark } = useDarkMode()

// Toggle dark mode
toggle()

// Set explicitly
setDark(true)
```

### Internationalization

```vue
<template>
  <div>{{ $t('common.welcome') }}</div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()

// Change language
locale.value = 'fr'

// Translate
const message = t('common.welcome')
</script>
```

## Configuration

### PrimeVue Theme

Edit `frontend/src/main.js`:

```javascript
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.dark'
    }
  }
})
```

### Language Files

Edit `frontend/src/i18n/locales/en.json` and `fr.json`:

```json
{
  "common": {
    "welcome": "Welcome"
  }
}
```

## Extending / modifying

### Custom Navigation Items

```javascript
// In AppLayout.vue
const sidebarNavItems = computed(() => {
  return [
    { label: t('nav.dashboard'), icon: 'pi-home', path: '/dashboard' },
    // Add custom items
    { label: 'Custom', icon: 'pi-star', path: '/custom' }
  ]
})
```

### Custom User Menu

```vue
<!-- In AppLayout.vue -->
<div class="user-menu">
  <!-- Custom menu items -->
</div>
```

## Troubleshooting

### Dark mode not working

- **Check class**: Ensure `.dark` class is applied to document root
- **Check CSS**: Ensure Tailwind dark mode is configured
- **Check PrimeVue**: Ensure PrimeVue theme supports dark mode

### Language not switching

- **Check locale**: Ensure `locale.value` is updated
- **Check translations**: Ensure translation keys exist
- **Check storage**: Ensure language is persisted

## Related docs

- [Dark Mode](./dark-mode.md) - Dark mode details
- [Internationalization](./internationalization.md) - i18n details
- [Routing](./routing.md) - Navigation
