<!-- src/views/DashboardView.vue - v3 -->
<template>
  <div class="space-y-6">
    <!-- Header Section -->
    <div class="flex flex-col md:flex-row md:items-center md:justify-between animate-fade-in">
      <div>
        <h1 class="text-4xl font-bold text-primary mb-2">{{ $t('dashboard.title') }}</h1>
        <p class="text-secondary">{{ $t('dashboard.welcome') }}</p>
      </div>
      <Button 
        :label="$t('common.refresh')" 
        icon="pi pi-refresh" 
        @click="refreshData"
        class="mt-4 md:mt-0 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
        :aria-label="$t('common.refresh')"
      />
    </div>

    <!-- Stats Cards Row -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-in">
      <Card class="card-base hover-lift focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900" :aria-label="$t('dashboard.totalUsers')" tabindex="0">
        <template #content>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-secondary text-sm mb-1 font-medium">{{ $t('dashboard.totalUsers') }}</p>
              <p class="text-3xl font-bold text-primary">12,543</p>
              <p class="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">↑ 12% {{ $t('dashboard.lastMonth') }}</p>
            </div>
            <div class="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <i class="pi pi-users text-xl text-blue-600 dark:text-blue-400" aria-hidden="true"></i>
            </div>
          </div>
        </template>
      </Card>

      <Card class="card-base hover-lift focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900" :aria-label="$t('dashboard.revenue')" tabindex="0">
        <template #content>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-secondary text-sm mb-1 font-medium">{{ $t('dashboard.revenue') }}</p>
              <p class="text-3xl font-bold text-primary">$45,231</p>
              <p class="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">↑ 8% {{ $t('dashboard.lastMonth') }}</p>
            </div>
            <div class="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <i class="pi pi-dollar text-xl text-green-600 dark:text-green-400" aria-hidden="true"></i>
            </div>
          </div>
        </template>
      </Card>

      <Card class="card-base hover-lift focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900" :aria-label="$t('dashboard.orders')" tabindex="0">
        <template #content>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-secondary text-sm mb-1 font-medium">{{ $t('dashboard.orders') }}</p>
              <p class="text-3xl font-bold text-primary">1,234</p>
              <p class="text-xs text-red-600 dark:text-red-400 mt-2 font-medium">↓ 3% {{ $t('dashboard.lastMonth') }}</p>
            </div>
            <div class="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
              <i class="pi pi-shopping-cart text-xl text-purple-600 dark:text-purple-400" aria-hidden="true"></i>
            </div>
          </div>
        </template>
      </Card>

      <Card class="card-base hover-lift focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900" :aria-label="$t('dashboard.conversion')" tabindex="0">
        <template #content>
          <div class="flex items-center justify-between">
            <div>
              <p class="text-secondary text-sm mb-1 font-medium">{{ $t('dashboard.conversion') }}</p>
              <p class="text-3xl font-bold text-primary">3.24%</p>
              <p class="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">↑ 0.5% {{ $t('dashboard.lastMonth') }}</p>
            </div>
            <div class="w-12 h-12 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
              <i class="pi pi-chart-line text-xl text-orange-600 dark:text-orange-400" aria-hidden="true"></i>
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- Charts Section -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Line Chart -->
      <Card class="card-base">
        <template #header>
          <div class="p-4 border-b border-primary">
            <h2 class="text-lg font-semibold text-primary">{{ $t('dashboard.revenueTrend') }}</h2>
          </div>
        </template>
        <template #content>
          <div class="chart-container">
            <Chart 
              v-if="chartDataReady" 
              :key="'line-' + chartKey" 
              type="line" 
              :data="chartData" 
              :options="lineChartOptions" 
              :aria-label="$t('accessibility.chart')" 
            />
          </div>
        </template>
      </Card>

      <!-- Doughnut Chart -->
      <Card class="card-base">
        <template #header>
          <div class="p-4 border-b border-primary">
            <h2 class="text-lg font-semibold text-primary">{{ $t('dashboard.salesDistribution') }}</h2>
          </div>
        </template>
        <template #content>
          <div class="chart-container">
            <Chart 
              v-if="chartDataReady" 
              :key="'doughnut-' + chartKey" 
              type="doughnut" 
              :data="pieChartData" 
              :options="doughnutChartOptions" 
              :aria-label="$t('accessibility.chart')" 
            />
          </div>
        </template>
      </Card>
    </div>

    <!-- Data Table Section -->
    <Card class="card-base">
      <template #header>
        <div class="p-4 border-b border-primary flex items-center justify-between">
          <h2 class="text-lg font-semibold text-primary">{{ $t('dashboard.recentTransactions') }}</h2>
          <Button 
            icon="pi pi-download" 
            text 
            rounded
            @click="exportCSV"
            :aria-label="$t('dashboard.exportCSV')"
            v-tooltip="$t('dashboard.exportCSV')"
            class="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          />
        </div>
      </template>
      <template #content>
        <DataTable 
          :value="transactions" 
          :paginator="true" 
          :rows="5"
          :rowsPerPageOptions="[5, 10, 20]"
          responsiveLayout="scroll"
          class="p-datatable-sm"
          :aria-label="$t('accessibility.table')"
          :pt="{
            root: { class: 'bg-transparent' },
            header: { class: 'bg-slate-100 dark:bg-slate-700' },
            row: { class: 'hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors' }
          }"
        >
          <Column field="id" :header="$t('dashboard.id')" :sortable="true" style="width: 80px"></Column>
          <Column field="customer" :header="$t('dashboard.customer')" :sortable="true"></Column>
          <Column field="amount" :header="$t('dashboard.amount')" :sortable="true">
            <template #body="{ data }">
              <span class="font-semibold text-green-600 dark:text-green-400">${{ data.amount }}</span>
            </template>
          </Column>
          <Column field="status" :header="$t('dashboard.status')" :sortable="true">
            <template #body="{ data }">
              <Tag 
                :value="$t(`dashboard.${data.status.toLowerCase()}`) || data.status" 
                :severity="getStatusSeverity(data.status)"
                :pt="{ root: { class: 'text-xs' } }"
              />
            </template>
          </Column>
          <Column field="date" :header="$t('dashboard.date')" :sortable="true"></Column>
          <Column :header="$t('dashboard.actions')" style="width: 100px">
            <template #body="{ data }">
              <Button 
                icon="pi pi-eye" 
                text 
                rounded 
                size="small"
                @click="viewTransaction(data)"
                :aria-label="$t('common.view')"
                v-tooltip="$t('common.view')"
                class="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              />
              <Button 
                icon="pi pi-trash" 
                text 
                rounded 
                size="small"
                severity="danger"
                @click="deleteTransaction(data)"
                :aria-label="$t('common.delete')"
                v-tooltip="$t('common.delete')"
                class="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <!-- Accordion Section (New Structure) -->
    <Card class="card-base">
      <template #header>
        <div class="p-4 border-b border-primary">
          <h2 class="text-lg font-semibold text-primary">{{ $t('dashboard.faqDocumentation') }}</h2>
        </div>
      </template>
      <template #content>
        <Accordion :value="activeAccordion" @update:value="activeAccordion = $event">
          <AccordionPanel :header="$t('dashboard.faqGetStarted')" value="0">
            <p class="text-secondary">
              {{ $t('dashboard.faqGetStartedDesc') }}
            </p>
          </AccordionPanel>
          <AccordionPanel :header="$t('dashboard.faqFeatures')" value="1">
            <p class="text-secondary">
              {{ $t('dashboard.faqFeaturesDesc') }}
            </p>
          </AccordionPanel>
          <AccordionPanel :header="$t('dashboard.faqCustomize')" value="2">
            <p class="text-secondary">
              {{ $t('dashboard.faqCustomizeDesc') }}
            </p>
          </AccordionPanel>
          <AccordionPanel :header="$t('dashboard.faqAPI')" value="3">
            <p class="text-secondary">
              {{ $t('dashboard.faqAPIDesc') }}
            </p>
          </AccordionPanel>
        </Accordion>
      </template>
    </Card>

    <!-- Tabs Section (New Structure) -->
    <Card class="card-base">
      <template #header>
        <div class="p-4 border-b border-primary">
          <h2 class="text-lg font-semibold text-primary">{{ $t('dashboard.additionalResources') }}</h2>
        </div>
      </template>
      <template #content>
        <Tabs :value="activeTab" @update:value="activeTab = $event">
          <TabPanel :header="$t('dashboard.overview')" value="0">
            <div class="space-y-4">
              <p class="text-secondary">
                {{ $t('dashboard.welcome') }}
              </p>
              <Button :label="$t('common.next')" icon="pi pi-arrow-right" class="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900" />
            </div>
          </TabPanel>
          <TabPanel :header="$t('dashboard.analytics')" value="1">
            <div class="space-y-4">
              <p class="text-secondary">
                {{ $t('dashboard.recentActivity') }}
              </p>
              <Button :label="$t('common.next')" icon="pi pi-arrow-right" class="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900" />
            </div>
          </TabPanel>
          <TabPanel :header="$t('common.settings')" value="2">
            <div class="space-y-4">
              <p class="text-secondary">
                {{ $t('common.settings') }}
              </p>
              <Button :label="$t('common.next')" icon="pi pi-arrow-right" class="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900" />
            </div>
          </TabPanel>
        </Tabs>
      </template>
    </Card>

    <!-- Buttons & Actions Section -->
    <Card class="card-base">
      <template #header>
        <div class="p-4 border-b border-primary">
          <h2 class="text-lg font-semibold text-primary">{{ $t('dashboard.quickActions') }}</h2>
        </div>
      </template>
      <template #content>
        <div class="flex flex-wrap gap-3">
          <Button 
            :label="$t('dashboard.createNew')" 
            icon="pi pi-plus" 
            class="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          />
          <Button 
            :label="$t('common.download')" 
            icon="pi pi-download" 
            severity="info"
            class="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          />
          <Button 
            :label="$t('dashboard.generateReport')" 
            icon="pi pi-file-pdf" 
            severity="success"
            class="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          />
          <Button 
            :label="$t('dashboard.sendNotification')" 
            icon="pi pi-bell" 
            severity="warning"
            class="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          />
          <Button 
            :label="$t('dashboard.deleteAll')" 
            icon="pi pi-trash" 
            severity="danger" 
            text
            class="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          />
        </div>
      </template>
    </Card>

    <!-- Messages Section -->
    <Card class="card-base">
      <template #header>
        <div class="p-4 border-b border-primary">
          <h2 class="text-lg font-semibold text-primary">{{ $t('dashboard.systemMessages') }}</h2>
        </div>
      </template>
      <template #content>
        <div class="space-y-3">
          <Message severity="info" :text="$t('dashboard.welcome')" />
          <Message severity="success" text="All systems operational" />
          <Message severity="warning" text="Please update your profile" />
        </div>
      </template>
    </Card>

    <!-- Progress Section -->
    <Card class="card-base">
      <template #header>
        <div class="p-4 border-b border-primary">
          <h2 class="text-lg font-semibold text-primary">{{ $t('dashboard.projectProgress') }}</h2>
        </div>
      </template>
      <template #content>
        <div class="space-y-4">
          <div>
            <div class="flex justify-between mb-2">
              <span class="text-secondary font-medium">{{ $t('dashboard.development') }}</span>
              <span class="text-primary font-semibold">75%</span>
            </div>
            <ProgressBar :value="75" />
          </div>
          <div>
            <div class="flex justify-between mb-2">
              <span class="text-secondary font-medium">{{ $t('dashboard.testing') }}</span>
              <span class="text-primary font-semibold">60%</span>
            </div>
            <ProgressBar :value="60" />
          </div>
          <div>
            <div class="flex justify-between mb-2">
              <span class="text-secondary font-medium">{{ $t('dashboard.deployment') }}</span>
              <span class="text-primary font-semibold">40%</span>
            </div>
            <ProgressBar :value="40" />
          </div>
        </div>
      </template>
    </Card>

    <!-- Rating Section -->
    <Card class="card-base">
      <template #header>
        <div class="p-4 border-b border-primary">
          <h2 class="text-lg font-semibold text-primary">{{ $t('dashboard.userSatisfaction') }}</h2>
        </div>
      </template>
      <template #content>
        <div class="flex items-center gap-4">
          <div>
            <p class="text-secondary mb-3">{{ $t('dashboard.averageRating') }}</p>
            <Rating v-model="userRating" :cancel="false" />
          </div>
          <div>
            <p class="text-3xl font-bold text-primary">{{ userRating }}.0</p>
            <p class="text-secondary text-sm">{{ $t('dashboard.basedOn') }} 1,234 {{ $t('dashboard.reviews') }}</p>
          </div>
        </div>
      </template>
    </Card>

    <!-- Timeline Section -->
    <Card class="card-base">
      <template #header>
        <div class="p-4 border-b border-primary">
          <h2 class="text-lg font-semibold text-primary">{{ $t('dashboard.recentActivity') }}</h2>
        </div>
      </template>
      <template #content>
        <Timeline :value="timelineEvents" align="left" layout="vertical">
          <template #content="slotProps">
            <p class="text-secondary">{{ slotProps.item.status }}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ slotProps.item.date }}</p>
          </template>
        </Timeline>
      </template>
    </Card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import Card from 'primevue/card'
