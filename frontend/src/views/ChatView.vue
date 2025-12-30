<!-- src/views/ChatView.vue -->
<template>
  <div class="chat-view">
    <!-- Single Chat Mode - Header integrated with Chat component -->
    <div v-if="chatInstances.length === 1" class="single-chat-mode">
      <Chat
        :ref="el => setChatRef(el, 0)"
        :instance-id="chatInstances[0].id"
        :initial-model-id="chatInstances[0].modelId"
        :show-header="true"
        @model-change="(modelId) => chatInstances[0].modelId = modelId"
      >
        <!-- Inject add button into Chat header via slot or we handle it here -->
      </Chat>
      <!-- Floating add button for single chat -->
      <Button
        class="floating-add-btn"
        icon="pi pi-plus"
        rounded
        v-tooltip.left="$t('chat.addChat')"
        @click="addChat"
      />
    </div>

    <!-- Multi-Chat Mode -->
    <template v-else>
      <!-- View Header -->
      <header class="view-header">
        <div class="header-left">
          <h1 class="view-title">{{ $t('chat.title') }}</h1>
          <div class="connection-badge" :class="{ connected: isConnected }">
            <span class="status-dot"></span>
            <span>{{ isConnected ? $t('chat.wsConnected') : $t('chat.wsDisconnected') }}</span>
          </div>
        </div>
        
        <div class="header-actions">
          <!-- Parallel Input -->
          <div class="parallel-input-container">
            <InputText
              v-model="parallelMessage"
              :placeholder="$t('chat.parallelPlaceholder', { count: chatInstances.length })"
              class="parallel-input"
              @keydown.enter="sendToAll"
            />
            <Button
              icon="pi pi-send"
              :label="$t('chat.sendToAll')"
              :disabled="!parallelMessage.trim() || !hasAvailableModel"
              @click="sendToAll"
              size="small"
            />
          </div>

          <!-- Chat Management -->
          <div class="chat-controls">
            <Button
              v-tooltip.bottom="$t('chat.addChat')"
              icon="pi pi-plus"
              severity="secondary"
              text
              @click="addChat"
            />
            <Button
              v-tooltip.bottom="$t('chat.removeChat')"
              icon="pi pi-minus"
              severity="secondary"
              text
              @click="removeChat"
            />
            <span class="chat-count">
              {{ chatInstances.length }} {{ $t('chat.chats') }}
            </span>
          </div>
        </div>
      </header>

      <!-- Chat Grid -->
      <div class="chat-grid" :class="gridClass">
        <div
          v-for="(instance, index) in chatInstances"
          :key="instance.id"
          class="chat-panel"
        >
          <!-- Panel Header -->
          <div class="panel-header">
            <span class="panel-title">Chat {{ index + 1 }}</span>
            <Select
              v-model="instance.modelId"
              :options="groupedModels"
              optionLabel="name"
              optionValue="id"
              optionGroupLabel="label"
              optionGroupChildren="items"
              optionDisabled="disabled"
              :placeholder="$t('chat.selectModel')"
              class="panel-model-select"
              size="small"
            />
            <Button
              v-tooltip.bottom="$t('chat.closeChat')"
              icon="pi pi-times"
              severity="secondary"
              text
              rounded
              size="small"
              @click="removeSpecificChat(index)"
              :disabled="chatInstances.length <= 1"
            />
          </div>
          
          <!-- Chat Component (no header in multi-mode) -->
          <Chat
            :ref="el => setChatRef(el, index)"
            :instance-id="instance.id"
            :initial-model-id="instance.modelId"
            :show-header="false"
            @model-change="(modelId) => instance.modelId = modelId"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLlm } from '@/composables/useLlm'
import { useWebSocket } from '@/composables/useWebSocket'
import Chat from '@/components/Chat.vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'

const { t } = useI18n()
const { models, availableProviders, getModelsByProvider, initialize: initializeLlm } = useLlm()
const { isConnected } = useWebSocket()

// Chat instances - each has its own model selection
const chatInstances = ref([])
const chatRefs = ref([])
const parallelMessage = ref('')

