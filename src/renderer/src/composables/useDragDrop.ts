import type { ResumeBlock } from '../types/resume'

export type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export interface DragHooks {
  onStart?: () => void
  /** 每次位移/尺寸变化后实时回调 */
  onChange?: () => void
  onEnd?: (changed: boolean, snappedBlockIds?: string[]) => void
  constrainDelta?: (dx: number, dy: number) => { dx: number; dy: number }
}

export interface SnapTarget {
  line: number
  blockIds: string[]
}

interface SnapTargets {
  v: SnapTarget[]
  h: SnapTarget[]
}

export interface SnapHooks {
  /** 返回吸附候选线及所属板块：v 为 x 轴线，h 为 y 轴线 */
  getTargets?: () => SnapTargets
  /** 拖拽过程中实时回调当前命中的辅助线 */
  onGuides?: (v: number[], h: number[]) => void
}

const MIN_WIDTH = 120
const MIN_HEIGHT = 60
/** 吸附阈值（画布坐标 px） */
const SNAP_THRESHOLD = 10

interface SnapCandidate {
  delta: number
  line: number
  blockIds: string[]
}

/** 在一组候选线中找离被拖拽边缘最近且在阈值内的吸附 */
function findSnap(edges: number[], targets: SnapTarget[]): SnapCandidate | null {
  let best: SnapCandidate | null = null
  for (const edge of edges) {
    for (const target of targets) {
      const delta = target.line - edge
      if (Math.abs(delta) <= SNAP_THRESHOLD && (!best || Math.abs(delta) < Math.abs(best.delta))) {
        best = { delta, line: target.line, blockIds: target.blockIds }
      }
    }
  }
  return best
}

/**
 * 基于 PointerEvent 的拖拽与缩放逻辑。
 * 所有计算都在画布（未缩放）坐标系中进行，getScale 用于把屏幕位移换算为画布位移。
 */
