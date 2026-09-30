import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parseCode } from '../analyzer/parser';
import { transformAstToFlowchart } from '../analyzer/transformer';
import { SimulationController } from '../analyzer/SimulationController';
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

  private _simulationController: SimulationController;

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

    this._simulationController = new SimulationController({
      postMessage: (msg: any) => this._panel?.webview.postMessage(msg),
      highlightLine: (line: number) => this._highlightEditorLine(line),
      clearHighlight: () => this._clearCodeHighlight(),
    });

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
            if (message.payload.nodeId) {
              this._panel?.webview.postMessage({
                type: 'highlight:node',
                payload: { nodeId: message.payload.nodeId },
              });
            }
            break;
          case 'simulation:start':
            this._startSimulation();
            break;
          case 'simulation:next':
            this._simulationController.nextStep();
            break;
          case 'simulation:stop':
            this._simulationController.stopSimulation();
            break;
          case 'simulation:pause':
            this._simulationController.pauseSimulation();
            break;
          case 'simulation:resume':
            this._simulationController.resumeSimulation();
            break;
          case 'simulation:speed':
            this._simulationController.setSpeed(message.payload.speedMs);
            break;
          case 'simulation:submitInput':
            if (message.payload.value.startsWith('WEBVIEW ERROR') || message.payload.value.startsWith('WEBVIEW PROMISE ERROR')) {
              vscode.window.showErrorMessage(message.payload.value);
            } else {
              this._simulationController.handleSubmittedInput(message.payload.value);
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

    this._simulationController.stopSimulation();
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
    this._simulationController.stopSimulation();

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
      if (!n.parentNode && n.type !== 'functionGroup') {
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
      if (n.parentNode) {
        const lineKey = `func:${n.data.codeLine}`;
        if (!nodesMap.has(lineKey)) {
          nodesMap.set(lineKey, n.id);
        }
      }
    });
    // Grupos contenedores de funciones para Hoisting y saltos visuales
    flowchartData.nodes.forEach(n => {
      if (n.type === 'functionGroup') {
        nodesMap.set(`group:${n.data.codeLine}`, n.id);
      }
    });

    this._simulationController.startSimulation(ast, nodesMap, true);
  }

  // ─────────────────────────────────────────────────────────────
  // Highlight de líneas en el editor
  // ─────────────────────────────────────────────────────────────

  private _highlightEditorLine(line: number) {
    const editor = this._getJsEditor();
    if (editor && line > 0) {
      const range = new vscode.Range(line - 1, 0, line - 1, 1000);
      editor.setDecorations(this._activeLineDecorationType, [range]);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
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
