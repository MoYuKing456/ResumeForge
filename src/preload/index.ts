import { contextBridge, ipcRenderer } from 'electron'

const api = {
  /** 保存图片（每页一个 dataURL），返回保存路径；用户取消返回 null */
  saveImage: (format: 'png' | 'jpeg', dataUrls: string[]): Promise<string | null> =>
    ipcRenderer.invoke('export:image', { format, dataUrls }),
  /** 保存 PDF，buffer 为 jsPDF 输出的 ArrayBuffer */
  savePdf: (buffer: ArrayBuffer): Promise<string | null> =>
    ipcRenderer.invoke('export:pdf', { buffer }),
  /** 保存简历 JSON */
  saveResume: (json: string): Promise<string | null> =>
    ipcRenderer.invoke('resume:save', { json }),
  /** 打开简历 JSON，返回文件内容 */
  loadResume: (): Promise<string | null> => ipcRenderer.invoke('resume:load')
}

export type RendererApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // 非隔离环境下直接挂载（类型声明见 index.d.ts）
  ;(window as unknown as { api: RendererApi }).api = api
}
