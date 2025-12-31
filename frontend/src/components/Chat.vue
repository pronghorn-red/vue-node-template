<!-- src/components/Chat.vue -->
<template>
  <div class="chat-container">
    <!-- Compact Header (shown only in single chat mode) -->
    <header v-if="showHeader" class="chat-header">
      <div class="header-left">
        <h1 class="chat-title">{{ $t('chat.title') }}</h1>
        <div class="connection-status" :class="{ connected: isConnected }">
          <span class="status-dot"></span>
          <span class="status-text">{{ isConnected ? $t('chat.wsConnected') : $t('chat.wsDisconnected') }}</span>
        </div>
      </div>
      
      <div class="header-controls">
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

        <div class="control-group header-actions">
          <Button
            v-tooltip.bottom="$t('chat.downloadChat')"
            icon="pi pi-download"
            severity="secondary"
            text
            size="small"
            :disabled="messages.length === 0"
            @click="downloadChat"
          />
          <Button
            v-tooltip.bottom="$t('chat.clearChat')"
            icon="pi pi-trash"
            severity="secondary"
            text
            size="small"
            :disabled="messages.length === 0"
            @click="confirmClearChat"
          />
          <Button
            v-tooltip.bottom="$t('chat.settings')"
            icon="pi pi-cog"
            severity="secondary"
            text
            size="small"
            @click="showSettings = !showSettings"
          />
          <Button
            v-tooltip.bottom="$t('chat.addChat')"
            icon="pi pi-plus"
            rounded
            size="small"
            @click="$emit('add-chat')"
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

    <!-- Settings Panel (only shown in single chat mode when header is visible) -->
    <Transition name="slide-down">
      <div v-if="showHeader && showSettings" class="settings-panel">
        <div class="settings-content">
          <div class="setting-item">
            <label>{{ $t('chat.systemPrompt') }}</label>
            <Textarea v-model="systemPrompt" :placeholder="$t('chat.systemPromptPlaceholder')" :autoResize="true" rows="2" class="system-prompt-input" />
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
    <div class="messages-area" ref="messagesContainer" @scroll="handleScroll">
      <div v-if="messages.length === 0 && !isStreaming" class="empty-state">
        <div class="empty-icon"><i class="pi pi-comments"></i></div>
        <h3>{{ $t('chat.emptyTitle') }}</h3>
        <p>{{ $t('chat.emptyDescription') }}</p>
      </div>

      <TransitionGroup name="message" tag="div" class="messages-list">
        <div v-for="(msg, index) in messages" :key="`msg-${index}`" :class="['message', msg.role]">
          <template v-if="msg.role === 'user'">
            <div class="message-wrapper user-wrapper">
              <div class="message-actions">
                <Button icon="pi pi-copy" severity="secondary" text rounded size="small" @click="copyToClipboard(msg.content, index)" />
              </div>
              <div class="message-bubble user-bubble">
                <div class="message-text markdown-content" v-html="renderMarkdown(msg.content)"></div>
              </div>
              <div class="avatar user-avatar"><i class="pi pi-user"></i></div>
            </div>
          </template>

          <template v-else-if="msg.role === 'assistant'">
            <div class="message-wrapper assistant-wrapper">
              <div class="avatar assistant-avatar" :class="{ 'streaming-avatar': msg.isStreaming }">
                <i class="pi pi-sparkles"></i>
              </div>
              <div class="message-bubble assistant-bubble">
                <div class="message-text markdown-content" v-html="renderMarkdown(msg.content)"></div>
                <div v-if="msg.isStreaming && !msg.content" class="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
              <div class="message-actions" v-if="!msg.isStreaming">
                <Button icon="pi pi-copy" severity="secondary" text rounded size="small" @click="copyToClipboard(msg.content, index)" />
                <Button icon="pi pi-download" severity="secondary" text rounded size="small" @click="downloadMessage(msg, index)" />
              </div>
            </div>
          </template>

          <Transition name="fade">
            <div v-if="copiedIndex === index" class="copy-feedback">
              <i class="pi pi-check"></i> {{ $t('chat.copied') }}
            </div>
          </Transition>
        </div>
      </TransitionGroup>

      <Transition name="fade-up">
        <Button v-if="showScrollButton" class="scroll-to-bottom" icon="pi pi-arrow-down" rounded severity="secondary" @click="scrollToBottom(true)" />
      </Transition>
    </div>

    <!-- Input Area -->
    <div class="input-area">
      <Transition name="slide-down">
        <div v-if="chatError" class="error-banner">
          <i class="pi pi-exclamation-circle"></i>
          <span>{{ chatError }}</span>
          <Button icon="pi pi-times" severity="secondary" text rounded size="small" @click="chatError = null" />
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
        />
        <div class="input-actions">
          <span class="char-count" :class="{ warn: inputMessage.length > 4000 }">{{ inputMessage.length.toLocaleString() }}</span>
          <Button v-if="isStreaming" icon="pi pi-stop" severity="danger" rounded @click="stopStreaming" v-tooltip.top="$t('chat.stop')" />
          <Button v-else icon="pi pi-send" rounded :disabled="!canSend" @click="sendMessage" v-tooltip.top="$t('chat.sendTooltip')" />
        </div>
      </div>
      <div class="input-hint">
        <kbd>Enter</kbd> {{ $t('chat.toSend') }} · <kbd>Shift</kbd>+<kbd>Enter</kbd> {{ $t('chat.forNewLine') }}
      </div>
    </div>

    <Dialog v-model:visible="showClearDialog" :header="$t('chat.clearChatConfirmTitle')" :modal="true" class="clear-dialog">
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

