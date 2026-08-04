import * as vscode from 'vscode';
import { FlowchartPanel } from './providers/FlowchartPanel';
import { registerEditorListener } from './listeners/editorListener';
import { DiagramEditorProvider } from './providers/DiagramEditorProvider';

/**
 * Punto de entrada principal de la extensión.
 * VS Code invoca esta función la primera vez que se activa la extensión
 * (basado en los activationEvents del package.json).
 * 
 * @param context Contexto de la extensión provisto por VS Code. Permite registrar comandos, vistas y limpiar recursos.
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('¡RueditasDeBici.js activado!');

  // Registrar el Custom Editor para archivos .rdb (diagramas guardados)
  context.subscriptions.push(DiagramEditorProvider.register(context));

  // Instanciar el proveedor de la vista gráfica (Webview) principal
  const provider = new FlowchartPanel(context.extensionUri);

  // Registrar el proveedor para que aparezca en el panel lateral/inferior según se configure
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(FlowchartPanel.viewType, provider)
  );

  // Registrar el comando expuesto al usuario en la Paleta de Comandos ("RueditasDeBici: Mostrar Diagrama")
  context.subscriptions.push(
    vscode.commands.registerCommand('RueditasDeBici.js.showFlowchart', () => {
      // 1. Enfoca el panel del diagrama para que sea visible
      vscode.commands.executeCommand('RueditasDeBici.js.flowchartView.focus');
      // 2. Lee el archivo activo actualmente y genera el diagrama
      provider.updateFlowchartForActiveEditor();
    })
  );

  // Iniciar los listeners para detectar cuando el usuario escribe o cambia de pestaña
  registerEditorListener(context, provider);
}

/**
 * Función llamada cuando la extensión se desactiva o se cierra VS Code.
 * Útil para liberar recursos pesados si los hubiera.
 */
export function deactivate() { }
