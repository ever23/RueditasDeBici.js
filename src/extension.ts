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

  // Registrar el comando expuesto al usuario en la Paleta de Comandos
  // ("Rueditas de Bici: Abrir Diagrama de Flujo")
  context.subscriptions.push(
    vscode.commands.registerCommand('RueditasDeBici.js.showFlowchart', () => {
      // Crear o enfocar el panel del diagrama al lado del editor activo
      const panel = FlowchartPanel.createOrShow(context.extensionUri);
      panel.updateFlowchartForActiveEditor();
    })
  );

  // Iniciar los listeners para detectar cuando el usuario escribe o cambia de pestaña
  registerEditorListener(context);
}

/**
 * Función llamada cuando la extensión se desactiva o se cierra VS Code.
 * Útil para liberar recursos pesados si los hubiera.
 */
export function deactivate() { }
