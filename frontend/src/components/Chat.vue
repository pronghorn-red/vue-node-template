<!-- src/views/Chat.vue -->
<template>
  <div class="chat-container">
    <!-- Compact Header -->
    <header class="chat-header">
      <div class="header-left">
        <h1 class="chat-title">{{ $t('chat.title') }}</h1>
        <div class="connection-status" :class="{ connected: isConnected }">
          <span class="status-dot"></span>
          <span class="status-text">{{ isConnected ? $t('chat.wsConnected') : $t('chat.wsDisconnected') }}</span>
        </div>
      </div>
      
      <div class="header-controls">
        <!-- Model Selector -->
        <div class="control-group">
          <Select 
            v-model="selectedModelId" 
            :options="groupedModels"
            optionLabel="name"
            optionValue="id"
            optionGroupLabel="label"
            optionGroupChildren="items"
            optionDisabled="disabled"
            :placeholder="$t('chat.selectModel')"
            class="model-select"
            size="small"
            @change="onModelChange"
          >
            <template #option="slotProps">
              <div class="model-option">
                <span>{{ slotProps.option.name }}</span>
                <Tag v-if="!slotProps.option.available" severity="danger" :value="$t('chat.unavailable')" class="unavailable-tag" />
              </div>
            </template>
          </Select>
        </div>

        <!-- Stream Method Toggle -->
        <div class="control-group">
          <SelectButton 
            v-model="localStreamMethod" 
            :options="streamMethodOptions"
            optionLabel="label"
            optionValue="value"
            :allowEmpty="false"
            size="small"
            @change="updateStreamMethod"
          />
        </div>

        <!-- Chat Actions -->
        <div class="control-group header-actions">
          <Button
            v-tooltip.bottom="$t('chat.downloadChat')"
            icon="pi pi-download"
            severity="secondary"
            text
            size="small"
            :disabled="messages.length === 0"
            @click="downloadChat"
            :aria-label="$t('chat.downloadChat')"
          />
          <Button
            v-tooltip.bottom="$t('chat.clearChat')"
            icon="pi pi-trash"
            severity="secondary"
            text
            size="small"
            :disabled="messages.length === 0"
            @click="confirmClearChat"
            :aria-label="$t('chat.clearChat')"
          />
          <Button
            v-tooltip.bottom="$t('chat.settings')"
            icon="pi pi-cog"
            severity="secondary"
            text
            size="small"
            @click="showSettings = !showSettings"
            :aria-label="$t('chat.settings')"
          />
        </div>
      </div>
    </header>

    <!-- Model Warning -->
    <Transition name="slide-down">
      <div v-if="currentModel && !currentModel.available" class="model-warning">
        <i class="pi pi-exclamation-triangle"></i>
        <span>{{ $t('chat.modelUnavailable', { model: currentModel.name }) }}</span>
      </div>
    </Transition>

    <!-- Settings Panel (Collapsible) -->
    <Transition name="slide-down">
      <div v-if="showSettings" class="settings-panel">
        <div class="settings-content">
          <div class="setting-item">
            <label>{{ $t('chat.systemPrompt') }}</label>
            <Textarea
              v-model="systemPrompt"
              :placeholder="$t('chat.systemPromptPlaceholder')"
              :autoResize="true"
              rows="2"
              class="system-prompt-input"
            />
          </div>
          <div class="setting-item">
            <label>{{ $t('chat.temperature') }}</label>
            <div class="temperature-control">
              <Slider v-model="temperature" :min="0" :max="1" :step="0.1" class="temperature-slider" />
              <span class="temperature-value">{{ temperature.toFixed(1) }}</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Messages Area -->
    <div 
      class="messages-area" 
      ref="messagesContainer"
      @scroll="handleScroll"
    >
      <!-- Empty State -->
      <div v-if="messages.length === 0 && !isStreaming" class="empty-state">
        <div class="empty-icon">
          <i class="pi pi-comments"></i>
        </div>
        <h3>{{ $t('chat.emptyTitle') }}</h3>
        <p>{{ $t('chat.emptyDescription') }}</p>
      </div>

      <!-- Messages -->
      <TransitionGroup name="message" tag="div" class="messages-list">
        <div 
          v-for="(msg, index) in messages" 
          :key="`msg-${index}`"
          :class="['message', msg.role]"
        >
          <!-- User Message -->
          <template v-if="msg.role === 'user'">
            <div class="message-wrapper user-wrapper">
              <div class="message-actions">
                <Button
                  v-tooltip.left="$t('chat.copyMessage')"
                  icon="pi pi-copy"
                  severity="secondary"
                  text
                  rounded
                  size="small"
                  @click="copyToClipboard(msg.content, index)"
                  :aria-label="$t('chat.copyMessage')"
                />
              </div>
              <div class="message-bubble user-bubble">
                <div class="message-text markdown-content" v-html="renderMarkdown(msg.content)"></div>
              </div>
              <div class="avatar user-avatar">
                <i class="pi pi-user"></i>
              </div>
            </div>
          </template>

          <!-- Assistant Message -->
          <template v-else-if="msg.role === 'assistant'">
            <div class="message-wrapper assistant-wrapper">
              <div class="avatar assistant-avatar" :class="{ 'streaming-avatar': msg.isStreaming }">
                <i class="pi pi-sparkles"></i>
              </div>
              <div class="message-bubble assistant-bubble">
                <div class="message-text markdown-content" v-html="renderMarkdown(msg.content)"></div>
                <div v-if="msg.isStreaming && !msg.content" class="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
              <div class="message-actions" v-if="!msg.isStreaming">
                <Button
                  v-tooltip.right="$t('chat.copyMessage')"
                  icon="pi pi-copy"
                  severity="secondary"
                  text
                  rounded
                  size="small"
                  @click="copyToClipboard(msg.content, index)"
                  :aria-label="$t('chat.copyMessage')"
                />
                <Button
                  v-tooltip.right="$t('chat.downloadMessage')"
                  icon="pi pi-download"
                  severity="secondary"
                  text
                  rounded
                  size="small"
                  @click="downloadMessage(msg, index)"
                  :aria-label="$t('chat.downloadMessage')"
                />
              </div>
            </div>
          </template>

          <!-- System Message -->
          <template v-else-if="msg.role === 'system'">
            <div class="message-wrapper system-wrapper">
              <div class="system-message">
                <i class="pi pi-info-circle"></i>
                <span>{{ msg.content }}</span>
              </div>
            </div>
          </template>

          <!-- Copy Feedback -->
          <Transition name="fade">
            <div v-if="copiedIndex === index" class="copy-feedback">
              <i class="pi pi-check"></i>
              {{ $t('chat.copied') }}
            </div>
          </Transition>
        </div>
      </TransitionGroup>

      <!-- Scroll to Bottom Button -->
      <Transition name="fade-up">
        <Button
          v-if="showScrollButton"
          class="scroll-to-bottom"
          icon="pi pi-arrow-down"
          rounded
          severity="secondary"
          @click="scrollToBottom(true)"
          :aria-label="$t('chat.scrollToBottom')"
        />
      </Transition>
    </div>

    <!-- Input Area -->
    <div class="input-area">
      <!-- Error Message -->
      <Transition name="slide-down">
        <div v-if="chatError" class="error-banner">
          <i class="pi pi-exclamation-circle"></i>
          <span>{{ chatError }}</span>
          <Button
            icon="pi pi-times"
            severity="secondary"
            text
            rounded
            size="small"
            @click="chatError = null"
            :aria-label="$t('common.close')"
          />
        </div>
      </Transition>

      <div class="input-container">
        <Textarea
          ref="inputTextarea"
          v-model="inputMessage"
          :placeholder="$t('chat.inputPlaceholder')"
          @keydown="handleKeydown"
          :disabled="isStreaming || !currentModel?.available"
          :autoResize="true"
          rows="1"
          class="message-input"
          :aria-label="$t('chat.inputPlaceholder')"
        />
        <div class="input-actions">
          <span class="char-count" :class="{ warn: inputMessage.length > 4000 }">
            {{ inputMessage.length.toLocaleString() }}
          </span>
          <Button
            v-if="isStreaming"
            icon="pi pi-stop"
            severity="danger"
            rounded
            @click="stopStreaming"
            :aria-label="$t('chat.stop')"
            v-tooltip.top="$t('chat.stop')"
          />
          <Button
            v-else
            icon="pi pi-send"
            rounded
            :disabled="!canSend"
            @click="sendMessage"
            :aria-label="$t('chat.send')"
            v-tooltip.top="$t('chat.sendTooltip')"
          />
        </div>
      </div>
      <div class="input-hint">
        <kbd>Enter</kbd> {{ $t('chat.toSend') }} · <kbd>Shift</kbd>+<kbd>Enter</kbd> {{ $t('chat.forNewLine') }}
      </div>
    </div>

    <!-- Clear Chat Confirmation Dialog -->
    <Dialog 
      v-model:visible="showClearDialog" 
      :header="$t('chat.clearChatConfirmTitle')" 
      :modal="true"
      :closable="true"
      class="clear-dialog"
    >
      <p>{{ $t('chat.clearChatConfirmMessage') }}</p>
      <template #footer>
        <Button :label="$t('common.cancel')" severity="secondary" text @click="showClearDialog = false" />
        <Button :label="$t('chat.clearChat')" severity="danger" @click="clearChat" />
      </template>
    </Dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick, onUnmounted } from 'vue'
