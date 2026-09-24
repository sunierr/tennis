import type { Prisma } from '@prisma/client'
import { recommendScore } from '@shared/level/fit'
import { LEVEL_TOLERANCE_DEFAULT } from '@shared/level/ntrp'
import { resolveWindow } from '@shared/time/range'
import { resolveCapacity } from '@shared/types/enums'
import type { Paginated } from '@shared/types/api'
import type {
  CancelMatchResult,
  CreateMatchInput,
  JoinMatchInput,
  JoinResult,
  LeaveResult,
  MatchDetail,
  MatchListQuery,
  MatchListItem,
  MatchSort,
  RegistrationsQuery,
} from '@shared/types/match'
import { prisma } from '../../db/prisma'
import { badRequest, conflict, forbidden, notFound } from '../../lib/http-error'
import {
  addGroupMember,
  createGroupConversation,
  loadMatchChatEntry,
  removeGroupMember,
} from '../conversations/service'
import {
  levelDistanceFor,
  toMatchDetail,
  toMatchListItem,
  toParticipantItem,
} from '../../serializers/match'

// 候选上限保护：硬过滤（城市 + 时间窗 + 水平区间）后仍有单城市几百条量级，超出即截断
const CANDIDATE_LIMIT = 500
const DEFAULT_PAGE_SIZE = 12
const MAX_PAGE_SIZE = 50

// 列表与详情统一带上创建者与已报名球友：派生字段（队内均水平、成局度）都依赖它们
const matchInclude = {
  creator: true,
  participants: {
    where: { status: 'JOINED' },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.MatchPostInclude

interface PageParams {
  page: number
  pageSize: number
  skip: number
  take: number
}

function resolvePage(query: { page?: number; pageSize?: number }): PageParams {
  const page = query.page ?? 1
  const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize }
}

// 「其他」且未写金额时费用未知，按最贵处理排到最后，避免被误当成免费场
function sortFee(fee: number | null): number {
  return fee ?? Number.POSITIVE_INFINITY
}

function paginate<T>(items: T[], params: PageParams): Paginated<T> {
  const start = (params.page - 1) * params.pageSize
  const pageItems = items.slice(start, start + params.pageSize)
  return {
    items: pageItems,
    total: items.length,
    page: params.page,
    pageSize: params.pageSize,
    hasMore: start + pageItems.length < items.length,
  }
}

// 只有 fit=me 时才需要查库拿当前用户水平
async function loadViewerLevel(userId: number | null): Promise<number | null> {
  if (userId === null) return null
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { levelTenths: true } })
  return user?.levelTenths ?? null
}

export async function listMatches(query: MatchListQuery, viewerUserId: number | null): Promise<Paginated<MatchListItem>> {
  const params = resolvePage(query)
  const window = resolveWindow({ datePreset: query.datePreset, from: query.from, to: query.to })
  const tolerance = query.tolerance ?? LEVEL_TOLERANCE_DEFAULT

  // 登录用户的水平只查一次库
  const viewerLevelTenths = await loadViewerLevel(viewerUserId)
  // 徽章用：显式传入的水平优先，否则用登录用户自评 —— 未登录且未指定则为 null
  const displayLevelTenths = query.levelTenths ?? viewerLevelTenths
  // 硬过滤用：fit=me 或显式指定 levelTenths 才套用；两者都没有则不做水平过滤（游客降级）
  const filterLevelTenths = query.fit === 'me' ? viewerLevelTenths : (query.levelTenths ?? null)

  const where: Prisma.MatchPostWhereInput = {
    status: 'OPEN',
    startsAt: { gte: window.from, lt: window.to },
    ...(query.city ? { city: query.city } : {}),
    // 「免费场」的准确定义是「有人请客」，而不是金额恰好为 0
    ...(query.free ? { feeType: 'TREAT' } : {}),
    ...(query.beginnerFriendly ? { beginnerFriendly: true } : {}),
    ...(query.format ? { format: query.format } : {}),
    ...(query.surface ? { surface: query.surface } : {}),
    // 硬容差：我的水平 ± tolerance 与 [min, max] 有交集才算候选
    ...(filterLevelTenths === null
      ? {}
      : {
          levelMinTenths: { lte: filterLevelTenths + tolerance },
          levelMaxTenths: { gte: filterLevelTenths - tolerance },
        }),
  }

  if (!query.city) console.warn('[matches] 未指定 city，候选集可能偏大')

  const rows = await prisma.matchPost.findMany({
    where,
    include: matchInclude,
    orderBy: { startsAt: 'asc' },
    take: CANDIDATE_LIMIT,
  })
  if (rows.length === CANDIDATE_LIMIT) {
    console.warn(`[matches] 候选集达到上限 ${CANDIDATE_LIMIT}，结果已截断，建议补全城市等硬过滤条件`)
  }

  const now = Date.now()
  const entries = rows.map((row) => {
    const item = toMatchListItem(row, { viewerLevelTenths: displayLevelTenths, tolerance })
    return {
      item,
      startsAt: row.startsAt.getTime(),
      score: recommendScore({
        levelDistance: levelDistanceFor(row, displayLevelTenths),
        startsAtDeltaMinutes: (row.startsAt.getTime() - now) / 60000,
        participantCount: item.participantCount,
        capacity: row.capacity,
      }),
    }
  })

  // 排序在服务端 JS 做：Prisma orderBy 表达不了「到区间的距离」，且算法要三端复用
  const sort: MatchSort = query.sort ?? 'recommend'
  entries.sort((a, b) => {
    if (sort === 'time') return a.startsAt - b.startsAt
    if (sort === 'fee') return sortFee(a.item.fee) - sortFee(b.item.fee) || a.startsAt - b.startsAt
    return b.score - a.score || a.startsAt - b.startsAt
  })

  return paginate(
    entries.map((entry) => entry.item),
    params,
  )
}

