<template>
  <div class="flowchart-canvas">
    <!-- BARRA SUPERIOR DE CONTROLES DE SIMULACIÓN (Player Controls) -->
    <SimToolbar
      :is-simulating="isSimulating"
      :current-step="currentStep"
      :total-steps="totalSteps"
      :selected-speed="selectedSpeed"
      @start="startSim"
      @next="nextStep"
      @restart="restartSim"
      @stop="stopSim"
      @speed-change="changeSpeed"
    />

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
      <ConsolePanel
        :logs="consoleLogs"
        :show-prompt="showPromptModal"
        :prompt-text="activePromptText"
        v-model:input-value="inputValue"
        @clear="consoleLogs = []"
        @submit="submitPromptValue"
      />

      <!-- CUADRO DE MEMORIA RAM -->
      <RamPanel
        :memory="memoryState"
        :changed-vars="changedVars"
      />

      <!-- CUADRO DE UNIDAD DE PROCESAMIENTO CPU / ALU -->
      <CpuPanel :logs="cpuLogs" />
    </div>

    <!-- EL MODAL FUE ELIMINADO EN FAVOR DEL INPUT EN LA CONSOLA -->
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '../styles/flowchart.css';

import { useVsCodeApi } from '../composables/useVsCodeApi';
import { StartEndNode, ProcessNode, DecisionNode, LoopNode, InputNode, OutputNode, VariableNode, ConstantNode, SubroutineNode, FunctionGroupNode } from './nodes/CustomNodes';
import { getLayoutedElements } from '../utils/layout';
import type { FlowchartNode, FlowchartEdge } from '../../../src/shared/types';

import SimToolbar from './shared/SimToolbar.vue';
import ConsolePanel from './shared/ConsolePanel.vue';
import RamPanel from './shared/RamPanel.vue';
import CpuPanel from './shared/CpuPanel.vue';

const nodeTypes = {
  startEnd: StartEndNode,
  process: ProcessNode,
  subroutine: SubroutineNode,
  decision: DecisionNode,
  loop: LoopNode,
  input: InputNode,
  output: OutputNode,
  variable: VariableNode,
  constant: ConstantNode,
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

const changedVars = ref<Set<string>>(new Set());

// Estado de Modal de Entrada (Leer / prompt)
const showPromptModal = ref(false);
const activePromptText = ref('');
const inputValue = ref('');

const simulationTimer = ref<ReturnType<typeof setTimeout> | undefined>(undefined);

const props = defineProps<{
  initialData?: any;
}>();

const { postMessage, onMessage } = useVsCodeApi();
const { fitView } = useVueFlow();

const handleUpdateFlowchart = (payload: any) => {
  parseError.value = '';
  const rawNodes = payload.nodes;
  const rawEdges = payload.edges;
  
  try {
    const layouted = getLayoutedElements(rawNodes, rawEdges, 'TB');
    nodes.value = layouted.nodes;
    edges.value = layouted.edges;
  } catch (err: any) {
    console.error("Layout error:", err);
    runtimeError.value = "Error al organizar el diagrama: " + (err.message || String(err));
    nodes.value = rawNodes; // Fallback sin layout
    edges.value = rawEdges;
  }
};

onMounted(() => {
  if (props.initialData?.nodes) {
    handleUpdateFlowchart(props.initialData);
  }
});

onMessage((message) => {
  if (message.type === 'update:flowchart') {
    handleUpdateFlowchart(message.payload);
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
  }
  else if (message.type === 'simulation:end') {
    cpuLogs.value.push('✔ Simulación completada con éxito.');
    isSimulating.value = false;
    showPromptModal.value = false;
  }
});

const submitPromptValue = () => {
  showPromptModal.value = false;
  consoleLogs.value.push(`${activePromptText.value} ${inputValue.value}`);
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
};

const changeSpeed = (speed: number) => {
  selectedSpeed.value = speed;
  postMessage({
    type: 'simulation:speed',
    payload: { speedMs: speed },
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