import { useLlm } from '@/composables/useLlm'
import { useWebSocket } from '@/composables/useWebSocket'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

// PrimeVue Components
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Slider from 'primevue/slider'
import Dialog from 'primevue/dialog'

const { t, locale } = useI18n()
const toast = useToast()

// Configure marked
marked.setOptions({
  breaks: true,
  gfm: true
})

// Composables
const {
  models,
  availableProviders,
  selectedModel,
  getModelsByProvider,
  streamChat,
  setStreamMethod,
  selectModel,
  streamMethod,
  initialize: initializeLlm
} = useLlm()

const { isConnected } = useWebSocket()

// Refs
const messagesContainer = ref(null)
const inputTextarea = ref(null)

// State
const messages = ref([])
const inputMessage = ref('')
const systemPrompt = ref('')
const temperature = ref(0.7)
const isStreaming = ref(false)
const chatError = ref(null)
const selectedModelId = ref(null)
const localStreamMethod = ref('sse')
const showSettings = ref(false)
const showScrollButton = ref(false)
const showClearDialog = ref(false)
const copiedIndex = ref(null)
const userScrolled = ref(false)
const abortController = ref(null)

// Stream method options
const streamMethodOptions = computed(() => [
  { label: t('chat.sse'), value: 'sse' },
  { label: t('chat.websocket'), value: 'ws' }
])

