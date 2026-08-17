# ResumeForge

一个基于 Electron + Vue 3 + TypeScript 的**可视化简历编辑器**。采用所见即所得的拖拽式区块编辑方式，无需编写任何代码即可快速制作、导出专业简历。

当前版本：**0.1.0**

---

## ✨ 功能特性

### 区块式编辑
- **8 种区块类型**：个人信息、个人简介、工作经历、教育背景、专业技能、项目经验、证书荣誉、自定义文本
- 点击左侧面板**添加**区块，或直接**拖拽**到画布任意位置
- 支持区块**拖动、缩放**（8 个方向手柄）、**复制、删除**
- **层级控制**：置顶 / 置底，自由叠加排列
- **对齐吸附**：拖拽时自动吸附到其他区块边缘，并显示对齐辅助线
- **方向键微调**：1px 精调位置，按住 `Shift` 加速 10 倍

### 样式与页面
- 属性面板可调整区块的**位置、尺寸、层级**以及**外观样式**（背景色、边框、圆角、内边距、字号、文字颜色、标题颜色、字体）
- **页面设置**：自定义页面背景色，A4 比例（794 × 1123）多页排版
- **自动分页**：内容超出当前页自动新增页面，收回内容自动减少页面
- **3 套预设模板**：经典蓝、简约灰、暖橙，一键套用

### 数据安全
- **自动保存**：编辑内容自动保存到本地（防抖 800ms），重启应用后自动恢复
- **JSON 文件互导**：通过系统文件对话框保存 / 打开简历数据（`.json`）
- **撤销 / 重做**：最多保留 50 步历史记录

### 导出与打印
- **PNG**：2x 高清位图，多页自动生成 `_p2`、`_p3` 后缀文件
- **JPEG**：体积更小，适合分享
- **PDF**：所有页合并为一个 A4 多页文档
- **打印**：调用系统打印对话框，以 100% 缩放逐页分页打印
- 导出内容与编辑画布**完全一致**（导出前自动清除选中态 / 编辑态 / 辅助线，像素级还原）

### 界面体验
- **亮色 / 暗色**主题一键切换
- **缩放控制**：放大、缩小、重置、适应窗口（0.4x – 2x）
- 顶部工具栏提供撤销、重做、打开、保存、导出等快捷操作

## ⌨️ 快捷键

| 快捷键 | 功能 |
| ------ | ---- |
| `Ctrl + Z` | 撤销 |
| `Ctrl + Y` / `Ctrl + Shift + Z` | 重做 |
| `Ctrl + S` | 保存到文件 |
| `Delete` / `Backspace` | 删除选中的区块 |
| `方向键` | 微调选中区块位置（`Shift` 加速 10 倍） |
| `Esc` | 退出编辑模式 / 取消选中 |

## 🛠️ 技术栈

| 层 | 技术 |
| -- | ---- |
| 桌面框架 | [Electron](https://www.electronjs.org/) + [electron-vite](https://electron-vite.org/) |
| 前端框架 | [Vue 3](https://vuejs.org/)（Composition API） |
| 状态管理 | [Pinia](https://pinia.vuejs.org/) |
| 语言 | TypeScript |
| 样式 | Sass（SCSS） |
| 导出渲染 | [html2canvas](https://html2canvas.hertzen.com/) + [jsPDF](https://github.com/parallax/jsPDF) |

## 📁 项目结构

```
ResumeForge/
├── build/                        # 打包资源（图标、mac 签名配置等）
├── resources/                    # 运行时资源
├── src/
│   ├── main/                     # Electron 主进程
│   │   ├── index.ts              # 窗口创建与应用生命周期
│   │   └── ipc/index.ts          # IPC 处理器（导出图片 / PDF / 保存 / 打开）
│   ├── preload/                  # 预加载脚本（contextBridge 暴露 window.api）
│   └── renderer/                 # 渲染进程（Vue 应用）
│       ├── src/
│       │   ├── App.vue           # 应用根组件（顶栏、布局）
│       │   ├── components/       # 界面组件
│       │   │   ├── BlockPalette.vue    # 区块面板 + 模板预设
│       │   │   ├── ResumeEditor.vue    # 编辑画布（多页、缩放、网格）
│       │   │   ├── BlockComponent.vue  # 单个区块（拖拽、缩放、编辑）
│       │   │   ├── PropertyPanel.vue   # 属性面板（样式 / 页面设置）
│       │   │   └── ExportPanel.vue     # 导出对话框
│       │   ├── composables/      # 组合式函数
│       │   │   ├── useResumeData.ts    # 自动保存 / JSON 互导
│       │   │   ├── useExport.ts        # 导出 PNG / JPEG / PDF / 打印
│       │   │   └── useDragDrop.ts      # 拖拽 / 缩放 / 对齐吸附
│       │   ├── stores/resumeStore.ts   # Pinia 状态（历史记录、区块、页面）
│       │   ├── types/resume.ts         # 类型定义
│       │   └── utils/blocks.ts         # 区块工厂与预设模板
├── electron-builder.yml          # 打包配置
├── electron.vite.config.ts       # electron-vite 配置
└── package.json
```

## 🚀 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) ≥ 18
- npm

### 安装依赖

```bash
$ npm install
```

### 开发模式（热更新）

```bash
$ npm run dev
```

### 类型检查与代码规范

```bash
$ npm run typecheck   # 主进程 + 渲染进程类型检查
$ npm run lint        # ESLint 检查
```

### 构建打包

```bash
# 仅构建（不打包安装程序）
$ npm run build

# Windows 安装包
$ npm run build:win

# macOS 安装包
$ npm run build:mac

# Linux 安装包
$ npm run build:linux
```

打包产物位于 `dist/` 目录，安装包命名格式：`resumeforge-<版本>-setup.exe`（Windows）。

## 💡 使用提示

- **自动恢复**：应用会记住上次编辑的内容，重新打开后直接继续编辑，无需手动保存
- **数据文件**：保存的 `.json` 文件包含全部区块与页面设置，可在多台设备间迁移，或通过「打开」随时恢复
- **导出前**：建议先通过「适应窗口」查看整体排版；导出为图片/PDF 时请耐心等待渲染完成
- **打印**：打印选项依赖系统打印服务，纸张建议选择 A4、边距设置为无，以获得最佳效果

## ✅ 推荐 IDE 配置

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

## 📄 License

MIT
