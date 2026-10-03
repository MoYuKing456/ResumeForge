import type { PersonalField, ResumeBlock, ResumeData } from '../types/resume'

/**
 * 纯文本编排：
 * - 按「先上后下、先左后右」的阅读顺序排列区块，无视自由画布坐标
 * - 仅使用常见字符（【】、|、·）与缩进，避免 Markdown 语法，
 *   确保粘贴到聊天软件或普通文本编辑器后依然排版清晰、直观可读
 */

/** 转成去除首尾空白的字符串 */
function text(value: unknown): string {
  return value === undefined || value === null ? '' : String(value).trim()
}

/** 多行文本逐行缩进，保持层次（忽略空行） */
function indentLines(value: unknown, indent = '  '): string {
  return text(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `${indent}${line}`)
    .join('\n')
}

/** 用分隔符连接非空片段 */
function joinParts(parts: unknown[], sep = ' | '): string {
  return parts
    .map(text)
    .filter((p) => p.length > 0)
    .join(sep)
}

/** 区块标题：用【】包裹，纯文本下清晰可辨且不会被当作 Markdown 渲染 */
function sectionTitle(title: string): string {
  return title ? `【${title}】` : ''
}

/** 单个区块 → 纯文本段落（无内容时返回空串） */
function blockToPlainText(block: ResumeBlock): string {
  const content = block.content ?? {}
  const body: string[] = []

  switch (block.type) {
    case 'personal': {
      const fields = (Array.isArray(content.fields) ? content.fields : []) as PersonalField[]
      const name = fields.find((f) => f.kind === 'name')
      const jobTitle = fields.find((f) => f.kind === 'title')
      const infos = fields.filter((f) => f.kind === 'info')

      const nameValue = text(name?.value)
      const titleValue = text(jobTitle?.value)
      if (nameValue) body.push(nameValue)
      if (titleValue) body.push(titleValue)

      const infoLines = infos
        .map((f) => {
          const value = text(f.value)
          if (!value) return ''
          const label = text(f.label)
          return label ? `${label}：${value}` : value
        })
        .filter((line) => line.length > 0)

      if (infoLines.length > 0) {
        if (body.length > 0) body.push('')
        body.push(...infoLines)
      }
      // 个人信息无需再加「个人信息」标题，直接输出内容
      return body.join('\n')
    }

    case 'summary':
    case 'custom': {
      const value = text(content.text)
      if (value) body.push(value)
      break
    }

    case 'skills': {
      const tags = (Array.isArray(content.tags) ? content.tags : []).map(text).filter(Boolean)
      if (tags.length > 0) body.push(tags.join(' · '))
      break
    }

    case 'experience':
    case 'project': {
      const items = (Array.isArray(content.items) ? content.items : []) as any[]
      items.forEach((item, index) => {
        const head = joinParts(
          block.type === 'experience'
            ? [item.company, item.role, item.period]
            : [item.name, item.role, item.period]
        )
        const desc = indentLines(item.description)
        if (!head && !desc) return
        if (index > 0) body.push('')
        if (head) body.push(head)
        if (desc) body.push(desc)
      })
      break
    }

    case 'education': {
      const items = (Array.isArray(content.items) ? content.items : []) as any[]
      items.forEach((item) => {
        const line = joinParts([item.school, item.major, item.degree, item.period])
        if (line) body.push(line)
      })
      break
    }

    case 'certificate': {
      const items = (Array.isArray(content.items) ? content.items : []) as any[]
      items.forEach((item) => {
        const line = joinParts([item.name, item.date])
        if (line) body.push(line)
      })
      break
    }
  }

  if (body.every((line) => line.trim().length === 0)) return ''
  const title = sectionTitle(text(block.title))
  return title ? `${title}\n${body.join('\n')}` : body.join('\n')
}

/** 简历数据 → 纯文本全文（按阅读顺序） */
export function buildResumePlainText(data: ResumeData): string {
  const blocks = [...(data.blocks ?? [])].sort((a, b) => a.y - b.y || a.x - b.x)
  const sections = blocks.map(blockToPlainText).filter((section) => section.length > 0)
  return sections.join('\n\n')
}
