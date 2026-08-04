<template>
  <FloatingWindow
    title="Consola de Salida Virtual"
    icon="🖥️"
    :initialX="800"
    :initialY="20"
    :initialWidth="320"
    :initialHeight="150"
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
            placeholder="Escribe aquí y presiona Enter..."
            @input="$emit('update:inputValue', ($event.target as HTMLInputElement).value)"
            @keyup.enter="$emit('submit')"
          />
        </div>
      </div>
    </div>
  </FloatingWindow>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import FloatingWindow from './FloatingWindow.vue';

const isCollapsed = ref(false);

const props = defineProps<{
  logs: string[];
  showPrompt: boolean;
  promptText: string;
  inputValue: string;
}>();

defineEmits<{
  (e: 'clear'): void;
  (e: 'submit'): void;
  (e: 'update:inputValue', value: string): void;
}>();

const consoleBodyRef = ref<HTMLElement | null>(null);
const promptInputRef = ref<HTMLInputElement | null>(null);

const scrollToBottom = () => {
  nextTick(() => {
    if (consoleBodyRef.value) {
      consoleBodyRef.value.scrollTop = consoleBodyRef.value.scrollHeight;
    }
  });
};

watch(() => props.logs.length, scrollToBottom);
watch(() => props.showPrompt, (val) => {
  if (val) {
    scrollToBottom();
    nextTick(() => promptInputRef.value?.focus());
  }
});

defineExpose({ scrollToBottom });
</script>
