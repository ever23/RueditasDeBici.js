<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import NestedScope from './NestedScope.vue';
import FloatingWindow from './FloatingWindow.vue';

const props = defineProps<{
  callStack?: { name: string, variables: Record<string, any> }[];
  changedVars?: Set<string>;
}>();

const isMinimized = ref(true);

const scopes = computed(() => {
  return props.callStack || [];
});
</script>

<template>
  <FloatingWindow
    title="Memoria RAM y Ámbitos"
    icon="💾"
    :initialX="800"
    :initialY="240"
    :initialWidth="350"
    :initialHeight="240"
    :start-minimized="true"
    :minimized-index="1"
    v-model:minimized="isMinimized"
  >
    <div class="panel-body" style="height: 100%; overflow: auto; padding: 10px;">
      <div v-if="scopes.length === 0" class="empty-state">
        Ejecución no iniciada
      </div>
      
      <div class="scopes-stack">
        <NestedScope :scopes="scopes" :depth="0" :changed-vars="changedVars || new Set()" />
      </div>
    </div>
  </FloatingWindow>
</template>

<style scoped>
.scope-panel-container {
  background-color: #1e1e1e;
  border-radius: 8px;
  border: 1px solid #333;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
}

.panel-header {
  background-color: #252526;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid #333;
}

.panel-icon {
  font-size: 16px;
}

.panel-title {
  color: #cccccc;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.panel-body {
  padding: 12px;
  overflow-y: auto;
  flex: 1;
}

.empty-state {
  color: #666;
  text-align: center;
  font-size: 12px;
  font-style: italic;
  padding: 20px 0;
}

.scopes-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.scope-card {
  background-color: #2a2d3e;
  border-radius: 6px;
  border: 1px solid #444;
  overflow: hidden;
  transition: all 0.3s ease;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.scope-card.is-top {
  border-color: #a855f7;
  box-shadow: 0 0 10px rgba(168, 85, 247, 0.2);
}

.scope-card.is-global {
  background-color: #1e293b;
  border-color: #334155;
}

.scope-card.is-global.is-top {
  border-color: #3b82f6;
  box-shadow: 0 0 10px rgba(59, 130, 246, 0.2);
}

.scope-header {
  background-color: rgba(0, 0, 0, 0.2);
  padding: 6px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.scope-icon {
  font-size: 14px;
}

.scope-name {
  color: #e2e8f0;
  font-size: 13px;
  font-weight: 600;
  flex: 1;
}

.active-badge {
  background-color: #a855f7;
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: bold;
}

.is-global .active-badge {
  background-color: #3b82f6;
}

.scope-vars {
  padding: 8px 10px;
}

.no-vars {
  color: #64748b;
  font-size: 12px;
  font-style: italic;
  text-align: center;
  padding: 4px 0;
}

.var-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.var-item {
  display: flex;
  align-items: center;
  font-family: 'Consolas', 'Courier New', monospace;
  font-size: 13px;
  background-color: rgba(0, 0, 0, 0.15);
  padding: 4px 8px;
  border-radius: 4px;
}

.var-name {
  color: #9cdcfe;
}

.var-equals {
  color: #d4d4d4;
  margin: 0 6px;
}

.var-value {
  color: #ce9178;
  word-break: break-all;
}
</style>