export async function getMatchDetail(id: number, viewerUserId: number | null): Promise<MatchDetail> {
  const match = await prisma.matchPost.findUnique({ where: { id }, include: matchInclude })
  if (!match) throw notFound('约球不存在或已被删除')

  const [viewerLevelTenths, myConversations] = await Promise.all([
    loadViewerLevel(viewerUserId),
    loadMatchChatEntry(id, match.creatorId, viewerUserId),
  ])
  return toMatchDetail(match, { viewerLevelTenths, viewerUserId, myConversations })
}

export async function createMatch(input: CreateMatchInput, userId: number): Promise<MatchDetail> {
  const startsAt = new Date(input.startsAt)
  if (startsAt.getTime() <= Date.now()) throw badRequest('开赛时间需要晚于当前时间')

  const capacity = resolveCapacity(input.format, input.capacity)
  // TREAT 恒为 0；OTHER 允许不写金额，以 notes 为准
  const fee = input.feeType === 'TREAT' ? 0 : (input.fee ?? null)
  const creator = await prisma.user.findUnique({ where: { id: userId }, select: { levelTenths: true } })

  const created = await prisma.$transaction(async (tx) => {
    const post = await tx.matchPost.create({
      data: {
        title: input.title,
        city: input.city,
        venue: input.venue,
        venueAddress: input.venueAddress ?? null,
        startsAt,
        durationMinutes: input.durationMinutes ?? 120,
        format: input.format,
        capacity,
        feeType: input.feeType,
        fee,
        surface: input.surface ?? 'HARD',
        levelMinTenths: input.levelMinTenths,
        levelMaxTenths: input.levelMaxTenths,
        beginnerFriendly: input.beginnerFriendly ?? false,
        notes: input.notes ?? null,
        creatorId: userId,
      },
      select: { id: true },
    })

    // 发起人占掉一个名额：入册后 participantCount、队内均水平、头像叠层都会包含他
    await tx.matchParticipant.create({
      data: {
        matchId: post.id,
        userId,
        status: 'JOINED',
        levelAtJoinTenths: creator?.levelTenths ?? null,
      },
    })

    // 同一事务内建群：群与球局同生共死，不会出现「有群没球局」的脏状态
    const groupId = await createGroupConversation(tx, post.id, userId)

    return { id: post.id, groupId }
  })

  const match = await prisma.matchPost.findUniqueOrThrow({ where: { id: created.id }, include: matchInclude })
  // 创建者视角不需要 levelFit（自己发的局）；发起人刚建群，两个入口里只有群聊可用
  return toMatchDetail(match, {
    viewerLevelTenths: null,
    viewerUserId: userId,
    myConversations: { groupId: created.groupId, groupJoined: true, directWithCreatorId: null },
  })
}

export async function cancelMatch(id: number, userId: number): Promise<CancelMatchResult> {
  const match = await prisma.matchPost.findUnique({
    where: { id },
    select: { id: true, creatorId: true, status: true },
  })
  if (!match) throw notFound('约球不存在或已被删除')
  if (match.creatorId !== userId) throw forbidden('只有发起人可以取消该约球')
  if (match.status !== 'OPEN') throw conflict('MATCH_NOT_OPEN', '该约球已取消或已结束')

  const updated = await prisma.matchPost.update({
    where: { id },
    data: { status: 'CANCELLED' },
    select: { id: true, status: true },
  })
  return { id: updated.id, status: updated.status }
}

