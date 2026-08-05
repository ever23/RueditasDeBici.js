import * as vscode from 'vscode';
import { FlowchartPanel } from '../providers/FlowchartPanel';

/**
 * Registra los observadores (listeners) para detectar cambios en el editor de código.
 * Cuando el usuario edita un archivo .js o cambia de pestaña, actualiza automáticamente
 * el diagrama de flujo en el panel abierto (si existe).
 * 
 * @param context El contexto de la extensión para limpiar los eventos al cerrar.
 */
export function registerEditorListener(
  context: vscode.ExtensionContext
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
        if (FlowchartPanel.currentPanel) {
          FlowchartPanel.currentPanel.updateFlowchartForActiveEditor();
        }
      }, 300);
    }
  });

  // Detectar cuando el usuario cambia de pestaña a otro archivo distinto
  const changeEditorSubscription = vscode.window.onDidChangeActiveTextEditor((editor) => {
    // Solo actualizar si el nuevo editor activo es un archivo JavaScript
    if (editor && editor.document.languageId === 'javascript' && FlowchartPanel.currentPanel) {
      FlowchartPanel.currentPanel.updateFlowchartForActiveEditor();
    }
  });

  context.subscriptions.push(changeDocumentSubscription, changeEditorSubscription);
}