const generateId = () => `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const getDefaultModelId = () => {
  const available = models.value.find(m => m.available)
  return available?.id || models.value[0]?.id || null
}

onMounted(async () => {
  await initializeLlm()
  if (chatInstances.value.length === 0) {
    addChat()
  }
})

watch(models, (newModels) => {
  if (newModels.length > 0 && chatInstances.value.length === 0) {
    addChat()
  }
}, { immediate: true })

const hasAvailableModel = computed(() => models.value.some(m => m.available))

const groupedModels = computed(() => {
  return availableProviders.value.map(provider => ({
    label: provider.charAt(0).toUpperCase() + provider.slice(1),
    items: getModelsByProvider(provider).map(model => ({
      ...model,
      disabled: !model.available
    }))
  })).filter(group => group.items.length > 0)
})

const gridClass = computed(() => {
  const count = chatInstances.value.length
  if (count === 2) return 'grid-2'
  if (count <= 4) return 'grid-4'
  if (count <= 6) return 'grid-6'
  return 'grid-many'
})

const setChatRef = (el, index) => {
  if (el) chatRefs.value[index] = el
}

const addChat = () => {
  chatInstances.value.push({
    id: generateId(),
    modelId: getDefaultModelId(),
  })
}

const removeChat = () => {
  if (chatInstances.value.length > 1) {
    chatInstances.value.pop()
    chatRefs.value.pop()
  }
}

const removeSpecificChat = (index) => {
  if (chatInstances.value.length > 1) {
    chatInstances.value.splice(index, 1)
    chatRefs.value.splice(index, 1)
  }
}

const sendToAll = async () => {
  if (!parallelMessage.value.trim()) return
  
  const message = parallelMessage.value.trim()
  parallelMessage.value = ''
  
  await nextTick()
  chatRefs.value.forEach((chatRef, index) => {
    if (chatRef?.sendExternalMessage) {
      // Use each instance's own model
      const modelId = chatInstances.value[index]?.modelId
      chatRef.sendExternalMessage(message, modelId)
    }
  })
}
</script>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 64px);
  background: var(--p-surface-ground);
}

/* Single Chat Mode */
.single-chat-mode {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.floating-add-btn {
  position: absolute;
  top: 0.75rem;
  right: 1rem;
  z-index: 10;
}

/* View Header (multi-chat) */
.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--p-surface-card);
  border-bottom: 1px solid var(--p-surface-border);
  gap: 1rem;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.view-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: var(--p-text-color);
}

.connection-badge {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 500;
  background: color-mix(in srgb, var(--p-red-500) 15%, transparent);
  color: var(--p-red-600);
}

.connection-badge.connected {
  background: color-mix(in srgb, var(--p-green-500) 15%, transparent);
  color: var(--p-green-600);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.parallel-input-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.parallel-input {
  min-width: 300px;
}

.chat-controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.chat-count {
  font-size: 0.875rem;
  color: var(--p-text-muted-color);
  margin-left: 0.5rem;
}

/* Chat Grid */
.chat-grid {
  flex: 1;
  display: grid;
  gap: 1px;
  background: var(--p-surface-border);
  overflow: hidden;
}

.grid-2 {
  grid-template-columns: repeat(2, 1fr);
}

.grid-4 {
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
}

.grid-6 {
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
}

.grid-many {
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  grid-auto-rows: minmax(300px, 1fr);
}

/* Chat Panel */
.chat-panel {
  display: flex;
  flex-direction: column;
  background: var(--p-surface-card);
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--p-surface-100);
  border-bottom: 1px solid var(--p-surface-border);
  flex-shrink: 0;
}

.panel-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--p-text-color);
}

.panel-model-select {
  flex: 1;
  max-width: 200px;
}

/* Responsive */
@media (max-width: 1200px) {
  .grid-6 {
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(3, 1fr);
  }
}

@media (max-width: 900px) {
  .grid-4,
  .grid-6 {
    grid-template-columns: 1fr;
    grid-auto-rows: minmax(250px, 1fr);
  }
  
  .parallel-input {
    min-width: 200px;
  }
}

@media (max-width: 768px) {
  .view-header {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }
  
  .header-left {
    justify-content: space-between;
  }
  
  .parallel-input-container {
    width: 100%;
  }
  
  .parallel-input {
    flex: 1;
    min-width: 0;
  }
  
  .grid-2 {
    grid-template-columns: 1fr;
  }
}

/* Dark Mode */
:root.dark .connection-badge {
  background: color-mix(in srgb, var(--p-red-400) 15%, transparent);
  color: var(--p-red-400);
}

:root.dark .connection-badge.connected {
  background: color-mix(in srgb, var(--p-green-400) 15%, transparent);
  color: var(--p-green-400);
}

:root.dark .panel-header {
  background: var(--p-surface-800);
  border-color: var(--p-surface-700);
}

:root.dark .panel-title {
  color: var(--p-text-color);
}
</style>