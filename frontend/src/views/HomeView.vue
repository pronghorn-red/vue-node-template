<!-- src/views/HomeView.vue - v2 -->
<template>
  <div class="space-y-16">
    <!-- Hero Section -->
    <section class="py-16 text-center animate-fade-in ">
<div class="flex justify-center items-center gap-8 md:gap-12 lg:gap-16">
    <img src="@/assets/vue.svg" alt="Vue logo" class="h-24 w-24 drop-shadow-lg" />
    <img src="@/assets/node.svg" alt="Node.js logo" class="h-32 w-32 drop-shadow-lg" /> <!-- Slightly larger if desired -->
  </div>
      <h1 class="text-5xl sm:text-6xl font-extrabold tracking-tight text-primary mb-4">
        Vue/Node <span class="gradient-text">{{ $t('home.title') }}</span>
      </h1>
      <p class="mt-6 text-xl font-light text-secondary max-w-2xl mx-auto">
        {{ $t('home.description') }}
      </p>

      <div class="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
        <Button
          :label="$t('home.viewDashboard')"
          icon="pi pi-arrow-right"
          @click="navigateToDashboard"
          class="px-8 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          :aria-label="$t('home.viewDashboard')"
        />
        <Button
          :label="$t('common.documentation')"
          icon="pi pi-book"
          severity="secondary"
          @click="openDocumentation"
          class="px-8 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          :aria-label="$t('common.documentation')"
        />
      </div>
    </section>

    <!-- Features Grid -->
    <section class="py-12">
      <div class="max-w-7xl mx-auto px-6">
        <h2 class="text-3xl font-bold text-center text-primary mb-16">
          {{ $t('home.builtForModern') }}
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard 
            icon="zap" 
            :title="$t('home.lightningFast')" 
            :description="$t('home.lightningFastDesc')" 
          />
          <FeatureCard 
            icon="palette" 
            :title="$t('home.beautifulDesign')" 
            :description="$t('home.beautifulDesignDesc')" 
          />
          <FeatureCard 
            icon="beaker" 
            :title="$t('home.testingReady')" 
            :description="$t('home.testingReadyDesc')" 
          />
          <FeatureCard 
            icon="shield-check" 
            :title="$t('home.bestPractices')" 
            :description="$t('home.bestPracticesDesc')" 
          />
        </div>
      </div>
    </section>

    <!-- Tech Stack Section -->
    <section class="py-12 bg-secondary rounded-lg">
      <div class="max-w-7xl mx-auto px-6">
        <h2 class="text-3xl font-bold text-center text-primary mb-12">
          {{ $t('home.poweredBy') }}
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
          {{ $t('home.keyFeatures') }}
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
                  <h3 class="text-lg font-semibold text-primary mb-2">{{ $t('home.darkModeSupport') }}</h3>
                  <p class="text-secondary">
                    {{ $t('home.darkModeSupportDesc') }}
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
                  <h3 class="text-lg font-semibold text-primary mb-2">{{ $t('home.responsiveDesign') }}</h3>
                  <p class="text-secondary">
                    {{ $t('home.responsiveDesignDesc') }}
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
                  <h3 class="text-lg font-semibold text-primary mb-2">{{ $t('home.richComponents') }}</h3>
                  <p class="text-secondary">
                    {{ $t('home.richComponentsDesc') }}
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
                  <h3 class="text-lg font-semibold text-primary mb-2">{{ $t('home.professionalStyling') }}</h3>
                  <p class="text-secondary">
                    {{ $t('home.professionalStylingDesc') }}
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
      <h2 class="text-3xl font-bold mb-4">{{ $t('home.readyToGetStarted') }}</h2>
      <p class="text-lg mb-8 opacity-90">
        {{ $t('home.exploreComprehensive') }}
      </p>
      <Button
        :label="$t('home.viewDashboard')"
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
