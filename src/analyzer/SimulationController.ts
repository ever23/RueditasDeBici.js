import { SimulationEngine } from './simulationEngine';
import { SimulationStepPayload } from '../shared/types';

export interface SimulationDelegate {
  postMessage(message: any): void;
  highlightLine?(line: number): void;
  clearHighlight?(): void;
}

export class SimulationController {
  private _simulationEngine = new SimulationEngine();
  private _simulationSteps: SimulationStepPayload[] = [];
  private _currentSimulationIndex = 0;
  private _simulationTimer?: NodeJS.Timeout;
  private _speedMs = 1200;
  private _waitingForInput = false;
  private _isAutoPlaying = false;
  
  private _cachedAst: any = null;
  private _cachedNodesMap: any = null;
  private _collectedInputs: string[] = [];

  constructor(private delegate: SimulationDelegate) {}

  public setSpeed(speedMs: number) {
    this._speedMs = speedMs;
  }

  public startSimulation(ast: any, nodesMap: any, autoPlay: boolean = true) {
    this.stopSimulation();
    this._cachedAst = ast;
    this._cachedNodesMap = nodesMap;
    this._collectedInputs = [];

    try {
      this._simulationSteps = this._simulationEngine.buildSimulationSteps(ast, nodesMap, []);
    } catch (err: any) {
      this.delegate.postMessage({ type: 'error:runtime', payload: { message: err.message || String(err) } });
      return;
    }
    
    this._currentSimulationIndex = 0;
    this._isAutoPlaying = autoPlay;
    if (this._isAutoPlaying) {
      this.runAutoSimulation();
    }
  }

  public runAutoSimulation() {
    if (this._waitingForInput) return;

    if (this._currentSimulationIndex >= this._simulationSteps.length) {
      this.delegate.postMessage({ type: 'simulation:end' });
      this.delegate.clearHighlight?.();
      return;
    }

    const step = this._simulationSteps[this._currentSimulationIndex];

    if (step.needsInput) {
      this._waitingForInput = true;
      if (this._simulationTimer) {
        clearTimeout(this._simulationTimer);
        this._simulationTimer = undefined;
      }

      this._emitStep(step);

      this.delegate.postMessage({
        type: 'simulation:prompt',
        payload: {
          varName: step.inputVarName || 'datos',
          promptText: step.inputPromptText || `Ingrese un valor para ${step.inputVarName || 'datos'}:`,
        },
      });
      return;
    }

    this._emitStep(step);
    this._currentSimulationIndex++;

    this._simulationTimer = setTimeout(() => {
      this.runAutoSimulation();
    }, this._speedMs);
  }

  public handleSubmittedInput(inputValue: string) {
    this._waitingForInput = false;
    this._collectedInputs.push(inputValue);

    if (!this._cachedAst) {
      if (this._isAutoPlaying) {
        this.runAutoSimulation();
      }
      return;
    }

    try {
      this._simulationSteps = this._simulationEngine.buildSimulationSteps(
        this._cachedAst,
        this._cachedNodesMap,
        this._collectedInputs
      );
    } catch (err: any) {
      this.delegate.postMessage({ type: 'error:runtime', payload: { message: err.message || String(err) } });
      return;
    }

    let resumeIndex = 0;
    let inputsSeenSoFar = 0;
    for (let i = 0; i < this._simulationSteps.length; i++) {
      const s = this._simulationSteps[i];
      if (s.inputVarName && !s.needsInput) {
        inputsSeenSoFar++;
        if (inputsSeenSoFar === this._collectedInputs.length) {
          resumeIndex = i + 1;
          break;
        }
      } else if (s.needsInput && inputsSeenSoFar === this._collectedInputs.length) {
        resumeIndex = i;
        break;
      }
    }

    this._currentSimulationIndex = resumeIndex;

    if (resumeIndex > 0) {
      const satisfiedStep = this._simulationSteps[resumeIndex - 1];
      this._emitStep(satisfiedStep);
    }

    // Siempre intentar continuar si estaba en auto-play o reanudar
    if (this._isAutoPlaying || this._currentSimulationIndex < this._simulationSteps.length) {
      if (this._simulationTimer) {
          clearTimeout(this._simulationTimer);
      }
      this._simulationTimer = setTimeout(() => {
        this.runAutoSimulation();
      }, this._speedMs);
    }
  }

  public nextStep() {
    if (this._simulationTimer) {
      clearTimeout(this._simulationTimer);
    }
    if (this._currentSimulationIndex < this._simulationSteps.length) {
      const step = this._simulationSteps[this._currentSimulationIndex];
      
      if (step.needsInput) {
        this._waitingForInput = true;
        this._emitStep(step);
        this.delegate.postMessage({
          type: 'simulation:prompt',
          payload: {
            varName: step.inputVarName || 'datos',
            promptText: step.inputPromptText || `Ingrese un valor para ${step.inputVarName || 'datos'}:`,
          },
        });
        return;
      }

      this._emitStep(step);
      this._currentSimulationIndex++;
    } else {
      this.delegate.postMessage({ type: 'simulation:end' });
      this.delegate.clearHighlight?.();
    }
  }

  public stopSimulation() {
    if (this._simulationTimer) {
      clearTimeout(this._simulationTimer);
      this._simulationTimer = undefined;
    }
    this._waitingForInput = false;
    this._isAutoPlaying = false;
    this._currentSimulationIndex = 0;
    this._collectedInputs = [];
    this.delegate.clearHighlight?.();
  }

  public pauseSimulation() {
    if (this._simulationTimer) {
      clearTimeout(this._simulationTimer);
      this._simulationTimer = undefined;
    }
    this._isAutoPlaying = false;
  }

  public resumeSimulation() {
    this._isAutoPlaying = true;
    this.runAutoSimulation();
  }

  private _emitStep(step: SimulationStepPayload) {
    step.currentStep = this._currentSimulationIndex + 1;
    step.totalSteps = this._simulationSteps.length;

    this.delegate.postMessage({
      type: 'simulation:step',
      payload: step,
    });

    if (step.codeLine > 0 && this.delegate.highlightLine) {
      this.delegate.highlightLine(step.codeLine);
    }
  }
}
