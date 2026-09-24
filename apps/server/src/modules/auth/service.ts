import bcrypt from 'bcryptjs'
import { prisma } from '../../db/prisma'
import { conflict, unauthorized } from '../../lib/http-error'
import { signAuthToken } from '../../lib/jwt'
import { toCurrentUser } from '../../serializers/user'
import type { AuthResponse, LoginInput, RegisterInput } from '@shared/types/user'

const BCRYPT_ROUNDS = 10

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const existing = await prisma.user.findUnique({ where: { account: input.account }, select: { id: true } })
  if (existing) throw conflict('ACCOUNT_EXISTS', '该账号已被注册')

  const user = await prisma.user.create({
    data: {
      account: input.account,
      password: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
      nickname: input.nickname,
      levelTenths: input.levelTenths ?? null,
      city: input.city ?? null,
      district: input.district ?? null,
    },
  })

  // 并发注册时的重复账号由 @@unique(account) 兜底，P2002 统一在 errorHandler 映射
  return { token: signAuthToken(user.id), user: toCurrentUser(user) }
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({ where: { account: input.account } })
  // 账号不存在与密码错误返回同一句话，避免账号枚举
  if (!user) throw unauthorized('账号或密码不正确')

  const matched = await bcrypt.compare(input.password, user.password)
  if (!matched) throw unauthorized('账号或密码不正确')

  return { token: signAuthToken(user.id), user: toCurrentUser(user) }
}