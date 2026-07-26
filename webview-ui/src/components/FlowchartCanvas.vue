<template>
  <div class="flowchart-canvas">
    <!-- BARRA SUPERIOR DE CONTROLES DE SIMULACIÓN (Player Controls) -->
    <div class="sim-toolbar">
      <button v-if="!isSimulating" class="btn btn-play" @click="startSim">
        ▶ Simular en Vivo
      </button>
      <template v-else>
        <button class="btn btn-step" @click="nextStep">⏭ Siguiente Paso</button>
        <button class="btn btn-stop" @click="stopSim">⏹ Detener</button>
      </template>
      <div class="speed-selector">
        <label>Velocidad:</label>
        <select v-model="selectedSpeed" @change="changeSpeed">
          <option :value="2000">Lenta (2.0s)</option>
          <option :value="1200">Normal (1.2s)</option>
          <option :value="600">Rápida (0.6s)</option>
        </select>
      </div>
    </div>

    <!-- CANVAS DEL DIAGRAMA CON VUEFLOW -->
    <VueFlow
      :nodes="nodes"
      :edges="edges"
      :node-types="nodeTypes"
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
        <div class="box-body console-body">
          <div v-if="consoleLogs.length === 0" class="empty-state">
            Sin salidas de pantalla todavía
          </div>
          <div v-else class="console-lines">
            <div v-for="(log, idx) in consoleLogs" :key="idx" class="console-line">
              <span class="prompt-symbol">&gt;</span> {{ log }}
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
                <th>Valor Actual</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(val, varName) in memoryState" :key="varName">
                <td class="var-name">{{ varName }}</td>
                <td class="var-value">{{ JSON.stringify(val) }}</td>
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
        <div class="box-body">
          <div class="cpu-log">
            {{ currentCpuOp || 'Esperando inicio de simulación...' }}
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL DE ENTRADA TECLADO (ÚLTIMO EN EL DOM = MÁXIMA PRIORIDAD VISUAL) -->
    <div v-if="showPromptModal" class="prompt-modal-overlay">
      <div class="prompt-modal-box">
        <div class="prompt-header">
          <span class="icon">📥</span>
          <strong>Entrada de Datos (Leer)</strong>
        </div>
        <div class="prompt-body">
          <p class="prompt-text">{{ activePromptText }}</p>
          <input
            ref="promptInputRef"
            v-model="inputValue"
            type="text"
            class="prompt-input"
            placeholder="Ingrese un valor..."
            @keyup.enter="submitPromptValue"
          />
        </div>
        <div class="prompt-footer">
          <button class="btn btn-play" @click="submitPromptValue">Ingresar Dato ➔</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { VueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '../styles/flowchart.css';

import { useVsCodeApi } from '../composables/useVsCodeApi';
import { StartEndNode, ProcessNode, DecisionNode, LoopNode, IONode, SubroutineNode, FunctionGroupNode } from './nodes/CustomNodes';
import { getLayoutedElements } from '../utils/layout';
import type { FlowchartNode, FlowchartEdge } from '../../src/shared/types';

const nodeTypes = {
  startEnd: StartEndNode,
  process: ProcessNode,
  subroutine: SubroutineNode,
  decision: DecisionNode,
  loop: LoopNode,
  io: IONode,
  functionGroup: FunctionGroupNode,
};

const nodes = ref<FlowchartNode[]>([]);
const edges = ref<FlowchartEdge[]>([]);

// Estado de Simulación y Hardware
const isSimulating = ref(false);
const selectedSpeed = ref(1200);
const memoryState = ref<Record<string, any>>({});
const currentCpuOp = ref<string>('');
const consoleLogs = ref<string[]>([]);
const visitedEdgeIds = ref<Set<string>>(new Set());
let lastActiveNodeId = '';

// Estado de Modal de Entrada (Leer / prompt)
const showPromptModal = ref(false);
const activePromptText = ref('');
const inputValue = ref('');
const promptInputRef = ref<HTMLInputElement | null>(null);

const { postMessage, onMessage } = useVsCodeApi();

onMessage((message) => {
  if (message.type === 'update:flowchart') {
    const rawNodes = message.payload.nodes;
    const rawEdges = message.payload.edges;
    
    const layouted = getLayoutedElements(rawNodes, rawEdges, 'TB');
    nodes.value = layouted.nodes;
    edges.value = layouted.edges;
  }
  else if (message.type === 'simulation:step') {
    isSimulating.value = true;
    memoryState.value = message.payload.memory;
    currentCpuOp.value = message.payload.cpuOperation;

    if (message.payload.outputLog) {
      consoleLogs.value.push(message.payload.outputLog);
    }

    const activeNodeId = message.payload.activeNodeId;
    const activeLine = message.payload.codeLine;

    if (lastActiveNodeId && activeNodeId && lastActiveNodeId !== activeNodeId) {
      const connectingEdge = edges.value.find(
        e => e.source === lastActiveNodeId && e.target === activeNodeId
      );
      if (connectingEdge) {
        visitedEdgeIds.value.add(connectingEdge.id);
      }
    }
    lastActiveNodeId = activeNodeId;

    nodes.value = nodes.value.map((n) => {
      const isMatch = n.id === activeNodeId || n.data.codeLine === activeLine;
      return {
        ...n,
        class: isMatch ? 'node-active-sim' : '',
      };
    });

    edges.value = edges.value.map((e) => {
      const isCurrentActiveEdge = lastActiveNodeId && e.source === lastActiveNodeId && e.target === activeNodeId;
      const isVisited = visitedEdgeIds.value.has(e.id);

      return {
        ...e,
        animated: isCurrentActiveEdge || e.id.includes('loopback'),
        class: isVisited ? 'edge-trail-visited' : (isCurrentActiveEdge ? 'edge-trail-active' : ''),
      };
    });
  }
  else if (message.type === 'simulation:prompt') {
    showPromptModal.value = true;
    activePromptText.value = message.payload.promptText || `Ingrese un valor para ${message.payload.varName}:`;
    inputValue.value = '';
    
    nextTick(() => {
      promptInputRef.value?.focus();
    });
  }
  else if (message.type === 'simulation:end') {
    currentCpuOp.value = '✔ Simulación completada con éxito.';
    isSimulating.value = false;
    showPromptModal.value = false;
  }
});

const submitPromptValue = () => {
  showPromptModal.value = false;
  consoleLogs.value.push(`> ${inputValue.value}`);
  postMessage({
    type: 'simulation:submitInput',
    payload: { value: inputValue.value },
  });
};

const startSim = () => {
  isSimulating.value = true;
  consoleLogs.value = [];
  visitedEdgeIds.value.clear();
  lastActiveNodeId = '';
  postMessage({ type: 'simulation:start' });
};

const nextStep = () => {
  postMessage({ type: 'simulation:next' });
};

const stopSim = () => {
  isSimulating.value = false;
  showPromptModal.value = false;
  currentCpuOp.value = 'Simulación detenida.';
  visitedEdgeIds.value.clear();
  lastActiveNodeId = '';
  postMessage({ type: 'simulation:stop' });
  
  nodes.value = nodes.value.map(n => ({ ...n, class: '' }));
  edges.value = edges.value.map(e => ({ ...e, animated: e.id.includes('loopback'), class: '' }));
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
