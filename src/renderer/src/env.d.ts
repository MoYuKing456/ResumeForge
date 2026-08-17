/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// 注意：window.api 的全局类型声明在 src/preload/index.d.ts 中，
// tsconfig.web.json 已包含该文件，渲染进程代码可直接获得类型提示。
