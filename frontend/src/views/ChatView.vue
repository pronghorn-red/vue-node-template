<!-- src/views/ChatView.vue -->
<template>
  <div class="chat-view">
    <!-- Header - always visible in multi-mode, or floating button in single mode -->
    <header v-if="chatInstances.length > 1" class="view-header">
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
            :disabled="!parallelMessage.trim() || !hasAvailableModel || !isConnected"
            @click="sendToAll"
            class="parallel-send-btn"
            v-tooltip.bottom="$t('chat.sendToAll')"
          />
        </div>

        <!-- Chat Management -->
        <div class="chat-controls">
          <Button
            v-tooltip.bottom="$t('chat.downloadAllChats')"
            icon="pi pi-download"
            severity="secondary"
            text
            @click="downloadAllChats"
            :disabled="!hasAnyMessages"
          />
          <Button
            v-tooltip.bottom="$t('chat.clearAllChats')"
            icon="pi pi-trash"
            severity="secondary"
            text
            @click="confirmClearAllChats"
            :disabled="!hasAnyMessages"
          />
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
            @click="removeLastChat"
          />
          <span class="chat-count">
            {{ chatInstances.length }} {{ $t('chat.chats') }}
          </span>
        </div>
      </div>
    </header>

    <!-- Chat Grid - unified for both single and multi mode -->
    <div class="chat-grid" :class="gridClass">
      <div
        v-for="(instance, index) in chatInstances"
        :key="instance.id"
        class="chat-panel"
        :class="{ 'single-panel': chatInstances.length === 1 }"
      >
        <!-- Panel Header (only for multiple chats) -->
        <div v-if="chatInstances.length > 1" class="panel-header">
          <InputText
            v-model="instance.name"
            :placeholder="`Chat ${index + 1}`"
            class="panel-name-input"
            size="small"
          />
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
            v-tooltip.bottom="$t('chat.settings')"
            icon="pi pi-cog"
            severity="secondary"
            text
            rounded
            size="small"
            @click="instance.showSettings = !instance.showSettings"
          />
          <Button
            v-tooltip.bottom="$t('chat.downloadChat')"
            icon="pi pi-download"
            severity="secondary"
            text
            rounded
            size="small"
            :disabled="!instance.messages?.length"
            @click="downloadSingleChat(index)"
          />
          <Button
            v-tooltip.bottom="$t('chat.clearChat')"
            icon="pi pi-trash"
            severity="secondary"
            text
            rounded
            size="small"
            :disabled="!instance.messages?.length"
            @click="clearSingleChat(index)"
          />
          <div class="panel-header-spacer"></div>
          <Checkbox
            v-model="instance.shareHistory"
            :binary="true"
            :inputId="`share-history-${instance.id}`"
          />
          <label :for="`share-history-${instance.id}`" class="share-history-label">{{ $t('chat.sharedHistory') }}</label>
          <Button
            v-tooltip.bottom="$t('chat.closeChat')"
            icon="pi pi-times"
            severity="secondary"
            text
            rounded
            size="small"
            @click="removeSpecificChat(index)"
          />
        </div>

        <!-- Panel Settings (collapsible, only for multiple chats) -->
        <Transition name="slide-down">
          <div v-if="chatInstances.length > 1 && instance.showSettings" class="panel-settings">
            <div class="setting-row setting-row-wide">
              <label>{{ $t('chat.systemPrompt') }}</label>
              <Textarea
                v-model="instance.systemPrompt"
                :placeholder="$t('chat.systemPromptPlaceholder')"
                :autoResize="true"
                rows="2"
                class="panel-system-prompt"
              />
            </div>
            <div class="setting-row">
              <label>{{ $t('chat.temperature') }}: {{ instance.temperature.toFixed(1) }}</label>
              <Slider v-model="instance.temperature" :min="0" :max="1" :step="0.1" class="panel-temperature-slider" />
            </div>
            <div class="setting-row">
              <label>{{ $t('chat.maxTokens') }}</label>
              <Select
                v-model="instance.maxTokens"
                :options="getMaxTokensOptions(instance.modelId)"
                optionLabel="label"
                optionValue="value"
                :placeholder="$t('chat.selectMaxTokens')"
                class="panel-max-tokens-select"
                size="small"
              />
            </div>
          </div>
        </Transition>
        
        <!-- Chat Component -->
        <Chat
          :key="instance.id"
          :ref="el => setChatRef(el, index)"
          :instance-id="instance.id"
          :initial-model-id="instance.modelId"
          :initial-system-prompt="instance.systemPrompt"
          :initial-temperature="instance.temperature"
          :initial-max-tokens="instance.maxTokens"
          :show-header="chatInstances.length === 1"
          :force-websocket="chatInstances.length > 1"
          v-model="instance.messages"
          :get-shared-history="() => getSharedHistoryForChat(index)"
          @model-change="(modelId) => instance.modelId = modelId"
          @settings-change="(settings) => updateInstanceSettings(index, settings)"
          @add-chat="addChat"
        />
      </div>
    </div>

    <!-- Clear All Confirmation Dialog -->
    <Dialog v-model:visible="showClearAllDialog" :header="$t('chat.clearAllChatsConfirmTitle')" :modal="true" class="clear-dialog">
      <p>{{ $t('chat.clearAllChatsConfirmMessage') }}</p>
      <template #footer>
        <Button :label="$t('common.cancel')" severity="secondary" text @click="showClearAllDialog = false" />
        <Button :label="$t('chat.clearAllChats')" severity="danger" @click="clearAllChats" />
      </template>
    </Dialog>
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
import Textarea from 'primevue/textarea'
import Slider from 'primevue/slider'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'

