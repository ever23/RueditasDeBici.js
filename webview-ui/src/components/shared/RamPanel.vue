<template>
  <div class="hardware-box ram-box">
    <div class="box-header" @click="isCollapsed = !isCollapsed" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="icon">💾</span>
        <strong>Memoria RAM (Variables)</strong>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 10px; color: #94a3b8;">{{ isCollapsed ? '▼' : '▲' }}</span>
      </div>
    </div>
    <div v-show="!isCollapsed" class="box-body">
      <div v-if="Object.keys(memory).length === 0" class="empty-state">
        Sin variables asignadas
      </div>
      <table v-else class="memory-table">
        <thead>
          <tr>
            <th>Variable</th>
            <th>Tipo</th>
            <th>Valor Actual</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(val, varName) in memory" :key="varName" :class="{ 'row-changed': changedVars.has(varName as string) }">
            <td class="var-name">{{ varName }}</td>
            <td class="var-type">{{ getDataType(val) }}</td>
            <td class="var-value">
              <template v-if="Array.isArray(val)">
                <div class="array-header" @click="toggleExpand(varName as string)" style="cursor: pointer; user-select: none; color: #4facfe;">
                  <span class="expand-icon">{{ expandedArrays.has(varName as string) ? '▼' : '▶' }}</span>
                  Array({{ val.length }})
                </div>
                <div v-if="expandedArrays.has(varName as string)" class="array-elements" style="padding-left: 10px; margin-top: 4px; font-size: 0.9em; border-left: 1px solid #4facfe;">
                  <div v-for="(item, i) in val" :key="i" class="array-item">
                    <span style="color: #888;">[{{ i }}]:</span> {{ JSON.stringify(item) }}
                  </div>
                </div>
              </template>
              <template v-else-if="val !== null && typeof val === 'object'">
                <div class="array-header" @click="toggleExpand(varName as string)" style="cursor: pointer; user-select: none; color: #a855f7;">
                  <span class="expand-icon">{{ expandedArrays.has(varName as string) ? '▼' : '▶' }}</span>
                  Object { {{ Object.keys(val).length }} }
                </div>
                <div v-if="expandedArrays.has(varName as string)" class="array-elements" style="padding-left: 10px; margin-top: 4px; font-size: 0.9em; border-left: 1px solid #a855f7;">
                  <div v-for="(item, key) in val" :key="key" class="array-item">
                    <span style="color: #888;">{{ key }}:</span> {{ JSON.stringify(item) }}
                  </div>
                </div>
              </template>
              <template v-else>
                {{ JSON.stringify(val) }}
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const isCollapsed = ref(false);

defineProps<{
  memory: Record<string, any>;
  changedVars: Set<string>;
}>();

const expandedArrays = ref<Set<string>>(new Set());

const toggleExpand = (varName: string) => {
  if (expandedArrays.value.has(varName)) {
    expandedArrays.value.delete(varName);
  } else {
    expandedArrays.value.add(varName);
  }
};

const getDataType = (val: any): string => {
  if (val === undefined) return 'Undefined';
  if (val === null) return 'Null';
  if (Array.isArray(val)) return 'Array';
  
  const t = typeof val;
  if (t === 'object') {
    return (val.constructor && val.constructor.name) ? val.constructor.name : 'Object';
  }
  
  return t.charAt(0).toUpperCase() + t.slice(1);
};
</script>

<style scoped>
@keyframes flash-yellow {
  0% { background-color: rgba(255, 215, 0, 0.7); }
  100% { background-color: rgba(255, 215, 0, 0.1); }
}

.row-changed td {
  animation: flash-yellow 1s ease-out;
  background-color: rgba(255, 215, 0, 0.1);
}
.array-header:hover {
  text-decoration: underline;
}
</style>