import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Slider from 'primevue/slider'
import Dialog from 'primevue/dialog'

const props = defineProps({
  instanceId: { type: String, default: null },
  initialModelId: { type: String, default: null },
  initialSystemPrompt: { type: String, default: '' },
  initialTemperature: { type: Number, default: 0.7 },
  showHeader: { type: Boolean, default: true },
  forceWebsocket: { type: Boolean, default: false },
  getSharedHistory: { type: Function, default: null }
})

const emit = defineEmits(['model-change', 'settings-change', 'add-chat'])

const { t, locale } = useI18n()
const toast = useToast()

marked.setOptions({ breaks: true, gfm: true })

const {
  models,
  availableProviders,
  getModelsByProvider,
  startChat,
  cancel,
  setStreamMethod,
  streamMethod,
  waitForTask,
  initialize: initializeLlm
} = useLlm()

const { isConnected } = useWebSocket()

// Refs
const messagesContainer = ref(null)
const inputTextarea = ref(null)

// State
const messages = ref([])
const inputMessage = ref('')
const systemPrompt = ref(props.initialSystemPrompt)
const temperature = ref(props.initialTemperature)
const isStreaming = ref(false)
const chatError = ref(null)
const selectedModelId = ref(null)
const localStreamMethod = ref('ws')
const showSettings = ref(false)
const showScrollButton = ref(false)
const showClearDialog = ref(false)
const copiedIndex = ref(null)
const userScrolled = ref(false)
const currentTaskId = ref(null)

const streamMethodOptions = computed(() => [
  { label: t('chat.sse'), value: 'sse' },
  { label: t('chat.websocket'), value: 'ws' }
])

const currentModel = computed(() => models.value.find(m => m.id === selectedModelId.value) || null)

const groupedModels = computed(() => {
  return availableProviders.value.map(provider => ({
    label: provider.charAt(0).toUpperCase() + provider.slice(1),
    items: getModelsByProvider(provider).map(model => ({ ...model, disabled: !model.available }))
  })).filter(group => group.items.length > 0)
})

const canSend = computed(() => inputMessage.value.trim() && currentModel.value?.available && !isStreaming.value)

const renderMarkdown = (content) => {
  if (!content) return ''
  try {
    return DOMPurify.sanitize(marked.parse(content), {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'del', 'sup', 'sub'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class']
    })
  } catch (err) {
    return content
  }
}

const handleScroll = () => {
  if (!messagesContainer.value) return
  const { scrollTop, scrollHeight, clientHeight } = messagesContainer.value
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight
  showScrollButton.value = distanceFromBottom > 100
  userScrolled.value = distanceFromBottom > 50
}

const scrollToBottom = async (force = false) => {
  await nextTick()
  if (!messagesContainer.value) return
  
  // Always scroll if forced, or if user hasn't manually scrolled up
  if (force || !userScrolled.value) {
    messagesContainer.value.scrollTo({ 
      top: messagesContainer.value.scrollHeight, 
      behavior: force ? 'smooth' : 'auto' 
    })
    // Reset userScrolled when we force scroll
    if (force) {
      userScrolled.value = false
    }
  }
}

