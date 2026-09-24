// 聊天域类型：会话、消息、实时帧。三端共用（Web / Node / 小程序）。
// 服务端单向推送，客户端不通过 WS 上行 —— 发消息仍走 HTTP POST（一套鉴权、一套错误码）。

import type { ConversationType, MessageType } from './enums'

// 单聊的另一方；群聊时为 null
export interface ChatPeer {
  userId: number
  nickname: string
}

// 群聊关联的球局摘要：会话列表里要让用户一眼认出「这是哪场球的群」
export interface ChatMatchSummary {
  id: number
  title: string
  startsAt: string
  city: string
  venue: string
}

export interface ChatMessage {
  id: number
  conversationId: number
  senderId: number
  senderNickname: string
  type: MessageType
  // TEXT 是正文，IMAGE 是图片绝对地址（小程序 <image> 可直接加载）
  content: string
  createdAt: string
}

export interface ConversationListItem {
  id: number
  type: ConversationType
  // 群聊 = 球局标题，单聊 = 对方昵称；由服务端算好，前端不再拼
  title: string
  peer: ChatPeer | null
  match: ChatMatchSummary | null
  // 群聊的当前有效组员数（leftAt 为空的行数）
  memberCount: number
  lastMessage: ChatMessage | null
  lastMessageAt: string | null
  unreadCount: number
}

export interface MessagePage {
  // 一律按 id 升序返回；向上翻页用响应里的首条 id 作为下一次的 beforeId
  items: ChatMessage[]
  // 更早的消息还没取完
  hasMore: boolean
}

// 增量拉取：首屏不带参数（取最近 limit 条）；向上翻页带 beforeId；断线重连追赶带 afterId
export interface MessageQuery {
  beforeId?: number
  afterId?: number
  limit?: number
}

export interface DirectConversationInput {
  userId: number
}

export interface SendMessageInput {
  type?: MessageType
  content: string
}

export interface MarkReadInput {
  lastReadMessageId: number
}

export interface MarkReadResult {
  lastReadMessageId: number
  unreadCount: number
}

// 实时帧：服务端 → 客户端单向推送
export interface RealtimeMessageFrame {
  type: 'message'
  conversationId: number
  message: ChatMessage
}

export type RealtimeFrame = RealtimeMessageFrame

// 详情页两个聊天入口需要的定位信息（未登录时为 null / false）
export interface MatchChatEntry {
  // 该球局的群聊 id（存在即给，能不能进看 groupJoined）
  groupId: number | null
  // 我是否是有效组员（leftAt 为空）—— 非组员按钮置灰
  groupJoined: boolean
  // 我与发起人的单聊 id（还没聊过则为 null，前端调 POST /conversations/direct 现取）
  directWithCreatorId: number | null
}