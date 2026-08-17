<script setup lang="ts">
import { useResumeStore } from '../stores/resumeStore'
import { BLOCK_TYPE_LABELS, type BlockType } from '../types/resume'
import { TEMPLATE_LABELS, type TemplateName } from '../utils/blocks'

const store = useResumeStore()

const BLOCK_TYPES = Object.keys(BLOCK_TYPE_LABELS) as BlockType[]
const TEMPLATES = Object.keys(TEMPLATE_LABELS) as TemplateName[]

const TYPE_ICONS: Record<BlockType, string> = {
  personal: '👤',
  summary: '📝',
  experience: '💼',
  education: '🎓',
  skills: '🏷️',
  project: '🚀',
  certificate: '🏅',
  custom: '🧩'
}

function onDragStart(e: DragEvent, type: BlockType): void {
  e.dataTransfer?.setData('block-type', type)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'
}

function onTemplate(name: TemplateName): void {
  if (store.blocks.length > 0 && !window.confirm(`应用「${TEMPLATE_LABELS[name]}」模板将替换当前全部区块（可撤销），继续吗？`)) {
    return
  }
  store.applyTemplate(name)
}

function onClear(): void {
  if (window.confirm('清空画布上的所有区块？（可撤销）')) store.clearAll()
}
</script>

<template>
  <aside class="palette-panel">
    <div class="panel-section">
      <h3>区块组件</h3>
      <p class="tip">点击添加，或拖拽到画布</p>
      <div class="block-list">
        <div
          v-for="type in BLOCK_TYPES"
          :key="type"
          class="palette-item"
          draggable="true"
          @dragstart="onDragStart($event, type)"
          @click="store.addBlock(type)"
        >
          <span class="icon">{{ TYPE_ICONS[type] }}</span>
          <span>{{ BLOCK_TYPE_LABELS[type] }}</span>
        </div>
      </div>
    </div>

    <div class="panel-section">
      <h3>模板预设</h3>
      <div class="template-list">
        <button v-for="t in TEMPLATES" :key="t" class="template-btn" @click="onTemplate(t)">
          {{ TEMPLATE_LABELS[t] }}
        </button>
      </div>
    </div>

    <div class="panel-section">
      <button class="clear-btn" @click="onClear">🗑 清空画布</button>
    </div>
  </aside>
</template>

<style lang="scss" scoped>
.palette-panel {
  height: 100%;
  overflow-y: auto;
  background: var(--panel);
  border-right: 1px solid var(--border);
  padding: 12px;
  box-sizing: border-box;
}

.panel-section {
  margin-bottom: 20px;

  h3 {
    margin: 0 0 6px;
    font-size: 13px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .tip {
    margin: 0 0 8px;
    font-size: 11px;
    color: var(--text-dim);
  }
}

.block-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  font-size: 13px;
  cursor: grab;
  transition: border-color 0.15s, transform 0.1s;

  &:hover {
    border-color: var(--accent);
  }
  &:active {
    transform: scale(0.97);
  }

  .icon {
    font-size: 15px;
  }
}

.template-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.template-btn {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
}

.clear-btn {
  width: 100%;
  padding: 8px;
  border: 1px solid #ef4444;
  border-radius: 8px;
  background: transparent;
  color: #ef4444;
  font-size: 13px;
  cursor: pointer;

  &:hover {
    background: rgba(239, 68, 68, 0.08);
  }
}
</style>
