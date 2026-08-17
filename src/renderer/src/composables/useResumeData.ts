import { watch } from 'vue'
import { useResumeStore } from '../stores/resumeStore'
import type { ResumeData } from '../types/resume'

const AUTOSAVE_KEY = 'resume-builder-autosave'

/**
 * 简历数据管理：
 * - 本地自动保存（localStorage，防抖 800ms）
 * - 通过 IPC 与文件系统互导 JSON
 */
export function useResumeData() {
  const store = useResumeStore()

  function startAutoSave(): void {
    let timer: ReturnType<typeof setTimeout> | undefined
    watch(
      () => [store.blocks, store.pageSettings],
      () => {
        clearTimeout(timer)
        timer = setTimeout(() => {
          try {
            localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(store.serialize()))
          } catch {
            /* 存储满等异常忽略 */
          }
        }, 800)
      },
      { deep: true }
    )
  }

  /** 启动时恢复上次编辑内容；没有则加载默认模板 */
  function restoreOrInit(): void {
    const saved = localStorage.getItem(AUTOSAVE_KEY)
    if (saved) {
      try {
        store.loadData(JSON.parse(saved) as ResumeData)
        return
      } catch {
        localStorage.removeItem(AUTOSAVE_KEY)
      }
    }
    store.applyTemplate('classic')
  }

  async function saveToFile(): Promise<string | null> {
    const json = JSON.stringify(store.serialize(), null, 2)
    if (window.api?.saveResume) return window.api.saveResume(json)
    // 浏览器降级：下载 JSON
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'resume.json'
    a.click()
    URL.revokeObjectURL(a.href)
    return 'resume.json'
  }

  async function loadFromFile(): Promise<boolean> {
    if (!window.api?.loadResume) return false
    const json = await window.api.loadResume()
    if (!json) return false
    store.loadData(JSON.parse(json) as ResumeData)
    return true
  }

  return { startAutoSave, restoreOrInit, saveToFile, loadFromFile }
}
