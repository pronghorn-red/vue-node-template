<!-- src/views/ChatView.vue -->
<template>
  <div class="chat-view">
    <Chat />
  </div>
</template>

<script setup>
import Chat from '@/components/Chat.vue'
</script>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 80px);
  /* padding: 1.5rem; */
  background: var(--p-surface-ground);
}
</style>