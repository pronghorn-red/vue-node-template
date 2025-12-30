<!-- src/views/AboutView.vue -->
<template>
  <div class="space-y-16">
    <!-- Hero Section -->
    <section class="py-16 text-center animate-fade-in">
      <div class="inline-flex items-center justify-center w-24 h-24 rounded-full bg-blue-100 dark:bg-blue-900 mb-8">
        <i class="pi pi-bolt text-4xl text-blue-600 dark:text-blue-400"></i>
      </div>

      <h1 class="text-5xl sm:text-6xl font-extrabold tracking-tight text-primary mb-4">
        {{ $t('about.title') }}
      </h1>

      <p class="mt-8 text-xl text-secondary max-w-3xl mx-auto leading-relaxed">
        {{ $t('about.subtitle') }}
      </p>
    </section>

    <!-- Mission / Philosophy -->
    <section class="py-12">
      <div class="grid lg:grid-cols-3 gap-8">
        <Card class="card-base text-center hover-lift focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900" tabindex="0">
          <template #content>
            <div class="text-5xl font-bold gradient-text mb-4">0%</div>
            <h3 class="text-2xl font-semibold text-primary mb-3">{{ $t('about.bloat') }}</h3>
            <p class="text-secondary">{{ $t('about.bloatDesc') }}</p>
          </template>
        </Card>

        <Card class="card-base text-center hover-lift focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900" tabindex="0">
          <template #content>
            <div class="text-5xl font-bold gradient-text mb-4">100%</div>
            <h3 class="text-2xl font-semibold text-primary mb-3">{{ $t('about.modern') }}</h3>
            <p class="text-secondary">{{ $t('about.modernDesc') }}</p>
          </template>
        </Card>

        <Card class="card-base text-center hover-lift focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900" tabindex="0">
          <template #content>
            <div class="text-5xl font-bold gradient-text mb-4">∞</div>
            <h3 class="text-2xl font-semibold text-primary mb-3">{{ $t('about.scalable') }}</h3>
            <p class="text-secondary">{{ $t('about.scalableDesc') }}</p>
          </template>
        </Card>
      </div>
    </section>

    <!-- Tech Stack -->
    <section class="py-12">
      <h2 class="text-4xl font-bold text-center text-primary mb-12">
        {{ $t('about.builtWithBest') }}
      </h2>

      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        <TechItem name="Vue 3" version="3.4+" icon="pi-code" />
        <TechItem name="Vite" version="5.x" icon="pi-flash" />
        <TechItem name="Tailwind CSS" version="3.4" icon="pi-palette" />
        <TechItem name="Vue Router" version="4.x" icon="pi-sitemap" />
        <TechItem name="ESLint + Prettier" icon="pi-code" />
        <TechItem name="Husky Hooks" icon="pi-code" />
        <TechItem name="Vitest" icon="pi-code" />
        <TechItem name="PrimeVue" version="4.5+" icon="pi-prime" />
      </div>
    </section>

    <!-- Features -->
    <section class="py-12 bg-secondary rounded-lg px-8">
      <h2 class="text-3xl font-bold text-primary mb-8">{{ $t('home.keyFeatures') }}</h2>
      <div class="grid md:grid-cols-2 gap-6">
        <div class="flex gap-4">
          <div class="flex-shrink-0">
            <div class="flex items-center justify-center h-10 w-10 rounded-md bg-green-100 dark:bg-green-900">
              <i class="pi pi-check-circle text-lg text-green-600 dark:text-green-400"></i>
            </div>
          </div>
          <div>
            <h3 class="font-semibold text-primary mb-2">{{ $t('about.universalDarkMode') }}</h3>
            <p class="text-secondary">{{ $t('about.universalDarkModeDesc') }}</p>
          </div>
        </div>
        <div class="flex gap-4">
          <div class="flex-shrink-0">
            <div class="flex items-center justify-center h-10 w-10 rounded-md bg-green-100 dark:bg-green-900">
              <i class="pi pi-check-circle text-lg text-green-600 dark:text-green-400"></i>
            </div>
          </div>
          <div>
            <h3 class="font-semibold text-primary mb-2">{{ $t('about.responsiveDesign') }}</h3>
            <p class="text-secondary">{{ $t('about.responsiveDesignDesc') }}</p>
          </div>
        </div>
        <div class="flex gap-4">
          <div class="flex-shrink-0">
            <div class="flex items-center justify-center h-10 w-10 rounded-md bg-green-100 dark:bg-green-900">
              <i class="pi pi-check-circle text-lg text-green-600 dark:text-green-400"></i>
            </div>
          </div>
          <div>
            <h3 class="font-semibold text-primary mb-2">{{ $t('about.richComponents') }}</h3>
            <p class="text-secondary">{{ $t('about.richComponentsDesc') }}</p>
          </div>
        </div>
        <div class="flex gap-4">
          <div class="flex-shrink-0">
            <div class="flex items-center justify-center h-10 w-10 rounded-md bg-green-100 dark:bg-green-900">
              <i class="pi pi-check-circle text-lg text-green-600 dark:text-green-400"></i>
            </div>
          </div>
          <div>
            <h3 class="font-semibold text-primary mb-2">{{ $t('about.professionalStyling') }}</h3>
            <p class="text-secondary">{{ $t('about.professionalStylingDesc') }}</p>
          </div>
        </div>
        <div class="flex gap-4">
          <div class="flex-shrink-0">
            <div class="flex items-center justify-center h-10 w-10 rounded-md bg-green-100 dark:bg-green-900">
              <i class="pi pi-check-circle text-lg text-green-600 dark:text-green-400"></i>
            </div>
          </div>
          <div>
            <h3 class="font-semibold text-primary mb-2">{{ $t('about.accessibility') }}</h3>
            <p class="text-secondary">{{ $t('about.accessibilityDesc') }}</p>
          </div>
        </div>
        <div class="flex gap-4">
          <div class="flex-shrink-0">
            <div class="flex items-center justify-center h-10 w-10 rounded-md bg-green-100 dark:bg-green-900">
              <i class="pi pi-check-circle text-lg text-green-600 dark:text-green-400"></i>
            </div>
          </div>
          <div>
            <h3 class="font-semibold text-primary mb-2">{{ $t('about.i18n') }}</h3>
            <p class="text-secondary">{{ $t('about.i18nDesc') }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Divider -->
    <Divider />

    <!-- Final CTA -->
    <section class="py-12 bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-500 dark:to-emerald-500 rounded-lg text-white text-center px-8">
      <h2 class="text-4xl font-bold mb-4">
        {{ $t('about.readyToBuild') }}
      </h2>
      <p class="text-lg mb-8 opacity-90">
        {{ $t('about.forkPronghorn') }}
      </p>
      <Button
        :label="$t('about.starOnGithub')"
        icon="pi pi-github"
        @click="openGitHub"
        severity="secondary"
        class="px-8 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
      />
    </section>
  </div>
</template>

<script setup>
import TechItem from '@/components/TechItem.vue'
import Card from 'primevue/card'
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const openGitHub = () => {
  window.open('https://github.com/pronghorn-red', '_blank')
}
</script>

<style scoped>
:deep(.p-card) {
  @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900;
}
</style>
