import { defineStore } from 'pinia'
import type { BlockType, PageSettings, ResumeBlock, ResumeData } from '../types/resume'
import { buildTemplate, createBlock, genId, type TemplateName } from '../utils/blocks'

const MAX_HISTORY = 50

interface Snapshot {
  blocks: ResumeBlock[]
  pageSettings: PageSettings
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

export const useResumeStore = defineStore('resume', {
  state: () => ({
    blocks: [] as ResumeBlock[],
    pageSettings: { width: 794, height: 1123, backgroundColor: '#ffffff' } as PageSettings,
    selectedId: null as string | null,
    /** 当前处于内容编辑模式的区块 id（导出前需清空） */
    editingId: null as string | null,
    /** 导出/打印期间置为 true，用于隐藏网格等辅助元素 */
    isExporting: false,
    theme: 'light' as 'light' | 'dark',
    zoom: 1,
    /** 拖拽时的对齐辅助线（画布坐标系，单位 px） */
    guides: { v: [] as number[], h: [] as number[] },
    past: [] as Snapshot[],
    future: [] as Snapshot[],
    /** 方向键微调节流时间戳 */
    lastNudgeAt: 0
  }),

  getters: {
    selectedBlock(state): ResumeBlock | null {
      return state.blocks.find((b) => b.id === state.selectedId) ?? null
    },
    sortedBlocks(state): ResumeBlock[] {
      return [...state.blocks].sort((a, b) => a.zIndex - b.zIndex)
    },
    /** 所有内容的最底部 y 坐标（连续坐标空间，贯穿多页） */
    contentBottom(state): number {
      return state.blocks.reduce((m, b) => Math.max(m, b.y + b.height), 0)
    },
    /** 页面数量：由内容自动派生，超出自动加页、收回自动减页 */
    pageCount(): number {
      const h = this.pageSettings.height
      const bottom = this.blocks.reduce((m, b) => Math.max(m, b.y + b.height), 0)
      return Math.max(1, Math.ceil(bottom / h))
    },
    canUndo: (state) => state.past.length > 0,
    canRedo: (state) => state.future.length > 0
  },

  actions: {
    /* ---------- 历史记录（撤销/重做） ---------- */

    /** 在执行一次可撤销的修改前调用 */
    snapshot(): void {
      this.past.push(clone({ blocks: this.blocks, pageSettings: this.pageSettings }))
      if (this.past.length > MAX_HISTORY) this.past.shift()
      this.future = []
    },

    /** 撤销上一次 snapshot（用于拖拽未产生位移时清理冗余记录） */
    discardSnapshot(): void {
      this.past.pop()
    },

    undo(): void {
      const prev = this.past.pop()
      if (!prev) return
      this.future.push(clone({ blocks: this.blocks, pageSettings: this.pageSettings }))
      this.blocks = prev.blocks
      this.pageSettings = prev.pageSettings
      if (this.selectedId && !this.blocks.some((b) => b.id === this.selectedId)) {
        this.selectedId = null
        this.editingId = null
      }
    },

    redo(): void {
      const next = this.future.pop()
      if (!next) return
      this.past.push(clone({ blocks: this.blocks, pageSettings: this.pageSettings }))
      this.blocks = next.blocks
      this.pageSettings = next.pageSettings
    },

    /* ---------- 区块操作 ---------- */

    nextZ(): number {
      return this.blocks.reduce((max, b) => Math.max(max, b.zIndex), 0) + 1
    },

    addBlock(type: BlockType, x?: number, y?: number): void {
      this.snapshot()
      // 未指定位置时无缝追加到内容最底部（可能自动落到新的一页）
      const defaultY = this.blocks.length > 0 ? this.contentBottom + 16 : 40
      const block = createBlock(type, x ?? 37, y ?? defaultY)
      block.zIndex = this.nextZ()
      this.blocks.push(block)
      this.selectedId = block.id
      this.editingId = null
    },

    /** 方向键微调选中区块（连续按键合并为一条历史记录） */
    nudgeSelected(dx: number, dy: number): void {
      const block = this.selectedBlock
      if (!block) return
      const now = Date.now()
      if (now - this.lastNudgeAt > 600) this.snapshot()
      this.lastNudgeAt = now
      block.x = Math.max(0, block.x + dx)
      block.y = Math.max(0, block.y + dy)
    },

    /** 更新拖拽对齐辅助线 */
    setGuides(v: number[], h: number[]): void {
      this.guides.v = v
      this.guides.h = h
    },

    removeBlock(id: string): void {
      const index = this.blocks.findIndex((b) => b.id === id)
      if (index === -1) return
      this.snapshot()
      this.blocks.splice(index, 1)
      if (this.selectedId === id) this.selectedId = null
      if (this.editingId === id) this.editingId = null
    },

    duplicateBlock(id: string): void {
      const source = this.blocks.find((b) => b.id === id)
      if (!source) return
      this.snapshot()
      const copy = clone(source)
      copy.id = genId()
      copy.x += 24
      copy.y += 24
      copy.zIndex = this.nextZ()
      this.blocks.push(copy)
      this.selectedId = copy.id
    },

    select(id: string | null): void {
      this.selectedId = id
      if (id === null) this.editingId = null
    },

    bringToFront(id: string): void {
      const block = this.blocks.find((b) => b.id === id)
      if (!block) return
      this.snapshot()
      block.zIndex = this.nextZ()
    },

    sendToBack(id: string): void {
      const block = this.blocks.find((b) => b.id === id)
      if (!block) return
      this.snapshot()
      const min = this.blocks.reduce((m, b) => Math.min(m, b.zIndex), Infinity)
      block.zIndex = (Number.isFinite(min) ? min : 1) - 1
    },

    /** 属性面板修改区块（带历史记录） */
    patchBlock(id: string, patch: Partial<ResumeBlock>): void {
      const block = this.blocks.find((b) => b.id === id)
      if (!block) return
      this.snapshot()
      Object.assign(block, patch)
    },

    patchBlockStyle(id: string, style: Partial<ResumeBlock['style']>): void {
      const block = this.blocks.find((b) => b.id === id)
      if (!block) return
      this.snapshot()
      Object.assign(block.style, style)
    },

    patchPageSettings(patch: Partial<PageSettings>): void {
      this.snapshot()
      Object.assign(this.pageSettings, patch)
    },

    /* ---------- 数据导入导出 ---------- */

    serialize(): ResumeData {
      return clone({ blocks: this.blocks, pageSettings: this.pageSettings })
    },

    loadData(data: ResumeData): void {
      if (!data || !Array.isArray(data.blocks) || !data.pageSettings) {
        throw new Error('无效的简历数据')
      }
      this.blocks = data.blocks
      this.pageSettings = data.pageSettings
      this.selectedId = null
      this.editingId = null
      this.past = []
      this.future = []
    },

    applyTemplate(name: TemplateName): void {
      this.snapshot()
      const data = buildTemplate(name)
      this.blocks = data.blocks
      this.pageSettings = data.pageSettings
      this.selectedId = null
      this.editingId = null
    },

    clearAll(): void {
      this.snapshot()
      this.blocks = []
      this.selectedId = null
      this.editingId = null
    }
  }
})
