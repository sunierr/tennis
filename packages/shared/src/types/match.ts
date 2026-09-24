import type { MatchCreator } from './user'
import type { MatchChatEntry } from './chat'
import type { FeeType, LevelFit, MatchFormat, MatchStatus, ParticipantStatus, Surface } from './enums'

// 服务端派生的筛选标签，前端 chip 直接消费（不再是本地过滤）
export type MatchTag = 'free' | 'today' | 'weekend' | 'beginnerFriendly' | 'friendlyLevel'

export interface MatchListItem {
  id: number
  title: string
  city: string
  venue: string
  startsAt: string
  durationMinutes: number
  // Decimal(10,2) 必须被 serializer 转成 number，否则会是 "60.00" 字符串
  // fee 现在可空：TREAT 恒为 0，AA 必填，OTHER 可空
  fee: number | null
  feeType: FeeType
  format: MatchFormat
  surface: Surface
  levelMinTenths: number
  levelMaxTenths: number
  // 「休闲 2.5 - 3.0 级」这类可直接展示的文案
  levelLabel: string
  beginnerFriendly: boolean
  // 含发起人的总人数上限
  capacity: number
  participantCount: number
  isFull: boolean
  // capacity - participantCount，前端只消费服务端算好的值，不自己减
  spotsLeft: number
  creatorNickname: string
  // 队内已报名球友的均水平（×10 取整），无人报名时为 null
  participantsLevelAvg: number | null
  // 未登录 / 未填水平时为 null
  levelFit: LevelFit | null
  tags: MatchTag[]
  // 「我的报名 / 我发布的」需要区分已取消的局，列表也一并带上状态
  status: MatchStatus
}

export interface MatchParticipantItem {
  id: number
  userId: number
  nickname: string
  levelTenths: number | null
  status: ParticipantStatus
  note: string | null
  isCreator: boolean
}

export interface MatchDetail extends MatchListItem {
  venueAddress: string | null
  lat: number | null
  lng: number | null
  notes: string | null
  creator: MatchCreator
  participants: MatchParticipantItem[]
  myParticipantStatus: ParticipantStatus | null
  // 群聊 / 私聊两个入口的定位信息
  myConversations: MatchChatEntry
  createdAt: string
  updatedAt: string
}

export type DatePreset = 'today' | 'tomorrow' | 'weekend' | 'week'
export type MatchSort = 'recommend' | 'time' | 'fee'

export interface MatchListQuery {
  city?: string
  datePreset?: DatePreset
  from?: string
  to?: string
  levelTenths?: number
  tolerance?: number
  // 用当前登录用户的水平做匹配；未登录时服务端忽略该参数
  fit?: 'me'
  free?: boolean
  beginnerFriendly?: boolean
  format?: MatchFormat
  surface?: Surface
  sort?: MatchSort
  page?: number
  pageSize?: number
}

export interface CreateMatchInput {
  title: string
  city: string
  venue: string
  venueAddress?: string
  startsAt: string
  durationMinutes?: number
  format: MatchFormat
  // TRAINING 时必填（2..6）；SINGLES/DOUBLES 由服务端按赛制写死，前端传了也忽略
  capacity?: number
  feeType: FeeType
  // AA 必填且 > 0；TREAT 由服务端写 0；OTHER 可空
  fee?: number
  surface?: Surface
  levelMinTenths: number
  levelMaxTenths: number
  beginnerFriendly?: boolean
  notes?: string
}

export interface JoinMatchInput {
  note?: string
}

export interface RegistrationsQuery {
  scope?: 'upcoming' | 'past'
  page?: number
  pageSize?: number
}

export interface JoinResult {
  participant: MatchParticipantItem
  participantCount: number
  isFull: boolean
  spotsLeft: number
}

export interface LeaveResult {
  participantCount: number
  isFull: boolean
  spotsLeft: number
}

export interface CancelMatchResult {
  id: number
  status: MatchStatus
}