<template>
  <div class="flowchart-canvas">
    <!-- BARRA SUPERIOR DE CONTROLES DE SIMULACIÓN (Player Controls) -->
    <div class="sim-toolbar" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
      <div class="toolbar-left" style="display: flex; gap: 8px; align-items: center;">
        <button v-if="!isSimulating" class="btn btn-play" @click="startSim">
          ▶ Simular en Vivo
        </button>
        <template v-else>
          <button class="btn btn-step" @click="nextStep">⏭ Siguiente Paso</button>
          <button class="btn btn-stop" @click="restartSim">🔄 Reiniciar</button>
          <button class="btn btn-stop" @click="stopSim">⏹ Detener</button>
          <span v-if="totalSteps > 0" class="step-counter">Paso {{ currentStep }} de {{ totalSteps }}</span>
        </template>
      </div>
      
      <div class="toolbar-right" style="display: flex; gap: 16px; align-items: center;">
        <div class="speed-selector">
          <label>Velocidad:</label>
          <select v-model="selectedSpeed" @change="changeSpeed">
            <option :value="2000">Lenta (2.0s)</option>
            <option :value="1200">Normal (1.2s)</option>
            <option :value="600">Rápida (0.6s)</option>
          </select>
        </div>
        <div class="author-credits" style="font-size: 0.75rem; color: #888; text-align: right;">
          Desarrollado por<br>
          <strong>Ing. Enyreber Franco</strong>
        </div>
      </div>
    </div>

    <!-- BANNER DE ERROR DE PARSING -->
    <div v-if="parseError" class="parse-error-banner">
      ❌ Error de sintaxis en línea {{ parseErrorLine }}: {{ parseError }}
    </div>

    <!-- BANNER DE ERROR DE EJECUCIÓN (RUNTIME) -->
    <div v-if="runtimeError" class="parse-error-banner runtime-error">
      ⚠️ Error en la simulación: {{ runtimeError }}
    </div>

    <!-- CANVAS DEL DIAGRAMA CON VUEFLOW -->
    <VueFlow
      :nodes="nodes"
      :edges="edges"
      :node-types="nodeTypes"
      :min-zoom="0.05"
      :max-zoom="4"
      @node-click="handleNodeClick"
      fit-view-on-init
    >
      <Background variant="dots" :gap="16" :size="1" />
      <Controls />
      <MiniMap />
    </VueFlow>

    <!-- WIDGETS PEDAGÓGICOS: MEMORIA (RAM), CPU Y CONSOLA DE SALIDA VIRTUAL -->
    <div class="hardware-inspector">
      <!-- CONSOLA DE SALIDA VIRTUAL -->
      <div class="hardware-box console-box">
        <div class="box-header">
          <span class="icon">🖥️</span>
          <strong>Consola de Salida Virtual</strong>
          <button class="btn-clear" @click="consoleLogs = []">Limpiar</button>
        </div>
        <div class="box-body console-body" ref="consoleBodyRef">
          <div v-if="consoleLogs.length === 0 && !showPromptModal" class="empty-state">
            Sin salidas de pantalla todavía
          </div>
          <div v-else class="console-lines">
            <div v-for="(log, idx) in consoleLogs" :key="idx" class="console-line">
              <span class="prompt-symbol">&gt;</span> {{ log }}
            </div>
            <div v-if="showPromptModal" class="console-prompt-line">
              <span class="prompt-symbol">?</span> <span style="margin-right: 8px;">{{ activePromptText }}</span>
              <input
                ref="promptInputRef"
                v-model="inputValue"
                type="text"
                class="console-input"
                placeholder="Escribe aquí y presiona Enter..."
                @keyup.enter="submitPromptValue"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- CUADRO DE MEMORIA RAM -->
      <div class="hardware-box ram-box">
        <div class="box-header">
          <span class="icon">💾</span>
          <strong>Memoria RAM (Variables)</strong>
        </div>
        <div class="box-body">
          <div v-if="Object.keys(memoryState).length === 0" class="empty-state">
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
              <tr v-for="(val, varName) in memoryState" :key="varName" :class="{ 'row-changed': changedVars.has(varName as string) }">
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
                  <template v-else>
                    {{ JSON.stringify(val) }}
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- CUADRO DE UNIDAD DE PROCESAMIENTO CPU / ALU -->
      <div class="hardware-box cpu-box">
        <div class="box-header">
          <span class="icon">⚡</span>
          <strong>Procesador (CPU / ALU)</strong>
        </div>
        <div class="box-body cpu-body" ref="cpuBodyRef">
          <div v-if="cpuLogs.length === 0" class="empty-state">
            Esperando inicio de simulación...
          </div>
          <div v-else class="cpu-lines">
            <div v-for="(log, idx) in cpuLogs" :key="idx" class="cpu-line">
              <span class="cpu-symbol">⚙️</span> {{ log }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- EL MODAL FUE ELIMINADO EN FAVOR DEL INPUT EN LA CONSOLA -->
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '../styles/flowchart.css';

import { useVsCodeApi } from '../composables/useVsCodeApi';
import { StartEndNode, ProcessNode, DecisionNode, LoopNode, IONode, SubroutineNode, FunctionGroupNode } from './nodes/CustomNodes';
import { getLayoutedElements } from '../utils/layout';
import type { FlowchartNode, FlowchartEdge } from '../../../src/shared/types';

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

const nodeTypes = {
  startEnd: StartEndNode,
  process: ProcessNode,
  subroutine: SubroutineNode,
  decision: DecisionNode,
  loop: LoopNode,
  io: IONode,
  functionGroup: FunctionGroupNode,
} as any;

const nodes = ref<FlowchartNode[]>([]);
const edges = ref<FlowchartEdge[]>([]);

// Estado de Simulación y Hardware
const isSimulating = ref(false);
const selectedSpeed = ref(1200);
const memoryState = ref<Record<string, any>>({});
const cpuLogs = ref<string[]>([]);
const consoleLogs = ref<string[]>([]);
const visitedEdgeIds = ref<Set<string>>(new Set());
let lastActiveNodeId = '';
const currentStep = ref(0);
const totalSteps = ref(0);
// Estado de errores
const parseError = ref('');
const parseErrorLine = ref<number>(0);
const runtimeError = ref('');

const expandedArrays = ref<Set<string>>(new Set());
const changedVars = ref<Set<string>>(new Set());

const toggleExpand = (varName: string) => {
  if (expandedArrays.value.has(varName)) {
    expandedArrays.value.delete(varName);
  } else {
    expandedArrays.value.add(varName);
  }
};

const cpuBodyRef = ref<HTMLElement | null>(null);
const consoleBodyRef = ref<HTMLElement | null>(null);

const scrollToBottom = () => {
  nextTick(() => {
    if (cpuBodyRef.value) {
      cpuBodyRef.value.scrollTop = cpuBodyRef.value.scrollHeight;
    }
    if (consoleBodyRef.value) {
      consoleBodyRef.value.scrollTop = consoleBodyRef.value.scrollHeight;
    }
  });
};

// Estado de Modal de Entrada (Leer / prompt)
const showPromptModal = ref(false);
const activePromptText = ref('');
const inputValue = ref('');
const promptInputRef = ref<HTMLInputElement | null>(null);

const { postMessage, onMessage } = useVsCodeApi();
const { fitView } = useVueFlow();

onMessage((message) => {
  if (message.type === 'update:flowchart') {
    parseError.value = '';
    const rawNodes = message.payload.nodes;
    const rawEdges = message.payload.edges;
    
    const layouted = getLayoutedElements(rawNodes, rawEdges, 'TB');
    nodes.value = layouted.nodes;
    edges.value = layouted.edges;
  }
  else if (message.type === 'error:parse') {
    parseError.value = message.payload.message;
    parseErrorLine.value = message.payload.line;
  }
  else if (message.type === 'error:runtime') {
    runtimeError.value = message.payload.message;
    stopSim();
  }
  else if (message.type === 'simulation:step') {
    isSimulating.value = true;
    runtimeError.value = '';

    const oldMemory = memoryState.value;
    const newMemory = message.payload.memory;
    
    changedVars.value.clear();
    for (const key in newMemory) {
      if (JSON.stringify(oldMemory[key]) !== JSON.stringify(newMemory[key])) {
        changedVars.value.add(key);
      }
    }
    memoryState.value = newMemory;
    
    cpuLogs.value.push(message.payload.cpuOperation);
    currentStep.value = message.payload.currentStep || 0;
    totalSteps.value = message.payload.totalSteps || 0;

    if (message.payload.outputLog) {
      consoleLogs.value.push(message.payload.outputLog);
    }
    
    scrollToBottom();

    const activeNodeId = message.payload.activeNodeId;
    const activeLine = message.payload.codeLine;

    if (lastActiveNodeId && activeNodeId && lastActiveNodeId !== activeNodeId) {
      const connectingEdge = edges.value.find(
        (e: FlowchartEdge) => e.source === lastActiveNodeId && e.target === activeNodeId
      );
      if (connectingEdge) {
        visitedEdgeIds.value.add(connectingEdge.id);
      }
    }
    lastActiveNodeId = activeNodeId;

    nodes.value = nodes.value.map((n: FlowchartNode) => {
      const isMatch = n.id === activeNodeId || n.data.codeLine === activeLine;
      return {
        ...n,
        class: isMatch ? 'node-active-sim' : '',
      };
    });

    edges.value = edges.value.map((e: FlowchartEdge) => {
      const isCurrentActiveEdge = lastActiveNodeId && e.source === lastActiveNodeId && e.target === activeNodeId;
      const isVisited = visitedEdgeIds.value.has(e.id);

      return {
        ...e,
        animated: isCurrentActiveEdge || e.id.includes('loopback'),
        class: isVisited ? 'edge-trail-visited' : (isCurrentActiveEdge ? 'edge-trail-active' : ''),
      };
    });

    if (activeNodeId) {
      nextTick(() => {
        fitView({ nodes: [activeNodeId], duration: 600, maxZoom: 1.1 });
      });
    }
  }
  else if (message.type === 'simulation:prompt') {
    showPromptModal.value = true;
    activePromptText.value = message.payload.promptText || `Ingrese un valor para ${message.payload.varName}:`;
    inputValue.value = '';
    
    scrollToBottom();
    
    nextTick(() => {
      promptInputRef.value?.focus();
    });
  }
  else if (message.type === 'simulation:end') {
    cpuLogs.value.push('✔ Simulación completada con éxito.');
    isSimulating.value = false;
    showPromptModal.value = false;
    scrollToBottom();
  }
});

const submitPromptValue = () => {
  showPromptModal.value = false;
  consoleLogs.value.push(`${activePromptText.value} ${inputValue.value}`);
  scrollToBottom();
  postMessage({
    type: 'simulation:submitInput',
    payload: { value: inputValue.value },
  });
};

const startSim = () => {
  isSimulating.value = true;
  consoleLogs.value = [];
  cpuLogs.value = [];
  visitedEdgeIds.value.clear();
  lastActiveNodeId = '';
  postMessage({ type: 'simulation:start' });
};

const nextStep = () => {
  postMessage({ type: 'simulation:next' });
};

const restartSim = () => {
  stopSim();
  // Se requiere un pequeño timeout para que los estados se reseteen en el provider y vista
  setTimeout(() => {
    startSim();
  }, 100);
};

const stopSim = () => {
  isSimulating.value = false;
  if (simulationTimer.value) {
    clearTimeout(simulationTimer.value);
    simulationTimer.value = undefined;
  }
  nodes.value = nodes.value.map((n: FlowchartNode) => ({ ...n, class: '' }));
  edges.value = edges.value.map((e: FlowchartEdge) => ({ ...e, animated: e.id.includes('loopback'), class: '' }));
  visitedEdgeIds.value.clear();
  lastActiveNodeId = '';
  postMessage({ type: 'simulation:stop' });
  scrollToBottom();
};

const changeSpeed = () => {
  postMessage({
    type: 'simulation:speed',
    payload: { speedMs: selectedSpeed.value },
  });
};

const handleNodeClick = (event: any) => {
  const node = event.node as FlowchartNode;
  if (node && node.data && node.data.codeLine) {
    postMessage({
      type: 'node:click',
      payload: {
        nodeId: node.id,
        line: node.data.codeLine,
      },
    });
  }
};

postMessage({ type: 'ready' });
</script>

<style scoped>
.row-changed td {
  background-color: rgba(255, 215, 0, 0.2);
  transition: background-color 0.3s ease;
}
.array-header:hover {
  text-decoration: underline;
}
</style>
