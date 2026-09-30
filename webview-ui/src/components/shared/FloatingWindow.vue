<script lang="ts">
// Compartido por todas las instancias de FloatingWindow
let globalZIndex = 100;
</script>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';

const props = defineProps<{
  title: string;
  icon?: string;
  initialX: number;
  initialY: number;
  initialWidth?: number;
  initialHeight?: number | string;
  minWidth?: number;
  minHeight?: number;
  startMinimized?: boolean;
  minimizedIndex?: number;
  minimized?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:minimized', val: boolean): void;
}>();

const safeX = () => {
  const w = props.initialWidth || 320;
  const vw = window.innerWidth || 1024;
  return Math.min(props.initialX, Math.max(10, vw - w - 20));
};

const safeY = () => {
  const vw = window.innerHeight || 768;
  return Math.min(props.initialY, Math.max(0, vw - 100));
};

const position = ref({ x: safeX(), y: safeY() });
const size = ref({ 
  width: props.initialWidth || 320, 
  height: props.initialHeight || 'auto' 
});
const zIndex = ref(globalZIndex++);
const isDragging = ref(false);
const isMinimized = ref(props.startMinimized !== undefined ? props.startMinimized : false);

// Reaccionar a cambios externos de v-model:minimized
watch(() => props.minimized, (newVal) => {
  if (newVal !== undefined && newVal !== isMinimized.value) {
    isMinimized.value = newVal;
  }
});

const bringToFront = () => {
  globalZIndex++;
  zIndex.value = globalZIndex;
};

const adjustPositionInsideScreen = () => {
  const currentWidth = typeof size.value.width === 'number' ? size.value.width : 320;
  const maxX = window.innerWidth - currentWidth - 20;
  if (position.value.x > maxX) {
    position.value.x = Math.max(10, maxX);
  }
};

const toggleMinimize = () => {
  isMinimized.value = !isMinimized.value;
  emit('update:minimized', isMinimized.value);
};

defineExpose({
  bringToFront,
  isMinimized,
});

onMounted(() => {
  nextTick(() => {
    adjustPositionInsideScreen();
  });
});

// --- DRAG LOGIC ---
let startX = 0;
let startY = 0;
let startPosX = 0;
let startPosY = 0;

const onDragStart = (e: MouseEvent) => {
  // Ignorar clics en botones dentro del header
  if ((e.target as HTMLElement).tagName.toLowerCase() === 'button') return;
  
  isDragging.value = true;
  bringToFront();
  startX = e.clientX;
  startY = e.clientY;
  startPosX = position.value.x;
  startPosY = position.value.y;

  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('mouseup', onDragEnd);
};

const onDragMove = (e: MouseEvent) => {
  if (!isDragging.value) return;
  
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  
  position.value.x = startPosX + dx;
  position.value.y = Math.max(0, startPosY + dy); // Evitar que se pierda arriba
};

const onDragEnd = () => {
  isDragging.value = false;
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
};

onUnmounted(() => {
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
});
</script>

<template>
  <div 
    class="floating-window"
    :class="{ dragging: isDragging, minimized: isMinimized }"
    :style="{
      left: isMinimized && minimizedIndex !== undefined ? `${20 + minimizedIndex * 220}px` : `${position.x}px`,
      top: isMinimized ? 'auto' : `${position.y}px`,
      bottom: isMinimized ? '20px' : 'auto',
      width: isMinimized ? '200px' : (typeof size.width === 'number' ? `${size.width}px` : size.width),
      height: isMinimized ? 'auto' : (typeof size.height === 'number' ? `${size.height}px` : size.height),
      minWidth: isMinimized ? '200px' : `${minWidth || 200}px`,
      minHeight: isMinimized ? 'unset' : `${minHeight || 100}px`,
      zIndex: zIndex
    }"
    @mousedown="bringToFront"
  >
    <div class="window-header" @mousedown="onDragStart" @dblclick="toggleMinimize">
      <div class="header-left">
        <span v-if="icon" class="window-icon">{{ icon }}</span>
        <span class="window-title">{{ title }}</span>
      </div>
      <div class="header-right">
        <button class="win-btn win-minimize" @click.stop="toggleMinimize" title="Minimizar">
          {{ isMinimized ? '🗖' : '🗕' }}
        </button>
      </div>
    </div>
    
    <div class="window-content" v-show="!isMinimized">
      <slot></slot>
    </div>
  </div>
</template>

<style scoped>
.floating-window {
  position: absolute;
  pointer-events: auto;
  background-color: #1e1e1e;
  border-radius: 8px;
  border: 1px solid #333;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  /* Propiedad mágica para permitir redimensionar la caja CSS pura! */
  resize: both;
}

.floating-window.dragging {
  opacity: 0.9;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.6);
}

.floating-window.minimized {
  height: auto !important;
  min-height: unset !important;
  resize: none;
  padding-bottom: 0;
}

.window-header {
  background-color: #252526;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #333;
  cursor: grab;
  user-select: none;
}

.window-header:active {
  cursor: grabbing;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.window-icon {
  font-size: 16px;
}

.window-title {
  color: #cccccc;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.win-btn {
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  font-size: 14px;
}
.win-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.window-content {
  flex: 1;
  overflow: auto; /* Scroll interno para el contenido */
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}
</style>
