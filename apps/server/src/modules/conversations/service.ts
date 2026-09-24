// 会话与消息：列表 / 单聊幂等 / 增量拉取 / 发送 / 已读。
// 一切读写判据只有一条 —— ConversationMember.leftAt 为空才算组员；
// 退出报名后立即失去读写权，重新报名自动恢复（不删行）。

import { Prisma } from '@prisma/client'
import type {
  ChatMessage,
  ConversationListItem,
  MarkReadResult,
  MatchChatEntry,
  MessagePage,
  MessageQuery,
  SendMessageInput,
} from '@shared/types/chat'
import { prisma } from '../../db/prisma'
import { badRequest, forbidden, notFound } from '../../lib/http-error'
import { toChatMessage, toConversationListItem, type MessageWithSender } from '../../serializers/chat'

const DEFAULT_PAGE_SIZE = 30
const MAX_PAGE_SIZE = 100

type Tx = Prisma.TransactionClient

const messageInclude = { sender: { select: { id: true, nickname: true } } } satisfies Prisma.MessageInclude

const conversationInclude = {
  match: { select: { id: true, title: true, startsAt: true, city: true, venue: true } },
  members: {
    where: { leftAt: null },
    select: { userId: true, leftAt: true, user: { select: { id: true, nickname: true } } },
  },
} satisfies Prisma.ConversationInclude

// 「minId:maxId」保证两人之间只有一个会话，与谁先开口无关
function buildPairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

async function requireMembership(conversationId: number, userId: number) {
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true, lastReadMessageId: true, leftAt: true },
  })
  if (!member || member.leftAt !== null) throw forbidden('你不是该会话的成员，报名后可加入群聊')
  return member
}

// 只数别人发的：自己的消息不该算未读。游标为空表示一条都没读过。
function countUnread(conversationId: number, userId: number, lastReadMessageId: number | null): Promise<number> {
  return prisma.message.count({
    where: {
      conversationId,
      senderId: { not: userId },
      ...(lastReadMessageId === null ? {} : { id: { gt: lastReadMessageId } }),
    },
  })
}

async function buildListItem(
  conversationId: number,
  viewerUserId: number,
  lastReadMessageId: number | null,
): Promise<ConversationListItem | null> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: conversationInclude,
  })
  if (!conversation) return null

  const [lastMessage, unreadCount] = await Promise.all([
    prisma.message.findFirst({
      where: { conversationId },
      orderBy: { id: 'desc' },
      include: messageInclude,
    }),
    countUnread(conversationId, viewerUserId, lastReadMessageId),
  ])
  return toConversationListItem({ conversation, viewerUserId, lastMessage, unreadCount })
}

// 每个会话的最后一条消息：固定两条查询（groupBy 取最大 id → 按 id 取回整行），
// 与「我参与了几个会话」无关。原来是每个会话各查一次。
async function loadLastMessages(conversationIds: number[]): Promise<Map<number, MessageWithSender>> {
  const grouped = await prisma.message.groupBy({
    by: ['conversationId'],
    where: { conversationId: { in: conversationIds } },
    _max: { id: true },
  })
  const lastIds = grouped.map((row) => row._max.id).filter((id): id is number => id !== null)
  if (lastIds.length === 0) return new Map()

  const rows = await prisma.message.findMany({ where: { id: { in: lastIds } }, include: messageInclude })
  return new Map(rows.map((row) => [row.conversationId, row]))
}

// 未读数：每个会话要比的是各自的 lastReadMessageId，Prisma 的 groupBy 表达不了
// 「逐行用不同阈值过滤」，只能下推成一条带 join 的 SQL（与报名/发帖的 FOR UPDATE 同样是收口在 service 的 raw SQL）。
async function loadUnreadCounts(conversationIds: number[], userId: number): Promise<Map<number, number>> {
  const rows = await prisma.$queryRaw<Array<{ conversationId: number; unread: bigint }>>`
    SELECT m.conversationId AS conversationId, COUNT(*) AS unread
    FROM Message m
    JOIN ConversationMember cm
      ON cm.conversationId = m.conversationId AND cm.userId = ${userId}
    WHERE m.senderId <> ${userId}
      AND (cm.lastReadMessageId IS NULL OR m.id > cm.lastReadMessageId)
      AND m.conversationId IN (${Prisma.join(conversationIds)})
    GROUP BY m.conversationId
  `
  return new Map(rows.map((row) => [row.conversationId, Number(row.unread)]))
}

