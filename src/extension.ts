import * as vscode from 'vscode';
import { FlowchartPanel } from './providers/FlowchartPanel';
import { registerEditorListener } from './listeners/editorListener';

export function activate(context: vscode.ExtensionContext) {
  console.log('La extensión "CodigoVivoJS" se ha activado.');

  const provider = new FlowchartPanel(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(FlowchartPanel.viewType, provider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('codigoVivo.showFlowchart', () => {
      vscode.commands.executeCommand('codigoVivo.flowchartView.focus');
      provider.updateFlowchartForActiveEditor();
    })
  );

  registerEditorListener(context, provider);
}

export function deactivate() {}