import Button from 'primevue/button'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Chart from 'primevue/chart'
import Accordion from 'primevue/accordion'
import AccordionPanel from 'primevue/accordionpanel'
import Tabs from 'primevue/tabs'
import TabPanel from 'primevue/tabpanel'
import Message from 'primevue/message'
import ProgressBar from 'primevue/progressbar'
import Rating from 'primevue/rating'
import Timeline from 'primevue/timeline'
import Divider from 'primevue/divider'
import { useToast } from 'primevue/usetoast'
import { useI18n } from 'vue-i18n'

const toast = useToast()
const { t } = useI18n()
const activeAccordion = ref('0')
const activeTab = ref('0')
const userRating = ref(4)
const chartKey = ref(0)
const isDarkMode = ref(document.documentElement.classList.contains('dark'))
const chartDataReady = ref(false)

let observer = null

// Chart Data
const chartData = ref({
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  datasets: [
    {
      label: 'Revenue',
      data: [12000, 19000, 3000, 5000, 2000, 3000],
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      tension: 0.4,
      fill: true,
      pointBackgroundColor: '#3b82f6',
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6
    }
  ]
})

const pieChartData = ref({
  labels: ['Product A', 'Product B', 'Product C', 'Product D'],
  datasets: [
    {
      data: [300, 150, 100, 50],
      backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'],
      borderColor: ['#1e40af', '#047857', '#d97706', '#b91c1c'],
      borderWidth: 2
    }
  ]
})

