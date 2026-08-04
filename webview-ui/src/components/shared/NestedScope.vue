<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';

const props = defineProps<{
  scopes: { name: string, variables: Record<string, any> }[];
  depth: number;
  changedVars: Set<string>;
}>();

const currentScope = computed(() => props.scopes[props.depth]);
const hasChild = computed(() => props.depth + 1 < props.scopes.length);

const isTop = computed(() => props.depth === props.scopes.length - 1);
const isGlobal = computed(() => props.depth === 0);

const expandedArrays = ref<Set<string>>(new Set());
const scopeContainer = ref<HTMLElement | null>(null);

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

// Scroll automático a la variable modificada
watch(() => props.changedVars, () => {
  nextTick(() => {
    if (scopeContainer.value) {
      const changedRow = scopeContainer.value.querySelector('.row-changed');
      if (changedRow) {
        changedRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  });
}, { deep: true, immediate: true });
</script>

<template>
  <div 
    v-if="currentScope"
    class="scope-card"
    ref="scopeContainer"
    :class="{ 
      'is-top': isTop, 
      'is-global': isGlobal,
      'is-empty': Object.keys(currentScope.variables).length === 0 && !isGlobal 
    }"
  >
    <div class="scope-header">
      <span class="scope-icon">{{ isGlobal ? '🌍' : '⚡' }}</span>
      <span class="scope-name">
        {{ isGlobal ? 'Ámbito Global' : `Ámbito Local: ${currentScope.name}()` }}
      </span>
      <span v-if="isTop" class="active-badge">Actual</span>
    </div>
    
    <div class="scope-vars">
      <div v-if="Object.keys(currentScope.variables).length === 0" class="no-vars">
        Sin variables declaradas
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
          <tr v-for="(val, varName) in currentScope.variables" :key="varName" :class="{ 'row-changed': changedVars.has(varName as string) }">
            <td class="var-name">{{ varName }}</td>
            <td class="var-type">{{ getDataType(val) }}</td>
            <td class="var-value">
              <template v-if="Array.isArray(val)">
                <div class="array-header" @click="toggleExpand(varName as string)">
                  <span class="expand-icon">{{ expandedArrays.has(varName as string) ? '▼' : '▶' }}</span>
                  Array({{ val.length }})
                </div>
                <div v-if="expandedArrays.has(varName as string)" class="array-elements">
                  <div v-for="(item, i) in val" :key="i" class="array-item">
                    <span class="array-idx">[{{ i }}]:</span> {{ JSON.stringify(item) }}
                  </div>
                </div>
              </template>
              <template v-else-if="val !== null && typeof val === 'object'">
                <div class="array-header" @click="toggleExpand(varName as string)" style="color: #a855f7;">
                  <span class="expand-icon">{{ expandedArrays.has(varName as string) ? '▼' : '▶' }}</span>
                  Object { {{ Object.keys(val).length }} }
                </div>
                <div v-if="expandedArrays.has(varName as string)" class="array-elements" style="border-left: 1px solid #a855f7;">
                  <div v-for="(item, key) in val" :key="key" class="array-item">
                    <span class="array-idx">{{ key }}:</span> {{ JSON.stringify(item) }}
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

    <!-- Renderizado recursivo para el siguiente ámbito en la pila -->
    <div v-if="hasChild" class="nested-child-container">
      <NestedScope :scopes="scopes" :depth="depth + 1" :changed-vars="changedVars" />
    </div>
  </div>
</template>

<style scoped>
.scope-card {
  background-color: #2a2d3e;
  border-radius: 6px;
  border: 1px solid #444;
  overflow: hidden;
  transition: all 0.3s ease;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  margin-bottom: 4px;
}

.scope-card.is-top {
  border-color: #a855f7;
  box-shadow: 0 0 10px rgba(168, 85, 247, 0.2);
}

.scope-card.is-global {
  background-color: transparent;
  border: none;
  box-shadow: none;
  border-radius: 0;
  margin-bottom: 0;
}

.scope-card.is-global > .scope-header {
  display: none;
}

.scope-card.is-global > .scope-vars {
  padding: 0 0 8px 0;
}

.scope-card.is-global > .nested-child-container {
  padding: 0;
}

.scope-card.is-empty {
  background-color: transparent;
  border: none;
  box-shadow: none;
  margin-bottom: 0;
  border-radius: 0;
}

.scope-card.is-empty > .scope-header {
  display: none;
}

.scope-card.is-empty > .scope-vars {
  display: none;
}

.scope-card.is-empty > .nested-child-container {
  padding: 0;
}

.scope-header {
  background-color: rgba(0, 0, 0, 0.2);
  padding: 4px 8px;
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
  padding: 4px 8px;
}

.no-vars {
  color: #64748b;
  font-size: 12px;
  font-style: italic;
  text-align: center;
  padding: 4px 0;
}

.memory-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.memory-table th {
  text-align: left;
  padding: 4px 6px;
  color: #94a3b8;
  font-weight: 600;
  border-bottom: 1px solid #334155;
  background-color: rgba(0, 0, 0, 0.1);
}

.memory-table td {
  padding: 4px 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  vertical-align: top;
}

.var-name {
  color: #9cdcfe;
  font-family: 'Consolas', 'Courier New', monospace;
  font-weight: 600;
}

.var-type {
  color: #4ec9b0;
}

.var-value {
  color: #ce9178;
  font-family: 'Consolas', 'Courier New', monospace;
  word-break: break-all;
}

.array-header {
  cursor: pointer;
  user-select: none;
  color: #4facfe;
  display: flex;
  align-items: center;
  gap: 4px;
}

.array-header:hover {
  text-decoration: underline;
}

.expand-icon {
  font-size: 10px;
}

.array-elements {
  padding-left: 10px;
  margin-top: 4px;
  font-size: 0.9em;
  border-left: 1px solid #4facfe;
}

.array-item {
  margin-bottom: 2px;
}

.array-idx {
  color: #888;
}

@keyframes flash-yellow {
  0% { background-color: rgba(255, 215, 0, 0.7); }
  100% { background-color: rgba(255, 215, 0, 0.1); }
}

.row-changed td {
  animation: flash-yellow 1s ease-out;
  background-color: rgba(255, 215, 0, 0.1);
}

.nested-child-container {
  padding: 0 8px 8px 8px;
}
</style>