// Computed
const currentModel = computed(() => {
  return models.value.find(m => m.id === selectedModelId.value) || null
})

const groupedModels = computed(() => {
  return availableProviders.value.map(provider => ({
    label: provider.charAt(0).toUpperCase() + provider.slice(1),
    items: getModelsByProvider(provider).map(model => ({
      ...model,
      disabled: !model.available
    }))
  })).filter(group => group.items.length > 0)
})

const canSend = computed(() => {
  return inputMessage.value.trim() && 
         currentModel.value?.available && 
         !isStreaming.value
})

// Markdown Rendering
const renderMarkdown = (content) => {
  if (!content) return ''
  try {
    const html = marked.parse(content)
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'del', 'sup', 'sub'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
    })
  } catch (err) {
    console.error('Markdown render error:', err)
    return content
  }
}

// Scroll Management
const handleScroll = () => {
  if (!messagesContainer.value) return
  
  const { scrollTop, scrollHeight, clientHeight } = messagesContainer.value
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight
  
  // Show button if scrolled up more than 100px
  showScrollButton.value = distanceFromBottom > 100
  
  // Track if user manually scrolled up
  userScrolled.value = distanceFromBottom > 50
}

const scrollToBottom = async (force = false) => {
  await nextTick()
  if (!messagesContainer.value) return
  
  // Only auto-scroll if user hasn't scrolled up (unless forced)
  if (!userScrolled.value || force) {
    messagesContainer.value.scrollTo({
      top: messagesContainer.value.scrollHeight,
      behavior: force ? 'smooth' : 'auto'
    })
    userScrolled.value = false
  }
}