// Line chart options with proper scaling
const lineChartOptions = computed(() => {
  const textColor = isDarkMode.value ? '#e2e8f0' : '#334155'
  const gridColor = isDarkMode.value ? 'rgba(148, 163, 184, 0.15)' : 'rgba(148, 163, 184, 0.3)'
  
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: textColor,
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: isDarkMode.value ? '#1e293b' : '#ffffff',
        titleColor: textColor,
        bodyColor: textColor,
        borderColor: isDarkMode.value ? '#475569' : '#e2e8f0',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8
      }
    },
    scales: {
      x: {
        display: true,
        grid: {
          display: true,
          color: gridColor,
          drawBorder: false
        },
        ticks: {
          color: textColor,
          font: {
            size: 11
          }
        }
      },
      y: {
        display: true,
        beginAtZero: true,
        grid: {
          display: true,
          color: gridColor,
          drawBorder: false
        },
        ticks: {
          color: textColor,
          font: {
            size: 11
          },
          callback: function(value) {
            return '$' + value.toLocaleString()
          }
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    },
    elements: {
      line: {
        borderWidth: 3
      },
      point: {
        hitRadius: 10,
        hoverRadius: 8
      }
    }
  }
})

// Doughnut chart options with proper scaling
const doughnutChartOptions = computed(() => {
  const textColor = isDarkMode.value ? '#e2e8f0' : '#334155'
  
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'right',
        labels: {
          color: textColor,
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        backgroundColor: isDarkMode.value ? '#1e293b' : '#ffffff',
        titleColor: textColor,
        bodyColor: textColor,
        borderColor: isDarkMode.value ? '#475569' : '#e2e8f0',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: function(context) {
            const total = context.dataset.data.reduce((a, b) => a + b, 0)
            const percentage = ((context.parsed / total) * 100).toFixed(1)
            return `${context.label}: ${context.parsed} (${percentage}%)`
          }
        }
      }
    },
    cutout: '60%',
    radius: '90%'
  }
})

