// 约球序列化：White-list 字段 + 派生字段（isFull / levelFit / tags / 队内均水平）。
// 关键点：Decimal 必须转 number，否则前端拿到的是 "60.00" 字符串。
import type { MatchParticipant, MatchPost, User } from '@prisma/client'
import { levelDistance, levelFit as computeLevelFit } from '@shared/level/fit'
import { formatLevelRangeWithTier, LEVEL_TOLERANCE_DEFAULT } from '@shared/level/ntrp'
import { matchDayTags } from '@shared/time/range'
import type { MatchChatEntry } from '@shared/types/chat'
import type { MatchDetail, MatchListItem, MatchParticipantItem, MatchTag } from '@shared/types/match'
import { toMatchCreator } from './user'

export type MatchWithRelations = MatchPost & {
  creator: User
  participants: Array<MatchParticipant & { user: User }>
}

export interface MatchViewOptions {
  // 游客或未填水平时为 null → levelFit 为 null（不做水平过滤）
  viewerLevelTenths?: number | null
  tolerance?: number
}

function joinedParticipants(match: MatchWithRelations) {
  return match.participants.filter((p) => p.status === 'JOINED')
}

// 队内均水平：×10 取整；无有效水平时 null
export function participantLevelAvg(match: MatchWithRelations): number | null {
  const levels = joinedParticipants(match)
    .map((p) => p.levelAtJoinTenths)
    .filter((value): value is number => typeof value === 'number')
  if (levels.length === 0) return null
  return Math.round(levels.reduce((sum, value) => sum + value, 0) / levels.length)
}

export function toParticipantItem(participant: MatchParticipant & { user: User }, creatorId: number): MatchParticipantItem {
  return {
    id: participant.id,
    userId: participant.userId,
    nickname: participant.user.nickname,
    levelTenths: participant.levelAtJoinTenths ?? participant.user.levelTenths,
    status: participant.status,
    note: participant.note,
    isCreator: participant.userId === creatorId,
  }
}

export function toMatchListItem(match: MatchWithRelations, options: MatchViewOptions = {}): MatchListItem {
  const viewerLevelTenths = options.viewerLevelTenths ?? null
  const tolerance = options.tolerance ?? LEVEL_TOLERANCE_DEFAULT
  const participants = joinedParticipants(match)
  const participantCount = participants.length
  const fee = match.fee === null ? null : match.fee.toNumber()
  const levelFit =
    viewerLevelTenths === null
      ? null
      : computeLevelFit(viewerLevelTenths, match.levelMinTenths, match.levelMaxTenths, tolerance)

  const tags: MatchTag[] = []
  // 「免费场」= 有人请客，而不是金额恰好为 0
  if (match.feeType === 'TREAT') tags.push('free')
  tags.push(...matchDayTags(match.startsAt))
  if (match.beginnerFriendly) tags.push('beginnerFriendly')
  if (levelFit === 'IN_RANGE') tags.push('friendlyLevel')

  return {
    id: match.id,
    title: match.title,
    city: match.city,
    venue: match.venue,
    startsAt: match.startsAt.toISOString(),
    durationMinutes: match.durationMinutes,
    fee,
    feeType: match.feeType,
    format: match.format,
    surface: match.surface,
    levelMinTenths: match.levelMinTenths,
    levelMaxTenths: match.levelMaxTenths,
    levelLabel: formatLevelRangeWithTier(match.levelMinTenths, match.levelMaxTenths),
    beginnerFriendly: match.beginnerFriendly,
    capacity: match.capacity,
    participantCount,
    isFull: participantCount >= match.capacity,
    spotsLeft: Math.max(0, match.capacity - participantCount),
    creatorNickname: match.creator.nickname,
    participantsLevelAvg: participantLevelAvg(match),
    levelFit,
    tags,
    status: match.status,
  }
}

export function levelDistanceFor(match: MatchWithRelations, viewerLevelTenths: number | null): number {
  if (viewerLevelTenths === null) return 0
  return levelDistance(viewerLevelTenths, match.levelMinTenths, match.levelMaxTenths)
}

export function toMatchDetail(
  match: MatchWithRelations,
  options: MatchViewOptions & { viewerUserId?: number | null; myConversations?: MatchChatEntry } = {},
): MatchDetail {
  const listItem = toMatchListItem(match, options)
  const viewerUserId = options.viewerUserId ?? null
  const myParticipant = match.participants.find((p) => p.userId === viewerUserId && p.status === 'JOINED')

  return {
    ...listItem,
    venueAddress: match.venueAddress,
    lat: match.lat,
    lng: match.lng,
    notes: match.notes,
    status: match.status,
    creator: toMatchCreator(match.creator),
    participants: joinedParticipants(match).map((p) => toParticipantItem(p, match.creatorId)),
    myParticipantStatus: myParticipant ? 'JOINED' : null,
    // 详情页的两个聊天入口都靠它定位；调用方不传时给「不可进」的中性值
    myConversations: options.myConversations ?? { groupId: null, groupJoined: false, directWithCreatorId: null },
    createdAt: match.createdAt.toISOString(),
    updatedAt: match.updatedAt.toISOString(),
  }
}