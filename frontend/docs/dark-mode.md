# Dark Mode

## What it is

Dark mode support with system preference detection, session persistence, and integration with PrimeVue and Chart.js components.

## Where it lives (code map)

- **`frontend/src/composables/useDarkMode.js`** - Dark mode composable
- **`frontend/src/main.js`** - Dark mode initialization
- **`frontend/src/utils/chartDarkModePlugin.js`** - Chart.js dark mode plugin

## How it works

### Initialization

1. Check `sessionStorage` for saved preference
2. If not saved, detect system preference
3. Apply `.dark` class to document root
4. Listen for system preference changes

### Persistence

- Preference stored in `sessionStorage` (cleared on tab close)
- System preference used if no saved preference
- Updates on toggle or system change

## How to use it

### Basic Usage

```javascript
import { useDarkMode } from '@/composables/useDarkMode'

const { isDark, toggle, setDark } = useDarkMode()

// Toggle
toggle()

// Set explicitly
setDark(true)
setDark(false)

// Check current state
if (isDark.value) {
  console.log('Dark mode is on')
}
```

### In Components

```vue
<template>
  <div :class="{ 'dark': isDark }">
    <button @click="toggle">Toggle Dark Mode</button>
  </div>
</template>

<script setup>
import { useDarkMode } from '@/composables/useDarkMode'

const { isDark, toggle } = useDarkMode()
</script>
```

## Configuration

### Tailwind Dark Mode

Ensure `tailwind.config.js` has:

```javascript
module.exports = {
  darkMode: 'class',  // Use class-based dark mode
  // ...
}
```

### PrimeVue Dark Mode

Configured in `main.js`:

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

## Extending / modifying

### Custom Theme Toggle

```vue
<template>
  <button @click="toggleTheme">
    <i :class="isDark ? 'pi-sun' : 'pi-moon'"></i>
  </button>
</template>
```

### Persist to localStorage

```javascript
// In useDarkMode.js
const applyTheme = (dark) => {
  document.documentElement.classList.toggle('dark', dark)
  localStorage.setItem('dark-mode', dark)  // Instead of sessionStorage
}
```

## Troubleshooting

### Dark mode not applying

- **Check class**: Ensure `.dark` is on `document.documentElement`
- **Check Tailwind**: Ensure `darkMode: 'class'` in config
- **Check CSS**: Ensure dark mode styles are defined

### Chart.js not updating

- **Check plugin**: Ensure `chartDarkModePlugin` is registered
- **Check chart update**: Call `chart.update()` after theme change

## Related docs

- [Layout & UI](./layout-ui.md) - Layout component with dark mode toggle