// Input Handling
const handleKeydown = (event) => {
  if (event.key === 'Enter') {
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      // Ctrl+Enter or Shift+Enter = new line (let default behavior happen)
      return
    }
    // Plain Enter = send message
    event.preventDefault()
    if (canSend.value) {
      sendMessage()
    }
  }
}

// Methods
const updateStreamMethod = () => {
  setStreamMethod(localStreamMethod.value)
}

const onModelChange = () => {
  if (selectedModelId.value) {
    selectModel(selectedModelId.value)
  }
}

const confirmClearChat = () => {
  showClearDialog.value = true
}

const clearChat = () => {
  messages.value = []
  chatError.value = null
  showClearDialog.value = false
}

const stopStreaming = () => {
  if (abortController.value) {
    abortController.value.abort()
    abortController.value = null
  }
  isStreaming.value = false
}

const copyToClipboard = async (content, index) => {
  try {
    await navigator.clipboard.writeText(content)
    copiedIndex.value = index
    setTimeout(() => {
      copiedIndex.value = null
    }, 2000)
  } catch (err) {
    console.error('Copy failed:', err)
    toast.add({
      severity: 'error',
      summary: t('common.error'),
      detail: t('chat.copyFailed'),
      life: 3000
    })
  }
}

const downloadMessage = (msg, index) => {
  const timestamp = new Date().toISOString().split('T')[0]
  const role = msg.role === 'assistant' ? 'assistant' : 'user'
  const filename = `message-${role}-${index + 1}-${timestamp}.md`
  
  const blob = new Blob([msg.content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const downloadChat = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `chat-history-${timestamp}.md`
  
  let content = `# ${t('chat.title')}\n\n`
  content += `${t('chat.exportedOn')}: ${new Date().toLocaleString(locale.value)}\n`
  content += `${t('chat.model')}: ${currentModel.value?.name || 'Unknown'}\n\n`
  content += `---\n\n`
  
  messages.value.forEach((msg, index) => {
    const role = msg.role === 'user' ? t('chat.you') : t('chat.assistant')
    content += `## ${role}\n\n${msg.content}\n\n`
    if (index < messages.value.length - 1) {
      content += `---\n\n`
    }
  })
  
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const sendMessage = async () => {
  if (!canSend.value) return

  const userMessage = inputMessage.value.trim()
  inputMessage.value = ''
  chatError.value = null

  // Add user message
  messages.value.push({
    role: 'user',
    content: userMessage
  })

  // Reset scroll tracking for new message
  userScrolled.value = false
  await scrollToBottom()

  // Add assistant message placeholder immediately - we'll update it in place
  const assistantMessageIndex = messages.value.length
  messages.value.push({
    role: 'assistant',
    content: '',
    isStreaming: true
  })

  isStreaming.value = true
  abortController.value = new AbortController()

  try {
    const messagesArray = messages.value
      .filter(msg => !msg.isStreaming) // Don't send the streaming placeholder
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }))

    await streamChat(
      messagesArray,
      systemPrompt.value || null,
      temperature.value,
      (chunk) => {
        // Update the message in place
        messages.value[assistantMessageIndex].content += chunk
        scrollToBottom()
      }
    )

    // Mark as no longer streaming
    messages.value[assistantMessageIndex].isStreaming = false

    await scrollToBottom()
  } catch (err) {
    if (err.name !== 'AbortError') {
      chatError.value = err.message || t('chat.error')
      console.error('Chat error:', err)
      
      // Remove both messages if no response was received
      if (!messages.value[assistantMessageIndex]?.content) {
        messages.value.splice(assistantMessageIndex - 1, 2) // Remove user + empty assistant
      } else {
        // Just mark as not streaming if we got partial content
        messages.value[assistantMessageIndex].isStreaming = false
      }
    }
  } finally {
    isStreaming.value = false
    abortController.value = null
    
    // Focus input after sending
    await nextTick()
    inputTextarea.value?.$el?.focus()
  }
}