const handleKeydown = (event) => {
  if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    event.preventDefault()
    if (canSend.value) sendMessage()
  }
}

const updateStreamMethod = () => setStreamMethod(localStreamMethod.value)
const onModelChange = () => {
  if (selectedModelId.value) {
    emit('model-change', selectedModelId.value)
  }
}

const confirmClearChat = () => { showClearDialog.value = true }
const clearChat = () => {
  messages.value = []
  chatError.value = null
  showClearDialog.value = false
}

const stopStreaming = () => {
  if (currentTaskId.value) {
    cancel(currentTaskId.value)
    currentTaskId.value = null
  }
  isStreaming.value = false
}

const copyToClipboard = async (content, index) => {
  try {
    await navigator.clipboard.writeText(content)
    copiedIndex.value = index
    setTimeout(() => { copiedIndex.value = null }, 2000)
  } catch (err) {
    toast.add({ severity: 'error', summary: t('common.error'), detail: t('chat.copyFailed'), life: 3000 })
  }
}

const downloadMessage = (msg, index) => {
  const timestamp = new Date().toISOString().split('T')[0]
  const filename = `message-${msg.role}-${index + 1}-${timestamp}.md`
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
  let content = `# ${t('chat.title')}\n\n`
  content += `${t('chat.exportedOn')}: ${new Date().toLocaleString(locale.value)}\n`
  content += `${t('chat.model')}: ${currentModel.value?.name || 'Unknown'}\n\n---\n\n`
  messages.value.forEach((msg, index) => {
    const role = msg.role === 'user' ? t('chat.you') : t('chat.assistant')
    content += `## ${role}\n\n${msg.content}\n\n`
    if (index < messages.value.length - 1) content += `---\n\n`
  })
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `chat-history-${timestamp}.md`
  a.click()
  URL.revokeObjectURL(url)
}

const sendMessage = async (sharedContextOverride = null) => {
  if (!canSend.value) return

  const userMessage = inputMessage.value.trim()
  inputMessage.value = ''
  chatError.value = null

  messages.value.push({ role: 'user', content: userMessage })
  
  // Reset scroll state and force scroll to bottom when user sends
  userScrolled.value = false
  await scrollToBottom(true)

  const assistantMessageIndex = messages.value.length
  messages.value.push({ role: 'assistant', content: '', isStreaming: true })

  // Scroll again to show the streaming indicator
  await scrollToBottom(true)

  isStreaming.value = true

  try {
    // Build messages array (exclude streaming placeholder)
    let messagesArray = messages.value
      .filter(msg => !msg.isStreaming)
      .map(msg => ({ role: msg.role, content: msg.content }))

    // Get shared context - either from override (sendExternalMessage) or from prop function

    console.log("sharedContextOverride", sharedContextOverride)
    console.log("props.getSharedHistory()", props.getSharedHistory())
    let sharedContext = sharedContextOverride;
    if (!sharedContext && props.getSharedHistory) {
      sharedContext = props.getSharedHistory()
      console.log('[Chat] Got shared history from prop function:', sharedContext?.length || 0, 'chats')
    }

    // If shared context provided, insert it as a user message BEFORE the last user message
    if (sharedContext && sharedContext.length > 0) {
      const contextStr = sharedContext.map(ctx => {
        const msgSummary = ctx.messages.map(m => `[${m.role}]: ${m.content}`).join('\n')
        return `=== ${ctx.name} ===\n${msgSummary}`
      }).join('\n\n')
      
      const sharedHistoryMessage = {
        role: 'user',
        content: `Here is some chat history from parallel chat sessions that I am having. I want you to consider this history in your answer, since it may be relevant. Treat these user messages like mine, and those assistant answers like responses from other assistants.\n\n${contextStr}`
      }
      
      // Insert before the last message (which is the current user message)
      if (messagesArray.length > 0) {
        messagesArray.splice(messagesArray.length - 1, 0, sharedHistoryMessage)
      } else {
        messagesArray.unshift(sharedHistoryMessage)
      }
      
      console.log('[Chat] Shared history injected:', { 
        contextCount: sharedContext.length,
        messagesArrayLength: messagesArray.length 
      })
    }

    // Use the systemPrompt directly (no longer mixing with shared history)
    let effectiveSystemPrompt = systemPrompt.value || null
    console.log('[Chat] sendMessage - systemPrompt:', { raw: systemPrompt.value, effective: effectiveSystemPrompt })

    // Determine which method to use
    // forceWebsocket prop forces WebSocket for multi-chat mode
    // otherwise respect localStreamMethod setting
    const forceMethod = props.forceWebsocket ? 'ws' : (localStreamMethod.value === 'sse' ? 'sse' : null)

    console.log('[Chat] sendMessage routing:', {
      forceWebsocket: props.forceWebsocket,
      localStreamMethod: localStreamMethod.value,
      forceMethod,
      isConnected: isConnected.value,
    })

    // Always use startChat - it handles routing internally
    const taskId = startChat({
      messages: messagesArray,
      model: selectedModelId.value,
      systemPrompt: effectiveSystemPrompt,
      temperature: temperature.value,
      forceMethod,
      onChunk: (chunk) => {
        if (messages.value[assistantMessageIndex]) {
          messages.value[assistantMessageIndex].content += chunk
          scrollToBottom()
        }
      }
    })

    currentTaskId.value = taskId
    await waitForTask(taskId)

    if (messages.value[assistantMessageIndex]) {
      messages.value[assistantMessageIndex].isStreaming = false
    }
    await scrollToBottom()
  } catch (err) {
    if (err.message !== 'Task cancelled') {
      chatError.value = err.message || t('chat.error')
      if (!messages.value[assistantMessageIndex]?.content) {
        messages.value.splice(assistantMessageIndex - 1, 2)
      } else {
        messages.value[assistantMessageIndex].isStreaming = false
      }
    }
  } finally {
    isStreaming.value = false
    currentTaskId.value = null
    await nextTick()
    inputTextarea.value?.$el?.focus()
  }
}

