import type { ResumeBlock } from '../types/resume'

export type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export interface DragHooks {
  onStart?: () => void
  onEnd?: (changed: boolean) => void
}

export interface SnapHooks {
  /** 返回吸附候选线：v 为垂直线（x 值），h 为水平线（y 值），画布坐标系 */
  getTargets?: () => { v: number[]; h: number[] }
  /** 拖拽过程中实时回调当前命中的辅助线 */
  onGuides?: (v: number[], h: number[]) => void
}

const MIN_WIDTH = 120
const MIN_HEIGHT = 60
/** 吸附阈值（画布坐标 px） */
const SNAP_THRESHOLD = 6

interface SnapCandidate {
  delta: number
  line: number
}

/** 在一组候选线中找离被拖拽边缘最近且在阈值内的吸附 */
function findSnap(edges: number[], targets: number[]): SnapCandidate | null {
  let best: SnapCandidate | null = null
  for (const edge of edges) {
    for (const target of targets) {
      const delta = target - edge
      if (Math.abs(delta) <= SNAP_THRESHOLD && (!best || Math.abs(delta) < Math.abs(best.delta))) {
        best = { delta, line: target }
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
  function startDrag(e: PointerEvent, block: ResumeBlock, hooks: DragHooks & SnapHooks = {}): void {
    e.preventDefault()
    e.stopPropagation()

    const scale = getScale()
    const startX = e.clientX
    const startY = e.clientY
    const origX = block.x
    const origY = block.y
    let moved = false

    hooks.onStart?.()

    const onMove = (ev: PointerEvent): void => {
      const dx = (ev.clientX - startX) / scale
      const dy = (ev.clientY - startY) / scale
      if (Math.abs(dx) + Math.abs(dy) > 1) moved = true

      let nextX = origX + dx
      let nextY = origY + dy
      const guideV: number[] = []
      const guideH: number[] = []

      const targets = hooks.getTargets?.()
      if (targets) {
        // 垂直方向吸附：比较区块的左 / 中 / 右三条边
        const snapX = findSnap(
          [nextX, nextX + block.width / 2, nextX + block.width],
          targets.v
        )
        if (snapX) {
          nextX += snapX.delta
          guideV.push(snapX.line)
        }
        // 水平方向吸附：比较区块的上 / 中 / 下三条边
        const snapY = findSnap(
          [nextY, nextY + block.height / 2, nextY + block.height],
          targets.h
        )
        if (snapY) {
          nextY += snapY.delta
          guideH.push(snapY.line)
        }
      }

      block.x = Math.max(0, Math.round(nextX))
      block.y = Math.max(0, Math.round(nextY))
      hooks.onGuides?.(guideV, guideH)
    }

    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      hooks.onGuides?.([], [])
      hooks.onEnd?.(moved)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function startResize(
    e: PointerEvent,
    block: ResumeBlock,
    dir: ResizeDir,
    hooks: DragHooks = {}
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
    }

    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      hooks.onEnd?.(changed)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return { startDrag, startResize }
}
