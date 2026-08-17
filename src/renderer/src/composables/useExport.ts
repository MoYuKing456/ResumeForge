import { nextTick } from 'vue'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { useResumeStore } from '../stores/resumeStore'

/**
 * 导出逻辑：
 * - 截图直接渲染编辑画布本身（每一页一个 .resume-page 元素），所见即所得
 * - 导出前清空选中态/编辑态/辅助线并隐藏网格线，保证像素级还原
 * - 图片：每页导出为一个文件（自动加 _p2、_p3 后缀）
 * - PDF：所有页合并为一个多页 A4 PDF
 */
export function useExport() {
  const store = useResumeStore()

  /** 逐页捕获画布为 Canvas（2x 高清） */
  async function capturePages(pixelRatio = 2): Promise<HTMLCanvasElement[]> {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.resume-page'))
    if (els.length === 0) throw new Error('未找到简历画布')

    store.selectedId = null
    store.editingId = null
    store.setGuides([], [])
    store.isExporting = true
    await nextTick()

    try {
      const bg = store.pageSettings.backgroundColor || '#ffffff'
      const canvases: HTMLCanvasElement[] = []
      for (const el of els) {
        canvases.push(
          await html2canvas(el, {
            scale: pixelRatio,
            useCORS: true,
            backgroundColor: bg,
            logging: false
          })
        )
      }
      return canvases
    } finally {
      store.isExporting = false
    }
  }

  /** 浏览器降级下载（无 Electron 环境时） */
  function downloadDataUrl(dataUrl: string, filename: string): void {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = filename
    a.click()
  }

  /** 导出 PNG / JPEG：每页一个文件，返回保存路径描述 */
  async function exportImage(format: 'png' | 'jpeg'): Promise<string | null> {
    const canvases = await capturePages()
    const mime = format === 'png' ? 'image/png' : 'image/jpeg'
    const dataUrls = canvases.map((c) => c.toDataURL(mime, 0.92))

    if (window.api?.saveImage) {
      return window.api.saveImage(format, dataUrls)
    }
    const ext = format === 'png' ? 'png' : 'jpg'
    dataUrls.forEach((url, i) => {
      downloadDataUrl(url, i === 0 ? `resume.${ext}` : `resume_p${i + 1}.${ext}`)
    })
    return dataUrls.length > 1 ? `${dataUrls.length} 个文件已下载` : `resume.${ext}`
  }

  /** 导出 PDF：所有页合并为一个 A4 多页文档 */
  async function exportPdf(): Promise<string | null> {
    const canvases = await capturePages()
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()

    canvases.forEach((canvas, index) => {
      if (index > 0) pdf.addPage('a4', 'portrait')
      const img = canvas.toDataURL('image/jpeg', 0.95)
      const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height)
      const w = canvas.width * ratio
      const h = canvas.height * ratio
      pdf.addImage(img, 'JPEG', (pageWidth - w) / 2, 0, w, h)
    })

    const buffer = pdf.output('arraybuffer')
    if (window.api?.savePdf) {
      return window.api.savePdf(buffer)
    }
    pdf.save('resume.pdf')
    return 'resume.pdf'
  }

  /** 系统打印：以 100% 缩放渲染全部页面，逐页分页 */
  async function printResume(): Promise<void> {
    store.selectedId = null
    store.editingId = null
    store.setGuides([], [])
    store.isExporting = true
    await nextTick()
    const restore = (): void => {
      store.isExporting = false
      window.removeEventListener('afterprint', restore)
    }
    window.addEventListener('afterprint', restore)
    window.print()
    // 部分环境 afterprint 不触发，保底恢复
    setTimeout(restore, 1000)
  }

  return { exportImage, exportPdf, printResume }
}