// Sample Data
const transactions = ref([
  { id: '#1001', customer: 'John Doe', amount: '1,250', status: 'Completed', date: '2024-12-10' },
  { id: '#1002', customer: 'Jane Smith', amount: '2,100', status: 'Pending', date: '2024-12-11' },
  { id: '#1003', customer: 'Bob Johnson', amount: '850', status: 'Completed', date: '2024-12-09' },
  { id: '#1004', customer: 'Alice Brown', amount: '3,500', status: 'Failed', date: '2024-12-08' },
  { id: '#1005', customer: 'Charlie Wilson', amount: '1,900', status: 'Completed', date: '2024-12-07' }
])

const timelineEvents = ref([
  { status: 'New user registered', date: '2 hours ago' },
  { status: 'Payment processed', date: '4 hours ago' },
  { status: 'Report generated', date: '1 day ago' },
  { status: 'System update completed', date: '2 days ago' },
  { status: 'Database backup created', date: '3 days ago' }
])

// Methods
const refreshData = () => {
  toast.add({ severity: 'info', summary: t('common.info'), detail: 'Dashboard data is being refreshed...', life: 3000 })
}

const exportCSV = () => {
  toast.add({ severity: 'success', summary: t('common.success'), detail: 'Data has been exported as CSV', life: 3000 })
}