export async function joinMatch(id: number, userId: number, input: JoinMatchInput): Promise<JoinResult> {
  const result = await prisma.$transaction(async (tx) => {
    // 对该约球行加锁：否则并发报名会各自读到旧人数，双双通过超员校验
    await tx.$queryRaw`SELECT id FROM MatchPost WHERE id = ${id} FOR UPDATE`

    const match = await tx.matchPost.findUnique({
      where: { id },
      select: {
        id: true,
        creatorId: true,
        status: true,
        capacity: true,
        participants: { where: { status: 'JOINED' }, select: { id: true } },
      },
    })
    if (!match) throw notFound('约球不存在或已被删除')
    if (match.status !== 'OPEN') throw conflict('MATCH_NOT_OPEN', '该约球已取消或已结束')

    const existing = await tx.matchParticipant.findUnique({
      where: { matchId_userId: { matchId: id, userId } },
      select: { id: true, status: true, note: true },
    })
    // 发起人创建时已占一席，所以「发起人不能报名」这条规则由这个检查自然覆盖
    if (existing?.status === 'JOINED') throw conflict('ALREADY_JOINED', '你已经报名这场约球了')
    if (match.participants.length >= match.capacity) throw conflict('MATCH_FULL', '人数已满，换一场试试')

    const user = await tx.user.findUnique({ where: { id: userId }, select: { levelTenths: true } })

    // 软取消过就复用同一行（@@unique([matchId,userId]) 不允许再插一行）
    const participant = await tx.matchParticipant.upsert({
      where: { matchId_userId: { matchId: id, userId } },
      create: {
        matchId: id,
        userId,
        status: 'JOINED',
        note: input.note ?? null,
        levelAtJoinTenths: user?.levelTenths ?? null,
      },
      update: {
        status: 'JOINED',
        note: input.note ?? existing?.note ?? null,
        levelAtJoinTenths: user?.levelTenths ?? null,
        cancelledAt: null,
      },
      include: { user: true },
    })

    // 报名成功即入群（重新报名时这里会把 leftAt 置空，自动恢复身份）
    await addGroupMember(tx, id, userId)

    return {
      participant,
      creatorId: match.creatorId,
      capacity: match.capacity,
      participantCount: match.participants.length + 1,
    }
  })

  return {
    participant: toParticipantItem(result.participant, result.creatorId),
    participantCount: result.participantCount,
    isFull: result.participantCount >= result.capacity,
    spotsLeft: Math.max(0, result.capacity - result.participantCount),
  }
}

export async function leaveMatch(id: number, userId: number): Promise<LeaveResult> {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM MatchPost WHERE id = ${id} FOR UPDATE`

    const participant = await tx.matchParticipant.findUnique({
      where: { matchId_userId: { matchId: id, userId } },
      select: { id: true, status: true },
    })
    if (!participant || participant.status !== 'JOINED') throw notFound('你还没有报名该球局')

    const match = await tx.matchPost.findUnique({
      where: { id },
      select: { capacity: true, creatorId: true },
    })
    if (!match) throw notFound('约球不存在或已被删除')
    // 发起人也是参与者行，但他的名额不能单独退出——要撤销整场请走「取消约球」
    if (match.creatorId === userId) throw badRequest('你是发起人，如需撤销请取消这场约球')

    await tx.matchParticipant.update({
      where: { id: participant.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    })
    // 退出即失去群成员身份（leftAt 置位、行保留）：此后拉/发消息一律 403，会话也从列表消失
    await removeGroupMember(tx, id, userId)
    const participantCount = await tx.matchParticipant.count({ where: { matchId: id, status: 'JOINED' } })
    return { participantCount, capacity: match.capacity }
  })

  return {
    participantCount: result.participantCount,
    isFull: result.participantCount >= result.capacity,
    spotsLeft: Math.max(0, result.capacity - result.participantCount),
  }
}

export async function listMyRegistrations(
  userId: number,
  query: RegistrationsQuery,
): Promise<Paginated<MatchListItem>> {
  const params = resolvePage(query)
  const scope = query.scope ?? 'upcoming'
  const now = new Date()
  const where: Prisma.MatchPostWhereInput = {
    participants: { some: { userId, status: 'JOINED' } },
    ...(scope === 'past' ? { startsAt: { lt: now } } : { startsAt: { gte: now } }),
  }

  const [total, rows] = await prisma.$transaction([
    prisma.matchPost.count({ where }),
    prisma.matchPost.findMany({
      where,
      include: matchInclude,
      orderBy: { startsAt: scope === 'past' ? 'desc' : 'asc' },
      skip: params.skip,
      take: params.take,
    }),
  ])

  const viewerLevelTenths = await loadViewerLevel(userId)
  return {
    items: rows.map((row) => toMatchListItem(row, { viewerLevelTenths })),
    total,
    page: params.page,
    pageSize: params.pageSize,
    hasMore: params.skip + rows.length < total,
  }
}

export async function listMyMatches(userId: number, query: RegistrationsQuery): Promise<Paginated<MatchListItem>> {
  const params = resolvePage(query)
  const where: Prisma.MatchPostWhereInput = { creatorId: userId }

  const [total, rows] = await prisma.$transaction([
    prisma.matchPost.count({ where }),
    prisma.matchPost.findMany({
      where,
      include: matchInclude,
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
    }),
  ])

  const viewerLevelTenths = await loadViewerLevel(userId)
  return {
    items: rows.map((row) => toMatchListItem(row, { viewerLevelTenths })),
    total,
    page: params.page,
    pageSize: params.pageSize,
    hasMore: params.skip + rows.length < total,
  }
}