<template>
  <div class="diagram-editor">
    <div class="sidebar">
      <h3>Nodos</h3>
      <div class="node-palette">
        <div class="palette-item" draggable="true" @dragstart="onDragStart($event, 'startEnd')">
          <div class="flowchart-node node-start-end palette-preview"><span class="node-label">Inicio / Fin</span></div>
        </div>
        <div class="palette-item" draggable="true" @dragstart="onDragStart($event, 'process')">
          <div class="flowchart-node node-process palette-preview"><span class="node-label">Proceso</span></div>
        </div>
        <div class="palette-item" draggable="true" @dragstart="onDragStart($event, 'decision')">
          <div class="flowchart-node node-decision palette-preview"><span class="node-label">Decisión</span></div>
        </div>
        <div class="palette-item" draggable="true" @dragstart="onDragStart($event, 'loop')">
          <div class="flowchart-node node-loop palette-preview"><span class="node-label">Mientras</span></div>
        </div>
        <div class="palette-item" draggable="true" @dragstart="onDragStart($event, 'input')">
          <div class="flowchart-node node-input palette-preview"><span class="node-label">Entrada</span></div>
        </div>
        <div class="palette-item" draggable="true" @dragstart="onDragStart($event, 'output')">
          <div class="flowchart-node node-output palette-preview"><span class="node-label">Salida</span></div>
        </div>
        <div class="palette-item" draggable="true" @dragstart="onDragStart($event, 'variable')">
          <div class="flowchart-node node-variable palette-preview"><span class="node-label">Variable</span></div>
        </div>
        <div class="palette-item" draggable="true" @dragstart="onDragStart($event, 'constant')">
          <div class="flowchart-node node-constant palette-preview"><span class="node-label">Constante</span></div>
        </div>
      </div>
      
      <div class="sidebar-section" style="margin-top: 20px; border-top: 1px solid #334155; padding-top: 15px;">
        <h3 style="margin-bottom: 10px; font-size: 13px; color: #94a3b8; text-transform: uppercase;">Próxima Conexión</h3>
        <div style="display: flex; gap: 8px; font-size: 12px;">
          <button 
            :style="{ background: nextConnectionType === 'Sí' ? '#22c55e' : '#1e293b', color: 'white', border: '1px solid #334155', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', flex: 1 }"
            @click="nextConnectionType = 'Sí'"
          >Sí</button>
          <button 
            :style="{ background: nextConnectionType === 'No' ? '#ef4444' : '#1e293b', color: 'white', border: '1px solid #334155', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', flex: 1 }"
            @click="nextConnectionType = 'No'"
          >No</button>
          <button 
            :style="{ background: nextConnectionType === '' ? '#3b82f6' : '#1e293b', color: 'white', border: '1px solid #334155', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', flex: 1 }"
            @click="nextConnectionType = ''"
          >Normal</button>
        </div>
        <p style="font-size: 11px; color: #64748b; margin-top: 8px; text-align: center;">Selecciona la etiqueta para tu próxima línea</p>
      </div>
    </div>
    
    <div class="main-content">
      <SimToolbar
        :is-simulating="isSimulating"
        :is-auto-playing="isAutoPlaying"
        :current-step="currentStep"
        :total-steps="totalSteps"
        :selected-speed="selectedSpeed"
        :is-js-file="isJsFile"
        @start="startSim"
        @prev="prevStep"
        @next="nextStep"
        @pause="pauseSim"
        @resume="resumeSim"
        @restart="restartSim"
        @stop="stopSim"
        @show-code="showCodeModal = true"
        @speed-change="changeSpeed"
      />

      <!-- BANNER DE ERROR DE EJECUCIÓN (RUNTIME) -->
      <div v-if="runtimeError" class="parse-error-banner runtime-error">
        ⚠️ Error en la simulación: {{ runtimeError }}
      </div>

      <div class="workspace">
        <div class="canvas-container" @drop="onDrop" @dragover.prevent @dragenter.prevent>
          <VueFlow
            v-model:nodes="nodes"
            v-model:edges="edges"
            :node-types="nodeTypes"
            :default-edge-options="{ type: 'smoothstep', style: { strokeWidth: 2 } }"
            :min-zoom="0.05"
            :max-zoom="4"
            :delete-key-code="['Delete', 'Backspace']"
            @connect="onConnect"
            @nodes-change="onNodesChange"
            @edges-change="onEdgesChange"
            @node-double-click="onNodeDoubleClick"
            @edge-context-menu="onEdgeContextMenu"
            @edge-double-click="onEdgeDoubleClick"
            fit-view-on-init
          >
            <Background variant="dots" :gap="16" :size="1" />
            <Controls />
            <MiniMap />
          </VueFlow>

          <!-- Editor Modal Oculto -->
          <div v-if="editingNode" class="node-editor-modal">
            <div class="modal-content">
              <h4>Editar Nodo</h4>
              <input 
                type="text" 
                v-model="editInputValue" 
                @keyup.enter="saveNodeEdit"
                ref="editInputRef"
              />
              <div class="modal-actions">
                <button @click="saveNodeEdit">Guardar</button>
                <button @click="cancelNodeEdit">Cancelar</button>
              </div>
            </div>
          </div>
          
          <!-- JS Code Viewer Modal -->
          <div v-if="showCodeModal" class="node-editor-modal code-viewer-modal">
            <div class="modal-content" style="width: 500px; max-width: 90vw;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h4 style="margin: 0; color: #38bdf8;">Código JavaScript Generado</h4>
                <button @click="showCodeModal = false" style="background: transparent; border: none; color: #ef4444; font-size: 16px; cursor: pointer;">✖</button>
              </div>
              <textarea readonly style="width: 100%; height: 300px; background: #0f172a; color: #10b981; border: 1px solid #334155; border-radius: 6px; padding: 10px; font-family: monospace; font-size: 13px; resize: none;">
{{ generatedJsCode || '// Aún no se ha generado código. ¡Inicia una simulación primero!' }}
              </textarea>
            </div>
          </div>
        </div>

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

          <!-- ÁRBOL DE ÁMBITOS (CALL STACK Y MEMORIA) -->
          <ScopePanel 
            :call-stack="callStackState" 
            :changed-vars="changedVars"
          />

          <!-- CUADRO DE UNIDAD DE PROCESAMIENTO CPU / ALU -->
          <CpuPanel :logs="cpuLogs" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '../styles/flowchart.css';

