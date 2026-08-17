import type { BlockType, ResumeBlock, ResumeData } from '../types/resume'
import { BLOCK_TYPE_LABELS } from '../types/resume'

let counter = 0

export function genId(): string {
  counter += 1
  return `b_${Date.now().toString(36)}_${counter}`
}

/** 各类型区块的默认尺寸与内容 */
const DEFAULTS: Record<BlockType, { width: number; height: number; content: () => any }> = {
  personal: {
    width: 720,
    height: 120,
    content: () => ({
      name: '张三',
      jobTitle: '前端工程师',
      phone: '138-0000-0000',
      email: 'zhangsan@example.com',
      address: '广东省深圳市'
    })
  },
  summary: {
    width: 720,
    height: 120,
    content: () => ({
      text: '5 年前端开发经验，熟悉 Vue / React 生态，关注性能优化与工程化，期望寻求高级前端工程师职位。'
    })
  },
  experience: {
    width: 720,
    height: 220,
    content: () => ({
      items: [
        {
          company: '某科技有限公司',
          role: '高级前端工程师',
          period: '2021.03 - 至今',
          description: '负责核心产品线前端架构设计与开发，主导微前端改造，页面加载性能提升 40%。'
        }
      ]
    })
  },
  education: {
    width: 720,
    height: 130,
    content: () => ({
      items: [
        {
          school: '某某大学',
          major: '计算机科学与技术',
          degree: '本科',
          period: '2015.09 - 2019.06'
        }
      ]
    })
  },
  skills: {
    width: 720,
    height: 110,
    content: () => ({
      tags: ['Vue 3', 'TypeScript', 'Electron', 'Node.js', 'Vite']
    })
  },
  project: {
    width: 720,
    height: 200,
    content: () => ({
      items: [
        {
          name: '企业级中后台系统',
          role: '前端负责人',
          period: '2022.01 - 2023.06',
          description: '从 0 到 1 搭建项目骨架，制定组件规范，封装 30+ 业务组件。'
        }
      ]
    })
  },
  certificate: {
    width: 720,
    height: 110,
    content: () => ({
      items: [{ name: '软件设计师（中级）', date: '2020.11' }]
    })
  },
  custom: {
    width: 360,
    height: 140,
    content: () => ({ text: '在这里输入自定义内容。' })
  }
}

/** 创建一个新区块 */
export function createBlock(type: BlockType, x = 37, y = 40): ResumeBlock {
  const d = DEFAULTS[type]
  return {
    id: genId(),
    type,
    title: BLOCK_TYPE_LABELS[type],
    x,
    y,
    width: d.width,
    height: d.height,
    content: d.content(),
    style: {
      backgroundColor: '#ffffff',
      borderColor: 'transparent',
      borderWidth: 0,
      borderRadius: 4,
      padding: 14,
      fontSize: 13,
      fontColor: '#374151',
      fontFamily: 'Microsoft YaHei',
      titleColor: '#1f2937'
    },
    zIndex: 1
  }
}

/* ------------------------------------------------------------------ */
/* 预设模板                                                             */
/* ------------------------------------------------------------------ */

export type TemplateName = 'classic' | 'minimal' | 'warm'

export const TEMPLATE_LABELS: Record<TemplateName, string> = {
  classic: '经典蓝',
  minimal: '简约灰',
  warm: '暖橙'
}

function basePage(backgroundColor: string): ResumeData['pageSettings'] {
  return { width: 794, height: 1123, backgroundColor }
}

export function buildTemplate(name: TemplateName): ResumeData {
  if (name === 'minimal') return minimalTemplate()
  if (name === 'warm') return warmTemplate()
  return classicTemplate()
}

function classicTemplate(): ResumeData {
  const personal = createBlock('personal', 37, 30)
  personal.style = { ...personal.style, backgroundColor: '#1e40af', fontColor: '#dbeafe', titleColor: '#ffffff', borderRadius: 0 }

  const summary = createBlock('summary', 37, 170)
  summary.style.titleColor = '#1e40af'

  const experience = createBlock('experience', 37, 310)
  experience.style.titleColor = '#1e40af'

  const education = createBlock('education', 37, 550)
  education.style.titleColor = '#1e40af'

  const skills = createBlock('skills', 37, 700)
  skills.style.titleColor = '#1e40af'

  const project = createBlock('project', 37, 830)
  project.style.titleColor = '#1e40af'

  return { blocks: [personal, summary, experience, education, skills, project], pageSettings: basePage('#ffffff') }
}

function minimalTemplate(): ResumeData {
  const personal = createBlock('personal', 40, 40)
  personal.style.backgroundColor = 'transparent'

  const summary = createBlock('summary', 40, 190)
  summary.style.backgroundColor = 'transparent'
  summary.style.titleColor = '#111827'

  const experience = createBlock('experience', 40, 330)
  experience.style.backgroundColor = 'transparent'
  experience.style.titleColor = '#111827'

  const skills = createBlock('skills', 40, 580)
  skills.style.backgroundColor = 'transparent'
  skills.style.titleColor = '#111827'

  const education = createBlock('education', 40, 720)
  education.style.backgroundColor = 'transparent'
  education.style.titleColor = '#111827'

  return { blocks: [personal, summary, experience, skills, education], pageSettings: basePage('#fafafa') }
}

function warmTemplate(): ResumeData {
  const personal = createBlock('personal', 37, 30)
  personal.style = { ...personal.style, backgroundColor: '#c2410c', fontColor: '#ffedd5', titleColor: '#ffffff', borderRadius: 8 }

  const summary = createBlock('summary', 37, 175)
  summary.style = { ...summary.style, backgroundColor: '#fff7ed', titleColor: '#c2410c', borderRadius: 8 }

  const skills = createBlock('skills', 37, 320)
  skills.style = { ...skills.style, backgroundColor: '#fff7ed', titleColor: '#c2410c', borderRadius: 8 }

  const experience = createBlock('experience', 37, 460)
  experience.style = { ...experience.style, backgroundColor: '#fff7ed', titleColor: '#c2410c', borderRadius: 8 }

  const project = createBlock('project', 37, 710)
  project.style = { ...project.style, backgroundColor: '#fff7ed', titleColor: '#c2410c', borderRadius: 8 }

  return { blocks: [personal, summary, skills, experience, project], pageSettings: basePage('#fffbeb') }
}
