<script setup lang="ts">
import { computed } from 'vue'
import { useResumeStore } from '../stores/resumeStore'

const store = useResumeStore()
const block = computed(() => store.selectedBlock)

const FONT_FAMILIES = [
  'Microsoft YaHei',
  'PingFang SC',
  'SimSun',
  'SimHei',
  'KaiTi',
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Courier New'
]

/** 数值/文本类修改：change 时先记录快照再写入 */
function patchNumber(field: 'x' | 'y' | 'width' | 'height' | 'zIndex', value: number): void {
  if (!block.value || Number.isNaN(value)) return
  store.patchBlock(block.value.id, { [field]: Math.round(value) })
}

function patchStyleNumber(
  field: 'borderWidth' | 'borderRadius' | 'padding' | 'fontSize',
  value: number
): void {
  if (!block.value || Number.isNaN(value)) return
  store.patchBlockStyle(block.value.id, { [field]: value })
}

function patchStyleColor(
  field: 'backgroundColor' | 'borderColor' | 'fontColor' | 'titleColor',
  value: string
): void {
  if (!block.value) return
  store.patchBlockStyle(block.value.id, { [field]: value })
}

function patchFontFamily(value: string): void {
  if (!block.value) return
  store.patchBlockStyle(block.value.id, { fontFamily: value })
}

function patchPageColor(value: string): void {
  store.patchPageSettings({ backgroundColor: value })
}

function setPageSize(width: number, height: number): void {
  store.patchPageSettings({ width, height })
}
</script>

<template>
  <aside class="property-panel">
    <!-- 选中区块时 -->
    <template v-if="block">
      <h3>区块属性</h3>
      <div class="block-type">{{ block.title }} · {{ block.type }}</div>

      <div class="group">
        <h4>位置与尺寸</h4>
        <div class="row">
          <label>X <input type="number" :value="block.x" @change="patchNumber('x', +($event.target as HTMLInputElement).value)" /></label>
          <label>Y <input type="number" :value="block.y" @change="patchNumber('y', +($event.target as HTMLInputElement).value)" /></label>
        </div>
        <div class="row">
          <label>宽 <input type="number" :value="block.width" @change="patchNumber('width', +($event.target as HTMLInputElement).value)" /></label>
          <label>高 <input type="number" :value="block.height" @change="patchNumber('height', +($event.target as HTMLInputElement).value)" /></label>
        </div>
        <div class="row">
          <label>层级 <input type="number" :value="block.zIndex" @change="patchNumber('zIndex', +($event.target as HTMLInputElement).value)" /></label>
        </div>
      </div>

      <div class="group">
        <h4>外观样式</h4>
        <div class="row color-row">
          <label>背景 <input type="color" :value="block.style.backgroundColor === 'transparent' ? '#ffffff' : block.style.backgroundColor" @change="patchStyleColor('backgroundColor', ($event.target as HTMLInputElement).value)" /></label>
          <label>边框 <input type="color" :value="block.style.borderColor === 'transparent' ? '#000000' : block.style.borderColor" @change="patchStyleColor('borderColor', ($event.target as HTMLInputElement).value)" /></label>
        </div>
        <div class="row color-row">
          <label>文字 <input type="color" :value="block.style.fontColor" @change="patchStyleColor('fontColor', ($event.target as HTMLInputElement).value)" /></label>
          <label>标题 <input type="color" :value="block.style.titleColor" @change="patchStyleColor('titleColor', ($event.target as HTMLInputElement).value)" /></label>
        </div>
        <div class="row">
          <label>边框宽 <input type="number" min="0" :value="block.style.borderWidth" @change="patchStyleNumber('borderWidth', +($event.target as HTMLInputElement).value)" /></label>
          <label>圆角 <input type="number" min="0" :value="block.style.borderRadius" @change="patchStyleNumber('borderRadius', +($event.target as HTMLInputElement).value)" /></label>
        </div>
        <div class="row">
          <label>内边距 <input type="number" min="0" :value="block.style.padding" @change="patchStyleNumber('padding', +($event.target as HTMLInputElement).value)" /></label>
          <label>字号 <input type="number" min="8" :value="block.style.fontSize" @change="patchStyleNumber('fontSize', +($event.target as HTMLInputElement).value)" /></label>
        </div>
        <div class="row">
          <label class="full">
            字体
            <select :value="block.style.fontFamily" @change="patchFontFamily(($event.target as HTMLSelectElement).value)">
              <option v-for="f in FONT_FAMILIES" :key="f" :value="f">{{ f }}</option>
            </select>
          </label>
        </div>
      </div>
    </template>

    <!-- 未选中时显示页面设置 -->
    <template v-else>
      <h3>页面设置</h3>
      <div class="group">
        <h4>页面尺寸</h4>
        <div class="size-presets">
          <button class="preset" @click="setPageSize(794, 1123)">A4 竖版</button>
          <button class="preset" @click="setPageSize(1123, 794)">A4 横版</button>
        </div>
        <div class="row">
          <label>宽 <input type="number" :value="store.pageSettings.width" @change="setPageSize(+($event.target as HTMLInputElement).value, store.pageSettings.height)" /></label>
          <label>高 <input type="number" :value="store.pageSettings.height" @change="setPageSize(store.pageSettings.width, +($event.target as HTMLInputElement).value)" /></label>
        </div>
      </div>
      <div class="group">
        <h4>页面背景</h4>
        <div class="row color-row">
          <label>颜色 <input type="color" :value="store.pageSettings.backgroundColor" @change="patchPageColor(($event.target as HTMLInputElement).value)" /></label>
        </div>
      </div>
      <p class="empty-hint">点击画布中的区块可编辑其属性</p>
    </template>
  </aside>
</template>

<style lang="scss" scoped>
.property-panel {
  height: 100%;
  overflow-y: auto;
  background: var(--panel);
  border-left: 1px solid var(--border);
  padding: 12px;
  box-sizing: border-box;

  h3 {
    margin: 0 0 4px;
    font-size: 14px;
  }

  .block-type {
    font-size: 12px;
    color: var(--text-dim);
    margin-bottom: 12px;
  }
}

.group {
  margin-bottom: 16px;

  h4 {
    margin: 0 0 8px;
    font-size: 12px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
}

.row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;

  label {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--text-dim);

    input,
    select {
      width: 100%;
      box-sizing: border-box;
      padding: 5px 8px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg);
      color: var(--text);
      font-size: 12px;
    }
  }

  &.color-row label {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;

    input[type='color'] {
      width: 44px;
      height: 26px;
      padding: 2px;
      cursor: pointer;
    }
  }
}

.size-presets {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.preset {
  flex: 1;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
}

.empty-hint {
  font-size: 12px;
  color: var(--text-dim);
  text-align: center;
  margin-top: 24px;
}
</style>
