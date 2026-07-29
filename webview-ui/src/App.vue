<template>
  <div v-if="!mode" class="loading-mode" style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; color: #ccc;">
    <h2>Cargando Interfaz...</h2>
  </div>
  <DiagramEditor v-else-if="mode === 'editor'" :initial-data="initialPayload" />
  <FlowchartCanvas v-else-if="mode === 'viewer'" :initial-data="initialPayload" />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import FlowchartCanvas from './components/FlowchartCanvas.vue';
import DiagramEditor from './components/DiagramEditor.vue';
import { useVsCodeApi } from './composables/useVsCodeApi';

const mode = ref<'viewer' | 'editor' | null>(null);
const initialPayload = ref<any>(null);
const { postMessage } = useVsCodeApi();

window.onerror = function (msg, url, lineNo, columnNo, error) {
  postMessage({ type: 'simulation:submitInput', payload: { value: `WEBVIEW ERROR: ${msg} at ${lineNo}:${columnNo} \n ${error?.stack}` } });
  return false;
};

window.addEventListener('unhandledrejection', (event) => {
  postMessage({ type: 'simulation:submitInput', payload: { value: `WEBVIEW PROMISE ERROR: ${event.reason}` } });
});

onMounted(() => {
  window.addEventListener('message', (event) => {
    const message = event.data;
    if (message.type === 'init:editor') {
      initialPayload.value = message.payload;
      mode.value = 'editor';
    } else if (message.type === 'update:flowchart') {
      if (!mode.value) {
        initialPayload.value = message.payload;
        mode.value = 'viewer';
      }
    }
  });

  // Notificar al backend de VS Code que el contenedor webview ya cargó el script principal
  postMessage({ type: 'ready' });
});
</script>

<style>
html, body, #app {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>
