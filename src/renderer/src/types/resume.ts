/** 简历区块类型 */
export type BlockType =
  | 'personal'
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'project'
  | 'certificate'
  | 'custom'

export interface BlockStyle {
  backgroundColor?: string
  borderColor?: string
  borderWidth?: number
  borderRadius?: number
  padding?: number
  fontSize?: number
  fontColor?: string
  fontFamily?: string
  titleColor?: string
}

/** 个人信息字段：姓名 / 职位为特殊展示样式，info 为普通联系信息行 */
export interface PersonalField {
  id: string
  kind: 'name' | 'title' | 'info'
  /** 字段标签，如「电话」「微信」「个人主页」 */
  label: string
  value: string
}

export interface PersonalContent {
  /** 自由增删的信息字段列表 */
  fields: PersonalField[]
}

export interface SummaryContent {
  text: string
}

export interface ExperienceItem {
  company: string
  role: string
  period: string
  description: string
}

export interface EducationItem {
  school: string
  major: string
  degree: string
  period: string
}

export interface ProjectItem {
  name: string
  role: string
  period: string
  description: string
}

export interface CertificateItem {
  name: string
  date: string
}

export interface SkillsContent {
  tags: string[]
}

export interface CustomContent {
  text: string
}

export interface ResumeBlock {
  id: string
  type: BlockType
  /** 区块标题，如「工作经历」 */
  title: string
  /** 左上角 x 坐标（页面坐标系，单位 px） */
  x: number
  /** 左上角 y 坐标 */
  y: number
  width: number
  height: number
  /** 具体内容，结构随 type 不同而不同 */
  content: any
  style: BlockStyle
  zIndex: number
}

export interface PageSettings {
  /** 默认 A4 比例 794 x 1123 */
  width: number
  height: number
  backgroundColor: string
}

export interface ResumeData {
  blocks: ResumeBlock[]
  pageSettings: PageSettings
}

export const BLOCK_TYPE_LABELS: Record<BlockType, string> = {
  personal: '个人信息',
  summary: '个人简介',
  experience: '工作经历',
  education: '教育背景',
  skills: '专业技能',
  project: '项目经验',
  certificate: '证书荣誉',
  custom: '自定义文本'
}
