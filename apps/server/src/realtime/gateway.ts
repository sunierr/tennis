// 实时通道：挂在同一个 HTTP server 的 /ws 上，不新开端口。
// 只做「服务端 → 客户端」单向推送：发消息仍走 HTTP POST（落库成功后再广播），
// 一套鉴权、一套错误码、一套幂等，避免两套校验逻辑漂移。
// 单进程内存订阅表；部署多实例必须补 Redis pub/sub，本期不做（已知限制）。

import type { Server } from 'node:http'
import type { ChatMessage, RealtimeMessageFrame } from '@shared/types/chat'
import { WebSocket, WebSocketServer } from 'ws'
import { verifyAuthToken } from '../lib/jwt'
import { listActiveMemberIds } from '../modules/conversations/service'

const HEARTBEAT_INTERVAL = 30_000

interface Client {
  socket: WebSocket
  userId: number
  // 心跳探活：两个周期内没收到 pong 就判定连接已死
  alive: boolean
}

// 按用户分组：推送时「谁是该会话的有效成员」由数据库决定（getActiveMemberIds），
// 内存表只回答「这个人在线吗」。用户身份是握手时确定并不可变的，所以不会被伪造。
const clientsByUser = new Map<number, Set<Client>>()

function addClient(client: Client): void {
  const existing = clientsByUser.get(client.userId)
  if (existing) {
    existing.add(client)
    return
  }
  clientsByUser.set(client.userId, new Set([client]))
}

function removeClient(client: Client): void {
  const clients = clientsByUser.get(client.userId)
  if (!clients) return
  clients.delete(client)
  if (clients.size === 0) clientsByUser.delete(client.userId)
}

// 握手鉴权：浏览器的 WebSocket 构造函数不能自定义 header，只能把 JWT 放 query。
// 注意：任何日志都不要打印 request.url，否则 token 会进日志。
function authenticate(url: string | undefined): number | null {
  const token = new URL(url ?? '', 'http://localhost').searchParams.get('token')
  if (!token) return null
  try {
    return verifyAuthToken(token).sub
  } catch {
    return null
  }
}

function sweepHeartbeat(): void {
  for (const clients of clientsByUser.values()) {
    for (const client of clients) {
      if (!client.alive) {
        client.socket.terminate()
        continue
      }
      client.alive = false
      client.socket.ping()
    }
  }
}

export function attachRealtime(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (socket, request) => {
    const userId = authenticate(request.url)
    if (userId === null) {
      // 4401 与 HTTP 401 对齐，前端据此停止重连（token 无效重连多少次都没用）
      socket.close(4401, 'unauthorized')
      return
    }

    const client: Client = { socket, userId, alive: true }
    addClient(client)
    socket.on('pong', () => {
      client.alive = true
    })
    socket.on('close', () => removeClient(client))
    socket.on('error', () => removeClient(client))
  })

  const timer = setInterval(sweepHeartbeat, HEARTBEAT_INTERVAL)
  // 别让心跳定时器把进程钉住（tsx watch 重启时需要能退出）
  timer.unref()
  wss.on('close', () => clearInterval(timer))
}

// 新消息落库后调用：只推给「数据库里 leftAt 为空」的组员
export async function broadcastMessage(conversationId: number, message: ChatMessage): Promise<void> {
  const memberIds = await listActiveMemberIds(conversationId)
  if (memberIds.length === 0) return

  const frame = JSON.stringify({ type: 'message', conversationId, message } satisfies RealtimeMessageFrame)
  for (const userId of memberIds) {
    const clients = clientsByUser.get(userId)
    if (!clients) continue
    for (const client of clients) {
      if (client.socket.readyState === WebSocket.OPEN) client.socket.send(frame)
    }
  }
}