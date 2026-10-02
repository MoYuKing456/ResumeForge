import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import { dirname, join } from 'path'

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

  /* ---------- 草稿备份（自动保存的未完成简历） ---------- */

  /** 获取草稿存储目录：开发环境为项目根目录/drafts，生产环境为 exe 同级/drafts */
  function getDraftDir(): string {
    let base: string
    if (app.isPackaged) {
      // 生产环境：exe 所在目录
      base = dirname(app.getPath('exe'))
    } else {
      // 开发环境：项目根目录
      base = app.getAppPath()
    }
    return join(base, 'drafts')
  }

  const DRAFT_FILE = 'draft.json'

  /** 保存草稿到文件系统（静默，不弹对话框） */
  ipcMain.handle('draft:save', async (_event, payload: { json: string }) => {
    try {
      const dir = getDraftDir()
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, DRAFT_FILE), payload.json, 'utf-8')
      return join(dir, DRAFT_FILE)
    } catch {
      return null
    }
  })

  /** 恢复草稿（读取并删除，实现"一次性"语义） */
  ipcMain.handle('draft:restore', async () => {
    try {
      const filePath = join(getDraftDir(), DRAFT_FILE)
      const json = await readFile(filePath, 'utf-8')
      await unlink(filePath)
      return json
    } catch {
      return null
    }
  })

  /** 打开草稿文件夹（资源管理器） */
  ipcMain.handle('draft:openFolder', async () => {
    const dir = getDraftDir()
    await mkdir(dir, { recursive: true })
    shell.openPath(dir)
    return dir
  })
}
