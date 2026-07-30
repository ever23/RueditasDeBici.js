<template>
  <div class="hardware-box cpu-box">
    <div class="box-header" @click="isCollapsed = !isCollapsed" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="icon">⚡</span>
        <strong>Procesador (CPU / ALU)</strong>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 10px; color: #94a3b8;">{{ isCollapsed ? '▼' : '▲' }}</span>
      </div>
    </div>
    <div v-show="!isCollapsed" class="box-body cpu-body" ref="cpuBodyRef">
      <div v-if="logs.length === 0" class="empty-state">
        Esperando inicio de simulación...
      </div>
      <div v-else class="cpu-lines">
        <div v-for="(log, idx) in logs" :key="idx" class="cpu-line">
          <span class="cpu-symbol">⚙️</span> {{ log }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';

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
