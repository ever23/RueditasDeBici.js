import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parseCode } from '../analyzer/parser';
import { transformAstToFlowchart } from '../analyzer/transformer';
import { SimulationEngine } from '../analyzer/simulationEngine';
import { WebviewToExtensionMessage, SimulationStepPayload } from '../shared/types';

export class FlowchartPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codigoVivo.flowchartView';
  private _view?: vscode.WebviewView;
  private _simulationEngine = new SimulationEngine();
  private _simulationSteps: SimulationStepPayload[] = [];
  private _currentSimulationIndex = 0;
  private _simulationTimer?: NodeJS.Timeout;
  private _speedMs = 1200;
  private _waitingForInput = false;

  // ═══════════════════════════════════════════════════════════════
  // REPLAY: Almacena el AST, nodesMap e inputs del usuario para
  //         reconstruir los pasos tras cada entrada.
  // ═══════════════════════════════════════════════════════════════
  private _cachedAst: any = null;
  private _cachedNodesMap: Map<string, string> = new Map();
  private _collectedInputs: string[] = [];

  private _activeLineDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
    isWholeLine: true,
    border: '1px solid #38bdf8',
    gutterIconPath: vscode.Uri.file(path.join(__dirname, '..', '..', 'resources', 'icon.svg')),
    gutterIconSize: 'contain',
  });

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message: WebviewToExtensionMessage) => {
      switch (message.type) {
        case 'ready':
          this.updateFlowchartForActiveEditor();
          break;
        case 'node:click':
          this._handleNodeClick(message.payload.line);
          break;
        case 'simulation:start':
          this._startSimulation();
          break;
        case 'simulation:next':
          this._nextStep();
          break;
        case 'simulation:stop':
          this._stopSimulation();
          break;
        case 'simulation:speed':
          this._speedMs = message.payload.speedMs;
          break;
        case 'simulation:submitInput':
          this._handleSubmittedInput(message.payload.value);
          break;
      }
    });
  }

  public updateFlowchartForActiveEditor() {
    if (!this._view) return;

    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'javascript') {
      return;
    }

    const code = editor.document.getText();
    const ast = parseCode(code);
    const flowchartData = transformAstToFlowchart(ast);

    this._view.webview.postMessage({
      type: 'update:flowchart',
      payload: flowchartData,
    });
  }

  private _startSimulation() {
    this._stopSimulation();

    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const code = editor.document.getText();
    const ast = parseCode(code);
    if (!ast) return;

    const flowchartData = transformAstToFlowchart(ast);
    const nodesMap = new Map<string, string>();
    // Nodos del flujo principal
    flowchartData.nodes.forEach(n => {
      if (!n.parentId && n.type !== 'functionGroup') {
        nodesMap.set(String(n.data.codeLine), n.id);
      }
    });
    // Nodos internos de funciones con prefijo 'func:' para resolución dual
    flowchartData.nodes.forEach(n => {
      if (n.parentId) {
        nodesMap.set(`func:${n.data.codeLine}`, n.id);
      }
    });

    // Cachear AST y nodesMap para poder hacer replay
    this._cachedAst = ast;
    this._cachedNodesMap = nodesMap;
    this._collectedInputs = [];

    // Generar pasos iniciales sin inputs (se detendrá en el primer prompt)
    this._simulationSteps = this._simulationEngine.buildSimulationSteps(ast, nodesMap, []);
    this._currentSimulationIndex = 0;

    this._runAutoSimulation();
  }

  private _runAutoSimulation() {
    if (this._waitingForInput) return;

    if (this._currentSimulationIndex >= this._simulationSteps.length) {
      this._view?.webview.postMessage({ type: 'simulation:end' });
      this._clearCodeHighlight();
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

      this._view?.webview.postMessage({
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
      this._runAutoSimulation();
    }, this._speedMs);
  }

  /**
   * REPLAY: Cuando el usuario ingresa un dato:
   * 1. Guardar el input en _collectedInputs
   * 2. Re-generar TODOS los pasos con todos los inputs acumulados
   * 3. Avanzar al paso después del último input consumido
   * Esto asegura que las condiciones (if, while) se evalúan con los valores REALES.
   */
  private _handleSubmittedInput(inputValue: string) {
    this._waitingForInput = false;

    // Acumular este nuevo input
    this._collectedInputs.push(inputValue);

    if (!this._cachedAst) {
      this._runAutoSimulation();
      return;
    }

    // Re-generar TODOS los pasos con los inputs acumulados
    this._simulationSteps = this._simulationEngine.buildSimulationSteps(
      this._cachedAst,
      this._cachedNodesMap,
      this._collectedInputs
    );

    // Buscar el siguiente paso no-procesado: el primer paso cuyo needsInput=true
    // o el paso justo después del último input ya consumido.
    // Todos los inputs ya satisfechos tendrán needsInput=false.
    // Buscamos el primer needsInput=true (el siguiente prompt) o
    // si no hay más, avanzamos desde el paso posterior al último input consumido.
    let resumeIndex = 0;
    let inputsSeenSoFar = 0;
    for (let i = 0; i < this._simulationSteps.length; i++) {
      const s = this._simulationSteps[i];
      if (s.inputVarName && !s.needsInput) {
        // Este es un input ya satisfecho
        inputsSeenSoFar++;
        if (inputsSeenSoFar === this._collectedInputs.length) {
          // Este es el último input que acabamos de satisfacer
          // Reanudar DESPUÉS de este paso
          resumeIndex = i + 1;
          break;
        }
      }
    }

    this._currentSimulationIndex = resumeIndex;

    // Emitir el paso del input actual (ya satisfecho) con el valor del usuario
    if (resumeIndex > 0) {
      const satisfiedStep = this._simulationSteps[resumeIndex - 1];
      this._emitStep(satisfiedStep);
    }

    // Continuar la simulación desde el paso siguiente
    this._simulationTimer = setTimeout(() => {
      this._runAutoSimulation();
    }, this._speedMs);
  }

  private _nextStep() {
    if (this._simulationTimer) {
      clearTimeout(this._simulationTimer);
    }
    if (this._currentSimulationIndex < this._simulationSteps.length) {
      const step = this._simulationSteps[this._currentSimulationIndex];
      
      if (step.needsInput) {
        this._waitingForInput = true;
        this._emitStep(step);
        this._view?.webview.postMessage({
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
      this._view?.webview.postMessage({ type: 'simulation:end' });
      this._clearCodeHighlight();
    }
  }

  private _stopSimulation() {
    if (this._simulationTimer) {
      clearTimeout(this._simulationTimer);
      this._simulationTimer = undefined;
    }
    this._waitingForInput = false;
    this._currentSimulationIndex = 0;
    this._collectedInputs = [];
    this._clearCodeHighlight();
  }

  private _emitStep(step: SimulationStepPayload) {
    if (!this._view) return;

    this._view.webview.postMessage({
      type: 'simulation:step',
      payload: step,
    });

    if (step.codeLine > 0) {
      this._highlightEditorLine(step.codeLine);
    }
  }

  private _highlightEditorLine(line: number) {
    const editor = vscode.window.activeTextEditor;
    if (editor && line > 0) {
      const range = new vscode.Range(line - 1, 0, line - 1, 1000);
      editor.setDecorations(this._activeLineDecorationType, [range]);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideForced);
    }
  }

  private _clearCodeHighlight() {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      editor.setDecorations(this._activeLineDecorationType, []);
    }
  }

  private _handleNodeClick(line: number) {
    this._highlightEditorLine(line);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const webviewHtmlPath = path.join(this._extensionUri.fsPath, 'dist', 'webview', 'index.html');
    if (fs.existsSync(webviewHtmlPath)) {
      return fs.readFileSync(webviewHtmlPath, 'utf8');
    }

    return `<!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Diagrama de Flujo - CodigoVivoJS</title>
      <style>body { font-family: sans-serif; padding: 15px; color: #ccc; }</style>
    </head>
    <body>
      <h3>CodigoVivoJS</h3>
      <p>Esperando compilación del Webview UI (dist/webview/index.html)...</p>
    </body>
    </html>`;
  }
}
