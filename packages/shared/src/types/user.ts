// 用户相关类型。
// 注意：任何对外响应都不得包含 account / password；约球里的创建者只暴露 MatchCreator 白名单。

export interface MatchCreator {
  id: number
  nickname: string
  levelTenths: number | null
  city: string | null
}

export interface CurrentUser {
  id: number
  nickname: string
  levelTenths: number | null
  city: string | null
  district: string | null
  bio: string | null
  createdAt: string
  updatedAt: string
}

export interface AuthResponse {
  token: string
  user: CurrentUser
}

export interface MeResponse {
  user: CurrentUser
  // 未填写自评水平时为 true，前端置顶「补全水平」引导
  needLevelSetup: boolean
}

export interface RegisterInput {
  account: string
  password: string
  nickname: string
  levelTenths?: number
  city?: string
  district?: string
}

export interface LoginInput {
  account: string
  password: string
}

export interface UpdateProfileInput {
  nickname?: string
  levelTenths?: number
  city?: string
  district?: string
  bio?: string
}