const { t } = useI18n()
const { models, availableProviders, getModelsByProvider, initialize: initializeLlm } = useLlm()
const { isConnected } = useWebSocket()

// Chat instances - each has its own settings
const chatInstances = ref([])
const chatRefs = ref([])
const parallelMessage = ref('')

const generateId = () => `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const getDefaultModelId = () => {
  const available = models.value.find(m => m.available)
  return available?.id || models.value[0]?.id || null
}

const createInstance = (overrides = {}) => ({
  id: generateId(),
  name: '',
  modelId: getDefaultModelId(),
  systemPrompt: '',
  temperature: 0.7,
  maxTokens: null, // null = use model default
  shareHistory: false,
  showSettings: false,
  messages: [], // Messages now managed by parent
  ...overrides
})

// Define addChat early so it can be used in watch with immediate: true
const addChat = () => {
  chatInstances.value.push(createInstance())
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
  if (count === 1) return 'grid-1'
  if (count === 2) return 'grid-2'
  if (count <= 4) return 'grid-4'
  if (count <= 6) return 'grid-6'
  return 'grid-many'
})

// Generate max tokens options for a given model
const getMaxTokensOptions = (modelId) => {
  const model = models.value.find(m => m.id === modelId)
  const modelMax = model?.maxOutputTokens || model?.maxTokens || 8192
  const options = [{ label: t('chat.modelDefault'), value: null }]
  
  // Start at 1024 and double until we exceed modelMax
  let value = 1024
  while (value < modelMax) {
    options.push({ 
      label: value.toLocaleString(), 
      value: value 
    })
    value *= 2
  }
  
  // Always include the model's max as the final option
  options.push({ 
    label: `${modelMax.toLocaleString()} (max)`, 
    value: modelMax 
  })
  
  return options
}

const setChatRef = (el, index) => {
  if (el) chatRefs.value[index] = el
}

const removeLastChat = () => {
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

const updateInstanceSettings = (index, settings) => {
  if (chatInstances.value[index]) {
    Object.assign(chatInstances.value[index], settings)
  }
}

// Computed to check if any chat has messages
const hasAnyMessages = computed(() => {
  return chatInstances.value.some(instance => instance.messages?.length > 0)
})

// Download a single chat's messages
const downloadSingleChat = (index) => {
  const instance = chatInstances.value[index]
  if (!instance?.messages?.length) return
  
  const name = instance.name || `Chat ${index + 1}`
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  
  let content = `# ${name}\n\n`
  content += `Exported: ${new Date().toLocaleString()}\n`
  content += `Model: ${instance.modelId || 'Unknown'}\n\n---\n\n`
  
  instance.messages.forEach((msg, msgIndex) => {
    const role = msg.role === 'user' ? 'You' : 'Assistant'
    content += `## ${role}\n\n${msg.content}\n\n`
    if (msgIndex < instance.messages.length - 1) content += `---\n\n`
  })
  
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name.replace(/\s+/g, '-').toLowerCase()}-${timestamp}.md`
  a.click()
  URL.revokeObjectURL(url)
}

// Clear a single chat's messages
const clearSingleChat = (index) => {
  if (chatInstances.value[index]) {
    chatInstances.value[index].messages = []
  }
}

// Download all chats combined
const downloadAllChats = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  let content = `# All Chat Sessions\n\n`
  content += `Exported: ${new Date().toLocaleString()}\n`
  content += `Total Chats: ${chatInstances.value.length}\n\n`
  
  chatInstances.value.forEach((instance, index) => {
    const name = instance.name || `Chat ${index + 1}`
    
    content += `${'='.repeat(60)}\n`
    content += `# ${name}\n`
    content += `Model: ${instance.modelId || 'Unknown'}\n`
    content += `${'='.repeat(60)}\n\n`
    
    if (instance.messages?.length) {
      instance.messages.forEach((msg, msgIndex) => {
        const role = msg.role === 'user' ? 'You' : 'Assistant'
        content += `## ${role}\n\n${msg.content}\n\n`
        if (msgIndex < instance.messages.length - 1) content += `---\n\n`
      })
    } else {
      content += `*No messages*\n\n`
    }
    
    content += `\n`
  })
  
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `all-chats-${timestamp}.md`
  a.click()
  URL.revokeObjectURL(url)
}

