<template>
  <div class="flowchart-canvas">
    <!-- BARRA SUPERIOR DE CONTROLES DE SIMULACIÓN (Player Controls) -->
    <SimToolbar
      :is-simulating="isSimulating"
      :is-auto-playing="isAutoPlaying"
      :current-step="currentStep"
      :total-steps="totalSteps"
      :selected-speed="selectedSpeed"
      @start="startSim"
      @prev="prevStep"
      @next="nextStep"
      @restart="restartSim"
      @stop="stopSim"
      @pause="pauseSim"
      @resume="resumeSim"
      @speed-change="changeSpeed"
    />

    <!-- BANNER DE ERROR DE PARSING -->
    <div v-if="parseError" class="parse-error-banner" style="cursor: pointer;" title="Haz clic para ir a la línea del error" @click="handleErrorClick">
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

    <!-- WIDGETS PEDAGÓGICOS FLOTANTES: MEMORIA (RAM), CPU Y CONSOLA DE SALIDA VIRTUAL -->
    <div class="floating-windows-container">
      <!-- CONSOLA DE SALIDA VIRTUAL -->
      <ConsolePanel
        :logs="consoleLogs"
        :show-prompt="showPromptModal"
        :prompt-text="activePromptText"
        v-model:input-value="inputValue"
        @clear="consoleLogs = []"
        @submit="submitPromptValue"
      />

      <!-- ÁRBOL DE ÁMBITOS (CALL STACK Y MEMORIA) -->
      <ScopePanel 
        :call-stack="callStackState" 
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
import { StartEndNode, ProcessNode, DecisionNode, LoopNode, InputNode, OutputNode, VariableNode, ConstantNode, SubroutineNode, FunctionGroupNode, FunctionDataNode } from './nodes/CustomNodes';
import { getLayoutedElements } from '../utils/layout';
import type { FlowchartNode, FlowchartEdge } from '../../../src/shared/types';

import SimToolbar from './shared/SimToolbar.vue';
import ConsolePanel from './shared/ConsolePanel.vue';
import ScopePanel from './shared/ScopePanel.vue';
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
  functionData: FunctionDataNode,
} as any;

const nodes = ref<FlowchartNode[]>([]);
const edges = ref<FlowchartEdge[]>([]);

// Estado de Simulación y Hardware
const isSimulating = ref(false);
const isAutoPlaying = ref(false);
const selectedSpeed = ref(1200);
const memoryState = ref<Record<string, any>>({});
const callStackState = ref<any[]>([]);
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
  else if (message.type === 'highlight:node') {
    const targetNodeId = message.payload.nodeId;
    if (targetNodeId) {
      nodes.value = nodes.value.map((n: FlowchartNode) => ({
        ...n,
        class: n.id === targetNodeId ? 'node-active-sim' : '',
      }));
      nextTick(() => {
        fitView({ nodes: [targetNodeId], duration: 600, maxZoom: 1.1 });
      });
    }
  }
  else if (message.type === 'simulation:step') {
    isSimulating.value = true;
    runtimeError.value = '';

    const incomingStep = message.payload.currentStep || 0;
    const isSteppingBack = incomingStep > 0 && incomingStep < currentStep.value;

    const oldMemory = memoryState.value;
    const newMemory = message.payload.memory;
    
    changedVars.value.clear();
    for (const key in newMemory) {
      if (JSON.stringify(oldMemory[key]) !== JSON.stringify(newMemory[key])) {
        changedVars.value.add(key);
      }
    }
    memoryState.value = newMemory;
    callStackState.value = message.payload.callStack || [];
    
    if (isSteppingBack && stepHistory.has(incomingStep)) {
      const snap = stepHistory.get(incomingStep)!;
      cpuLogs.value = [...snap.cpuLogs];
      consoleLogs.value = [...snap.consoleLogs];
      visitedEdgeIds.value = new Set(snap.visitedEdges);
      showPromptModal.value = false;
    } else {
      if (message.payload.cpuOperation) {
        cpuLogs.value.push(message.payload.cpuOperation);
      }
      if (message.payload.outputLog) {
        consoleLogs.value.push(message.payload.outputLog);
      }
    }

    currentStep.value = incomingStep;
    totalSteps.value = message.payload.totalSteps || 0;

    const activeNodeId = message.payload.activeNodeId;
    const activeLine = message.payload.codeLine;

    if (!isSteppingBack && lastActiveNodeId && activeNodeId && lastActiveNodeId !== activeNodeId) {
      const connectingEdge = edges.value.find(
        (e: FlowchartEdge) => e.source === lastActiveNodeId && e.target === activeNodeId
      );
      if (connectingEdge) {
        visitedEdgeIds.value.add(connectingEdge.id);
      }
    }
    lastActiveNodeId = activeNodeId;

    if (incomingStep > 0) {
      stepHistory.set(incomingStep, {
        cpuLogs: [...cpuLogs.value],
        consoleLogs: [...consoleLogs.value],
        visitedEdges: new Set(visitedEdgeIds.value),
      });
    }

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
    isAutoPlaying.value = false;
    showPromptModal.value = false;
  }
});

const stepHistory = new Map<number, { cpuLogs: string[]; consoleLogs: string[]; visitedEdges: Set<string> }>();

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
  isAutoPlaying.value = true;
  consoleLogs.value = [];
  cpuLogs.value = [];
  visitedEdgeIds.value.clear();
  stepHistory.clear();
  lastActiveNodeId = '';
  postMessage({ type: 'simulation:start' });
};

const prevStep = () => {
  isAutoPlaying.value = false;
  postMessage({ type: 'simulation:prev' });
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
  isAutoPlaying.value = false;
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

const pauseSim = () => {
  isAutoPlaying.value = false;
  postMessage({ type: 'simulation:pause' });
};

const resumeSim = () => {
  isAutoPlaying.value = true;
  postMessage({ type: 'simulation:resume' });
};

const handleErrorClick = () => {
  if (parseErrorLine.value) {
    postMessage({
      type: 'error:click',
      payload: { line: parseErrorLine.value },
    });
  }
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
