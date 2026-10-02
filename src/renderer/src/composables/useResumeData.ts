import { watch } from 'vue'
import { useResumeStore } from '../stores/resumeStore'
import type { ResumeData } from '../types/resume'

/**
 * 简历数据管理：
 * - 草稿自动备份到文件系统（防抖 800ms），用户可通过文件管理器找到
 * - 启动时一次性恢复草稿（恢复后自动删除文件）
 * - 无草稿时以空简历启动
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
            const json = JSON.stringify(store.serialize())
            window.api?.saveDraft(json)
          } catch {
            /* 异常忽略 */
          }
        }, 800)
      },
      { deep: true }
    )
  }

  /** 启动时恢复上次编辑内容；没有则以空简历启动 */
  async function restoreOrInit(): Promise<void> {
    try {
      const saved = await window.api?.restoreDraft()
      if (saved) {
        store.loadData(JSON.parse(saved) as ResumeData)
        return
      }
    } catch {
      /* 草稿文件损坏则忽略 */
    }
    // 无草稿：空简历
    store.resetAll()
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

  async function openDraftFolder(): Promise<void> {
    await window.api?.openDraftFolder()
  }

  return { startAutoSave, restoreOrInit, saveToFile, loadFromFile, openDraftFolder }
}