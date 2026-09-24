import cors from 'cors'
import express from 'express'
import { prisma } from './db/prisma'
import { env } from './env'
import { errorHandler, notFoundHandler } from './middleware/error'
import authRouter from './modules/auth/route'
import conversationsRouter from './modules/conversations/route'
import meRouter from './modules/matches/me.route'
import matchesRouter from './modules/matches/route'
import postsRouter from './modules/posts/route'
import tagsRouter from './modules/tags/route'
import uploadsRouter from './modules/uploads/route'
import usersRouter from './modules/users/route'
import { ensureUploadDir, UPLOAD_DIR, UPLOAD_URL_PREFIX } from './storage'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')

  app.use(
    cors({
      origin: env.CORS_ORIGIN ? env.CORS_ORIGIN.split(',').map((item) => item.trim()) : true,
    }),
  )
  app.use(express.json({ limit: '1mb' }))

  // 上传目录启动时自动创建；文件名是 UUID（内容不可变），可以放心长时间缓存
  ensureUploadDir()
  app.use(UPLOAD_URL_PREFIX, express.static(UPLOAD_DIR, { maxAge: '7d', index: false }))

  app.get('/api/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`
    res.json({ ok: true, db: 'up' })
  })

  app.use('/api/auth', authRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/matches', matchesRouter)
  app.use('/api/conversations', conversationsRouter)
  app.use('/api/posts', postsRouter)
  app.use('/api/tags', tagsRouter)
  app.use('/api/uploads', uploadsRouter)
  app.use('/api/me', meRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}