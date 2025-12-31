<!-- src/views/HomeView.vue -->
<template>
  <div class="space-y-16">
    <!-- Hero Section -->
    <section class="py-16 text-center animate-fade-in ">
<div class="flex justify-center items-center gap-8 md:gap-12 lg:gap-16">
    <img src="@/assets/vue.svg" alt="Vue logo" class="h-24 w-24 drop-shadow-lg" />
    <img src="@/assets/node.svg" alt="Node.js logo" class="h-32 w-32 drop-shadow-lg" /> <!-- Slightly larger if desired -->
  </div>
      <h1 class="text-5xl sm:text-6xl font-extrabold tracking-tight text-primary mb-4">
        Vue/Node <span class="gradient-text">Template</span>
      </h1>
      <p class="mt-6 text-xl font-light text-secondary max-w-2xl mx-auto">
        The ultimate <span class="font-semibold text-primary">Vue 3 + Vite + Tailwind + PrimeVue</span> starter template for modern web applications
      </p>

      <div class="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
        <Button
          label="View Dashboard"
          icon="pi pi-arrow-right"
          @click="navigateToDashboard"
          class="px-8 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          :aria-label="'View Dashboard'"
        />
        <Button
          label="Documentation"
          icon="pi pi-book"
          severity="secondary"
          @click="openDocumentation"
          class="px-8 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          :aria-label="'Open Documentation'"
        />
      </div>
    </section>

    <!-- Features Grid -->
    <section class="py-12">
      <div class="max-w-7xl mx-auto px-6">
        <h2 class="text-3xl font-bold text-center text-primary mb-16">
          Built for modern development
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard 
            icon="zap" 
            title="Lightning Fast" 
            description="Vite-powered HMR gives you instant feedback during development." 
          />
          <FeatureCard 
            icon="palette" 
            title="Beautiful Design" 
            description="Tailwind CSS + PrimeVue Aura theme for stunning UI out of the box." 
          />
          <FeatureCard 
            icon="beaker" 
            title="Testing Ready" 
            description="Vitest + Vue Test Utils pre-configured for comprehensive testing." 
          />
          <FeatureCard 
            icon="shield-check" 
            title="Best Practices" 
            description="ESLint, Prettier, Husky — code quality enforced automatically." 
          />
        </div>
      </div>
    </section>

    <!-- Tech Stack Section -->
    <section class="py-12 bg-secondary rounded-lg">
      <div class="max-w-7xl mx-auto px-6">
        <h2 class="text-3xl font-bold text-center text-primary mb-12">
          Powered by industry leaders
        </h2>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          <TechItem name="Vue 3" icon="pi-code" />
          <TechItem name="Vite" icon="pi-flash" />
          <TechItem name="Tailwind" icon="pi-palette" />
          <TechItem name="PrimeVue" icon="pi-prime" />
          <TechItem name="Vue Router" icon="pi-sitemap" />
          <TechItem name="TypeScript" icon="pi-code" />
        </div>
      </div>
    </section>

    <!-- Features Highlight -->
    <section class="py-12">
      <div class="max-w-7xl mx-auto px-6">
        <h3 class="text-2xl font-bold text-primary mb-12">
          Key Features
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card class="card-base hover-lift">
            <template #content>
              <div class="flex gap-4">
                <div class="flex-shrink-0">
                  <div class="flex items-center justify-center h-12 w-12 rounded-md bg-blue-100 dark:bg-blue-900">
                    <i class="pi pi-check-circle text-xl text-blue-600 dark:text-blue-400"></i>
                  </div>
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-primary mb-2">Dark Mode Support</h3>
                  <p class="text-secondary">
                    Universal dark/light theme toggle that works seamlessly across all components and persists user preference.
                  </p>
                </div>
              </div>
            </template>
          </Card>

          <Card class="card-base hover-lift">
            <template #content>
              <div class="flex gap-4">
                <div class="flex-shrink-0">
                  <div class="flex items-center justify-center h-12 w-12 rounded-md bg-green-100 dark:bg-green-900">
                    <i class="pi pi-check-circle text-xl text-green-600 dark:text-green-400"></i>
                  </div>
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-primary mb-2">Responsive Design</h3>
                  <p class="text-secondary">
                    Mobile-first approach with floating menu toggle and adaptive layouts for all screen sizes.
                  </p>
                </div>
              </div>
            </template>
          </Card>

          <Card class="card-base hover-lift">
            <template #content>
              <div class="flex gap-4">
                <div class="flex-shrink-0">
                  <div class="flex items-center justify-center h-12 w-12 rounded-md bg-purple-100 dark:bg-purple-900">
                    <i class="pi pi-check-circle text-xl text-purple-600 dark:text-purple-400"></i>
                  </div>
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-primary mb-2">Rich Components</h3>
                  <p class="text-secondary">
                    Comprehensive PrimeVue component library with charts, tables, forms, and more pre-configured.
                  </p>
                </div>
              </div>
            </template>
          </Card>

          <Card class="card-base hover-lift">
            <template #content>
              <div class="flex gap-4">
                <div class="flex-shrink-0">
                  <div class="flex items-center justify-center h-12 w-12 rounded-md bg-orange-100 dark:bg-orange-900">
                    <i class="pi pi-check-circle text-xl text-orange-600 dark:text-orange-400"></i>
                  </div>
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-primary mb-2">Professional Styling</h3>
                  <p class="text-secondary">
                    Sleek, modern design system with consistent spacing, colors, and typography throughout.
                  </p>
                </div>
              </div>
            </template>
          </Card>
        </div>
      </div>
    </section>

    <!-- Call to Action -->
    <section class="py-16 bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-blue-500 dark:to-emerald-500 rounded-lg text-white text-center">
      <h2 class="text-3xl font-bold mb-4">Ready to get started?</h2>
      <p class="text-lg mb-8 opacity-90">
        Explore the comprehensive dashboard and see all the features in action.
      </p>
      <Button
        label="View Dashboard"
        icon="pi pi-arrow-right"
        @click="navigateToDashboard"
        severity="secondary"
        class="px-8 py-3"
      />
    </section>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import FeatureCard from '@/components/FeatureCard.vue'
import TechItem from '@/components/TechItem.vue'
import Card from 'primevue/card'
import Button from 'primevue/button'

const router = useRouter()

const navigateToDashboard = () => {
  router.push('/dashboard')
}

const openDocumentation = () => {
  window.open('https://primevue.org', '_blank')
}
</script>
