<template>
  <FloatingWindow
    title="Procesador (CPU / ALU)"
    icon="⚡"
    :initialX="800"
    :initialY="500"
    :initialWidth="350"
    :initialHeight="170"
    :start-minimized="true"
    :minimized-index="2"
    v-model:minimized="isMinimized"
  >
    <div class="box-body cpu-body" ref="cpuBodyRef" style="height: 100%; overflow: auto;">
      <div v-if="logs.length === 0" class="empty-state">
        Esperando inicio de simulación...
      </div>
      <div v-else class="cpu-lines">
        <div
          v-for="(log, idx) in logs"
          :key="idx"
          :class="['cpu-line', { 'cpu-line-latest': idx === logs.length - 1 }]"
        >
          <span class="cpu-symbol">{{ idx === logs.length - 1 ? '▶' : '⚙️' }}</span> {{ log }}
        </div>
      </div>
    </div>
  </FloatingWindow>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import FloatingWindow from './FloatingWindow.vue';

const isMinimized = ref(true);

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

watch(() => props.logs.length, (newLen, oldLen) => {
  scrollToBottom();
  if (newLen > 0 && (oldLen === 0 || oldLen === undefined)) {
    isMinimized.value = false;
  }
});

defineExpose({ scrollToBottom });
</script>
