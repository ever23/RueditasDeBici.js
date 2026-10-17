<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { useVsCodeApi } from '../../composables/useVsCodeApi';

const { postMessage } = useVsCodeApi();

const props = defineProps<{
  scopes: { name: string, variables: Record<string, any> }[];
  depth: number;
  changedVars: Set<string>;
}>();

const currentScope = computed(() => props.scopes[props.depth]);
const hasChild = computed(() => props.depth + 1 < props.scopes.length);

const isTop = computed(() => props.depth === props.scopes.length - 1);
const isGlobal = computed(() => props.depth === 0);

// Filtrar helpers internos del simulador (como prompt = "[Interfaz de Teclado]") para no confundir al estudiante
const visibleVariables = computed(() => {
  if (!currentScope.value || !currentScope.value.variables) return {};
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(currentScope.value.variables)) {
    if (k === 'prompt' && v === '[Interfaz de Teclado]') continue;
    result[k] = v;
  }
  return result;
});

const expandedArrays = ref<Set<string>>(new Set());
const scopeContainer = ref<HTMLElement | null>(null);

const toggleExpand = (varName: string) => {
  if (expandedArrays.value.has(varName)) {
    expandedArrays.value.delete(varName);
  } else {
    expandedArrays.value.add(varName);
  }
};

const handleFunctionClick = (funcObj: any) => {
  if (funcObj && funcObj.line) {
    postMessage({
      type: 'node:click',
      payload: {
        nodeId: funcObj.nodeId || `hidden_${funcObj.line}`,
        line: funcObj.line,
      },
    });
  }
};

const getDataType = (val: any): string => {
  if (val === undefined) return 'Undefined';
  if (val === null) return 'Null';
  if (val && typeof val === 'object' && val.__type === 'Function') return 'Function';
  if (Array.isArray(val)) return `Array(${val.length})`;
  
  const t = typeof val;
  if (t === 'number') return 'Number';
  if (t === 'string') return 'String';
  if (t === 'boolean') return 'Boolean';
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
      'is-empty': Object.keys(visibleVariables).length === 0 && !isGlobal 
    }"
  >
    <div class="scope-header">
      <span class="scope-icon">{{ isGlobal ? '🌍' : '⚡' }}</span>
      <span class="scope-name">
        {{ isGlobal ? 'Ámbito Global' : `Función: ${currentScope.name}()` }}
      </span>
      <span v-if="isTop" class="active-badge">Activo</span>
    </div>
    
    <div class="scope-vars">
      <div v-if="Object.keys(visibleVariables).length === 0" class="no-vars">
        Sin variables declaradas en este ámbito todavía
      </div>
      <table v-else class="memory-table">
        <thead>
          <tr>
            <th style="width: 34%;">Variable</th>
            <th style="width: 24%;">Tipo</th>
            <th style="width: 42%;">Valor Actual</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(val, varName) in visibleVariables" :key="varName" :class="{ 'row-changed': changedVars.has(varName as string) }">
            <td class="var-name">{{ varName }}</td>
            <td class="var-type">
              <span v-if="val && typeof val === 'object' && val.__type === 'Function'" class="badge-type badge-type-function">Función</span>
              <span v-else class="badge-type">{{ getDataType(val) }}</span>
            </td>
            <td class="var-value">
              <template v-if="val && typeof val === 'object' && val.__type === 'Function'">
                <button 
                  type="button" 
                  class="func-chip" 
                  @click="handleFunctionClick(val)"
                  title="Clic para enfocar la función en el código y en el diagrama"
                >
                  <span class="func-symbol">ƒ</span>
                  <span class="func-sig">{{ val.signature || 'ƒ()' }}</span>
                </button>
              </template>
              <template v-else-if="Array.isArray(val)">
                <div class="array-header" @click="toggleExpand(varName as string)">
                  <span class="expand-icon">{{ expandedArrays.has(varName as string) ? '▼' : '▶' }}</span>
                  [ {{ val.length }} elementos ]
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
                  { {{ Object.keys(val).length }} props }
                </div>
                <div v-if="expandedArrays.has(varName as string)" class="array-elements" style="border-left: 1px solid #a855f7;">
                  <div v-for="(item, key) in val" :key="key" class="array-item">
                    <span class="array-idx">{{ key }}:</span> {{ JSON.stringify(item) }}
                  </div>
                </div>
              </template>
              <template v-else>
                <span :class="{ 'val-number': typeof val === 'number', 'val-boolean': typeof val === 'boolean', 'val-string': typeof val === 'string' }">
                  {{ JSON.stringify(val) }}
                </span>
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
  table-layout: fixed;
}

.memory-table th {
  text-align: left;
  padding: 5px 6px;
  color: #94a3b8;
  font-weight: 600;
  border-bottom: 1px solid #334155;
  background-color: rgba(15, 23, 42, 0.5);
  font-size: 11px;
}

.memory-table td {
  padding: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  vertical-align: middle;
}

.var-name {
  color: #7dd3fc;
  font-family: 'Consolas', 'Courier New', monospace;
  font-weight: 700;
  word-break: break-word;
}

.var-type {
  color: #4ec9b0;
  text-align: left !important;
}

.badge-type {
  display: inline-block;
  background: rgba(20, 184, 166, 0.14);
  color: #2dd4bf;
  border: 1px solid rgba(45, 212, 191, 0.3);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10.5px;
  font-weight: 600;
  font-style: normal;
}

.var-value {
  color: #fbbf24;
  font-family: 'Consolas', 'Courier New', monospace;
  word-break: break-word;
  text-align: left !important;
}

.val-number {
  color: #34d399;
  font-weight: 700;
}

.val-boolean {
  color: #38bdf8;
  font-weight: 700;
}

.val-string {
  color: #fb923c;
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
  0% { background-color: rgba(250, 204, 21, 0.55); }
  100% { background-color: rgba(250, 204, 21, 0.12); }
}

.row-changed td {
  animation: flash-yellow 1s ease-out;
  background-color: rgba(250, 204, 21, 0.12);
}

.nested-child-container {
  padding: 4px 6px 6px 6px;
}

.badge-type-function {
  background: rgba(168, 85, 247, 0.2);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.4);
}

.func-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(168, 85, 247, 0.15);
  border: 1px solid #a855f7;
  color: #e9d5ff;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 11.5px;
  font-family: monospace;
  cursor: pointer;
  transition: all 0.2s ease;
}

.func-chip:hover {
  background: rgba(168, 85, 247, 0.35);
  box-shadow: 0 0 10px rgba(168, 85, 247, 0.5);
  transform: translateY(-1px);
}

.func-symbol {
  color: #c084fc;
  font-weight: bold;
}
</style>
