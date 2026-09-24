// 全站唯一的实时通道点（迁移小程序 → uni.connectSocket）。
// 只订阅服务端推送，不发业务帧 —— 发消息仍走 HTTP POST（一套鉴权/错误码/幂等）。
// 连接、鉴权、心跳、指数退避重连全部收在这里，页面只调 subscribe()。

import type { ChatMessage, RealtimeFrame } from '@shared/types/chat'
import { WS_BASE_URL } from './env'
import { readToken } from './storage'

// 服务端每 30s 发一次 ping 探活，浏览器会自动回 pong，这里不需要自己发心跳
const RETRY_MIN = 1000
const RETRY_MAX = 30_000
// 4401 = 握手鉴权失败（token 失效），重连多少次都没用，等下次登录再连
const CLOSE_UNAUTHORIZED = 4401

type MessageHandler = (message: ChatMessage, conversationId: number) => void
type ReconnectHandler = () => void

let socket: WebSocket | null = null
let retryDelay = RETRY_MIN
let retryTimer: ReturnType<typeof setTimeout> | null = null
let stopped = false
// 首次连接不算「重连」：只有断过再连上才需要补拉缺口
let connectedOnce = false

const handlersByConversation = new Map<number, Set<MessageHandler>>()
const allHandlers = new Set<MessageHandler>()
const reconnectHandlers = new Set<ReconnectHandler>()

function dispatch(raw: unknown): void {
  if (typeof raw !== 'string') return
  let frame: RealtimeFrame
  try {
    frame = JSON.parse(raw) as RealtimeFrame
  } catch {
    return
  }
  if (frame.type !== 'message') return

  for (const handler of handlersByConversation.get(frame.conversationId) ?? []) {
    handler(frame.message, frame.conversationId)
  }
  for (const handler of allHandlers) handler(frame.message, frame.conversationId)
}

function notifyReconnect(): void {
  for (const handler of reconnectHandlers) handler()
}

function scheduleReconnect(): void {
  // 没人订阅时不保持长连接（例如退出登录后）
  if (stopped || retryTimer !== null || (allHandlers.size === 0 && handlersByConversation.size === 0)) return

  retryTimer = setTimeout(() => {
    retryTimer = null
    connect()
  }, retryDelay)
  // 指数退避：1s → 2s → 4s … 30s 封顶
  retryDelay = Math.min(retryDelay * 2, RETRY_MAX)
}

function connect(): void {
  if (socket || stopped) return
  const token = readToken()
  if (!token) return

  const ws = new WebSocket(`${WS_BASE_URL}/ws?token=${encodeURIComponent(token)}`)
  socket = ws

  ws.onopen = () => {
    retryDelay = RETRY_MIN
    if (connectedOnce) notifyReconnect()
    connectedOnce = true
  }

  ws.onmessage = (event) => dispatch(event.data)

  ws.onclose = (event) => {
    if (socket === ws) socket = null
    if (event.code === CLOSE_UNAUTHORIZED) return
    scheduleReconnect()
  }

  // 统一走 onclose：这里只负责触发关闭，避免错误与关闭两条路径各写一遍重连
  ws.onerror = () => ws.close()
}

export function subscribe(conversationId: number, handler: MessageHandler): () => void {
  stopped = false
  const handlers = handlersByConversation.get(conversationId) ?? new Set<MessageHandler>()
  handlers.add(handler)
  handlersByConversation.set(conversationId, handlers)
  connect()

  return () => {
    handlers.delete(handler)
    if (handlers.size === 0) handlersByConversation.delete(conversationId)
  }
}

// 会话列表用：不关心具体是哪个会话，来了消息就刷新未读
export function subscribeAll(handler: MessageHandler): () => void {
  stopped = false
  allHandlers.add(handler)
  connect()
  return () => {
    allHandlers.delete(handler)
  }
}

// 重连成功后触发：页面据此用 afterId 补拉断线期间的消息（补拉才是正确性来源）
export function onReconnect(handler: ReconnectHandler): () => void {
  reconnectHandlers.add(handler)
  return () => {
    reconnectHandlers.delete(handler)
  }
}

// 退出登录时调用：停止重连并断开，避免用失效 token 反复握手
export function disconnect(): void {
  stopped = true
  if (retryTimer !== null) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  retryDelay = RETRY_MIN
  connectedOnce = false
  const current = socket
  socket = null
  current?.close()
}