// Show clear all confirmation
const showClearAllDialog = ref(false)

const confirmClearAllChats = () => {
  showClearAllDialog.value = true
}

// Clear all chats
const clearAllChats = () => {
  chatInstances.value.forEach(instance => {
    instance.messages = []
  })
  showClearAllDialog.value = false
}

// Build shared history context from all OTHER chats for the chat at excludeIndex
// Now uses parent-managed messages directly (no need to access child refs)
const buildSharedHistoryContext = (excludeIndex) => {
  const context = []
  
  chatInstances.value.forEach((instance, idx) => {
    // Skip the chat that's requesting the history
    if (idx === excludeIndex) return
    
    // Use instance.messages directly (managed by parent)
    if (!instance.messages?.length) return
    
    const name = instance.name || `Chat ${idx + 1}`
    
    // Filter out streaming messages and map to simple format
    const validMessages = instance.messages
      .filter(m => !m.isStreaming)
      .map(m => ({ role: m.role, content: m.content }))
    
    if (validMessages.length > 0) {
      context.push({
        name,
        messages: validMessages
      })
    }
  })
  
  console.log('[ChatView] buildSharedHistoryContext:', {
    excludeIndex,
    contextLength: context.length,
    context: context.map(c => ({ name: c.name, messageCount: c.messages.length }))
  })
  
  return context
}

// Get shared history for a specific chat - checks if shareHistory is enabled at call time
const getSharedHistoryForChat = (index) => {
  const instance = chatInstances.value[index]
  console.log('[ChatView] getSharedHistoryForChat called:', {
    index,
    instanceId: instance?.id,
    shareHistory: instance?.shareHistory,
  })
  
  if (!instance?.shareHistory) {
    console.log('[ChatView] shareHistory is false, returning null')
    return null
  }
  
  const context = buildSharedHistoryContext(index)
  console.log('[ChatView] Built shared history context:', context)
  return context
}