const sendExternalMessage = async (message, modelId, sharedContext = null) => {
  if (!message?.trim() || isStreaming.value) return
  if (modelId && modelId !== selectedModelId.value) {
    selectedModelId.value = modelId
  }
  inputMessage.value = message
  await nextTick()
  sendMessage(sharedContext)
}

defineExpose({ sendExternalMessage, clearChat, messages })

onMounted(async () => {
  await initializeLlm()
  
  // Use prop or find first available model
  if (props.initialModelId) {
    selectedModelId.value = props.initialModelId
  } else if (models.value.length > 0) {
    const availableModel = models.value.find(m => m.available)
    selectedModelId.value = (availableModel || models.value[0]).id
  }
  
  // Initialize from props
  systemPrompt.value = props.initialSystemPrompt
  temperature.value = props.initialTemperature
  
  // Force WebSocket if prop is set, otherwise use saved preference
  if (props.forceWebsocket) {
    localStreamMethod.value = 'ws'
  } else {
    localStreamMethod.value = streamMethod.value || 'ws'
  }
  
  await nextTick()
  inputTextarea.value?.$el?.focus()
})

watch(() => props.initialModelId, (newVal) => {
  if (newVal && newVal !== selectedModelId.value) {
    selectedModelId.value = newVal
  }
})

watch(() => props.initialSystemPrompt, (newVal, oldVal) => {
  // Update local state when prop changes
  systemPrompt.value = newVal || ''
}, { immediate: false })

watch(() => props.initialTemperature, (newVal) => {
  // Update local state when prop changes
  if (newVal !== undefined && newVal !== null) {
    temperature.value = newVal
  }
}, { immediate: false })

// Emit settings changes back to parent
watch(systemPrompt, (newVal) => {
  emit('settings-change', { systemPrompt: newVal })
})

watch(temperature, (newVal) => {
  emit('settings-change', { temperature: newVal })
})

watch(models, () => {
  if (models.value.length > 0 && !selectedModelId.value) {
    const availableModel = models.value.find(m => m.available)
    selectedModelId.value = (availableModel || models.value[0]).id
  }
}, { immediate: true })

watch(streamMethod, (newVal) => { localStreamMethod.value = newVal })

onUnmounted(() => {
  if (currentTaskId.value) cancel(currentTaskId.value)
})
</script>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--p-surface-ground);
  overflow: hidden;
}

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

