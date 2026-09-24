// 平台配置的唯一来源。小程序迁移时改这里（uni 侧读 manifest/配置），
// 组件与 stores 不允许直接读 import.meta.env。
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? ''

// 开发期 vite 已把 /api 代理到 http://localhost:3000，因此留空即可
export const IS_DEV: boolean = import.meta.env.DEV

// 实时通道基址（不含 token）。浏览器 WebSocket 不接受相对路径，必须拼出绝对地址；
// 开发期 vite 把 /ws 代理到后端（同一 origin），生产可用 VITE_WS_BASE_URL 覆盖。
function resolveWsBaseURL(): string {
  const configured: string | undefined = import.meta.env.VITE_WS_BASE_URL
  if (configured) return configured
  if (API_BASE_URL) return API_BASE_URL.replace(/^http/, 'ws')
  const protocol = globalThis.location?.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${globalThis.location?.host ?? 'localhost:5173'}`
}

export const WS_BASE_URL: string = resolveWsBaseURL()