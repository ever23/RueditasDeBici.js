// Contrato de tipos compartidos entre Extension Host y Webview UI

export type ExtensionToWebviewMessage =
  | { type: 'update:flowchart'; payload: FlowchartData }
  | { type: 'update:theme'; payload: 'light' | 'dark' }
  | { type: 'highlight:node'; payload: { nodeId: string } }
  | { type: 'simulation:step'; payload: SimulationStepPayload }
  | { type: 'simulation:prompt'; payload: { varName: string; promptText: string } }
  | { type: 'simulation:end' }
  | { type: 'error:parse'; payload: { message: string; line: number } };

export type WebviewToExtensionMessage =
  | { type: 'node:click'; payload: { nodeId: string; line: number } }
  | { type: 'simulation:start' }
  | { type: 'simulation:next' }
  | { type: 'simulation:stop' }
  | { type: 'simulation:speed'; payload: { speedMs: number } }
  | { type: 'simulation:submitInput'; payload: { value: string } }
  | { type: 'ready' };

export interface SimulationStepPayload {
  activeNodeId: string;
  codeLine: number;
  cpuOperation: string;                  // Ej: "Cálculo UAL: 15 > 100 ➔ FALSE" o "Suma: 0 + 25 ➔ 25"
  memory: Record<string, any>;           // Estado de la RAM: { totalVentas: 25, i: 1 }
  outputLog?: string;                    // Salida a la Consola de Salida Virtual
  needsInput?: boolean;                  // true cuando este paso requiere entrada por teclado (Leer/prompt)
  inputVarName?: string;                 // Nombre de la variable destino de la lectura
  inputPromptText?: string;              // Texto de solicitud para el usuario
  currentStep?: number;                  // Número del paso actual
  totalSteps?: number;                   // Total de pasos generados
}

export interface FlowchartData {
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
}

export type FlowchartNodeType = 'startEnd' | 'process' | 'decision' | 'loop' | 'io' | 'subroutine' | 'functionGroup';

export interface FlowchartNode {
  id: string;
  type: FlowchartNodeType;
  data: {
    label: string;
    codeLine: number;
    codeSnippet?: string;
    lines?: number[];                    // Líneas agrupadas (ej: declaraciones múltiples)
  };
  position: { x: number; y: number };
  parentNode?: string;
  extent?: 'parent';
  style?: Record<string, any>;
}

export interface FlowchartEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  type?: 'default' | 'smoothstep' | 'step';
}
