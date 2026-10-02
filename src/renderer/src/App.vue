<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useResumeStore } from './stores/resumeStore'
import { useResumeData } from './composables/useResumeData'
import BlockPalette from './components/BlockPalette.vue'
import ResumeEditor from './components/ResumeEditor.vue'
import PropertyPanel from './components/PropertyPanel.vue'
import ExportPanel from './components/ExportPanel.vue'

const store = useResumeStore()
const { startAutoSave, restoreOrInit, saveToFile, loadFromFile, openDraftFolder } = useResumeData()

const showExport = ref(false)
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

function notify(message: string): void {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2600)
}

function applyTheme(): void {
  document.documentElement.dataset.theme = store.theme
}

function toggleTheme(): void {
  store.theme = store.theme === 'light' ? 'dark' : 'light'
  applyTheme()
}

async function onSave(): Promise<void> {
  const path = await saveToFile()
  if (path) notify(`已保存：${path}`)
}

async function onOpen(): Promise<void> {
  try {
    if (await loadFromFile()) notify('简历数据已载入')
  } catch {
    notify('打开失败：文件格式不正确')
  }
}

async function onOpenDraftFolder(): Promise<void> {
  await openDraftFolder()
  notify('已打开草稿文件夹')
}

function onKeydown(e: KeyboardEvent): void {
  const target = e.target as HTMLElement
  const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  const mod = e.ctrlKey || e.metaKey
  const key = e.key.toLowerCase()
  if (mod && key === 'z' && !e.shiftKey) {
    e.preventDefault()
    store.undo()
  } else if ((mod && key === 'y') || (mod && e.shiftKey && key === 'z')) {
    e.preventDefault()
    store.redo()
  } else if (mod && key === 's') {
    e.preventDefault()
    onSave()
  } else if (!inInput && (e.key === 'Delete' || e.key === 'Backspace') && store.selectedId && !store.editingId) {
    e.preventDefault()
    store.removeBlock(store.selectedId)
  } else if (e.key === 'Escape') {
    // ESC：先退出编辑模式，再取消选中
    if (store.editingId) store.editingId = null
    else store.select(null)
  } else if (!inInput && ARROW_KEYS[e.key] && store.selectedId && !store.editingId) {
    // 方向键微调位置，Shift 加速 10 倍
    e.preventDefault()
    const step = e.shiftKey ? 10 : 1
    const [dx, dy] = ARROW_KEYS[e.key]
    store.nudgeSelected(dx * step, dy * step)
  }
}

const ARROW_KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0]
}

onMounted(() => {
  applyTheme()
  restoreOrInit()
  startAutoSave()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="brand">📄 ResumeForge</div>
      <div class="header-actions">
        <button class="btn" :disabled="!store.canUndo" title="Ctrl+Z" @click="store.undo()">↩ 撤销</button>
        <button class="btn" :disabled="!store.canRedo" title="Ctrl+Y" @click="store.redo()">↪ 重做</button>
        <span class="divider"></span>
        <button class="btn" @click="onOpen">打开</button>
        <button class="btn" title="Ctrl+S" @click="onSave">保存</button>
        <button class="btn primary" @click="showExport = true">导出</button>
        <span class="divider"></span>
        <button class="btn" @click="toggleTheme">
          {{ store.theme === 'light' ? '🌙 暗色' : '☀️ 亮色' }}
        </button>
        <span class="divider"></span>
        <button class="btn" title="打开草稿存档文件夹" @click="onOpenDraftFolder">📁 草稿</button>
      </div>
    </header>

    <div class="app-body">
      <BlockPalette class="palette" />
      <ResumeEditor class="editor" />
      <PropertyPanel class="property" />
    </div>

    <ExportPanel v-if="showExport" @close="showExport = false" @done="notify" />
    <transition name="fade">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </transition>
  </div>
</template>

<style lang="scss" scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg);
  color: var(--text);
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 16px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;

  .brand {
    font-weight: 700;
    font-size: 15px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .divider {
    width: 1px;
    height: 20px;
    background: var(--border);
  }
}

.app-body {
  display: flex;
  flex: 1;
  min-height: 0;

  .palette {
    width: 200px;
    flex-shrink: 0;
  }

  .editor {
    flex: 1;
    min-width: 0;
  }

  .property {
    width: 264px;
    flex-shrink: 0;
  }
}

.toast {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 20px;
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  font-size: 13px;
  z-index: 1000;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
