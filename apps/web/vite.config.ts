import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 共享包用源码直连（不启用 npm workspaces）：Vite 与 tsconfig.paths 指向同一份源码
const sharedSrc = resolve(import.meta.dirname, '../../packages/shared/src')

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@shared': sharedSrc,
    },
  },
  server: {
    port: 5173,
    // 开发期把 /api 透传到后端，前端 baseURL 保持为空字符串
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // 实时通道同源代理：浏览器 WebSocket 不能走相对路径，前端拼 ws://localhost:5173/ws
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
})