import { useVsCodeApi } from '../composables/useVsCodeApi';
import { StartEndNode, ProcessNode, DecisionNode, LoopNode, InputNode, OutputNode, VariableNode, ConstantNode, SubroutineNode, FunctionGroupNode } from './nodes/CustomNodes';
import type { FlowchartNode, FlowchartEdge } from '../../../src/shared/types';

import SimToolbar from './shared/SimToolbar.vue';
import ConsolePanel from './shared/ConsolePanel.vue';
import ScopePanel from './shared/ScopePanel.vue';
import CpuPanel from './shared/CpuPanel.vue';

const nodeTypes = {
  startEnd: StartEndNode,
  process: ProcessNode,
  decision: DecisionNode,
  loop: LoopNode,
  input: InputNode,
  output: OutputNode,
  variable: VariableNode,
  constant: ConstantNode,
  subroutine: SubroutineNode,
  functionGroup: FunctionGroupNode,
} as any;

const nodes = ref<FlowchartNode[]>([]);
const edges = ref<FlowchartEdge[]>([]);

const editingNode = ref<FlowchartNode | null>(null);
const editInputValue = ref('');
const editInputRef = ref<HTMLInputElement | null>(null);

const props = defineProps<{
  initialData?: any;
}>();

const { postMessage, onMessage } = useVsCodeApi();
const { screenToFlowCoordinate, addEdges, fitView, setCenter, findNode, getViewport, getSelectedNodes, getSelectedEdges, removeNodes, removeEdges } = useVueFlow();

