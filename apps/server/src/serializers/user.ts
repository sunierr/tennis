// 用户序列化：白名单字段，**绝不含 account / password**。
import type { User } from '@prisma/client'
import type { CurrentUser, MatchCreator } from '@shared/types/user'

export function toCurrentUser(user: User): CurrentUser {
  return {
    id: user.id,
    nickname: user.nickname,
    levelTenths: user.levelTenths,
    city: user.city,
    district: user.district,
    bio: user.bio,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }
}

// 约球里的创建者只暴露这四项，堵住 `...match` 式的整表泄漏
export function toMatchCreator(user: User): MatchCreator {
  return {
    id: user.id,
    nickname: user.nickname,
    levelTenths: user.levelTenths,
    city: user.city,
  }
}