// Lifecycle
onMounted(async () => {
  await initializeLlm()
  
  if (selectedModel.value) {
    selectedModelId.value = selectedModel.value.id
  } else if (models.value.length > 0) {
    const availableModel = models.value.find(m => m.available)
    selectedModelId.value = (availableModel || models.value[0]).id
  }
  
  localStreamMethod.value = streamMethod.value || 'sse'
  
  // Focus input
  await nextTick()
  inputTextarea.value?.$el?.focus()
})

// Watchers
watch(() => selectedModel.value, (newModel) => {
  if (newModel && newModel.id !== selectedModelId.value) {
    selectedModelId.value = newModel.id
  }
})

watch(models, () => {
  if (models.value.length > 0 && !selectedModelId.value) {
    const availableModel = models.value.find(m => m.available)
    selectedModelId.value = (availableModel || models.value[0]).id
  }
}, { immediate: true })

watch(streamMethod, (newVal) => {
  localStreamMethod.value = newVal
})

// Cleanup
onUnmounted(() => {
  if (abortController.value) {
    abortController.value.abort()
  }
})
</script>

<style scoped>
/* ============================================
   Container & Layout
   ============================================ */
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100vh;
  background: var(--p-surface-ground);
  overflow: hidden;
}

/* ============================================
   Header
   ============================================ */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: var(--p-surface-card);
  border-bottom: 1px solid var(--p-surface-border);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.chat-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--p-text-color);
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  border-radius: var(--p-border-radius-md);
  font-size: 0.75rem;
  font-weight: 500;
  background: color-mix(in srgb, var(--p-red-500) 10%, transparent);
  color: var(--p-red-600);
}

.connection-status.connected {
  background: color-mix(in srgb, var(--p-green-500) 10%, transparent);
  color: var(--p-green-600);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.model-select {
  min-width: 180px;
}

.model-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.unavailable-tag {
  font-size: 0.65rem;
  padding: 0.125rem 0.375rem;
}

.header-actions {
  display: flex;
  gap: 0.25rem;
}

/* ============================================
   Model Warning
   ============================================ */
.model-warning {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: color-mix(in srgb, var(--p-orange-500) 10%, transparent);
  color: var(--p-orange-700);
  font-size: 0.875rem;
  border-bottom: 1px solid var(--p-surface-border);
}

/* ============================================
   Settings Panel
   ============================================ */
.settings-panel {
  background: var(--p-surface-card);
  border-bottom: 1px solid var(--p-surface-border);
  padding: 1rem;
}

.settings-content {
  display: flex;
  gap: 2rem;
  flex-wrap: wrap;
}

.setting-item {
  flex: 1;
  min-width: 200px;
}

.setting-item label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--p-text-muted-color);
  margin-bottom: 0.5rem;
}

.system-prompt-input {
  width: 100%;
  font-size: 0.875rem;
}

.temperature-control {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.temperature-slider {
  flex: 1;
}

.temperature-value {
  font-family: monospace;
  font-weight: 600;
  min-width: 2rem;
}

/* ============================================
   Messages Area
   ============================================ */
.messages-area {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1rem;
  position: relative;
  scroll-behavior: auto;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 300px;
  text-align: center;
  color: var(--p-text-muted-color);
}

.empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--p-surface-100);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.empty-icon .pi {
  font-size: 1.75rem;
  opacity: 0.5;
}