.messages-area {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1rem;
  position: relative;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 200px;
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

.user-wrapper {
  flex-direction: row-reverse;
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
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.message-bubble {
  padding: 0.625rem 0.875rem;
  border-radius: 1rem;
  word-wrap: break-word;
  overflow-wrap: break-word;
  max-width: min(90%, 1200px);
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

.message-actions {
  display: flex;
  gap: 0.125rem;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.message:hover .message-actions {
  opacity: 1;
}

.copy-feedback {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--p-surface-900);
  color: white;
  padding: 0.375rem 0.75rem;
  border-radius: var(--p-border-radius-md);
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  z-index: 10;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--p-text-muted-color);
  animation: typing 1.4s infinite;
}

.typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}

.scroll-to-bottom {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  box-shadow: var(--p-shadow-md);
  z-index: 10;
}

.markdown-content {
  font-size: 0.9375rem;
  line-height: 1.5;
}

.markdown-content :deep(> *:first-child) { margin-top: 0 !important; }
.markdown-content :deep(> *:last-child) { margin-bottom: 0 !important; }
.markdown-content :deep(p) { margin: 0 0 0.4em 0; }
.markdown-content :deep(p:last-child) { margin-bottom: 0; }

.markdown-content :deep(pre) {
  background: #f6f8fa;
  color: #24292e;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  overflow-x: auto;
  margin: 0.4em 0;
  font-size: 0.8125em;
  border: 1px solid #e1e4e8;
}

.markdown-content :deep(code) {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.875em;
}

.markdown-content :deep(code:not(pre code)) {
  background: #f0f0f0;
  color: #d63384;
  padding: 0.1em 0.35em;
  border-radius: 3px;
}

.input-area {
  padding: 0.75rem 1rem 1rem;
  background: var(--p-surface-card);
  border-top: 1px solid var(--p-surface-border);
  flex-shrink: 0;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: color-mix(in srgb, var(--p-red-500) 10%, transparent);
  color: var(--p-red-700);
  border-radius: var(--p-border-radius-md);
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
}

.error-banner span { flex: 1; }

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
  line-height: 1.5;
  overflow-y: auto !important;
}

.message-input:focus { outline: none !important; }

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

.char-count.warn { color: var(--p-orange-600); }

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

.clear-dialog { max-width: 400px; }

.slide-down-enter-active, .slide-down-leave-active { transition: all 0.2s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-10px); }

.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.fade-up-enter-active, .fade-up-leave-active { transition: all 0.2s ease; }
.fade-up-enter-from, .fade-up-leave-to { opacity: 0; transform: translateY(10px); }

.message-enter-active { transition: all 0.3s ease-out; }
.message-leave-active { transition: all 0.2s ease-in; }
.message-enter-from { opacity: 0; transform: translateY(20px); }
.message-leave-to { opacity: 0; transform: translateX(-20px); }

@media (max-width: 768px) {
  .chat-header { flex-direction: column; align-items: stretch; gap: 0.75rem; padding: 0.75rem; }
  .header-left { justify-content: space-between; }
  .header-controls { flex-wrap: wrap; justify-content: space-between; }
  .model-select { min-width: 0; flex: 1; }
  .settings-content { flex-direction: column; gap: 1rem; }
  .input-hint { display: none; }
}

:root.dark .connection-status { background: color-mix(in srgb, var(--p-red-400) 15%, transparent); color: var(--p-red-400); }
:root.dark .connection-status.connected { background: color-mix(in srgb, var(--p-green-400) 15%, transparent); color: var(--p-green-400); }
:root.dark .assistant-bubble { background: var(--p-surface-700); border-color: var(--p-surface-600); }
:root.dark .user-bubble { background: #166534; color: #dcfce7; border-color: #15803d; }
:root.dark .assistant-avatar { background: var(--p-surface-600); }
:root.dark .user-avatar { background: #15803d; color: #dcfce7; }
:root.dark .input-container { border-color: var(--p-surface-500); }
:root.dark .input-hint kbd { background: #374151; border-color: #4b5563; color: #e5e7eb; }
:root.dark .markdown-content :deep(pre) { background: #1e1e1e; color: #d4d4d4; border-color: #333; }
:root.dark .markdown-content :deep(code:not(pre code)) { background: #374151; color: #f472b6; }
</style>