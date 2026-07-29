import * as vscode from 'vscode';
import { FlowchartPanel } from './providers/FlowchartPanel';
import { registerEditorListener } from './listeners/editorListener';
import { DiagramEditorProvider } from './providers/DiagramEditorProvider';

export function activate(context: vscode.ExtensionContext) {
  console.log('¡RueditasDeBici.js activado!');

  // Registrar el Custom Editor para archivos .rdb
  context.subscriptions.push(DiagramEditorProvider.register(context));

  const provider = new FlowchartPanel(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(FlowchartPanel.viewType, provider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('RueditasDeBici.js.showFlowchart', () => {
      vscode.commands.executeCommand('RueditasDeBici.js.flowchartView.focus');
      provider.updateFlowchartForActiveEditor();
    })
  );

  registerEditorListener(context, provider);
}

export function deactivate() { }