.empty-state h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--p-text-color);
}

.empty-state p {
  margin: 0;
  font-size: 0.875rem;
}

/* ============================================
   Message Styles
   ============================================ */
.message {
  position: relative;
}

.message-wrapper {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  max-width: 100%;
  width: 100%;
}

.message-wrapper.user-wrapper {
  justify-content: flex-end;
}

.message-wrapper.assistant-wrapper {
  justify-content: flex-start;
}

.message-wrapper.system-wrapper {
  justify-content: center;
}

/* Message bubbles constrain their own width */
.message-bubble {
  padding: 0.625rem 0.875rem;
  border-radius: 1rem;
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-width: min(90%, 1600px);
}
.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 0.75rem;
}

.user-avatar {
  background: #22c55e;
  color: white;
}

.assistant-avatar {
  background: var(--p-surface-200);
  color: var(--p-text-color);
}

.streaming-avatar {
  animation: pulse-avatar 1.5s ease-in-out infinite;
}

@keyframes pulse-avatar {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.user-bubble {
  background: #dcfce7;
  color: #166534;
  border: 1px solid #bbf7d0;
  border-bottom-right-radius: 0.25rem;
}

.assistant-bubble {
  background: var(--p-surface-50);
  color: var(--p-text-color);
  border: 1px solid var(--p-surface-200);
  border-bottom-left-radius: 0.25rem;
}

.message-text {
  font-size: 0.9375rem;
  line-height: 1.5;
  /* white-space: pre-wrap; */
}

/* System Messages */
.system-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: color-mix(in srgb, var(--p-blue-500) 10%, transparent);
  color: var(--p-blue-700);
  border-radius: var(--p-border-radius-md);
  font-size: 0.875rem;
}