const focusActiveNode = (nodeId: string) => {
  const node = findNode(nodeId);
  if (node && node.position) {
    const x = node.position.x + (node.dimensions?.width || 130) / 2;
    const y = node.position.y + (node.dimensions?.height || 50) / 2;
    const currentZoom = getViewport().zoom || 1;
    // Centrado panorámico sin zoom agresivo (máx 0.40) para mantener visible una amplia porción del diagrama
    const targetZoom = Math.min(Math.max(currentZoom, 0.30), 0.40);
    setCenter(x, y, { duration: 400, zoom: targetZoom });
  } else {
    fitView({ nodes: [nodeId], duration: 400, padding: 4, maxZoom: 0.40 });
  }
};

let nextNodeId = 1;

const isJsFile = ref(false);
const callStackState = ref<any[]>([]);

const handleInitEditor = (payload: any) => {
  try {
    if (payload?.content) {
      isJsFile.value = !!payload.isJsFile;
      const parsed = JSON.parse(payload.content);
      nodes.value = parsed.nodes || [];
      
      const parsedEdges = parsed.edges || [];
      edges.value = parsedEdges.map((e: any) => {
        let sHandle = 'source-bottom';
        let tHandle = 'target-top';
        
        const sourceNode = nodes.value.find(n => n.id === e.source);
        if (sourceNode && (sourceNode.type === 'decision' || sourceNode.type === 'loop')) {
          if (e.label === 'Sí') sHandle = 'source-bottom';
          else if (e.label === 'No') sHandle = 'source-right';
        }
        if (e.id.includes('loopback') || e.label === 'Repetir') {
          sHandle = 'source-left';
          tHandle = 'target-left';
        }

        return {
          ...e,
          sourceHandle: e.sourceHandle || sHandle,
          targetHandle: e.targetHandle || tHandle,
        };
      });
      
      parsed.nodes?.forEach((n: any) => {
        if (n.id.startsWith('n_')) {
          const num = parseInt(n.id.substring(2));
          if (!isNaN(num) && num >= nextNodeId) {
            nextNodeId = num + 1;
          }
        }
      });
    }
  } catch (e) {
    console.error('Failed to parse .rdb file', e);
  }
};

onMounted(() => {
  if (props.initialData) {
    handleInitEditor(props.initialData);
  }
});

// --- CONNECTION TYPE STATE ---
const nextConnectionType = ref('');