const viewTransaction = (data) => {
  toast.add({ severity: 'info', summary: t('common.view'), detail: `Viewing transaction ${data.id}`, life: 3000 })
}

const deleteTransaction = (data) => {
  toast.add({ severity: 'warn', summary: t('common.delete'), detail: `Transaction ${data.id} deleted`, life: 3000 })
}

const getStatusSeverity = (status) => {
  switch (status) {
    case 'Completed':
      return 'success'
    case 'Pending':
      return 'warning'
    case 'Failed':
      return 'danger'
    default:
      return 'info'
  }
}

// Watch for dark mode changes and recreate charts
onMounted(() => {
  // Initialize dark mode state
  isDarkMode.value = document.documentElement.classList.contains('dark')
  
  // Ensure DOM is ready before rendering charts
  nextTick(() => {
    chartDataReady.value = true
    chartKey.value++
  })
  
  observer = new MutationObserver(() => {
    // Update dark mode state and force chart re-render
    isDarkMode.value = document.documentElement.classList.contains('dark')
    chartDataReady.value = false
    chartKey.value++
    
    // Re-render charts after DOM update
    nextTick(() => {
      chartDataReady.value = true
    })
  })
  
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })
})

onUnmounted(() => {
  if (observer) {
    observer.disconnect()
  }
})
</script>

<style scoped>
/* Chart container with fixed height for proper scaling */
.chart-container {
  position: relative;
  height: 300px;
  width: 100%;
}

/* Ensure PrimeVue Chart component fills container */
:deep(.p-chart) {
  width: 100% !important;
  height: 100% !important;
}

:deep(.p-chart canvas) {
  width: 100% !important;
  height: 100% !important;
}

/* DataTable styling */
:deep(.p-datatable) {
  background: transparent;
}

:deep(.p-datatable .p-datatable-thead > tr > th) {
  background-color: #f2f2f2 !important;
  color: #333333 !important;
}

html.dark :deep(.p-datatable .p-datatable-thead > tr > th) {
  background-color: #334155 !important;
  color: #f1f5f9 !important;
}
</style>