// 全站唯一的 localStorage 接触点（迁移小程序 → uni.getStorageSync）。
// 只存 token：用户信息以 GET /users/me 为唯一真相源，改昵称后不会出现「旧昵称残留」。

import type { PlatformStorage } from '@shared/http/types'

export const TOKEN_KEY = 'match_point_token'

export const storage: PlatformStorage = {
  get: (key) => localStorage.getItem(key),
  set: (key, value) => localStorage.setItem(key, value),
  remove: (key) => localStorage.removeItem(key),
}

export function readToken(): string | null {
  return storage.get(TOKEN_KEY)
}

export function writeToken(token: string): void {
  storage.set(TOKEN_KEY, token)
}

export function clearToken(): void {
  storage.remove(TOKEN_KEY)
}