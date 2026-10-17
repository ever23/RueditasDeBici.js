<template>
  <div class="sim-toolbar" role="toolbar" aria-label="Controles de simulación">
    <div class="toolbar-left" style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
      <template v-if="!isSimulating">
        <button class="btn btn-play" aria-label="Iniciar simulación en vivo" @click="$emit('start')">
          ▶ Simular en Vivo
        </button>
        <button v-if="!isJsFile" class="btn btn-step" style="background-color: #6366f1;" aria-label="Ver código JavaScript generado" @click="$emit('show-code')">
          💻 Ver Código JS
        </button>
      </template>
      <template v-else>
        <button v-if="isAutoPlaying" class="btn btn-stop" style="background-color: #f59e0b;" aria-label="Pausar simulación" @click="$emit('pause')">⏸ Pausar</button>
        <button v-else class="btn btn-play" aria-label="Reanudar simulación" @click="$emit('resume')">▶ Reanudar</button>
        <button
          v-if="!isAutoPlaying"
          class="btn btn-step"
          :disabled="currentStep <= 1"
          :style="{ opacity: currentStep <= 1 ? 0.5 : 1, cursor: currentStep <= 1 ? 'not-allowed' : 'pointer' }"
          title="Retroceder al paso anterior"
          aria-label="Paso anterior"
          @click="$emit('prev')"
        >
          ⏮ Paso Anterior
        </button>
        <button v-if="!isAutoPlaying" class="btn btn-step" title="Avanzar al siguiente paso" aria-label="Siguiente paso" @click="$emit('next')">⏭ Siguiente Paso</button>
        <button class="btn btn-stop" aria-label="Reiniciar simulación" @click="$emit('restart')">🔄 Reiniciar</button>
        <button class="btn btn-stop" aria-label="Detener simulación" @click="$emit('stop')">⏹ Detener</button>
        <span v-if="totalSteps > 0" class="step-counter" aria-live="polite">Paso {{ currentStep }} de {{ totalSteps }}</span>
      </template>
    </div>
    
    <div class="toolbar-right" style="display: flex; gap: 14px; align-items: center; margin-left: auto; flex-shrink: 0;">
      <div class="speed-selector">
        <label for="sim-speed-select">Velocidad:</label>
        <select id="sim-speed-select" aria-label="Velocidad de simulación" :value="selectedSpeed" @change="$emit('speed-change', Number(($event.target as HTMLSelectElement).value))">
          <option :value="2000">Lenta (2.0s)</option>
          <option :value="1200">Normal (1.2s)</option>
          <option :value="600">Rápida (0.6s)</option>
        </select>
      </div>
      <div class="author-credits" style="font-size: 0.72rem; color: #94a3b8; text-align: right; line-height: 1.25; white-space: nowrap;">
        Desarrollado por<br>
        <strong style="color: #e2e8f0;">Ing. Enyerber Franco</strong>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  isSimulating: boolean;
  isAutoPlaying?: boolean;
  currentStep: number;
  totalSteps: number;
  selectedSpeed: number;
  isJsFile?: boolean;
}>(), {
  isAutoPlaying: false,
  isJsFile: true,
});

defineEmits<{
  (e: 'start'): void;
  (e: 'prev'): void;
  (e: 'next'): void;
  (e: 'restart'): void;
  (e: 'stop'): void;
  (e: 'pause'): void;
  (e: 'resume'): void;
  (e: 'show-code'): void;
  (e: 'speed-change', speed: number): void;
}>();
</script>
