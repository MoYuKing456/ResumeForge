<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import type { PersonalField, ResumeBlock } from '../types/resume'
import { useResumeStore } from '../stores/resumeStore'
import { useDragDrop, type ResizeDir } from '../composables/useDragDrop'
import { genId } from '../utils/blocks'

const props = withDefaults(defineProps<{ block: ResumeBlock; pageOffset?: number }>(), {
  pageOffset: 0
})
const store = useResumeStore()
const { startDrag, startResize } = useDragDrop(() => store.zoom)

const HANDLES: ResizeDir[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

const isSelected = computed(() => store.selectedId === props.block.id)
const isEditing = computed(() => store.editingId === props.block.id)

const rootRef = ref<HTMLElement | null>(null)

/**
 * 编辑模式下的虚拟高度：仅参与渲染，绝不写入 block.height、
 * 不触发任何下推，因此编辑框不会与下方组件产生位置交互
 * （不挤压排版，退出编辑后也不留空洞）。
 */
const editHeight = ref<number | null>(null)

/** 个人信息中的头部字段（姓名 / 职位，按顺序展示） */
const headFields = computed<PersonalField[]>(() => {
  const fields = props.block.content?.fields
  if (!Array.isArray(fields)) return []
  return fields.filter((f: PersonalField) => f.kind !== 'info' && f.value)
})

/** 个人信息中的普通信息行（kind === 'info'） */
const infoFields = computed<PersonalField[]>(() => {
  const fields = props.block.content?.fields
  if (!Array.isArray(fields)) return []
  return fields.filter((f: PersonalField) => f.kind === 'info' && (f.value || f.label))
})

/* ---------- 编辑框虚拟高度 ---------- */

/** 测量编辑表单的自然高度，更新虚拟编辑高度（只增不减） */
async function updateEditHeight(): Promise<void> {
  await nextTick()
  const el = rootRef.value
  if (!el || !isEditing.value) return
  const prevHeight = el.style.height
  el.style.height = 'auto'
  const natural = el.scrollHeight
  el.style.height = prevHeight
  const fit = natural + 2
  if (editHeight.value === null || fit > editHeight.value) {
    editHeight.value = Math.max(props.block.height, fit)
  }
}

// 双击进入编辑：虚拟撑开以容纳完整表单；退出编辑：立即恢复原高度
watch(isEditing, (editing) => {
  if (editing) {
    updateEditHeight()
  } else {
    editHeight.value = null
  }
})

const blockStyle = computed(() => {
  const s = props.block.style
  const bw = s.borderWidth ?? 0
  return {
    left: props.block.x + 'px',
    // block.y 是贯穿多页的连续坐标，渲染时减去所在页的偏移
    top: props.block.y - props.pageOffset + 'px',
    width: props.block.width + 'px',
    // 编辑时使用虚拟高度（浮层效果），数据高度保持不变
    height: (isEditing.value && editHeight.value !== null ? editHeight.value : props.block.height) + 'px',
    zIndex: props.block.zIndex,
    background: s.backgroundColor,
    border: `${bw}px solid ${s.borderColor ?? 'transparent'}`,
    borderRadius: (s.borderRadius ?? 0) + 'px',
    padding: (s.padding ?? 12) + 'px',
    fontSize: (s.fontSize ?? 13) + 'px',
    color: s.fontColor,
    fontFamily: s.fontFamily
  }
})

const titleStyle = computed(() => ({
  color: props.block.style.titleColor || props.block.style.fontColor
}))

/* ---------- 拖拽 / 缩放（带对齐吸附） ---------- */

/** 收集吸附候选线：其他区块的边线/中线 + 页面垂直中线 */
function collectSnapTargets(): { v: number[]; h: number[] } {
  const v: number[] = [store.pageSettings.width / 2]
  const h: number[] = []
  for (const b of store.blocks) {
    if (b.id === props.block.id) continue
    v.push(b.x, b.x + b.width / 2, b.x + b.width)
    h.push(b.y, b.y + b.height / 2, b.y + b.height)
  }
  return { v, h }
}

function onGuides(v: number[], h: number[]): void {
  store.setGuides(v, h)
}

function onPointerDown(e: PointerEvent): void {
  if (isEditing.value) return
  const target = e.target as HTMLElement
  if (target.closest('.block-actions, .resize-handle')) return
  store.select(props.block.id)
  store.snapshot()
  startDrag(e, props.block, {
    getTargets: collectSnapTargets,
    onGuides,
    onEnd: (changed) => {
      if (!changed) {
        store.discardSnapshot()
      } else {
        // 拖拽落位后若与下方组件重合，自动下推
        store.pushDownOverlapped(props.block.id)
      }
    }
  })
}

function onResizeStart(e: PointerEvent, dir: ResizeDir): void {
  store.select(props.block.id)
  store.snapshot()
  startResize(e, props.block, dir, {
    getTargets: collectSnapTargets,
    onGuides,
    // 拉大边框的过程中实时下推重合的下方组件
    onChange: () => store.pushDownOverlapped(props.block.id),
    onEnd: (changed) => {
      if (!changed) store.discardSnapshot()
    }
  })
}

/* ---------- 编辑模式 ---------- */

function enterEdit(): void {
  if (isEditing.value) return
  store.snapshot()
  store.selectedId = props.block.id
  store.editingId = props.block.id
}

function exitEdit(): void {
  if (store.editingId === props.block.id) store.editingId = null
}

/* ---------- 列表型内容的增删 ---------- */

function addItem(): void {
  const c = props.block.content
  if (!Array.isArray(c.items)) return
  switch (props.block.type) {
    case 'experience':
      c.items.push({ company: '', role: '', period: '', description: '' })
      break
    case 'education':
      c.items.push({ school: '', major: '', degree: '', period: '' })
      break
    case 'project':
      c.items.push({ name: '', role: '', period: '', description: '' })
      break
    case 'certificate':
      c.items.push({ name: '', date: '' })
      break
  }
  updateEditHeight()
}

function removeItem(index: number): void {
  const c = props.block.content
  if (Array.isArray(c.items)) c.items.splice(index, 1)
  updateEditHeight()
}

const newTag = ref('')

function addTag(): void {
  const value = newTag.value.trim()
  if (!value) return
  if (!Array.isArray(props.block.content.tags)) props.block.content.tags = []
  props.block.content.tags.push(value)
  newTag.value = ''
  updateEditHeight()
}

function removeTag(index: number): void {
  props.block.content.tags.splice(index, 1)
  updateEditHeight()
}

/* ---------- 个人信息字段的增删 ---------- */

function addField(): void {
  const c = props.block.content
  if (!Array.isArray(c.fields)) c.fields = []
  c.fields.push({ id: genId(), kind: 'info', label: '', value: '' })
  updateEditHeight()
}

function removeField(index: number): void {
  const c = props.block.content
  if (Array.isArray(c.fields)) c.fields.splice(index, 1)
  updateEditHeight()
}
</script>

<template>
  <div
    ref="rootRef"
    class="block"
    :class="{ selected: isSelected && !store.isExporting, editing: isEditing }"
    :style="blockStyle"
    @pointerdown="onPointerDown"
    @click.stop
    @dblclick.stop="enterEdit"
  >
    <div class="block-title" :style="titleStyle">{{ block.title }}</div>

    <!-- ======== 展示模式 ======== -->
    <div v-if="!isEditing" class="block-body">
      <template v-if="block.type === 'personal'">
        <template v-for="f in headFields" :key="f.id">
          <div v-if="f.kind === 'name'" class="personal-name">{{ f.value }}</div>
          <div v-else class="personal-job">{{ f.value }}</div>
        </template>
        <div v-if="infoFields.length" class="personal-contact">
          <span v-for="f in infoFields" :key="f.id">
            <template v-if="f.label">{{ f.label }}：</template>{{ f.value }}
          </span>
        </div>
      </template>

      <template v-else-if="block.type === 'summary' || block.type === 'custom'">
        <p class="plain-text">{{ block.content.text }}</p>
      </template>

      <template v-else-if="block.type === 'experience'">
        <div v-for="(item, i) in (block.content.items as any[])" :key="i" class="entry">
          <div class="entry-head">
            <strong>{{ item.company }}</strong>
            <span class="entry-period">{{ item.period }}</span>
          </div>
          <div class="entry-sub">{{ item.role }}</div>
          <p class="plain-text">{{ item.description }}</p>
        </div>
      </template>

      <template v-else-if="block.type === 'education'">
        <div v-for="(item, i) in (block.content.items as any[])" :key="i" class="entry">
          <div class="entry-head">
            <strong>{{ item.school }}</strong>
            <span class="entry-period">{{ item.period }}</span>
          </div>
          <div class="entry-sub">{{ item.degree }} · {{ item.major }}</div>
        </div>
      </template>

      <template v-else-if="block.type === 'skills'">
        <div class="tag-list">
          <span v-for="(tag, i) in (block.content.tags as any[])" :key="i" class="tag">{{ tag }}</span>
        </div>
      </template>

      <template v-else-if="block.type === 'project'">
        <div v-for="(item, i) in (block.content.items as any[])" :key="i" class="entry">
          <div class="entry-head">
            <strong>{{ item.name }}</strong>
            <span class="entry-period">{{ item.period }}</span>
          </div>
          <div class="entry-sub">{{ item.role }}</div>
          <p class="plain-text">{{ item.description }}</p>
        </div>
      </template>

      <template v-else-if="block.type === 'certificate'">
        <div v-for="(item, i) in (block.content.items as any[])" :key="i" class="entry-head cert-row">
          <span>🏅 {{ item.name }}</span>
          <span class="entry-period">{{ item.date }}</span>
        </div>
      </template>
    </div>

    <!-- ======== 编辑模式 ======== -->
    <div v-else class="block-editor" @pointerdown.stop @dblclick.stop>
      <input v-model="block.title" class="edit-title" placeholder="区块标题" />

      <template v-if="block.type === 'personal'">
        <div v-for="(f, i) in (block.content.fields as PersonalField[])" :key="f.id" class="field-row">
          <select v-model="f.kind" class="field-kind" title="字段类型">
            <option value="name">姓名</option>
            <option value="title">职位</option>
            <option value="info">信息</option>
          </select>
          <input v-model="f.label" class="field-label" placeholder="标签，如 微信" />
          <input v-model="f.value" class="field-value" placeholder="内容" />
          <button class="mini danger field-remove" title="删除该信息" @click="removeField(i)">×</button>
        </div>
        <button class="mini" @click="addField">＋ 添加信息</button>
      </template>

      <template v-else-if="block.type === 'summary' || block.type === 'custom'">
        <textarea v-model="block.content.text" rows="4"></textarea>
      </template>

      <template v-else-if="block.type === 'experience'">
        <div v-for="(item, i) in (block.content.items as any[])" :key="i" class="item-form">
          <div class="item-form-head">
            <span>经历 {{ i + 1 }}</span>
            <button class="mini danger" @click="removeItem(i)">删除</button>
          </div>
          <input v-model="item.company" placeholder="公司" />
          <input v-model="item.role" placeholder="职位" />
          <input v-model="item.period" placeholder="时间段，如 2021.03 - 至今" />
          <textarea v-model="item.description" rows="2" placeholder="工作描述"></textarea>
        </div>
        <button class="mini" @click="addItem">＋ 添加经历</button>
      </template>

      <template v-else-if="block.type === 'education'">
        <div v-for="(item, i) in (block.content.items as any[])" :key="i" class="item-form">
          <div class="item-form-head">
            <span>教育 {{ i + 1 }}</span>
            <button class="mini danger" @click="removeItem(i)">删除</button>
          </div>
          <input v-model="item.school" placeholder="学校" />
          <input v-model="item.major" placeholder="专业" />
          <input v-model="item.degree" placeholder="学历" />
          <input v-model="item.period" placeholder="时间段" />
        </div>
        <button class="mini" @click="addItem">＋ 添加教育</button>
      </template>

      <template v-else-if="block.type === 'skills'">
        <div class="tag-edit-list">
          <span v-for="(tag, i) in (block.content.tags as any[])" :key="i" class="tag editable">
            {{ tag }}
            <button class="tag-remove" @click="removeTag(i)">×</button>
          </span>
        </div>
        <div class="tag-add">
          <input v-model="newTag" placeholder="输入技能后回车" @keydown.enter.prevent="addTag" />
          <button class="mini" @click="addTag">添加</button>
        </div>
      </template>

      <template v-else-if="block.type === 'project'">
        <div v-for="(item, i) in (block.content.items as any[])" :key="i" class="item-form">
          <div class="item-form-head">
            <span>项目 {{ i + 1 }}</span>
            <button class="mini danger" @click="removeItem(i)">删除</button>
          </div>
          <input v-model="item.name" placeholder="项目名称" />
          <input v-model="item.role" placeholder="担任角色" />
          <input v-model="item.period" placeholder="时间段" />
          <textarea v-model="item.description" rows="2" placeholder="项目描述"></textarea>
        </div>
        <button class="mini" @click="addItem">＋ 添加项目</button>
      </template>

      <template v-else-if="block.type === 'certificate'">
        <div v-for="(item, i) in (block.content.items as any[])" :key="i" class="item-form">
          <div class="item-form-head">
            <span>证书 {{ i + 1 }}</span>
            <button class="mini danger" @click="removeItem(i)">删除</button>
          </div>
          <input v-model="item.name" placeholder="证书/荣誉名称" />
          <input v-model="item.date" placeholder="获得时间" />
        </div>
        <button class="mini" @click="addItem">＋ 添加证书</button>
      </template>

      <button class="mini done" @click="exitEdit">✓ 完成编辑</button>
    </div>

    <!-- ======== 选中态工具 ======== -->
    <template v-if="isSelected && !isEditing && !store.isExporting">
      <div class="block-actions">
        <button title="置顶" @click.stop="store.bringToFront(block.id)">⇧</button>
        <button title="置底" @click.stop="store.sendToBack(block.id)">⇩</button>
        <button title="复制" @click.stop="store.duplicateBlock(block.id)">⧉</button>
        <button class="danger" title="删除" @click.stop="store.removeBlock(block.id)">🗑</button>
      </div>
      <div
        v-for="h in HANDLES"
        :key="h"
        class="resize-handle"
        :class="`handle-${h}`"
        @pointerdown="onResizeStart($event, h)"
      ></div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.block {
  position: absolute;
  box-sizing: border-box;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  display: flex;
  flex-direction: column;

  &.selected {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }

  &.editing {
    cursor: default;
    user-select: text;
    overflow: auto;
    z-index: 9999 !important;
    outline: 2px solid var(--accent);
    /* 编辑框是覆盖在下方组件之上的虚拟浮层，兜底不透明背景避免透出下层内容 */
    background: var(--panel) !important;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  }
}

.block-title {
  font-size: 1.15em;
  font-weight: 700;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 2px solid currentColor;
  flex-shrink: 0;
}

.block-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  line-height: 1.55;
}