/* Message Actions */
.message-actions {
  display: flex;
  gap: 0.125rem;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.message-wrapper:hover .message-actions {
  opacity: 1;
}

.message-actions :deep(.p-button) {
  width: 1.75rem;
  height: 1.75rem;
}

.message-actions :deep(.p-button .pi) {
  font-size: 0.75rem;
}

/* Copy Feedback */
.copy-feedback {
  position: absolute;
  top: -1.5rem;
  right: 0;
  background: var(--p-green-500);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: var(--p-border-radius-sm);
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

/* Typing Indicator */
.typing-indicator {
  display: inline-flex;
  gap: 0.25rem;
  padding: 0.25rem 0;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--p-text-muted-color);
  animation: typing-bounce 1.4s infinite ease-in-out both;
}

.typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

@keyframes typing-bounce {
  0%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* Scroll to Bottom Button */
.scroll-to-bottom {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  box-shadow: var(--p-shadow-md);
  z-index: 10;
}

/* ============================================
   Markdown Content
   ============================================ */
.markdown-content {
  font-size: 0.9375rem;
  line-height: 1.5;
}

.markdown-content :deep(> *:first-child) {
  margin-top: 0 !important;
}

.markdown-content :deep(> *:last-child) {
  margin-bottom: 0 !important;
}

.markdown-content :deep(p) {
  margin: 0 0 0.4em 0;
}

.markdown-content :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-content :deep(h1) {
  font-size: 1.25em;
  font-weight: 700;
  margin: 0.5em 0 0.25em 0;
}

.markdown-content :deep(h2) {
  font-size: 1.125em;
  font-weight: 700;
  margin: 0.5em 0 0.25em 0;
}

.markdown-content :deep(h3) {
  font-size: 1em;
  font-weight: 700;
  margin: 0.5em 0 0.2em 0;
}

.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  font-size: 0.9375em;
  font-weight: 700;
  margin: 0.4em 0 0.2em 0;
}

.markdown-content :deep(h1:first-child),
.markdown-content :deep(h2:first-child),
.markdown-content :deep(h3:first-child),
.markdown-content :deep(h4:first-child),
.markdown-content :deep(h5:first-child),
.markdown-content :deep(h6:first-child) {
  margin-top: 0;
}

.markdown-content :deep(strong) {
  font-weight: 600;
}

.markdown-content :deep(em) {
  font-style: italic;
}

.markdown-content :deep(pre) {
  background: #f6f8fa;
  color: #24292e;
  padding: 0.5rem 0.75rem;
  border-radius: var(--p-border-radius-sm);
  overflow-x: auto;
  margin: 0.4em 0;
  font-size: 0.8125em;
  border: 1px solid #e1e4e8;
}

.markdown-content :deep(code) {
  font-family: 'JetBrains Mono', 'Fira Code', 'Monaco', monospace;
  font-size: 0.875em;
}

.markdown-content :deep(pre code) {
  background: transparent;
  padding: 0;
  font-size: inherit;
  color: #24292e;
}

.markdown-content :deep(code:not(pre code)) {
  background: #f0f0f0;
  color: #d63384;
  padding: 0.1em 0.35em;
  border-radius: 3px;
  font-size: 0.85em;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 0.2em 0;
  padding-left: 1.25em;
}

.markdown-content :deep(li) {
  margin: 0.1em 0;
}

.markdown-content :deep(li > p) {
  margin: 0;
}

.markdown-content :deep(li > ul),
.markdown-content :deep(li > ol) {
  margin: 0.1em 0;
}

.markdown-content :deep(blockquote) {
  border-left: 3px solid var(--p-primary-color);
  margin: 0.4em 0;
  padding: 0.2em 0 0.2em 0.6em;
  color: #6b7280;
  background: #f9fafb;
  border-radius: 0 6px 6px 0;
}

.markdown-content :deep(a) {
  color: var(--p-primary-color);
  text-decoration: none;
}

.markdown-content :deep(a:hover) {
  text-decoration: underline;
}

.markdown-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.5em 0;
  font-size: 0.875em;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  overflow: hidden;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  border: 1px solid #d1d5db;
  padding: 0.5em 0.75em;
  text-align: left;
}

.markdown-content :deep(th) {
  background: #f3f4f6;
  font-weight: 600;
}

.markdown-content :deep(tr:nth-child(even)) {
  background: #f9fafb;
}

.markdown-content :deep(hr) {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 1em 0;
}

/* ============================================
   Input Area
   ============================================ */
.input-area {
  padding: 0.75rem 1rem;
  background: var(--p-surface-card);
  border-top: 1px solid var(--p-surface-border);
  flex-shrink: 0;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.75rem;
  background: color-mix(in srgb, var(--p-red-500) 10%, transparent);
  color: var(--p-red-700);
  border-radius: var(--p-border-radius-md);
  font-size: 0.875rem;
}

.error-banner span {
  flex: 1;
}

.input-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--p-surface-card);
  border: 2px solid var(--p-surface-300);
  border-radius: 1.5rem;
  padding: 0.625rem 0.625rem 0.625rem 1rem;
  min-height: 48px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.input-container:focus-within {
  border-color: var(--p-primary-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--p-primary-color) 15%, transparent);
}

.message-input {
  flex: 1;
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  resize: none;
  font-size: 0.9375rem;
  max-height: 150px;
  min-height: 24px;
  padding: 0 !important;
  margin: 0;
  line-height: 1.5;
  overflow-y: auto !important;
}

.message-input :deep(textarea) {
  padding: 0 !important;
  min-height: 24px;
  max-height: 150px;
  line-height: 1.5;
  overflow-y: auto !important;
}

.message-input:focus {
  outline: none !important;
  box-shadow: none !important;
}

.input-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.char-count {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
  font-family: monospace;
}

.char-count.warn {
  color: var(--p-orange-600);
}

