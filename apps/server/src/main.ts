// bootstrap：env 必须先加载（db/prisma 依赖 DATABASE_URL）
import { env } from './env'
import { createApp } from './app'
import { prisma } from './db/prisma'
import { attachRealtime } from './realtime/gateway'

const app = createApp()
const server = app.listen(env.PORT, () => {
  console.log(`[server] listening on http://localhost:${env.PORT} (${env.NODE_ENV})`)
})

// 实时通道挂在同一个 HTTP server 上（/ws），不新开端口
attachRealtime(server)

async function shutdown(signal: string) {
  console.log(`[server] 收到 ${signal}，正在关闭…`)
  server.close(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
  // 兜底：10s 内没关干净就强退，避免 tsx watch 卡住
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))