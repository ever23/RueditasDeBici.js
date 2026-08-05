import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parseCode } from '../analyzer/parser';
import { transformAstToFlowchart } from '../analyzer/transformer';
import { SimulationEngine } from '../analyzer/simulationEngine';
import { WebviewToExtensionMessage, SimulationStepPayload } from '../shared/types';

/**
 * Panel Webview que renderiza el diagrama de flujo y la simulación.
 * Se abre como una pestaña de editor al lado del código fuente,
 * usando el patrón Singleton para evitar duplicados.
 */
export class FlowchartPanel {
  public static readonly viewType = 'RueditasDeBici.js.flowchartView';

  /** Instancia singleton del panel activo (undefined si fue cerrado). */
  public static currentPanel: FlowchartPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  private _simulationEngine = new SimulationEngine();
  private _simulationSteps: SimulationStepPayload[] = [];
  private _currentSimulationIndex = 0;
  private _simulationTimer?: NodeJS.Timeout;
  private _speedMs = 1200;
  private _waitingForInput = false;
  private _isAutoPlaying = false;

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

  // ─────────────────────────────────────────────────────────────
  // Patrón Singleton: createOrShow
  // ─────────────────────────────────────────────────────────────

  /**
   * Crea un nuevo panel o enfoca el existente.
   * Se abre al lado del editor activo (ViewColumn.Beside).
   */
  public static createOrShow(extensionUri: vscode.Uri): FlowchartPanel {
    // Si ya existe un panel abierto, simplemente enfocarlo
    if (FlowchartPanel.currentPanel) {
      FlowchartPanel.currentPanel._panel.reveal(vscode.ViewColumn.Beside);
      return FlowchartPanel.currentPanel;
    }

    // Crear un nuevo WebviewPanel al lado del editor actual
    const panel = vscode.window.createWebviewPanel(
      FlowchartPanel.viewType,
      'Rueditas de Bici: Diagrama de Flujo',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    FlowchartPanel.currentPanel = new FlowchartPanel(panel, extensionUri);
    return FlowchartPanel.currentPanel;
  }

  // ─────────────────────────────────────────────────────────────
  // Constructor privado
  // ─────────────────────────────────────────────────────────────

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Cargar el HTML del webview
    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

    // Escuchar mensajes del webview (Vue) → extensión
    this._panel.webview.onDidReceiveMessage(
      (message: WebviewToExtensionMessage) => {
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
          case 'simulation:pause':
            this._pauseSimulation();
            break;
          case 'simulation:resume':
            this._resumeSimulation();
            break;
          case 'simulation:speed':
            this._speedMs = message.payload.speedMs;
            break;
          case 'simulation:submitInput':
            if (message.payload.value.startsWith('WEBVIEW ERROR') || message.payload.value.startsWith('WEBVIEW PROMISE ERROR')) {
              vscode.window.showErrorMessage(message.payload.value);
            } else {
              this._handleSubmittedInput(message.payload.value);
            }
            break;
          case 'error:click':
            this._highlightEditorLine(message.payload.line);
            break;
        }
      },
      null,
      this._disposables
    );

    // Limpiar cuando el usuario cierre la pestaña
    this._panel.onDidDispose(
      () => this._dispose(),
      null,
      this._disposables
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Dispose
  // ─────────────────────────────────────────────────────────────

  private _dispose() {
    FlowchartPanel.currentPanel = undefined;

    this._stopSimulation();
    this._panel.dispose();

    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) d.dispose();
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Actualización del diagrama
  // ─────────────────────────────────────────────────────────────

  private _getJsEditor(): vscode.TextEditor | undefined {
    if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.languageId === 'javascript') {
      return vscode.window.activeTextEditor;
    }
    return vscode.window.visibleTextEditors.find(e => e.document.languageId === 'javascript');
  }

