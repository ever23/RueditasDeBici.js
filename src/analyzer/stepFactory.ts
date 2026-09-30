import { SimulationStepPayload, ScopePayload } from '../shared/types';
import { ScopeManager } from './ScopeManager';

export interface StepOptions {
  activeNodeId: string;
  codeLine: number;
  cpuOperation: string;
  memory?: Record<string, any>;
  callStack?: ScopePayload[];
  outputLog?: string;
  needsInput?: boolean;
  inputVarName?: string;
  inputPromptText?: string;
}

/**
 * Fábrica de pasos de simulación.
 * Centraliza la creación de `SimulationStepPayload` con snapshots
 * inmutables de memoria y call stack, y resuelve identificadores de nodos.
 */
export class StepFactory {
  constructor(
    private scopeManager: ScopeManager,
    private stepsList: SimulationStepPayload[]
  ) {}

  /**
   * Resuelve el ID del nodo visual correspondiente en el diagrama según
   * si la línea se ejecuta dentro de una función o en el flujo principal.
   */
  public resolveNodeId(line: number, nodesMap: Map<string, string>, insideFunction: boolean): string {
    if (insideFunction) {
      const funcNodeId = nodesMap.get(`func:${line}`);
      if (funcNodeId) return funcNodeId;
    }
    return nodesMap.get(String(line)) || `hidden_${line}`;
  }

  /**
   * Construye un objeto SimulationStepPayload inmutable.
   */
  public createStep(options: StepOptions): SimulationStepPayload {
    return {
      activeNodeId: options.activeNodeId,
      codeLine: options.codeLine,
      cpuOperation: options.cpuOperation,
      memory: options.memory ?? this.scopeManager.cloneMemory(),
      callStack: options.callStack ?? this.scopeManager.cloneCallStack(),
      outputLog: options.outputLog,
      needsInput: options.needsInput,
      inputVarName: options.inputVarName,
      inputPromptText: options.inputPromptText,
    };
  }

  /**
   * Crea un paso y lo almacena inmediatamente en la secuencia de simulación.
   */
  public emitStep(options: StepOptions): SimulationStepPayload {
    const step = this.createStep(options);
    this.stepsList.push(step);
    return step;
  }
}
