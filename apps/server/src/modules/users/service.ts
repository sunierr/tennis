import { prisma } from '../../db/prisma'
import { unauthorized } from '../../lib/http-error'
import { toCurrentUser } from '../../serializers/user'
import type { MeResponse, UpdateProfileInput } from '@shared/types/user'

export async function getMe(userId: number): Promise<MeResponse> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  // token 有效但用户已被删除
  if (!user) throw unauthorized('登录状态已失效，请重新登录')

  return { user: toCurrentUser(user), needLevelSetup: user.levelTenths === null }
}

export async function updateMe(userId: number, input: UpdateProfileInput): Promise<MeResponse> {
  const user = await prisma.user.update({ where: { id: userId }, data: input })
  return { user: toCurrentUser(user), needLevelSetup: user.levelTenths === null }
}