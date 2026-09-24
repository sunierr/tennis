import { PrismaClient } from '@prisma/client'
import { env } from '../env'

// PrismaClient 单例：tsx watch 热重载时不会重复创建连接池
export const prisma = new PrismaClient({
  datasourceUrl: env.DATABASE_URL,
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
})