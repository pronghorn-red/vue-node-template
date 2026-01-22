# Internationalization

## What it is

Vue I18n integration with English and French language support, language switching, and locale persistence.

## Where it lives (code map)

- **`frontend/src/i18n/index.js`** - i18n configuration
- **`frontend/src/i18n/locales/en.json`** - English translations
- **`frontend/src/i18n/locales/fr.json`** - French translations

## How it works

### Language Detection

1. Check `sessionStorage` for saved language
2. Default to 'en' if not found
3. Persist language choice on change

### Translation System

- Vue I18n with composition API support
- JSON-based translation files
- Fallback to English if translation missing

## How to use it

### Basic Usage

```vue
<template>
  <div>{{ $t('common.welcome') }}</div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()

// Translate
const message = t('common.welcome')

// Change language
locale.value = 'fr'
</script>
```

### In Components

```vue
<template>
  <button>{{ $t('common.submit') }}</button>
</template>
```

### Programmatic Translation

```javascript
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const message = t('common.welcome', { name: 'John' })
```

## Configuration

### Adding Languages

1. Create translation file: `frontend/src/i18n/locales/es.json`
2. Add to `i18n/index.js`:
   ```javascript
   import es from './locales/es.json'
   
   const messages = {
     en,
     fr,
     es
   }
   ```

### Translation Files

Structure in `en.json`:

```json
{
  "common": {
    "welcome": "Welcome",
    "submit": "Submit"
  },
  "nav": {
    "dashboard": "Dashboard",
    "users": "Users"
  }
}
```

## Extending / modifying

### Custom Language Switcher

```vue
<template>
  <select v-model="locale">
    <option value="en">English</option>
    <option value="fr">Français</option>
  </select>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()
</script>
```

### Pluralization

```json
{
  "items": {
    "zero": "No items",
    "one": "One item",
    "other": "{count} items"
  }
}
```

## Troubleshooting

### Translations not showing

- **Check key**: Ensure translation key exists in locale file
- **Check locale**: Ensure correct locale is set
- **Check fallback**: Check browser console for missing key warnings

### Language not persisting

- **Check storage**: Ensure `sessionStorage` is available
- **Check initialization**: Ensure language is set on app startup

## Related docs

- [Layout & UI](./layout-ui.md) - Language switcher in layout
