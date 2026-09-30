import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { parseCode } from '../analyzer/parser';
import { SimulationController } from '../analyzer/SimulationController';
import { GraphToCodeGenerator } from '../analyzer/GraphToCodeGenerator';

export class DiagramEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'RueditasDeBici.js.diagramEditor';

  private _simulationController!: SimulationController;
  private _currentPanel?: vscode.WebviewPanel;
  private _cachedAst: any;
  private _cachedNodesMap: any;
  private _collectedInputs: string[] = [];

  constructor(private readonly _context: vscode.ExtensionContext) {}

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new DiagramEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(
      DiagramEditorProvider.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }
    );
  }

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this._currentPanel = webviewPanel;
    this._simulationController = new SimulationController({
      postMessage: (msg: any) => this._currentPanel?.webview.postMessage(msg)
    });

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._context.extensionUri],
    };

    webviewPanel.webview.html = this._getHtmlForWebview(webviewPanel.webview);

    // Initial message to set mode and send file content
    const updateWebview = () => {
      let content = document.getText().trim();
      
      // Si el archivo está vacío, generar una plantilla base automáticamente
      if (!content) {
        const baseTemplate = {
          nodes: [
            { id: "n_1", type: "startEnd", position: { x: 250, y: 50 }, data: { label: "Inicio" } },
            { id: "n_2", type: "startEnd", position: { x: 250, y: 400 }, data: { label: "Fin" } }
          ],
          edges: []
        };
        content = JSON.stringify(baseTemplate, null, 2);
        
        // Escribirlo en el archivo físico
        this._updateDocument(document, content);
      }

      webviewPanel.webview.postMessage({
        type: 'init:editor',
        payload: {
          content: content,
          isJsFile: document.uri.fsPath.endsWith('.js'),
        },
      });
    };

    // Receive messages from webview
    const messageListener = webviewPanel.webview.onDidReceiveMessage((e) => {
      if (e.type === 'ready') {
        updateWebview();
      } else if (e.type === 'update:document') {
        this._updateDocument(document, e.payload.content);
      } else if (e.type === 'simulation:start') {
        this._startSimulation(document.getText());
      } else if (e.type === 'simulation:next') {
        this._simulationController.nextStep();
      } else if (e.type === 'simulation:stop') {
        this._simulationController.stopSimulation();
      } else if (e.type === 'simulation:pause') {
        this._simulationController.pauseSimulation();
      } else if (e.type === 'simulation:resume') {
        this._simulationController.resumeSimulation();
      } else if (e.type === 'simulation:speed') {
        this._simulationController.setSpeed(e.payload.speedMs);
      } else if (e.type === 'simulation:submitInput') {
        if (e.payload.value.startsWith('WEBVIEW ERROR') || e.payload.value.startsWith('WEBVIEW PROMISE ERROR')) {
          vscode.window.showErrorMessage(e.payload.value);
        } else {
          this._simulationController.handleSubmittedInput(e.payload.value);
        }
      }
    });

    // Clean up
    webviewPanel.onDidDispose(() => {
      this._simulationController.stopSimulation();
      messageListener.dispose();
    });

    // Update webview if text changes outside the editor
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        updateWebview();
        this._simulationController.stopSimulation();
      }
    });

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
    });
  }

  private _updateDocument(document: vscode.TextDocument, content: string) {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      content
    );
    return vscode.workspace.applyEdit(edit);
  }

  private _startSimulation(documentText: string) {
    if (!this._currentPanel) return;

    this._simulationController.stopSimulation();
    
    let parsedJson;
    try {
      parsedJson = JSON.parse(documentText);
    } catch(e) {
      this._currentPanel.webview.postMessage({ type: 'error:runtime', payload: { message: 'El diagrama no es válido.' } });
      return;
    }

    // 1. Generate JS Code from visual graph
    const { code, lineToNodeMap } = GraphToCodeGenerator.generate(parsedJson.nodes || [], parsedJson.edges || []);
    this._currentPanel.webview.postMessage({ type: 'debug:code', payload: { code } });
    
    // 2. Parse JS Code to AST
    let parseResult;
    try {
      parseResult = parseCode(code);
    } catch(err: any) {
      this._currentPanel.webview.postMessage({ type: 'error:runtime', payload: { message: 'Excepción al intentar analizar el código: ' + (err.message || String(err)) } });
      return;
    }

    if (parseResult.error) {
      this._currentPanel.webview.postMessage({ type: 'error:runtime', payload: { message: 'Error de sintaxis en el diagrama (Línea ' + parseResult.line + '): ' + parseResult.error } });
      return;
    }

    const ast = parseResult.ast;
    this._cachedAst = ast;
    this._cachedNodesMap = lineToNodeMap;
    this._collectedInputs = [];

    // 3. Build steps
    const nodesMapAny: any = new Map(Object.entries(lineToNodeMap)); 
    this._simulationController.startSimulation(ast, nodesMapAny, true);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const webviewHtmlPath = path.join(this._context.extensionUri.fsPath, 'dist', 'webview', 'index.html');
    if (fs.existsSync(webviewHtmlPath)) {
      return fs.readFileSync(webviewHtmlPath, 'utf8');
    }

    return `<!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Editor de Diagramas - RueditasDeBici</title>
      <style>body { font-family: sans-serif; padding: 15px; color: #ccc; }</style>
    </head>
    <body>
      <h3>Editor de Diagramas</h3>
      <p>Esperando compilación del Webview UI (dist/webview/index.html)...</p>
    </body>
    </html>`;
  }
}