const sendToAll = async () => {
  if (!parallelMessage.value.trim() || !isConnected.value) return
  
  const message = parallelMessage.value.trim()
  parallelMessage.value = ''
  
  await nextTick()
  
  chatRefs.value.forEach((chatRef, index) => {
    if (!chatRef?.sendExternalMessage) return
    
    const instance = chatInstances.value[index]
    const modelId = instance?.modelId
    
    // Build shared history context if this instance has shareHistory enabled
    let sharedContext = null
    if (instance?.shareHistory) {
      sharedContext = buildSharedHistoryContext(index)
    }
    
    chatRef.sendExternalMessage(message, modelId, sharedContext)
  })
}
</script>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 64px);
  background: var(--p-surface-ground);
  position: relative;
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
  background: var(--p-surface-card);
  border: 2px solid var(--p-surface-300);
  border-radius: 1.5rem;
  padding: 0.375rem 0.375rem 0.375rem 1rem;
}

.parallel-input-container:focus-within {
  border-color: var(--p-primary-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--p-primary-color) 15%, transparent);
}

.parallel-input {
  min-width: 280px;
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  padding: 0.25rem 0 !important;
}

.parallel-input:focus {
  outline: none !important;
  box-shadow: none !important;
}

.parallel-send-btn {
  border-radius: 50% !important;
  width: 2.25rem !important;
  height: 2.25rem !important;
  padding: 0 !important;
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
  overflow: hidden;
}

.chat-grid.grid-1 {
  grid-template-columns: 1fr;
}

.chat-grid.grid-2 {
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  padding: 0.75rem;
}

.chat-grid.grid-4 {
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 0.75rem;
  padding: 0.75rem;
}

.chat-grid.grid-6 {
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  gap: 0.75rem;
  padding: 0.75rem;
}

.chat-grid.grid-many {
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  grid-auto-rows: minmax(300px, 1fr);
  gap: 0.75rem;
  padding: 0.75rem;
}

/* Chat Panel */
.chat-panel {
  display: flex;
  flex-direction: column;
  background: var(--p-surface-card);
  overflow: hidden;
}

.chat-panel:not(.single-panel) {
  border: 2px solid var(--p-surface-300);
  border-radius: 0.75rem;
}

.chat-panel.single-panel {
  /* No border for single chat - it fills the whole space */
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--p-surface-100);
  border-bottom: 1px solid var(--p-surface-border);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.panel-name-input {
  width: 120px;
  font-weight: 600;
}

.panel-model-select {
  min-width: 140px;
  max-width: 180px;
}

.panel-header-spacer {
  flex: 1;
}

.share-history-label {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  cursor: pointer;
  user-select: none;
}

/* Panel Settings */
.panel-settings {
  padding: 0.75rem;
  background: var(--p-surface-50);
  border-bottom: 1px solid var(--p-surface-border);
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.setting-row {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex: 1;
  min-width: 120px;
}

.setting-row-wide {
  flex: 2;
  min-width: 200px;
}

.setting-row label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--p-text-muted-color);
}

.panel-system-prompt {
  font-size: 0.8125rem;
}

.panel-temperature-slider {
  width: 100%;
}

.panel-max-tokens-select {
  width: 100%;
}

/* Transitions */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Responsive */
@media (max-width: 1200px) {
  .chat-grid.grid-6 {
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(3, 1fr);
  }
}

@media (max-width: 900px) {
  .chat-grid.grid-4,
  .chat-grid.grid-6 {
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
  
  .chat-grid.grid-2 {
    grid-template-columns: 1fr;
  }
  
  .panel-header {
    flex-wrap: wrap;
  }
  
  .panel-name-input {
    width: 100px;
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

:root.dark .chat-panel:not(.single-panel) {
  border-color: var(--p-surface-600);
}

:root.dark .panel-header {
  background: var(--p-surface-800);
  border-color: var(--p-surface-700);
}

:root.dark .panel-settings {
  background: var(--p-surface-900);
  border-color: var(--p-surface-700);
}

:root.dark .parallel-input-container {
  border-color: var(--p-surface-500);
}
</style>