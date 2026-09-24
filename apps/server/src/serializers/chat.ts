// 聊天序列化：会话标题、未读数、最后一条消息都在这里收口，
// 前端拿到直接渲染 —— 不在页面里拼文案、不自己算未读。

import type { Conversation, ConversationMember, MatchPost, Message, User } from '@prisma/client'
import type { ChatMessage, ConversationListItem } from '@shared/types/chat'

export type MessageWithSender = Message & { sender: Pick<User, 'id' | 'nickname'> }

export function toChatMessage(message: MessageWithSender): ChatMessage {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    senderNickname: message.sender.nickname,
    type: message.type,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  }
}

export interface ConversationViewInput {
  conversation: Conversation & {
    match: Pick<MatchPost, 'id' | 'title' | 'startsAt' | 'city' | 'venue'> | null
    // 只包含 leftAt 为空的组员
    members: Array<Pick<ConversationMember, 'userId' | 'leftAt'> & { user: Pick<User, 'id' | 'nickname'> }>
  }
  viewerUserId: number
  lastMessage: MessageWithSender | null
  unreadCount: number
}

export function toConversationListItem(input: ConversationViewInput): ConversationListItem {
  const { conversation, viewerUserId, lastMessage, unreadCount } = input
  const activeMembers = conversation.members.filter((member) => member.leftAt === null)
  // 单聊的展示名用对方昵称；群聊用球局标题
  const peer =
    conversation.type === 'DIRECT' ? (activeMembers.find((member) => member.userId !== viewerUserId) ?? null) : null

  return {
    id: conversation.id,
    type: conversation.type,
    title: conversation.type === 'DIRECT' ? (peer?.user.nickname ?? '球友') : (conversation.match?.title ?? '球局群聊'),
    peer: peer ? { userId: peer.userId, nickname: peer.user.nickname } : null,
    match: conversation.match
      ? {
          id: conversation.match.id,
          title: conversation.match.title,
          startsAt: conversation.match.startsAt.toISOString(),
          city: conversation.match.city,
          venue: conversation.match.venue,
        }
      : null,
    memberCount: activeMembers.length,
    lastMessage: lastMessage ? toChatMessage(lastMessage) : null,
    lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
    unreadCount,
  }
}