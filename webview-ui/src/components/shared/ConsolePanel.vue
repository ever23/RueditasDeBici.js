<template>
  <FloatingWindow
    title="Consola de Salida Virtual"
    icon="🖥️"
    :initialX="800"
    :initialY="60"
    :initialWidth="320"
    :initialHeight="160"
    :start-minimized="true"
    :minimized-index="0"
    v-model:minimized="isMinimized"
  >
    <div class="box-header-actions" style="display: flex; justify-content: flex-end; padding: 4px 8px; background: #252526; border-bottom: 1px solid #333;">
      <button class="btn-clear" @click.stop="$emit('clear')">Limpiar Consola</button>
    </div>
    <div class="box-body console-body" ref="consoleBodyRef" style="height: 100%; overflow: auto;">
      <div v-if="logs.length === 0 && !showPrompt" class="empty-state">
        Sin salidas de pantalla todavía
      </div>
      <div v-else class="console-lines">
        <div v-for="(log, idx) in logs" :key="idx" class="console-line">
          <span class="prompt-symbol">&gt;</span> {{ log }}
        </div>
        <div v-if="showPrompt" class="console-prompt-line">
          <span class="prompt-symbol">?</span> <span style="margin-right: 8px;">{{ promptText }}</span>
          <input
            ref="promptInputRef"
            :value="inputValue"
            type="text"
            class="console-input"
            aria-label="Entrada de consola interactiva"
            placeholder="Escribe aquí y presiona Enter (↑/↓ historial)..."
            @input="$emit('update:inputValue', ($event.target as HTMLInputElement).value)"
            @keydown.up.prevent="navigateHistory(-1)"
            @keydown.down.prevent="navigateHistory(1)"
            @keyup.enter="handleSubmit"
          />
        </div>
      </div>
    </div>
  </FloatingWindow>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import FloatingWindow from './FloatingWindow.vue';

const isMinimized = ref(true);
const inputHistory = ref<string[]>([]);
const historyIndex = ref(-1);

const props = defineProps<{
  logs: string[];
  showPrompt: boolean;
  promptText: string;
  inputValue: string;
}>();

const emit = defineEmits<{
  (e: 'clear'): void;
  (e: 'submit'): void;
  (e: 'update:inputValue', value: string): void;
}>();

const consoleBodyRef = ref<HTMLElement | null>(null);
const promptInputRef = ref<HTMLInputElement | null>(null);

const handleSubmit = () => {
  if (props.inputValue.trim() !== '') {
    inputHistory.value.push(props.inputValue);
  }
  historyIndex.value = inputHistory.value.length;
  emit('submit');
};

const navigateHistory = (direction: number) => {
  if (inputHistory.value.length === 0) return;
  const nextIdx = historyIndex.value + direction;
  if (nextIdx >= 0 && nextIdx < inputHistory.value.length) {
    historyIndex.value = nextIdx;
    emit('update:inputValue', inputHistory.value[nextIdx]);
  } else if (nextIdx >= inputHistory.value.length) {
    historyIndex.value = inputHistory.value.length;
    emit('update:inputValue', '');
  }
};

const scrollToBottom = () => {
  nextTick(() => {
    if (consoleBodyRef.value) {
      consoleBodyRef.value.scrollTop = consoleBodyRef.value.scrollHeight;
    }
  });
};

const expandConsole = () => {
  isMinimized.value = false;
};

watch(() => props.logs.length, (newLen, oldLen) => {
  scrollToBottom();
  if (newLen > 0 && newLen > (oldLen || 0)) {
    expandConsole();
  }
});

watch(() => props.showPrompt, (val) => {
  if (val) {
    historyIndex.value = inputHistory.value.length;
    expandConsole();
    scrollToBottom();
    nextTick(() => promptInputRef.value?.focus());
  }
});

defineExpose({ scrollToBottom, expandConsole });
</script>