.plain-text {
  margin: 4px 0 0;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 个人信息 */
.personal-name {
  font-size: 1.9em;
  font-weight: 700;
  line-height: 1.2;
}
.personal-job {
  font-size: 1.1em;
  opacity: 0.85;
  margin-top: 2px;
}
.personal-contact {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
  margin-top: 6px;
  font-size: 0.92em;
  opacity: 0.9;
}

/* 经历条目 */
.entry {
  margin-bottom: 10px;

  &:last-child {
    margin-bottom: 0;
  }
}
.entry-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}
.entry-period {
  font-size: 0.9em;
  opacity: 0.7;
  white-space: nowrap;
}
.entry-sub {
  font-size: 0.95em;
  opacity: 0.85;
}
.cert-row {
  padding: 2px 0;
}

/* 技能标签 */
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tag {
  padding: 3px 12px;
  border-radius: 999px;
  background: rgba(128, 128, 128, 0.15);
  border: 1px solid rgba(128, 128, 128, 0.3);
  font-size: 0.92em;
  white-space: nowrap;
}

/* 操作按钮 */
.block-actions {
  position: absolute;
  top: -32px;
  right: 0;
  display: flex;
  gap: 4px;
  z-index: 10;

  button {
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 6px;
    background: var(--accent);
    color: #fff;
    font-size: 13px;
    cursor: pointer;
    line-height: 1;

    &.danger {
      background: #ef4444;
    }
    &:hover {
      filter: brightness(1.15);
    }
  }
}

