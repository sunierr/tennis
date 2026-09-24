// 平台适配契约：shared 层不碰任何平台 API，只依赖这两个接口。
// Web 注入 axios + localStorage，小程序注入 uni.request + uni.getStorageSync。

export interface PlatformStorage {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export interface HttpRequest {
  method: HttpMethod
  path: string
  // 用 object 而非 Record<string, unknown>，这样具名 query 接口（如 MatchListQuery）可直接传入
  query?: object
  body?: unknown
  headers?: Record<string, string>
}

export interface HttpResponse<T> {
  status: number
  data: T
}

export interface HttpAdapter {
  request<T>(req: HttpRequest): Promise<HttpResponse<T>>
}