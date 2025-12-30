<!-- src/views/DashboardView.vue -->
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
          <Chart :key="chartKey" type="line" :data="chartData" :options="chartOptions" :aria-label="$t('accessibility.chart')" />
        </template>
      </Card>

      <!-- Pie Chart -->
      <Card class="card-base">
        <template #header>
          <div class="p-4 border-b border-primary">
            <h2 class="text-lg font-semibold text-primary">{{ $t('dashboard.salesDistribution') }}</h2>
          </div>
        </template>
        <template #content>
          <Chart :key="chartKey" type="doughnut" :data="pieChartData" :options="chartOptions" :aria-label="$t('accessibility.chart')" />
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
          <AccordionPanel header="How do I get started?" value="0">
            <p class="text-secondary">
              To get started, navigate to the documentation section and follow the setup guide. 
              Our team is here to help if you need any assistance.
            </p>
          </AccordionPanel>
          <AccordionPanel header="What features are included?" value="1">
            <p class="text-secondary">
              This dashboard includes real-time analytics, data visualization, transaction management, 
              and comprehensive reporting tools to help you manage your business efficiently.
            </p>
          </AccordionPanel>
          <AccordionPanel header="How can I customize the dashboard?" value="2">
            <p class="text-secondary">
              You can customize the dashboard by modifying the components, adding new widgets, 
              and adjusting the layout to match your specific needs.
            </p>
          </AccordionPanel>
          <AccordionPanel header="Is there API documentation?" value="3">
            <p class="text-secondary">
              Yes, comprehensive API documentation is available in our developer portal. 
              You can access it through the main menu under "Documentation".
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
          <TabPanel header="Overview" value="0">
            <div class="space-y-4">
              <p class="text-secondary">
                This is your main dashboard overview. Here you can see all your key metrics and performance indicators.
              </p>
              <Button :label="$t('common.next')" icon="pi pi-arrow-right" class="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900" />
            </div>
          </TabPanel>
          <TabPanel header="Analytics" value="1">
            <div class="space-y-4">
              <p class="text-secondary">
                Detailed analytics and insights about your business performance and user behavior.
              </p>
              <Button :label="$t('common.next')" icon="pi pi-arrow-right" class="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900" />
            </div>
          </TabPanel>
          <TabPanel header="Settings" value="2">
            <div class="space-y-4">
              <p class="text-secondary">
                Configure your dashboard preferences, notifications, and other settings.
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

    <!-- Message Section -->
    <Card class="card-base">
      <template #header>
        <div class="p-4 border-b border-primary">
          <h2 class="text-lg font-semibold text-primary">{{ $t('dashboard.systemMessages') }}</h2>
        </div>
      </template>
      <template #content>
        <div class="space-y-3">
          <Message severity="info" text="New features are available. Check the documentation for details." />
          <Message severity="success" text="Your data has been successfully synced." />
          <Message severity="warning" text="Please update your profile information." />
          <Message severity="error" text="An error occurred. Please try again later." />
        </div>
      </template>
    </Card>

    <!-- Progress & Rating Section -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card class="card-base">
        <template #header>
          <div class="p-4 border-b border-primary">
            <h3 class="text-lg font-semibold text-primary">{{ $t('dashboard.projectProgress') }}</h3>
          </div>
        </template>
        <template #content>
          <div class="space-y-4">
            <div>
              <div class="flex justify-between mb-2">
                <label class="text-secondary text-sm font-medium">{{ $t('dashboard.development') }}</label>
                <span class="text-primary font-semibold text-sm">75%</span>
              </div>
              <ProgressBar :value="75" aria-label="Development progress" />
            </div>
            <div>
              <div class="flex justify-between mb-2">
                <label class="text-secondary text-sm font-medium">{{ $t('dashboard.testing') }}</label>
                <span class="text-primary font-semibold text-sm">50%</span>
              </div>
              <ProgressBar :value="50" aria-label="Testing progress" />
            </div>
            <div>
              <div class="flex justify-between mb-2">
                <label class="text-secondary text-sm font-medium">{{ $t('dashboard.deployment') }}</label>
                <span class="text-primary font-semibold text-sm">90%</span>
              </div>
              <ProgressBar :value="90" aria-label="Deployment progress" />
            </div>
          </div>
        </template>
      </Card>

      <Card class="card-base">
        <template #header>
          <div class="p-4 border-b border-primary">
            <h3 class="text-lg font-semibold text-primary">{{ $t('dashboard.userSatisfaction') }}</h3>
          </div>
        </template>
        <template #content>
          <div class="flex flex-col items-center justify-center py-6">
            <fieldset class="flex flex-col items-center">
              <legend class="sr-only">{{ $t('dashboard.userSatisfaction') }}</legend>
              <Rating v-model="userRating" :cancel="false" class="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900" aria-label="User satisfaction rating" />
            </fieldset>
            <p class="text-secondary text-sm mt-4 font-medium">{{ $t('dashboard.averageRating') }}: 4.5/5</p>
            <p class="text-xs text-secondary mt-2">{{ $t('dashboard.basedOn') }} 1,234 {{ $t('dashboard.reviews') }}</p>
          </div>
        </template>
      </Card>
    </div>

    <!-- Timeline Section -->
    <Card class="card-base">
      <template #header>
        <div class="p-4 border-b border-primary">
          <h3 class="text-lg font-semibold text-primary">{{ $t('dashboard.recentActivity') }}</h3>
        </div>
      </template>
      <template #content>
        <Timeline :value="timelineEvents" align="left" layout="vertical">
          <template #content="slotProps">
            <div class="flex flex-col gap-2">
              <p class="font-semibold text-primary">{{ slotProps.item.status }}</p>
              <p class="text-secondary text-sm">{{ slotProps.item.date }}</p>
            </div>
          </template>
        </Timeline>
      </template>
    </Card>

    <!-- Divider -->
    <Divider />

    <!-- Footer Info -->
    <div class="text-center py-6">
      <p class="text-secondary text-sm">
        {{ $t('dashboard.poweredBy') }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
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
import { getChartOptions } from '@/utils/chartDarkModePlugin'

const toast = useToast()
const { t } = useI18n()
const activeAccordion = ref('0')
const activeTab = ref('0')
const userRating = ref(4)
const chartKey = ref(0) // Force chart re-render on theme toggle
const isDarkMode = ref(document.documentElement.classList.contains('dark'))

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
      borderColor: ['#1e40af', '#047857', '#d97706', '#b91c1c']
    }
  ]
})

// Computed chart options that respond to dark mode
const chartOptions = computed(() => {
  return getChartOptions(isDarkMode.value)
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
  
  // Force initial chart render
  chartKey.value++
  
  const observer = new MutationObserver(() => {
    // Update dark mode state and force chart re-render
    isDarkMode.value = document.documentElement.classList.contains('dark')
    chartKey.value++
  })
  
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })
})
</script>

<style scoped>
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
