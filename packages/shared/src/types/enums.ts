// 平台无关的枚举与中文文案，Web / Node / 小程序三端共用。
// 用 const 对象 + 同名 union type，而非 TS enum：值即数据库字符串（无需映射），
// 且是「可擦除语法」，Node 22 可直接剥离类型运行单测。

export const MatchStatus = {
  OPEN: 'OPEN',
  CANCELLED: 'CANCELLED',
  FINISHED: 'FINISHED',
} as const
export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus]

export const ParticipantStatus = {
  JOINED: 'JOINED',
  CANCELLED: 'CANCELLED',
} as const
export type ParticipantStatus = (typeof ParticipantStatus)[keyof typeof ParticipantStatus]

export const Surface = {
  HARD: 'HARD',
  CLAY: 'CLAY',
  GRASS: 'GRASS',
  INDOOR: 'INDOOR',
} as const
export type Surface = (typeof Surface)[keyof typeof Surface]

// 赛制：决定人数上限（capacity 的默认来源）
export const MatchFormat = {
  SINGLES: 'SINGLES',
  DOUBLES: 'DOUBLES',
  TRAINING: 'TRAINING',
} as const
export type MatchFormat = (typeof MatchFormat)[keyof typeof MatchFormat]

// 费用三态：场地费由谁承担
export const FeeType = {
  TREAT: 'TREAT',
  AA: 'AA',
  OTHER: 'OTHER',
} as const
export type FeeType = (typeof FeeType)[keyof typeof FeeType]

// 水平契合度：落在区间内 / 容差内 / 超出容差
export const LevelFit = {
  IN_RANGE: 'IN_RANGE',
  NEAR: 'NEAR',
  FAR: 'FAR',
} as const
export type LevelFit = (typeof LevelFit)[keyof typeof LevelFit]

// 会话类型：每场球局一个群聊，任意两人一个单聊
export const ConversationType = {
  GROUP: 'GROUP',
  DIRECT: 'DIRECT',
} as const
export type ConversationType = (typeof ConversationType)[keyof typeof ConversationType]

export const MessageType = {
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
  SYSTEM: 'SYSTEM',
} as const
export type MessageType = (typeof MessageType)[keyof typeof MessageType]

// 帖子状态：HIDDEN 预留（暂不做审核后台），DELETED 是软删（作者删帖后仍保留行）
export const PostStatus = {
  ACTIVE: 'ACTIVE',
  HIDDEN: 'HIDDEN',
  DELETED: 'DELETED',
} as const
export type PostStatus = (typeof PostStatus)[keyof typeof PostStatus]

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  ACTIVE: '正常',
  HIDDEN: '已隐藏',
  DELETED: '已删除',
}

// 社区发帖限制：图片与标签上限写在这里，前端 picker 与后端校验共用同一份数字
export const POST_IMAGE_MAX = 9
export const POST_TAG_MAX = 3

export const CONVERSATION_TYPE_LABELS: Record<ConversationType, string> = {
  GROUP: '球局群聊',
  DIRECT: '球友单聊',
}

export const SURFACE_LABELS: Record<Surface, string> = {
  HARD: '硬地',
  CLAY: '红土',
  GRASS: '草地',
  INDOOR: '室内',
}

export const MATCH_FORMAT_LABELS: Record<MatchFormat, string> = {
  SINGLES: '1 对 1',
  DOUBLES: '2 对 2',
  TRAINING: '练习',
}

export const FEE_TYPE_LABELS: Record<FeeType, string> = {
  TREAT: '我请客',
  AA: 'AA 分摊',
  OTHER: '其他',
}

// 费用一行文案：卡片、详情、行列表三处共用，避免各写一套分支
export function feeText(feeType: FeeType, fee: number | null): string {
  if (feeType === 'TREAT') return '我请客'
  if (feeType === 'AA') return fee === null ? 'AA 分摊' : `人均 ¥${fee}`
  return fee === null ? '费用见留言' : `约 ¥${fee} · 见留言`
}

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  OPEN: '招募中',
  CANCELLED: '已取消',
  FINISHED: '已结束',
}

export const PARTICIPANT_STATUS_LABELS: Record<ParticipantStatus, string> = {
  JOINED: '已报名',
  CANCELLED: '已取消',
}

// 三态文案（不含方向）：方向相关的表达由 level/fit.ts 的 levelFitText 给出
export const LEVEL_FIT_LABELS: Record<LevelFit, string> = {
  IN_RANGE: '水平合适',
  NEAR: '水平接近',
  FAR: '差得多',
}

export const SURFACES: Surface[] = ['HARD', 'CLAY', 'GRASS', 'INDOOR']
export const MATCH_FORMATS: MatchFormat[] = ['SINGLES', 'DOUBLES', 'TRAINING']
export const FEE_TYPES: FeeType[] = ['TREAT', 'AA', 'OTHER']

// 赛制对应的人数上限（含发起人）。TRAINING 无固定值：由发布者在下方区间内自选。
export const MATCH_FORMAT_CAPACITY: Record<Exclude<MatchFormat, 'TRAINING'>, number> = {
  SINGLES: 2,
  DOUBLES: 4,
}
export const TRAINING_CAPACITY_MIN = 2
export const TRAINING_CAPACITY_MAX = 6

// 由赛制推出人数上限：1 对 1 / 2 对 2 写死，练习局用发布者选的值
export function resolveCapacity(format: MatchFormat, requested?: number | null): number {
  if (format === 'TRAINING') return requested ?? TRAINING_CAPACITY_MIN
  return MATCH_FORMAT_CAPACITY[format]
}