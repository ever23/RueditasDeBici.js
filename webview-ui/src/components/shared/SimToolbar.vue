<template>
  <div class="sim-toolbar" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
    <div class="toolbar-left" style="display: flex; gap: 8px; align-items: center;">
      <button v-if="!isSimulating" class="btn btn-play" @click="$emit('start')">
        ▶ Simular en Vivo
      </button>
      <button v-if="!isSimulating && !isJsFile" class="btn btn-step" style="background-color: #6366f1;" @click="$emit('show-code')">
        💻 Ver Código JS
      </button>
      <template v-else>
        <button v-if="isAutoPlaying" class="btn btn-stop" style="background-color: #f59e0b;" @click="$emit('pause')">⏸ Pausar</button>
        <button v-else class="btn btn-play" @click="$emit('resume')">▶ Reanudar</button>
        <button v-if="!isAutoPlaying" class="btn btn-step" @click="$emit('next')">⏭ Siguiente Paso</button>
        <button class="btn btn-stop" @click="$emit('restart')">🔄 Reiniciar</button>
        <button class="btn btn-stop" @click="$emit('stop')">⏹ Detener</button>
        <span v-if="totalSteps > 0" class="step-counter">Paso {{ currentStep }} de {{ totalSteps }}</span>
      </template>
    </div>
    
    <div class="toolbar-right" style="display: flex; gap: 16px; align-items: center;">
      <div class="speed-selector">
        <label>Velocidad:</label>
        <select :value="selectedSpeed" @change="$emit('speed-change', Number(($event.target as HTMLSelectElement).value))">
          <option :value="2000">Lenta (2.0s)</option>
          <option :value="1200">Normal (1.2s)</option>
          <option :value="600">Rápida (0.6s)</option>
        </select>
      </div>
      <div class="author-credits" style="font-size: 0.75rem; color: #888; text-align: right;">
        Desarrollado por<br>
        <strong>Ing. Enyerber Franco</strong>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  isSimulating: boolean;
  isAutoPlaying: boolean;
  currentStep: number;
  totalSteps: number;
  selectedSpeed: number;
  isJsFile?: boolean;
}>();

defineEmits<{
  (e: 'start'): void;
  (e: 'next'): void;
  (e: 'restart'): void;
  (e: 'stop'): void;
  (e: 'pause'): void;
  (e: 'resume'): void;
  (e: 'show-code'): void;
  (e: 'speed-change', speed: number): void;
}>();
</script>
