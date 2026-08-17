<script setup lang="ts">
import { computed, ref } from 'vue'
import { useResumeStore } from '../stores/resumeStore'
import type { BlockType } from '../types/resume'
import BlockComponent from './BlockComponent.vue'

const store = useResumeStore()
const viewportRef = ref<HTMLElement | null>(null)

/** 页面之间的可视间距（仅视觉，坐标空间是连续的） */
const PAGE_GAP = 24

/** 打印/导出时强制 100% 缩放，保证输出尺寸精确 */
const effectiveZoom = computed(() => (store.isExporting ? 1 : store.zoom))

const pageH = computed(() => store.pageSettings.height)

const pages = computed(() => Array.from({ length: store.pageCount }, (_, i) => i))

const GRID =
  'linear-gradient(to right, rgba(120,120,120,0.10) 1px, transparent 1px),' +
  'linear-gradient(to bottom, rgba(120,120,120,0.10) 1px, transparent 1px)'

const pageStyle = computed(() => ({
  width: store.pageSettings.width + 'px',
  height: pageH.value + 'px',
  background: store.pageSettings.backgroundColor,
  backgroundImage: store.isExporting ? 'none' : GRID,
  backgroundSize: '20px 20px',
  transform: `scale(${effectiveZoom.value})`
}))

const columnStyle = computed(() => ({
  width: store.pageSettings.width * effectiveZoom.value + 'px'
}))

function scalerStyle(index: number): Record<string, string> {
  return {
    width: store.pageSettings.width * effectiveZoom.value + 'px',
    height: pageH.value * effectiveZoom.value + 'px',
    marginBottom: index < pages.value.length - 1 ? PAGE_GAP * effectiveZoom.value + 'px' : '0px'
  }
}

/** 某一页上的区块（按区块左上角所属页分配） */
function blocksOnPage(index: number) {
  return store.sortedBlocks.filter((b) => Math.floor(b.y / pageH.value) === index)
}

function pageOffset(index: number): number {
  return index * pageH.value
}

/** 水平辅助线（画布 y 坐标）换算为页面栏内的屏幕坐标（考虑可视页间距） */
function guideTop(canvasY: number): number {
  const pageIndex = Math.floor(canvasY / pageH.value)
  return (canvasY + pageIndex * PAGE_GAP) * effectiveZoom.value
}

function zoomIn(): void {
  store.zoom = Math.min(2, Math.round((store.zoom + 0.1) * 10) / 10)
}

function zoomOut(): void {
  store.zoom = Math.max(0.4, Math.round((store.zoom - 0.1) * 10) / 10)
}

function zoomReset(): void {
  store.zoom = 1
}

/** 缩放至适应视口宽度 */
function zoomFit(): void {
  const vw = viewportRef.value?.clientWidth ?? 900
  const fit = (vw - 80) / store.pageSettings.width
  store.zoom = Math.min(2, Math.max(0.4, Math.round(fit * 100) / 100))
}

function onDragOver(e: DragEvent): void {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

/** 从工具栏拖入新区块：按落点所在页换算连续坐标 */
function onDrop(e: DragEvent): void {
  e.preventDefault()
  const type = e.dataTransfer?.getData('block-type') as BlockType
  if (!type) return
  const pageEl = (e.target as HTMLElement).closest('.resume-page') as HTMLElement | null
  if (!pageEl) return
  const pageIndex = Number(pageEl.dataset.index ?? 0)
  const rect = pageEl.getBoundingClientRect()
  const x = Math.round((e.clientX - rect.left) / effectiveZoom.value) - 60
  const y =
    pageIndex * pageH.value + Math.round((e.clientY - rect.top) / effectiveZoom.value) - 20
  store.addBlock(type, Math.max(0, x), Math.max(0, y))
}

function onBlankPointerDown(): void {
  store.select(null)
}
</script>

<template>
  <div class="editor-wrap">
    <div class="zoom-bar">
      <button class="btn" @click="zoomOut">−</button>
      <span class="zoom-value" @dblclick="zoomReset">{{ Math.round(effectiveZoom * 100) }}%</span>
      <button class="btn" @click="zoomIn">＋</button>
      <button class="btn" @click="zoomFit">适应宽度</button>
      <button class="btn" @click="zoomReset">100%</button>
      <span class="hint">共 {{ store.pageCount }} 页 · 双击区块编辑 · 拖动可吸附对齐 · 方向键微调</span>
    </div>

    <div ref="viewportRef" class="viewport" @pointerdown.self="onBlankPointerDown">
      <div class="pages-column" :style="columnStyle">
        <div v-for="i in pages" :key="i" class="page-scaler" :style="scalerStyle(i)">
          <div
            class="resume-page"
            :data-index="i"
            :style="pageStyle"
            @dragover="onDragOver"
            @drop="onDrop"
            @pointerdown.self="onBlankPointerDown"
          >
            <BlockComponent
              v-for="block in blocksOnPage(i)"
              :key="block.id"
              :block="block"
              :page-offset="pageOffset(i)"
            />
          </div>
        </div>

        <!-- 对齐辅助线（拖拽时显示，跨页贯穿） -->
        <template v-if="!store.isExporting">
          <div
            v-for="(g, idx) in store.guides.v"
            :key="'v' + idx"
            class="guide guide-v"
            :style="{ left: g * effectiveZoom + 'px' }"
          ></div>
          <div
            v-for="(g, idx) in store.guides.h"
            :key="'h' + idx"
            class="guide guide-h"
            :style="{ top: guideTop(g) + 'px' }"
          ></div>
        </template>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.editor-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.zoom-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 16px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;

  .zoom-value {
    min-width: 48px;
    text-align: center;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }

  .hint {
    margin-left: auto;
    font-size: 12px;
    color: var(--text-dim);
  }
}

.viewport {
  flex: 1;
  overflow: auto;
  padding: 32px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.pages-column {
  position: relative;
  flex-shrink: 0;
}

.resume-page {
  position: relative;
  transform-origin: top left;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

.guide {
  position: absolute;
  background: #f5222d;
  pointer-events: none;
  z-index: 9998;
}

.guide-v {
  top: 0;
  bottom: 0;
  width: 1px;
}

.guide-h {
  left: 0;
  right: 0;
  height: 1px;
}
</style>
