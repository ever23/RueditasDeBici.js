import * as vscode from 'vscode';
import { FlowchartPanel } from '../providers/FlowchartPanel';

/**
 * Registra los observadores (listeners) para detectar cambios en el editor de código.
 * 
 * @param context El contexto de la extensión para limpiar los eventos al cerrar.
 * @param provider La instancia del Webview que contiene el diagrama.
 */
export function registerEditorListener(
  context: vscode.ExtensionContext,
  provider: FlowchartPanel
) {
  let debounceTimer: NodeJS.Timeout | undefined;

  // Detectar cada vez que el usuario escribe algo en el documento de texto
  const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
    const activeEditor = vscode.window.activeTextEditor;
    // Solo actualizar si el archivo que se editó es el que el usuario tiene activo en la pantalla
    if (activeEditor && event.document === activeEditor.document) {
      if (debounceTimer) {
        clearTimeout(debounceTimer); // Cancelar la actualización anterior si sigue escribiendo rápido
      }
      // Esperar 300 milisegundos de inactividad antes de procesar el código y mandar el nuevo diagrama
      debounceTimer = setTimeout(() => {
        provider.updateFlowchartForActiveEditor();
      }, 300);
    }
  });

  // Detectar cuando el usuario cambia de pestaña a otro archivo distinto
  const changeEditorSubscription = vscode.window.onDidChangeActiveTextEditor(() => {
    provider.updateFlowchartForActiveEditor();
  });

  context.subscriptions.push(changeDocumentSubscription, changeEditorSubscription);
}