export async function listConversations(userId: number): Promise<ConversationListItem[]> {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId, leftAt: null },
    select: { conversationId: true, lastReadMessageId: true },
  })
  if (memberships.length === 0) return []

  const conversationIds = memberships.map((membership) => membership.conversationId)

  const [conversations, unreadByConversation] = await Promise.all([
    prisma.conversation.findMany({ where: { id: { in: conversationIds } }, include: conversationInclude }),
    loadUnreadCounts(conversationIds, userId),
  ])
  const lastMessages = await loadLastMessages(conversationIds)

  const items = conversations.map((conversation) =>
    toConversationListItem({
      conversation,
      viewerUserId: userId,
      lastMessage: lastMessages.get(conversation.id) ?? null,
      unreadCount: unreadByConversation.get(conversation.id) ?? 0,
    }),
  )

  // 有消息的按时间倒序，一个字没说的沉底。
  // 空值不能直接参与比较：Date.parse('') 是 NaN，比较器一旦返回 NaN 就被当成「相等」，
  // 排到哪儿取决于上游的查询顺序 —— 这里显式把「没有消息」当 0，排到所有真实时间戳之后。
  const timestamp = (value: string | null) => (value === null ? 0 : Date.parse(value))
  return items.sort((a, b) => timestamp(b.lastMessageAt) - timestamp(a.lastMessageAt))
}

export async function openDirectConversation(userId: number, peerUserId: number): Promise<ConversationListItem> {
  if (userId === peerUserId) throw badRequest('不能和自己聊天')
  const peer = await prisma.user.findUnique({ where: { id: peerUserId }, select: { id: true } })
  if (!peer) throw notFound('该球友不存在')

  const pairKey = buildPairKey(userId, peerUserId)
  // upsert 是幂等的关键：重复点「私聊」拿到的永远是同一个会话，不会刷出一堆空会话
  const conversation = await prisma.conversation.upsert({
    where: { pairKey },
    create: { type: 'DIRECT', pairKey, members: { create: [{ userId }, { userId: peerUserId }] } },
    update: {},
    select: { id: true },
  })

  // 自愈：并发的两次 upsert 有可能只创建了一次成员行，这里保证我的成员行一定在（且已恢复）
  const membership = await prisma.conversationMember.upsert({
    where: { conversationId_userId: { conversationId: conversation.id, userId } },
    create: { conversationId: conversation.id, userId },
    update: { leftAt: null },
    select: { lastReadMessageId: true },
  })

  const item = await buildListItem(conversation.id, userId, membership.lastReadMessageId)
  if (!item) throw notFound('会话创建失败，请重试')
  return item
}

export async function listMessages(
  conversationId: number,
  userId: number,
  query: MessageQuery,
): Promise<MessagePage> {
  await requireMembership(conversationId, userId)
  const limit = Math.min(query.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)

  // 断线重连追赶：只取比 afterId 更新的消息（升序，直接追加到列表尾部）
  if (query.afterId !== undefined) {
    const rows = await prisma.message.findMany({
      where: { conversationId, id: { gt: query.afterId } },
      orderBy: { id: 'asc' },
      take: limit,
      include: messageInclude,
    })
    return { items: rows.map(toChatMessage), hasMore: rows.length === limit }
  }

  // 首屏与向上翻页都在「比游标更早」的区间里倒序取，再翻回升序
  const rows = await prisma.message.findMany({
    where: { conversationId, ...(query.beforeId === undefined ? {} : { id: { lt: query.beforeId } }) },
    orderBy: { id: 'desc' },
    take: limit,
    include: messageInclude,
  })
  const items: MessageWithSender[] = rows.reverse()
  return { items: items.map(toChatMessage), hasMore: items.length === limit }
}

