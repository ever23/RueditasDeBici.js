<template>
  <div class="hardware-box console-box">
    <div class="box-header">
      <span class="icon">🖥️</span>
      <strong>Consola de Salida Virtual</strong>
      <button class="btn-clear" @click="$emit('clear')">Limpiar</button>
    </div>
    <div class="box-body console-body" ref="consoleBodyRef">
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
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';

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