export function useDragDrop(getScale: () => number) {
  function startDrag(
    e: PointerEvent,
    block: ResumeBlock,
    hooks: DragHooks & SnapHooks = {},
    group: ResumeBlock[] = [block]
  ): void {
    e.preventDefault()
    e.stopPropagation()

    const scale = getScale()
    const startX = e.clientX
    const startY = e.clientY
    const originals = group.map((member) => ({ member, x: member.x, y: member.y }))
    const bounds = {
      left: Math.min(...group.map((member) => member.x)),
      top: Math.min(...group.map((member) => member.y)),
      right: Math.max(...group.map((member) => member.x + member.width)),
      bottom: Math.max(...group.map((member) => member.y + member.height))
    }
    let moved = false
    let snappedBlockIds: string[] = []

    hooks.onStart?.()

    const onMove = (ev: PointerEvent): void => {
      const dx = (ev.clientX - startX) / scale
      const dy = (ev.clientY - startY) / scale
      let nextX = bounds.left + dx
      let nextY = bounds.top + dy
      const guideV: number[] = []
      const guideH: number[] = []
      let snapX: SnapCandidate | null = null
      let snapY: SnapCandidate | null = null

      const targets = hooks.getTargets?.()
      if (targets) {
        // 垂直方向吸附：比较区块的左 / 中 / 右三条边
        snapX = findSnap(
          [nextX, (bounds.left + bounds.right) / 2 + dx, bounds.right + dx],
          targets.v
        )
        if (snapX) {
          nextX += snapX.delta
        }
        // 水平方向吸附：比较区块的上 / 中 / 下三条边
        snapY = findSnap(
          [nextY, (bounds.top + bounds.bottom) / 2 + dy, bounds.bottom + dy],
          targets.h
        )
        if (snapY) {
          nextY += snapY.delta
        }
      }

      // 约束吸附后的最终位移，避免吸附越过上方组件的底边。
      const constrained = hooks.constrainDelta?.(nextX - bounds.left, nextY - bounds.top)
      if (constrained) {
        nextX = bounds.left + constrained.dx
        nextY = bounds.top + constrained.dy
      }

      const appliedX = Math.max(0, Math.round(nextX)) - bounds.left
      const appliedY = Math.max(0, Math.round(nextY)) - bounds.top
      // 只显示最终仍然对齐的辅助线；边界约束取消吸附时不留下误导线。
      const snappedIds = new Set<string>()
      if (targets && snapX) {
        const edgesX = [
          bounds.left + appliedX,
          (bounds.left + bounds.right) / 2 + appliedX,
          bounds.right + appliedX
        ]
        for (const target of targets.v) {
          if (edgesX.some((edge) => Math.abs(edge - target.line) < 0.5)) {
            guideV.push(target.line)
            target.blockIds.forEach((id) => snappedIds.add(id))
          }
        }
      }
      if (targets && snapY) {
        const edgesY = [
          bounds.top + appliedY,
          (bounds.top + bounds.bottom) / 2 + appliedY,
          bounds.bottom + appliedY
        ]
        for (const target of targets.h) {
          if (edgesY.some((edge) => Math.abs(edge - target.line) < 0.5)) {
            guideH.push(target.line)
            target.blockIds.forEach((id) => snappedIds.add(id))
          }
        }
      }
      snappedBlockIds = [...snappedIds]
      if (Math.abs(appliedX) + Math.abs(appliedY) > 1) moved = true
      for (const original of originals) {
        original.member.x = original.x + appliedX
        original.member.y = original.y + appliedY
      }
      hooks.onGuides?.(guideV, guideH)
      hooks.onChange?.()
    }

    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      hooks.onGuides?.([], [])
      hooks.onEnd?.(moved, snappedBlockIds)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function startResize(
    e: PointerEvent,
    block: ResumeBlock,
    dir: ResizeDir,
    hooks: DragHooks & SnapHooks = {}
  ): void {
    e.preventDefault()
    e.stopPropagation()

    const scale = getScale()
    const startX = e.clientX
    const startY = e.clientY
    const orig = { x: block.x, y: block.y, w: block.width, h: block.height }
    let changed = false

    hooks.onStart?.()

    const onMove = (ev: PointerEvent): void => {
      const dx = (ev.clientX - startX) / scale
      const dy = (ev.clientY - startY) / scale
      if (Math.abs(dx) + Math.abs(dy) > 1) changed = true

      let { x, y, w, h } = orig

      if (dir.includes('e')) w = orig.w + dx
      if (dir.includes('s')) h = orig.h + dy
      if (dir.includes('w')) {
        w = orig.w - dx
        x = orig.x + dx
      }
      if (dir.includes('n')) {
        h = orig.h - dy
        y = orig.y + dy
      }

      const guideV: number[] = []
      const guideH: number[] = []

      // 缩放的移动边缘同样参与吸附（与其他组件的边线/中线对齐贴合）
      const targets = hooks.getTargets?.()
      if (targets) {
        if (dir.includes('e')) {
          const snap = findSnap([x + w], targets.v)
          if (snap) {
            w += snap.delta
            guideV.push(snap.line)
          }
        }
        if (dir.includes('w')) {
          const snap = findSnap([x], targets.v)
          if (snap) {
            x += snap.delta
            w -= snap.delta
            guideV.push(snap.line)
          }
        }
        if (dir.includes('s')) {
          const snap = findSnap([y + h], targets.h)
          if (snap) {
            h += snap.delta
            guideH.push(snap.line)
          }
        }
        if (dir.includes('n')) {
          const snap = findSnap([y], targets.h)
          if (snap) {
            y += snap.delta
            h -= snap.delta
            guideH.push(snap.line)
          }
        }
      }

      // 保证最小尺寸，且左上角不被最小尺寸约束"推走"
      if (w < MIN_WIDTH) {
        if (dir.includes('w')) x -= MIN_WIDTH - w
        w = MIN_WIDTH
      }
      if (h < MIN_HEIGHT) {
        if (dir.includes('n')) y -= MIN_HEIGHT - h
        h = MIN_HEIGHT
      }

      block.x = Math.max(0, Math.round(x))
      block.y = Math.max(0, Math.round(y))
      block.width = Math.round(w)
      block.height = Math.round(h)
      hooks.onGuides?.(guideV, guideH)
      hooks.onChange?.()
    }

    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      hooks.onGuides?.([], [])
      hooks.onEnd?.(changed)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return { startDrag, startResize }
}