.input-hint {
  margin-top: 0.5rem;
  text-align: center;
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.input-hint kbd {
  display: inline-block;
  padding: 0.125rem 0.375rem;
  background: #e5e7eb;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.6875rem;
  color: #374151;
}

:root.dark .input-hint kbd {
  background: #374151;
  border-color: #4b5563;
  color: #e5e7eb;
}

/* ============================================
   Dialog
   ============================================ */
.clear-dialog {
  max-width: 400px;
}

/* ============================================
   Transitions
   ============================================ */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-up-enter-active,
.fade-up-leave-active {
  transition: all 0.2s ease;
}

.fade-up-enter-from,
.fade-up-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.message-enter-active {
  transition: all 0.3s ease-out;
}

.message-leave-active {
  transition: all 0.2s ease-in;
}

.message-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.message-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* ============================================
   Responsive
   ============================================ */
@media (max-width: 768px) {
  .chat-header {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
    padding: 0.75rem;
  }

  .header-left {
    justify-content: space-between;
  }

  .header-controls {
    flex-wrap: wrap;
    justify-content: space-between;
  }

  .model-select {
    min-width: 0;
    flex: 1;
  }

  .message-wrapper {
    max-width: 95%;
  }

  .settings-content {
    flex-direction: column;
    gap: 1rem;
  }

  .input-hint {
    display: none;
  }
}

@media (max-width: 480px) {
  .chat-title {
    font-size: 1rem;
  }

  .status-text {
    display: none;
  }

  .message-bubble {
    padding: 0.5rem 0.75rem;
  }

  .avatar {
    width: 24px;
    height: 24px;
    font-size: 0.625rem;
  }
}

/* ============================================
   Dark Mode Adjustments
   ============================================ */
:root.dark .connection-status {
  background: color-mix(in srgb, var(--p-red-400) 15%, transparent);
  color: var(--p-red-400);
}

:root.dark .connection-status.connected {
  background: color-mix(in srgb, var(--p-green-400) 15%, transparent);
  color: var(--p-green-400);
}

:root.dark .model-warning {
  background: color-mix(in srgb, var(--p-orange-400) 15%, transparent);
  color: var(--p-orange-300);
}

:root.dark .system-message {
  background: color-mix(in srgb, var(--p-blue-400) 15%, transparent);
  color: var(--p-blue-300);
}

:root.dark .error-banner {
  background: color-mix(in srgb, var(--p-red-400) 15%, transparent);
  color: var(--p-red-300);
}

:root.dark .assistant-bubble {
  background: var(--p-surface-700);
  border-color: var(--p-surface-600);
  color: var(--p-text-color);
}

:root.dark .user-bubble {
  background: #166534;
  color: #dcfce7;
  border-color: #15803d;
}

:root.dark .assistant-avatar {
  background: var(--p-surface-600);
  color: var(--p-text-color);
}

:root.dark .user-avatar {
  background: #15803d;
  color: #dcfce7;
}

:root.dark .input-container {
  border-color: var(--p-surface-500);
}

:root.dark .markdown-content :deep(pre) {
  background: #1e1e1e;
  color: #d4d4d4;
  border-color: #333;
}

:root.dark .markdown-content :deep(pre code) {
  color: #d4d4d4;
}

:root.dark .markdown-content :deep(code:not(pre code)) {
  background: #374151;
  color: #f472b6;
}

:root.dark .markdown-content :deep(blockquote) {
  background: #1f2937;
  color: #9ca3af;
}

:root.dark .markdown-content :deep(table) {
  border-color: #4b5563;
}

:root.dark .markdown-content :deep(th),
:root.dark .markdown-content :deep(td) {
  border-color: #4b5563;
}

:root.dark .markdown-content :deep(th) {
  background: #374151;
}

:root.dark .markdown-content :deep(tr:nth-child(even)) {
  background: #1f2937;
}

:root.dark .markdown-content :deep(hr) {
  border-color: #4b5563;
}
</style>