<script setup lang="ts">
import { ref } from 'vue'
import { useExport } from '../composables/useExport'

const emit = defineEmits<{
  close: []
  done: [message: string]
}>()

const { exportImage, exportPdf, printResume } = useExport()

const busy = ref(false)
const status = ref('')

async function run(task: () => Promise<string | null>, successPrefix: string): Promise<void> {
  if (busy.value) return
  busy.value = true
  status.value = '正在渲染，请稍候…'
  try {
    const path = await task()
    if (path) {
      status.value = ''
      emit('done', `${successPrefix}：${path}`)
      emit('close')
    } else {
      status.value = '已取消'
    }
  } catch (err) {
    console.error(err)
    status.value = '导出失败，请查看控制台'
  } finally {
    busy.value = false
  }
}

async function onPrint(): Promise<void> {
  emit('close')
  await printResume()
}
</script>

<template>
  <div class="export-overlay" @click.self="emit('close')">
    <div class="export-dialog">
      <h3>导出简历</h3>
      <p class="desc">导出内容与编辑画布完全一致（2x 高清渲染）</p>

      <div class="export-options">
        <button class="export-btn" :disabled="busy" @click="run(() => exportImage('png'), 'PNG 已导出')">
          <span class="fmt">PNG</span>
          <span class="fmt-desc">透明支持 · 高清位图</span>
        </button>
        <button class="export-btn" :disabled="busy" @click="run(() => exportImage('jpeg'), 'JPEG 已导出')">
          <span class="fmt">JPEG</span>
          <span class="fmt-desc">体积更小 · 适合分享</span>
        </button>
        <button class="export-btn" :disabled="busy" @click="run(() => exportPdf(), 'PDF 已导出')">
          <span class="fmt">PDF</span>
          <span class="fmt-desc">A4 排版 · 投递首选</span>
        </button>
        <button class="export-btn" :disabled="busy" @click="onPrint">
          <span class="fmt">打印</span>
          <span class="fmt-desc">调用系统打印对话框</span>
        </button>
      </div>

      <p v-if="status" class="status">{{ status }}</p>

      <div class="dialog-actions">
        <button class="btn" :disabled="busy" @click="emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.export-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 900;
}

.export-dialog {
  width: 420px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);

  h3 {
    margin: 0 0 4px;
  }

  .desc {
    margin: 0 0 16px;
    font-size: 12px;
    color: var(--text-dim);
  }
}

.export-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.export-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
  transition: border-color 0.15s;

  &:hover:not(:disabled) {
    border-color: var(--accent);
  }
  &:disabled {
    opacity: 0.5;
    cursor: wait;
  }

  .fmt {
    font-size: 15px;
    font-weight: 700;
  }
  .fmt-desc {
    font-size: 11px;
    color: var(--text-dim);
  }
}

.status {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--accent);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
