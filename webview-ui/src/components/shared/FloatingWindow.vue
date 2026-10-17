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

const getViewportWidth = () => document.documentElement.clientWidth || window.innerWidth || 1024;
const getViewportHeight = () => document.documentElement.clientHeight || window.innerHeight || 768;

const safeX = () => {
  const w = props.initialWidth || 340;
  const vw = getViewportWidth();
  return Math.min(props.initialX, Math.max(12, vw - w - 24));
};

const safeY = () => {
  const vh = getViewportHeight();
  return Math.min(props.initialY, Math.max(64, vh - 140));
};

const position = ref({ x: safeX(), y: safeY() });
const size = ref({ 
  width: props.initialWidth || 340, 
  height: props.initialHeight || 'auto' 
});
const zIndex = ref(globalZIndex++);
const isDragging = ref(false);
const isMinimized = ref(props.startMinimized !== undefined ? props.startMinimized : false);

const adjustPositionInsideScreen = () => {
  const currentWidth = typeof size.value.width === 'number' ? size.value.width : 340;
  const vw = getViewportWidth();
  const vh = getViewportHeight();
  const maxX = vw - currentWidth - 20;
  if (position.value.x > maxX) {
    position.value.x = Math.max(12, maxX);
  }
  if (position.value.y < 60) {
    position.value.y = 64;
  } else if (position.value.y > vh - 80) {
    position.value.y = Math.max(64, vh - 140);
  }
};

// Reaccionar a cambios externos de v-model:minimized
watch(() => props.minimized, (newVal) => {
  if (newVal !== undefined && newVal !== isMinimized.value) {
    isMinimized.value = newVal;
    if (!newVal) {
      nextTick(() => adjustPositionInsideScreen());
    }
  }
});

const bringToFront = () => {
  globalZIndex++;
  zIndex.value = globalZIndex;
};

const toggleMinimize = () => {
  isMinimized.value = !isMinimized.value;
  if (!isMinimized.value) {
    nextTick(() => adjustPositionInsideScreen());
  }
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
  window.addEventListener('resize', adjustPositionInsideScreen);
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
  const currentWidth = typeof size.value.width === 'number' ? size.value.width : 340;
  const maxX = Math.max(12, getViewportWidth() - currentWidth - 16);
  
  position.value.x = Math.min(maxX, Math.max(8, startPosX + dx));
  position.value.y = Math.max(58, startPosY + dy); // Evitar que tape la barra superior
};

const onDragEnd = () => {
  isDragging.value = false;
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
};

onUnmounted(() => {
  window.removeEventListener('mousemove', onDragMove);
  window.removeEventListener('mouseup', onDragEnd);
  window.removeEventListener('resize', adjustPositionInsideScreen);
});
</script>

<template>
  <div 
    class="floating-window"
    :class="{ dragging: isDragging, minimized: isMinimized }"
    :style="{
      left: isMinimized && minimizedIndex !== undefined ? `${14 + minimizedIndex * 224}px` : `${position.x}px`,
      top: isMinimized ? 'auto' : `${position.y}px`,
      bottom: isMinimized ? '14px' : 'auto',
      width: isMinimized ? '214px' : (typeof size.width === 'number' ? `${size.width}px` : size.width),
      height: isMinimized ? 'auto' : (typeof size.height === 'number' ? `${size.height}px` : size.height),
      minWidth: isMinimized ? '214px' : `${minWidth || 240}px`,
      minHeight: isMinimized ? 'unset' : `${minHeight || 110}px`,
      zIndex: zIndex
    }"
    @mousedown="bringToFront"
  >
    <div class="window-header" @mousedown="onDragStart" @dblclick="toggleMinimize">
      <div class="header-left">
        <span v-if="icon" class="window-icon">{{ icon }}</span>
        <span class="window-title" :title="title">{{ title }}</span>
      </div>
      <div class="header-right">
        <slot v-if="!isMinimized" name="header-actions"></slot>
        <button class="win-btn win-minimize" @click.stop="toggleMinimize" :title="isMinimized ? 'Expandir panel' : 'Minimizar panel'">
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
  background-color: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 10px;
  border: 1px solid #334155;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5);
  resize: both;
}

.floating-window.dragging {
  opacity: 0.92;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.65);
  border-color: #38bdf8;
}

.floating-window.minimized {
  height: auto !important;
  min-height: unset !important;
  resize: none;
  padding-bottom: 0;
  border-radius: 8px;
}

.window-header {
  background-color: rgba(30, 41, 59, 0.95);
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #334155;
  cursor: grab;
  user-select: none;
  gap: 8px;
}

.floating-window.minimized .window-header {
  border-bottom: none;
}

.window-header:active {
  cursor: grabbing;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.window-icon {
  font-size: 15px;
  flex-shrink: 0;
}

.window-title {
  color: #e2e8f0;
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.win-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #cbd5e1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 5px;
  font-size: 12px;
  transition: all 0.15s ease;
}
.win-btn:hover {
  background: rgba(56, 189, 248, 0.2);
  border-color: #38bdf8;
  color: #38bdf8;
}

.window-content {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}
</style>
