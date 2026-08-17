import { BrowserWindow, dialog, ipcMain } from 'electron'
import { readFile, writeFile } from 'fs/promises'

/**
 * 注册所有 IPC 处理器。
 * 渲染进程通过 preload 暴露的 window.api 调用。
 */
export function registerIpc(): void {
  // 导出图片（PNG / JPEG），渲染进程传入 html2canvas 生成的 dataURL 数组（每页一张）
  ipcMain.handle(
    'export:image',
    async (event, payload: { format: 'png' | 'jpeg'; dataUrls: string[] }) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return null
      const ext = payload.format === 'png' ? 'png' : 'jpg'
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        title: '导出简历图片',
        defaultPath: `resume.${ext}`,
        filters: [{ name: '图片文件', extensions: [ext] }]
      })
      if (canceled || !filePath) return null

      const extReg = new RegExp(`\\.${ext}$`, 'i')
      const saved: string[] = []
      for (let i = 0; i < payload.dataUrls.length; i++) {
        // 多页时第 2 页起自动加 _p2、_p3 后缀
        const target =
          i === 0
            ? filePath
            : extReg.test(filePath)
              ? filePath.replace(extReg, `_p${i + 1}.${ext}`)
              : `${filePath}_p${i + 1}.${ext}`
        const base64 = payload.dataUrls[i].replace(/^data:image\/\w+;base64,/, '')
        await writeFile(target, Buffer.from(base64, 'base64'))
        saved.push(target)
      }
      return saved.join('\n')
    }
  )

  // 导出 PDF，渲染进程传入 jsPDF 生成的 ArrayBuffer
  ipcMain.handle('export:pdf', async (event, payload: { buffer: ArrayBuffer }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: '导出简历 PDF',
      defaultPath: 'resume.pdf',
      filters: [{ name: 'PDF 文件', extensions: ['pdf'] }]
    })
    if (canceled || !filePath) return null
    await writeFile(filePath, Buffer.from(payload.buffer))
    return filePath
  })

  // 保存简历数据为 JSON
  ipcMain.handle('resume:save', async (event, payload: { json: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: '保存简历数据',
      defaultPath: 'resume.json',
      filters: [{ name: 'JSON 文件', extensions: ['json'] }]
    })
    if (canceled || !filePath) return null
    await writeFile(filePath, payload.json, 'utf-8')
    return filePath
  })

  // 从 JSON 文件加载简历数据
  ipcMain.handle('resume:load', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: '打开简历数据',
      properties: ['openFile'],
      filters: [{ name: 'JSON 文件', extensions: ['json'] }]
    })
    if (canceled || filePaths.length === 0) return null
    return await readFile(filePaths[0], 'utf-8')
  })
}