export async function sendMessage(
  conversationId: number,
  userId: number,
  input: SendMessageInput,
): Promise<ChatMessage> {
  await requireMembership(conversationId, userId)
  const content = input.content.trim()
  if (!content) throw badRequest('消息内容不能为空')

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: { conversationId, senderId: userId, type: input.type ?? 'TEXT', content },
      include: messageInclude,
    })
    // 会话列表排序靠它，省掉列表页 join Message 排序的开销
    await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: created.createdAt } })
    return created
  })
  return toChatMessage(message)
}

export async function markRead(
  conversationId: number,
  userId: number,
  lastReadMessageId: number,
): Promise<MarkReadResult> {
  const member = await requireMembership(conversationId, userId)
  const latest = await prisma.message.aggregate({ where: { conversationId }, _max: { id: true } })
  // 游标只能前进，也不能超过会话里真实存在的最大消息 id
  const cursor = Math.min(Math.max(lastReadMessageId, member.lastReadMessageId ?? 0), latest._max.id ?? 0)

  await prisma.conversationMember.update({ where: { id: member.id }, data: { lastReadMessageId: cursor } })
  return { lastReadMessageId: cursor, unreadCount: await countUnread(conversationId, userId, cursor) }
}

// —— 供 matches 模块在同一事务里调用（建群 / 入群 / 退群）——

// 建球局时同事务建群：matchId @unique 让「一场球只有一个群」由数据库兜底
export async function createGroupConversation(tx: Tx, matchId: number, creatorId: number): Promise<number> {
  const conversation = await tx.conversation.create({
    data: { type: 'GROUP', matchId, members: { create: [{ userId: creatorId }] } },
    select: { id: true },
  })
  return conversation.id
}

// 报名成功即入群；重新报名时 leftAt 置空即恢复身份（复用同一行）
export async function addGroupMember(tx: Tx, matchId: number, userId: number): Promise<void> {
  const conversation = await tx.conversation.findUnique({ where: { matchId }, select: { id: true } })
  // 迁移前创建的历史球局可能没有群，静默跳过而不是让报名失败
  if (!conversation) return
  await tx.conversationMember.upsert({
    where: { conversationId_userId: { conversationId: conversation.id, userId } },
    create: { conversationId: conversation.id, userId },
    update: { leftAt: null },
  })
}

// 退出报名 → 置 leftAt：不删行，便于重新报名恢复与回看历史消息
export async function removeGroupMember(tx: Tx, matchId: number, userId: number): Promise<void> {
  const conversation = await tx.conversation.findUnique({ where: { matchId }, select: { id: true } })
  if (!conversation) return
  await tx.conversationMember.updateMany({
    where: { conversationId: conversation.id, userId, leftAt: null },
    data: { leftAt: new Date() },
  })
}

// 详情页两个聊天入口的定位信息
export async function loadMatchChatEntry(
  matchId: number,
  creatorId: number,
  viewerUserId: number | null,
): Promise<MatchChatEntry> {
  if (viewerUserId === null) return { groupId: null, groupJoined: false, directWithCreatorId: null }

  const group = await prisma.conversation.findUnique({ where: { matchId }, select: { id: true } })
  const [membership, direct] = await Promise.all([
    group
      ? prisma.conversationMember.findUnique({
          where: { conversationId_userId: { conversationId: group.id, userId: viewerUserId } },
          select: { leftAt: true },
        })
      : null,
    // 发起人不需要和自己的单聊入口
    viewerUserId === creatorId
      ? null
      : prisma.conversation.findUnique({
          where: { pairKey: buildPairKey(viewerUserId, creatorId) },
          select: { id: true },
        }),
  ])

  return {
    groupId: group?.id ?? null,
    groupJoined: Boolean(membership && membership.leftAt === null),
    directWithCreatorId: direct?.id ?? null,
  }
}

// 新消息落库后要推给谁：会话里 leftAt 为空的组员（安全判据以数据库为准，不信内存订阅表）
export async function listActiveMemberIds(conversationId: number): Promise<number[]> {
  const members = await prisma.conversationMember.findMany({
    where: { conversationId, leftAt: null },
    select: { userId: true },
  })
  return members.map((member) => member.userId)
}