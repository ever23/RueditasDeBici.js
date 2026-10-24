import { SimulationStepPayload, ISimulationContext } from '../shared/types';
import { ExpressionEvaluator } from './expressionEvaluator';
import { ScopeManager } from './ScopeManager';
import { InputManager } from './InputManager';
import { StepFactory } from './stepFactory';
import { scanFunctions } from './FunctionScanner';
import { invokeFunctionCall } from './functionInvoker';
import {
  evaluateStatements,
  StatementHandlerContext,
} from './statementHandlers';

/**
 * El Motor de Simulación (Cerebro de la ejecución).
 * Orquesta la simulación paso a paso del código JavaScript:
 * delega la memoria a `ScopeManager`, los pasos a `StepFactory`,
 * las entradas a `InputManager`, las subrutinas a `functionInvoker`
 * y la ejecución de sentencias a `statementHandlers`.
 */
export class SimulationEngine implements ISimulationContext {
  private evaluator = new ExpressionEvaluator();
  private scopeManager = new ScopeManager();
  private inputManager = new InputManager();
  private steps: SimulationStepPayload[] = [];
  private stepFactory: StepFactory = new StepFactory(this.scopeManager, this.steps);
  private functionsMap: Map<string, any> = new Map();

  private lastReturnValue = { value: undefined as any };
  private _insideFunction = { value: false };
  private _breakSignal = { value: false };
  private _continueSignal = { value: false };
  private _returnSignal = { value: false };
  private _maxLoopIterations: number = 100;

  public setMaxIterations(n: number): void {
    this._maxLoopIterations = Math.max(1, Math.min(n, 10000));
  }

  // --- Delegación de ISimulationContext y ScopeManager ---

  public getMemory(): Record<string, any> {
    return this.scopeManager.getMemory();
  }

  public pushScope(name: string): void {
    this.scopeManager.pushScope(name);
  }

  public popScope(): void {
    this.scopeManager.popScope();
  }

  public declareVariable(key: string, value: any): void {
    this.scopeManager.declareVariable(key, value);
  }

  public updateVariable(key: string, value: any): void {
    this.scopeManager.updateVariable(key, value);
  }

  public getFunctionsMap(): Map<string, any> {
    return this.functionsMap;
  }

  public pushStep(step: SimulationStepPayload): void {
    if (!step.callStack) {
      step.callStack = this.scopeManager.cloneCallStack();
    }
    if (!step.memory) {
      step.memory = this.scopeManager.cloneMemory();
    }
    this.steps.push(step);
  }

  /**
   * Invoca una subrutina o función registrada en el AST.
   */
  public invokeFunctionCall(
    callExpr: any,
    callerNodeId: string,
    nodesMap: Map<string, string>
  ): any {
    return invokeFunctionCall(callExpr, callerNodeId, nodesMap, {
      scopeManager: this.scopeManager,
      stepFactory: this.stepFactory,
      functionsMap: this.functionsMap,
      evaluator: this.evaluator,
      simulationContext: this,
      insideFunction: this._insideFunction,
      lastReturnValue: this.lastReturnValue,
      returnSignal: this._returnSignal,
      evaluateStatements: (stmts, map) =>
        evaluateStatements(stmts, map, this.buildHandlerContext(map)),
    });
  }

  /**
   * Construye el contexto unificado para el despacho de sentencias.
   */
  private buildHandlerContext(nodesMap: Map<string, string>): StatementHandlerContext {
    return {
      scopeManager: this.scopeManager,
      inputManager: this.inputManager,
      stepFactory: this.stepFactory,
      functionsMap: this.functionsMap,
      evaluator: this.evaluator,
      simulationContext: this,
      insideFunction: this._insideFunction,
      breakSignal: this._breakSignal,
      continueSignal: this._continueSignal,
      returnSignal: this._returnSignal,
      lastReturnValue: this.lastReturnValue,
      maxLoopIterations: this._maxLoopIterations,
    };
  }

  /**
   * Genera la lista completa de pasos de simulación. Lee el AST y pre-calcula
   * cada movimiento, operación matemática y cambio en la memoria RAM antes de enviarlo
   * al Webview para ser animado.
   * 
   * @param ast El Árbol de Sintaxis Abstracta generado por Acorn.
   * @param nodesMap Un mapa que vincula la línea de código con el ID visual del nodo en Vue Flow.
   * @param providedInputs Arreglo de respuestas del usuario en la consola para resolver prompts.
   * @returns SimulationStepPayload[] La lista secuencial de pasos para animar.
   */
  public buildSimulationSteps(
    ast: any,
    nodesMap: Map<string, string>,
    providedInputs: string[] = []
  ): SimulationStepPayload[] {
    // 1. Reiniciar estado de la simulación
    this.scopeManager.reset();
    this.steps = [];
    this.stepFactory = new StepFactory(this.scopeManager, this.steps);
    this.inputManager.reset(providedInputs);
    this.functionsMap.clear();
    this.lastReturnValue.value = undefined;
    this._insideFunction.value = false;
    this._breakSignal.value = false;
    this._continueSignal.value = false;
    this._returnSignal.value = false;

    // 2. Escanear y registrar funciones y variables de prompt
    const scan = scanFunctions(ast);
    this.functionsMap = scan.functionsMap;
    scan.promptVars.forEach((v) => this.inputManager.addPromptVar(v));

    // 3. Paso inicial: Inicio de la CPU
    this.stepFactory.emitStep({
      activeNodeId: 'start',
      codeLine: 1,
      cpuOperation: 'CPU Lista ➔ Inicializando Registro de Instrucciones',
    });

    // 4. Fase de Creación (Hoisting): Registrar funciones en RAM y saltar a sus recuadros
    for (const funcDecl of scan.functionDeclarations) {
      const funcName = funcDecl.id?.name;
      if (!funcName) continue;
      const funcLine = funcDecl.loc?.start?.line || 1;
      const paramsList = (funcDecl.params || []).map((p: any) => p.name || '...').join(', ');
      const groupNodeId =
        nodesMap.get(`group:${funcLine}`) ||
        nodesMap.get(`func:${funcLine}`) ||
        `hidden_${funcLine}`;

      this.declareVariable(funcName, {
        __type: 'Function',
        name: funcName,
        signature: `ƒ(${paramsList})`,
        line: funcLine,
        nodeId: groupNodeId,
      });

      this.stepFactory.emitStep({
        activeNodeId: groupNodeId,
        codeLine: funcLine,
        cpuOperation: `Fase de Creación (Hoisting) ➔ Almacenando tipo Function: ${funcName}(${paramsList}) en RAM`,
      });
    }

    // 5. Evaluación de las sentencias del programa
    if (ast && ast.type === 'Program' && Array.isArray(ast.body)) {
      const ctx = this.buildHandlerContext(nodesMap);
      evaluateStatements(ast.body, nodesMap, ctx);
    }

    // 6. Paso final: CPU Halt
    this.stepFactory.emitStep({
      activeNodeId: 'end',
      codeLine: ast?.loc?.end?.line || 1,
      cpuOperation: 'CPU Halt ➔ Ejecución de Programa Finalizada',
    });

    return this.steps;
  }
}
