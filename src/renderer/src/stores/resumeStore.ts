import { defineStore } from 'pinia'
import type { BlockType, PageSettings, ResumeBlock, ResumeData } from '../types/resume'
import { buildTemplate, createBlock, genId, migrateBlock, type TemplateName } from '../utils/blocks'

/** 区块之间的默认垂直间距 */
const BLOCK_GAP = 0

const MAX_HISTORY = 50

interface Snapshot {
  blocks: ResumeBlock[]
  pageSettings: PageSettings
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

/** 两个矩形只有接触或重叠时才属于同一个可拖动组合。 */
function blocksAreConnected(a: ResumeBlock, b: ResumeBlock): boolean {
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  if (overlapX > 0 && overlapY > 0) return true

  const touches = (edgeA: number, edgeB: number): boolean => Math.abs(edgeA - edgeB) <= 0.5
  const touchesVertically =
    overlapX > 0 &&
    (touches(a.y + a.height, b.y) || touches(b.y + b.height, a.y))
  const touchesHorizontally =
    overlapY > 0 &&
    (touches(a.x + a.width, b.x) || touches(b.x + b.width, a.x))
  return touchesVertically || touchesHorizontally
}

export const useResumeStore = defineStore('resume', {
  state: () => ({
    blocks: [] as ResumeBlock[],
    pageSettings: { width: 794, height: 1123, backgroundColor: '#ffffff', contentPageGap: 32 } as PageSettings,
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
      const gap = Math.min(this.pageSettings.contentPageGap ?? 32, Math.floor((h - 1) / 2))
      let count = 1
      for (const block of this.blocks) {
        const startPage = Math.floor(block.y / h)
        let lastPage = startPage
        while (lastPage < startPage + 1000) {
          const continuedPages = lastPage - startPage
          const contentEnd = (lastPage + 1) * h - 2 * continuedPages * gap - gap
          if (block.y + block.height <= contentEnd) break
          lastPage++
        }
        count = Math.max(count, lastPage + 1)
      }
      return count
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
      this.reconcileBlockGroups()
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
      this.reconcileBlockGroups()
    },

    /* ---------- 区块操作 ---------- */

    nextZ(): number {
      return this.blocks.reduce((max, b) => Math.max(max, b.zIndex), 0) + 1
    },

    /** 清除已经有间隔的旧组合，并保留仍然接触的连通段。 */
    reconcileBlockGroups(): void {
      const groups = new Map<string, ResumeBlock[]>()
      for (const block of this.blocks) {
        if (!block.groupId) continue
        const members = groups.get(block.groupId) ?? []
        members.push(block)
        groups.set(block.groupId, members)
      }

      for (const [groupId, members] of groups) {
        if (members.length < 2) {
          for (const member of members) delete member.groupId
          continue
        }

        const remaining = new Set(members)
        const components: ResumeBlock[][] = []
        while (remaining.size > 0) {
          const first = remaining.values().next().value as ResumeBlock
          remaining.delete(first)
          const component = [first]
          const queue = [first]
          while (queue.length > 0) {
            const current = queue.pop()!
            for (const candidate of [...remaining]) {
              if (!blocksAreConnected(current, candidate)) continue
              remaining.delete(candidate)
              component.push(candidate)
              queue.push(candidate)
            }
          }
          components.push(component)
        }

        const largestGroup = components
          .filter((component) => component.length >= 2)
          .sort((a, b) => b.length - a.length)[0]
        for (const component of components) {
          if (component.length < 2) {
            for (const member of component) delete member.groupId
            continue
          }
          const nextGroupId = component === largestGroup ? groupId : genId()
          for (const member of component) member.groupId = nextGroupId
        }
      }
    },

    addBlock(type: BlockType, x?: number, y?: number): void {
      this.reconcileBlockGroups()
      this.snapshot()
      const block = createBlock(type, x ?? 37, y ?? 40)
      if (x === undefined && y === undefined) {
        // 未指定位置时：与最底部的上方组件保持同宽、左对齐，并紧贴其下方
        const above = [...this.blocks].sort(
          (a, b) => b.y + b.height - (a.y + a.height)
        )[0]
        if (above) {
          block.x = above.x
          block.width = above.width
          block.y = above.y + above.height + BLOCK_GAP
          const groupId = above.groupId ?? genId()
          above.groupId = groupId
          block.groupId = groupId
        } else {
          block.x = 37
          block.y = 40
        }
      }
      block.zIndex = this.nextZ()
      this.blocks.push(block)
      this.selectedId = block.id
      this.editingId = null
      // 拖拽落点与现有组件重合时，自动下推被压住的组件
      this.pushDownOverlapped(block.id)
    },

    /**
     * 防重合：只把与上方组件真正发生垂直重叠（且水平重叠）的下方组件往下推。
     * 采用位移传播：被撞组件的下移量会传递给更下方的组件，
     * 因此原本排好（贴合或自定义间距）的组件间距保持不变，
     * 绝不会把没有重合的组件撑出空隙。
     * anchorId 为刚被改动的组件，它本身不会被推动。
     */
    pushDownOverlapped(anchorId?: string | string[]): void {
      const anchors = new Set(Array.isArray(anchorId) ? anchorId : anchorId ? [anchorId] : [])
      const dy = new Map<string, number>()
      for (const b of this.blocks) dy.set(b.id, 0)

      let changed = true
      let guard = 0
      while (changed && guard++ < 30) {
        changed = false
        const posY = (b: ResumeBlock): number => b.y + (dy.get(b.id) ?? 0)
        const sorted = [...this.blocks].sort((a, b) => posY(a) - posY(b) || a.x - b.x)
        for (let i = 0; i < sorted.length; i++) {
          for (let j = i + 1; j < sorted.length; j++) {
            const a = sorted[i]
            const b = sorted[j]
            if (anchors.has(b.id)) continue
            const hOverlap =
              Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
            if (hOverlap <= 0) continue
            // 真正重叠的量（基于 a 下移后的底边）
            const overlap = posY(a) + a.height - posY(b)
            if (overlap > 0) {
              // 取"消除重叠所需位移"与"上方组件已发生的位移"的较大者：
              // 前者保证不重合，后者把位移传播下去以保持原始间距
              const push = Math.max(overlap, dy.get(a.id) ?? 0)
              if (push > (dy.get(b.id) ?? 0)) {
                dy.set(b.id, push)
                changed = true
              }
            }
          }
        }
      }

      for (const b of this.blocks) {
        const d = dy.get(b.id) ?? 0
        if (d > 0) b.y += d
      }
      this.reconcileBlockGroups()
    },

    /** 拖拽吸附后合并来源组与目标组；拖拽开始时已创建历史快照。 */
    mergeBlockGroups(ids: string[]): void {
      const idSet = new Set(ids)
      const members = this.blocks.filter((b) => idSet.has(b.id))
      if (members.length < 2) return

      const groupId = members.find((b) => b.groupId)?.groupId ?? genId()
      for (const member of members) member.groupId = groupId
      this.reconcileBlockGroups()
    },

    /** 将组合按当前区块拆成前段、单体、后段；多区块段各自保留为组合。 */
    detachBlockGroup(id: string): void {
      const block = this.blocks.find((b) => b.id === id)
      if (!block?.groupId) return

      const originalGroupId = block.groupId
      const group = this.blocks
        .filter((b) => b.groupId === originalGroupId)
        .sort((a, b) => a.y - b.y || a.x - b.x)
      const splitIndex = group.findIndex((b) => b.id === id)
      if (splitIndex < 0) return

      const before = group.slice(0, splitIndex)
      const after = group.slice(splitIndex + 1)
      this.snapshot()
      for (const member of group) delete member.groupId

      if (before.length >= 2) {
        const beforeGroupId = after.length >= 2 ? genId() : originalGroupId
        for (const member of before) member.groupId = beforeGroupId
      }
      if (after.length >= 2) {
        for (const member of after) member.groupId = originalGroupId
      }
      this.reconcileBlockGroups()
    },

    /** 调整工作/项目经历条目的显示顺序。 */
    moveItem(id: string, index: number, offset: -1 | 1): void {
      const block = this.blocks.find((b) => b.id === id)
      const items = block?.content?.items
      if (!block || !Array.isArray(items)) return
      const target = index + offset
      if (target < 0 || target >= items.length) return
      this.snapshot()
      ;[items[index], items[target]] = [items[target], items[index]]
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
      this.reconcileBlockGroups()
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
      this.reconcileBlockGroups()
    },

    duplicateBlock(id: string): void {
      const source = this.blocks.find((b) => b.id === id)
      if (!source) return
      this.snapshot()
      const copy = clone(source)
      copy.id = genId()
      delete copy.groupId
      copy.x += 24
      copy.y += 24
      copy.zIndex = this.nextZ()
      this.blocks.push(copy)
      this.selectedId = copy.id
      this.pushDownOverlapped(copy.id)
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
      // 几何属性变化后，自动下推发生重合的下方组件
      if ('x' in patch || 'y' in patch || 'width' in patch || 'height' in patch) {
        this.pushDownOverlapped(id)
      }
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
      this.blocks = data.blocks.map((b) => migrateBlock(b))
      const legacyPageSettings = data.pageSettings as PageSettings & { pageGap?: number }
      this.pageSettings = {
        ...data.pageSettings,
        contentPageGap:
          data.pageSettings.contentPageGap ?? legacyPageSettings.pageGap ?? 32
      }
      delete (this.pageSettings as PageSettings & { pageGap?: number }).pageGap
      this.reconcileBlockGroups()
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
      this.reconcileBlockGroups()
      this.selectedId = null
      this.editingId = null
    },

    clearAll(): void {
      this.snapshot()
      this.blocks = []
      this.selectedId = null
      this.editingId = null
      this.guides = { v: [], h: [] }
    },

    /** 清空所有内容（不记录历史，用于初始化） */
    resetAll(): void {
      this.blocks = []
      this.pageSettings = { width: 794, height: 1123, backgroundColor: '#ffffff', contentPageGap: 32 }
      this.selectedId = null
      this.editingId = null
      this.past = []
      this.future = []
    }
  }
})