  /**
   * Lee el código del editor activo, lo analiza y envía los nodos/conexiones 
   * actualizadas al frontend (Vue) para renderizar el diagrama en vivo.
   */
  public updateFlowchartForActiveEditor() {
    if (!this._panel) return;

    const editor = this._getJsEditor();
    if (!editor || editor.document.languageId !== 'javascript') {
      return;
    }

    const code = editor.document.getText();
    const result = parseCode(code);

    if (result.error !== null) {
      this._panel.webview.postMessage({
        type: 'error:parse',
        payload: { message: result.error, line: result.line },
      });
      return;
    }

    let flowchartData;
    try {
      flowchartData = transformAstToFlowchart(result.ast);
    } catch (err: any) {
      console.error('Error transforming AST to flowchart:', err);
      this._panel.webview.postMessage({
        type: 'error:parse',
        payload: { message: `Error interno al generar diagrama: ${err.message || err}`, line: 0 },
      });
      // Send empty flowchart so webview exits "loading" state
      this._panel.webview.postMessage({
        type: 'update:flowchart',
        payload: { nodes: [], edges: [] },
      });
      return;
    }

    this._panel.webview.postMessage({
      type: 'update:flowchart',
      payload: flowchartData,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Simulación
  // ─────────────────────────────────────────────────────────────

  private _startSimulation() {
    this._stopSimulation();

    const editor = this._getJsEditor();
    if (!editor) return;

    const code = editor.document.getText();
    const result = parseCode(code);

    if (result.error !== null) {
      this._panel?.webview.postMessage({
        type: 'error:parse',
        payload: { message: result.error, line: result.line },
      });
      return;
    }

    const ast = result.ast;
    const flowchartData = transformAstToFlowchart(ast);
    const nodesMap = new Map<string, string>();
    // Nodos del flujo principal
    flowchartData.nodes.forEach(n => {
      if (!n.parentId && n.type !== 'functionGroup') {
        const linesToMap = n.data.lines || [n.data.codeLine];
        linesToMap.forEach((l: number) => {
          const lineKey = String(l);
          if (!nodesMap.has(lineKey)) {
            nodesMap.set(lineKey, n.id);
          }
        });
      }
    });
    // Nodos internos de funciones con prefijo 'func:' para resolución dual
    flowchartData.nodes.forEach(n => {
      if (n.parentId) {
        const lineKey = `func:${n.data.codeLine}`;
        if (!nodesMap.has(lineKey)) {
          nodesMap.set(lineKey, n.id);
        }
      }
    });

    // Cachear AST y nodesMap para poder hacer replay
    this._cachedAst = ast;
    this._cachedNodesMap = nodesMap;
    this._collectedInputs = [];

    // Generar pasos iniciales sin inputs (se detendrá en el primer prompt)
    try {
      this._simulationSteps = this._simulationEngine.buildSimulationSteps(ast, nodesMap, []);
    } catch (err: any) {
      this._panel?.webview.postMessage({
        type: 'error:runtime',
        payload: { message: err.message || String(err) },
      });
      return;
    }
    this._currentSimulationIndex = 0;
    this._isAutoPlaying = true;

    this._runAutoSimulation();
  }

  private _runAutoSimulation() {
    if (this._waitingForInput) return;

    if (this._currentSimulationIndex >= this._simulationSteps.length) {
      this._panel?.webview.postMessage({ type: 'simulation:end' });
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

      this._panel?.webview.postMessage({
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
    try {
      this._simulationSteps = this._simulationEngine.buildSimulationSteps(
        this._cachedAst,
        this._cachedNodesMap,
        this._collectedInputs
      );
    } catch (err: any) {
      this._panel?.webview.postMessage({
        type: 'error:runtime',
        payload: { message: err.message || String(err) },
      });
      return;
    }

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

    // Continuar la simulación desde el paso siguiente si está en autoplay
    if (this._isAutoPlaying) {
      this._simulationTimer = setTimeout(() => {
        this._runAutoSimulation();
      }, this._speedMs);
    }
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
        this._panel?.webview.postMessage({
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
      this._panel?.webview.postMessage({ type: 'simulation:end' });
      this._clearCodeHighlight();
    }
  }

  private _stopSimulation() {
    if (this._simulationTimer) {
      clearTimeout(this._simulationTimer);
      this._simulationTimer = undefined;
    }
    this._waitingForInput = false;
    this._isAutoPlaying = false;
    this._currentSimulationIndex = 0;
    this._collectedInputs = [];
    this._clearCodeHighlight();
  }

  private _pauseSimulation() {
    if (this._simulationTimer) {
      clearTimeout(this._simulationTimer);
      this._simulationTimer = undefined;
    }
    this._isAutoPlaying = false;
  }

  private _resumeSimulation() {
    this._isAutoPlaying = true;
    this._runAutoSimulation();
  }

  private _emitStep(step: SimulationStepPayload) {
    if (!this._panel) return;

    // Inyectar contador de pasos
    step.currentStep = this._currentSimulationIndex + 1;
    step.totalSteps = this._simulationSteps.length;

    this._panel.webview.postMessage({
      type: 'simulation:step',
      payload: step,
    });

    if (step.codeLine > 0) {
      this._highlightEditorLine(step.codeLine);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Highlight de líneas en el editor
  // ─────────────────────────────────────────────────────────────

  private _highlightEditorLine(line: number) {
    const editor = this._getJsEditor();
    if (editor && line > 0) {
      const range = new vscode.Range(line - 1, 0, line - 1, 1000);
      editor.setDecorations(this._activeLineDecorationType, [range]);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutside);
    }
  }

  private _clearCodeHighlight() {
    const editor = this._getJsEditor();
    if (editor) {
      editor.setDecorations(this._activeLineDecorationType, []);
    }
  }

  private _handleNodeClick(line: number) {
    this._highlightEditorLine(line);
  }

  // ─────────────────────────────────────────────────────────────
  // HTML del Webview
  // ─────────────────────────────────────────────────────────────

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