// --- KEYBOARD EVENT FOR DELETION ---
const handleKeyDown = (e: KeyboardEvent) => {
  // If editing a node via modal or in input, ignore
  if (editingNode.value || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

  if (e.key === 'Delete' || e.key === 'Backspace') {
    const selectedN = getSelectedNodes.value;
    const selectedE = getSelectedEdges.value;
    if (selectedN.length > 0) removeNodes(selectedN);
    if (selectedE.length > 0) removeEdges(selectedE);
    if (selectedN.length > 0 || selectedE.length > 0) saveDocument();
  }
};

const onEdgeContextMenu = (e: any) => {
  e.event.preventDefault();
  removeEdges([e.edge.id]);
  saveDocument();
};

const onEdgeDoubleClick = (e: any) => {
  removeEdges([e.edge.id]);
  saveDocument();
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

// --- ESTADO DE SIMULACIÓN ---
const isSimulating = ref(false);
const isAutoPlaying = ref(false);
const selectedSpeed = ref(1200);
const memoryState = ref<Record<string, any>>({});
const cpuLogs = ref<string[]>([]);
const consoleLogs = ref<string[]>([]);
const visitedEdgeIds = ref<Set<string>>(new Set());
const stepHistory = new Map<number, { cpuLogs: string[]; consoleLogs: string[]; visitedEdges: Set<string>; callStack?: any[] }>();
let lastActiveNodeId = '';
const currentStep = ref(0);
const totalSteps = ref(0);
const runtimeError = ref('');
const changedVars = ref<Set<string>>(new Set());

const showPromptModal = ref(false);
const activePromptText = ref('');
const inputValue = ref('');

const showCodeModal = ref(false);
const generatedJsCode = ref('');

onMessage((message) => {
  if (message.type === 'init:editor') {
    handleInitEditor(message.payload);
  }
  else if (message.type === 'debug:code') {
    generatedJsCode.value = message.payload.code;
  }
  else if (message.type === 'error:runtime') {
    runtimeError.value = message.payload.message;
    stopSim();
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
    if (message.payload.callStack && message.payload.callStack.length > 0) {
      callStackState.value = message.payload.callStack;
    }
    
    if (isSteppingBack && stepHistory.has(incomingStep)) {
      const snap = stepHistory.get(incomingStep)!;
      cpuLogs.value = [...snap.cpuLogs];
      consoleLogs.value = [...snap.consoleLogs];
      visitedEdgeIds.value = new Set(snap.visitedEdges);
      if (snap.callStack) {
        callStackState.value = [...snap.callStack];
      }
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
    
    // El GraphToCodeGenerator nos envía IDs directamente como activeNodeId (a través de lineToNodeMap)
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
        callStack: [...callStackState.value],
      });
    }

    nodes.value = nodes.value.map((n: FlowchartNode) => {
      const isMatch = n.id === activeNodeId;
      return { ...n, class: isMatch ? 'node-active-sim' : '' };
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
        focusActiveNode(activeNodeId);
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

const pauseSim = () => {
  isAutoPlaying.value = false;
  postMessage({ type: 'simulation:pause' });
};

const resumeSim = () => {
  isAutoPlaying.value = true;
  postMessage({ type: 'simulation:resume' });
};

const restartSim = () => {
  stopSim();
  setTimeout(() => startSim(), 100);
};

const stopSim = () => {
  isSimulating.value = false;
  isAutoPlaying.value = false;
  nodes.value = nodes.value.map((n: FlowchartNode) => ({ ...n, class: '' }));
  edges.value = edges.value.map((e: FlowchartEdge) => ({ ...e, animated: e.id.includes('loopback'), class: '' }));
  visitedEdgeIds.value.clear();
  stepHistory.clear();
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

const onDragStart = (event: DragEvent, nodeType: string) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData('application/vueflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  }
};

const onDrop = (event: DragEvent) => {
  const type = event.dataTransfer?.getData('application/vueflow');
  if (!type) return;

  const position = screenToFlowCoordinate({ x: event.clientX, y: event.clientY });
  const newNode: FlowchartNode = {
    id: `n_${nextNodeId++}`,
    type,
    position,
    data: { label: getLabelForType(type) },
  };

  nodes.value.push(newNode);
  saveDocument();
};

const getLabelForType = (type: string) => {
  switch(type) {
    case 'startEnd': return 'Inicio';
    case 'process': return 'x = y + 1';
    case 'decision': return 'x > 0';
    case 'loop': return 'i < 10';
    case 'input': return 'Leer x';
    case 'output': return 'Escribir x';
    case 'variable': return 'let x = 0';
    case 'constant': return 'const PI = 3.14';
    case 'io': return 'console.log("X")';
    default: return 'Nodo';
  }
};

const onConnect = (connection: any) => {
  // Autolabel decision edges
  let label = '';
  const sourceNode = nodes.value.find(n => n.id === connection.source);
  if (sourceNode && (sourceNode.type === 'decision' || sourceNode.type === 'loop')) {
    if (nextConnectionType.value !== '') {
      label = nextConnectionType.value;
    } else {
      // Autolabel decision edges
      const existingEdges = edges.value.filter(e => e.source === connection.source);
      if (existingEdges.length === 0) {
        label = 'Sí'; // Por defecto la primera es Sí
      } else if (existingEdges.length === 1) {
        label = existingEdges[0].label === 'Sí' ? 'No' : 'Sí';
      } else {
        return; // No permitir más de 2 salidas
      }
    }
  }

  const newEdge = {
    ...connection,
    id: `e_${connection.source}-${connection.target}`,
    label,
    animated: false
  };
  edges.value.push(newEdge);
  saveDocument();
};

const onNodeDoubleClick = (event: any) => {
  const node = event.node as FlowchartNode;
  if (node.type === 'startEnd') return; // Start/End no son editables
  
  editingNode.value = node;
  editInputValue.value = node.data.label;
  nextTick(() => {
    editInputRef.value?.focus();
  });
};

const saveNodeEdit = () => {
  if (editingNode.value) {
    const node = nodes.value.find(n => n.id === editingNode.value!.id);
    if (node) {
      node.data.label = editInputValue.value;
    }
  }
  editingNode.value = null;
  saveDocument();
};

const cancelNodeEdit = () => {
  editingNode.value = null;
};

const onNodesChange = () => saveDocument();
const onEdgesChange = () => saveDocument();

let saveTimeout: any = null;
const saveDocument = () => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    postMessage({
      type: 'update:document',
      payload: {
        content: JSON.stringify({ nodes: nodes.value, edges: edges.value }, null, 2)
      }
    });
  }, 300); // 300ms debounce
};



</script>

<style scoped>
.diagram-editor {
  display: flex;
  height: 100vh;
  width: 100%;
}
.sidebar {
  width: 250px;
  background-color: var(--vscode-sideBar-background, #252526);
  border-right: 1px solid var(--vscode-sideBarSectionHeader-border, #444);
  padding: 15px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.sidebar h3 {
  margin-top: 0;
  margin-bottom: 15px;
  color: var(--vscode-sideBarTitle-foreground, #ccc);
}
.node-palette {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.palette-item {
  cursor: grab;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 10px;
}
.palette-item:active {
  cursor: grabbing;
}
.palette-preview {
  /* Escalar el diseño del nodo original para que quepa en la paleta */
  transform: scale(0.8);
  transform-origin: top center;
  margin: 0;
  pointer-events: none; /* Let drag events pass to parent */
}
.canvas-container {
  flex-grow: 1;
  position: relative;
  height: 100%;
}
.main-content {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}
.workspace {
  display: flex;
  flex-direction: row;
  flex-grow: 1;
  height: calc(100% - 40px); /* Adjust for toolbar height */
  overflow: hidden;
}
.hardware-inspector {
  width: 300px;
  background-color: var(--vscode-sideBar-background, #252526);
  border-left: 1px solid var(--vscode-sideBarSectionHeader-border, #444);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

/* Modal Styles */
.node-editor-modal {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-content {
  background: var(--vscode-editor-background, #1e1e1e);
  padding: 20px;
  border-radius: 8px;
  border: 1px solid var(--vscode-widget-border, #444);
  min-width: 300px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
}
.modal-content h4 {
  margin-top: 0;
  margin-bottom: 15px;
  color: var(--vscode-editor-foreground, #ccc);
}
.modal-content input {
  width: 100%;
  padding: 8px;
  margin-bottom: 15px;
  background: var(--vscode-input-background, #3c3c3c);
  color: var(--vscode-input-foreground, #ccc);
  border: 1px solid var(--vscode-input-border, #3c3c3c);
  border-radius: 2px;
  box-sizing: border-box;
}
.modal-content input:focus {
  outline: 1px solid var(--vscode-focusBorder, #007fd4);
  border-color: transparent;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.modal-actions button {
  padding: 6px 12px;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  background: var(--vscode-button-background, #0e639c);
  color: var(--vscode-button-foreground, #ffffff);
}
.modal-actions button:last-child {
  background: var(--vscode-button-secondaryBackground, #3a3d41);
  color: var(--vscode-button-secondaryForeground, #ffffff);
}
.modal-actions button:hover {
  opacity: 0.9;
}
</style>
