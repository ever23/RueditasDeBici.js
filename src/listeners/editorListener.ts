import * as vscode from 'vscode';
import { FlowchartPanel } from '../providers/FlowchartPanel';

export function registerEditorListener(
  context: vscode.ExtensionContext,
  provider: FlowchartPanel
) {
  let debounceTimer: NodeJS.Timeout | undefined;

  const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((event) => {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && event.document === activeEditor.document) {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        provider.updateFlowchartForActiveEditor();
      }, 300);
    }
  });

  const changeEditorSubscription = vscode.window.onDidChangeActiveTextEditor(() => {
    provider.updateFlowchartForActiveEditor();
  });

  context.subscriptions.push(changeDocumentSubscription, changeEditorSubscription);
}