/* 缩放手柄 */
.resize-handle {
  position: absolute;
  width: 9px;
  height: 9px;
  background: var(--accent);
  border: 1px solid #fff;
  border-radius: 2px;
  z-index: 10;
}
.handle-nw { left: -5px; top: -5px; cursor: nwse-resize; }
.handle-n  { left: calc(50% - 4px); top: -5px; cursor: ns-resize; }
.handle-ne { right: -5px; top: -5px; cursor: nesw-resize; }
.handle-e  { right: -5px; top: calc(50% - 4px); cursor: ew-resize; }
.handle-se { right: -5px; bottom: -5px; cursor: nwse-resize; }
.handle-s  { left: calc(50% - 4px); bottom: -5px; cursor: ns-resize; }
.handle-sw { left: -5px; bottom: -5px; cursor: nesw-resize; }
.handle-w  { left: -5px; top: calc(50% - 4px); cursor: ew-resize; }

/* 编辑模式表单 */
.block-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: auto;
  font-size: 13px;

  label {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text);

    input {
      flex: 1;
    }
  }

  input,
  textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 4px 8px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--panel);
    color: var(--text);
    font-size: 12px;
    font-family: inherit;
  }

  .edit-title {
    font-weight: 700;
  }
}

.item-form {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px;
  border: 1px dashed var(--border);
  border-radius: 6px;
}

.item-form-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--text-dim);
}

.mini {
  padding: 3px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--panel);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;

  &.danger {
    color: #ef4444;
    border-color: #ef4444;
  }
  &.done {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
    align-self: flex-end;
    position: sticky;
    bottom: 0;
  }
}

.tag-edit-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.tag.editable {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(128, 128, 128, 0.15);
  border-radius: 999px;
  padding: 2px 6px 2px 10px;
}
.tag-remove {
  border: none;
  background: none;
  color: #ef4444;
  cursor: pointer;
  font-size: 13px;
  padding: 0 2px;
}
.tag-add {
  display: flex;
  gap: 6px;
}

/* 个人信息动态字段行 */
.field-row {
  display: flex;
  align-items: center;
  gap: 6px;

  .field-kind {
    width: 64px;
    flex-shrink: 0;
    padding: 4px 4px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: var(--panel);
    color: var(--text);
    font-size: 12px;
  }

  .field-label {
    width: 90px;
    flex-shrink: 0;
  }

  .field-value {
    flex: 1;
    min-width: 0;
  }

  .field-remove {
    flex-shrink: 0;
    padding: 3px 8px;
  }
}
</style>
