<template>
  <FloatingWindow
    title="Procesador (CPU / ALU)"
    icon="⚡"
    :initialX="800"
    :initialY="450"
    :initialWidth="320"
    :initialHeight="150"
  >
    <div class="box-body cpu-body" ref="cpuBodyRef" style="height: 100%; overflow: auto;">
      <div v-if="logs.length === 0" class="empty-state">
        Esperando inicio de simulación...
      </div>
      <div v-else class="cpu-lines">
        <div v-for="(log, idx) in logs" :key="idx" class="cpu-line">
          <span class="cpu-symbol">⚙️</span> {{ log }}
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
}>();

const cpuBodyRef = ref<HTMLElement | null>(null);

const scrollToBottom = () => {
  nextTick(() => {
    if (cpuBodyRef.value) {
      cpuBodyRef.value.scrollTop = cpuBodyRef.value.scrollHeight;
    }
  });
};

watch(() => props.logs.length, scrollToBottom);

defineExpose({ scrollToBottom });
</script>
