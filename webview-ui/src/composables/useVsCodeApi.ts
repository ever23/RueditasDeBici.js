import { ref, onMounted, onUnmounted } from 'vue';
import type { WebviewToExtensionMessage, ExtensionToWebviewMessage } from '../../src/shared/types';

declare function acquireVsCodeApi(): {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
};

let vscodeApi: any = null;

export function useVsCodeApi() {
  if (!vscodeApi && typeof acquireVsCodeApi === 'function') {
    vscodeApi = acquireVsCodeApi();
  }

  const postMessage = (message: WebviewToExtensionMessage) => {
    if (vscodeApi) {
      vscodeApi.postMessage(message);
    } else {
      console.log('[Dev Mode] postMessage:', message);
    }
  };

  const onMessage = (callback: (message: ExtensionToWebviewMessage) => void) => {
    const handler = (event: MessageEvent) => {
      const message = event.data as ExtensionToWebviewMessage;
      callback(message);
    };

    onMounted(() => window.addEventListener('message', handler));
    onUnmounted(() => window.removeEventListener('message', handler));
  };

  return {
    postMessage,
    onMessage,
  };
}
