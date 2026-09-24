// 开发库种子数据：清库后一条命令灌回可用的测试数据。
// 用 tsx 直接跑（package.json 的 prisma.seed 已配置）：npm --prefix apps/server run seed
import bcrypt from 'bcryptjs'
import { fromShanghai, shanghaiParts } from '@shared/time/range'
import { prisma } from './prisma'

const PASSWORD = 'passw0rd'

// 以「今天」为基准推算出上海挂钟时间，避免种子数据一写死就过期
function shanghaiDayOffset(days: number, hour: number, minute = 0): Date {
  const today = shanghaiParts(new Date())
  return fromShanghai(today.year, today.month, today.day + days, hour, minute)
}

interface SeedMatch {
  title: string
  city: string
  venue: string
  venueAddress: string
  startsAt: Date
  durationMinutes: number
  format: 'SINGLES' | 'DOUBLES' | 'TRAINING'
  capacity: number
  feeType: 'TREAT' | 'AA' | 'OTHER'
  fee: number | null
  surface: 'HARD' | 'CLAY' | 'GRASS' | 'INDOOR'
  levelMinTenths: number
  levelMaxTenths: number
  beginnerFriendly: boolean
  notes: string | null
  status?: 'OPEN' | 'CANCELLED' | 'FINISHED'
  // 除发起人外还要报名的账号
  joiners: string[]
}

const MATCHES: SeedMatch[] = [
  {
    title: '南山晚风局 · 轻松双打',
    city: '深圳',
    venue: '南山网球中心 · 3 号场',
    venueAddress: '深圳市南山区科苑南路 1088 号',
    startsAt: shanghaiDayOffset(1, 19),
    durationMinutes: 120,
    format: 'DOUBLES',
    capacity: 4,
    feeType: 'AA',
    fee: 60,
    surface: 'HARD',
    levelMinTenths: 30,
    levelMaxTenths: 40,
    beginnerFriendly: false,
    notes: '打完一起喝咖啡，场地费 AA。',
    joiners: ['seedviewer'],
  },
  {
    title: '单挑一局 · 3.5 级对拍',
    city: '深圳',
    venue: '深圳湾体育中心 · 室内 1 号场',
    venueAddress: '深圳市南山区滨海大道 3001 号',
    startsAt: shanghaiDayOffset(1, 20, 30),
    durationMinutes: 90,
    format: 'SINGLES',
    capacity: 2,
    feeType: 'TREAT',
    fee: 0,
    surface: 'INDOOR',
    levelMinTenths: 30,
    levelMaxTenths: 40,
    beginnerFriendly: false,
    notes: '我请客，来一场痛快的单打。',
    joiners: [],
  },
  {
    title: '周末练习局 · 找陪练',
    city: '深圳',
    venue: '香蜜公园网球场',
    venueAddress: '深圳市福田区香蜜湖街道',
    startsAt: shanghaiDayOffset(2, 10),
    durationMinutes: 120,
    format: 'TRAINING',
    capacity: 6,
    feeType: 'OTHER',
    fee: null,
    surface: 'CLAY',
    levelMinTenths: 20,
    levelMaxTenths: 50,
    beginnerFriendly: true,
    notes: '费用按实际到场人数分摊，散场前一起算。',
    joiners: ['seedviewer'],
  },
  {
    title: '福田红土双打 · 落日场',
    city: '深圳',
    venue: '笔架山网球中心 · 红土场',
    venueAddress: '深圳市福田区笋岗西路',
    startsAt: shanghaiDayOffset(3, 18),
    durationMinutes: 120,
    format: 'DOUBLES',
    capacity: 4,
    feeType: 'AA',
    fee: 90,
    surface: 'CLAY',
    levelMinTenths: 35,
    levelMaxTenths: 45,
    beginnerFriendly: false,
    notes: null,
    joiners: ['seedviewer'],
  },
  {
    title: '科技园硬地双打 · 早场',
    city: '深圳',
    venue: '科兴科学园网球场',
    venueAddress: '深圳市南山区科苑路 15 号',
    startsAt: shanghaiDayOffset(4, 9),
    durationMinutes: 120,
    format: 'DOUBLES',
    capacity: 4,
    feeType: 'AA',
    fee: 45,
    surface: 'HARD',
    levelMinTenths: 20,
    levelMaxTenths: 35,
    beginnerFriendly: true,
    notes: '新手友好，欢迎第一次上场的球友。',
    joiners: [],
  },
  {
    title: '上周三练习局（历史数据）',
    city: '深圳',
    venue: '莲花山网球中心',
    venueAddress: '深圳市福田区红荔路 6030 号',
    startsAt: shanghaiDayOffset(-3, 19, 30),
    durationMinutes: 120,
    format: 'DOUBLES',
    capacity: 4,
    feeType: 'AA',
    fee: 50,
    surface: 'HARD',
    levelMinTenths: 25,
    levelMaxTenths: 40,
    beginnerFriendly: false,
    notes: '用来验证「我的报名 · 已结束」列表。',
    joiners: ['seedviewer'],
  },
]

// 按 MATCHES 下标灌种子群消息：只有第 1 场（发起人与小球友同在）有内容
const SEED_MESSAGES: Record<number, Array<{ from: string; content: string }>> = {
  0: [
    { from: 'seedhost', content: '明晚 3 号场，提前十分钟到，一起热身。' },
    { from: 'seedhost', content: '球我带两筒新的，你们不用带。' },
  ],
}

// —— 社区种子：带图带标签的帖子，让信息流、九宫格、标签 chip、热门标签一开箱就有内容 ——
interface SeedImage {
  prompt: string
  width: number
  height: number
}

interface SeedPost {
  author: string
  content: string
  tags: string[]
  images: SeedImage[]
  // 谁点了赞（用于让 likeCount 不为 0）
  likes: string[]
  // 评论：[评论者, 内容]
  comments: Array<{ from: string; content: string }>
  // 发布时刻（几小时/几天前）：不能是「刚刚」，否则种子跑完就撞上发帖 60 秒限流
  hoursAgo: number
}

// 演示图片走文生图接口拿真实照片感的图；种子数据不该往 uploads 里塞文件
function demoImage(prompt: string, width = 1200, height = 900): SeedImage {
  return { prompt, width, height }
}

function demoImageUrl(image: SeedImage): string {
  const prompt = encodeURIComponent(image.prompt)
  const size = image.width === image.height ? 'square_hd' : 'landscape_4_3'
  return `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${prompt}&image_size=${size}`
}

const POSTS: SeedPost[] = [
  {
    author: 'seedhost',
    content:
      '昨晚南山 3 号场的灯光实在太好了，打到 9 点多还不舍得走。今晚双打差一位 3.0 左右的球友，有兴趣的来群里说一声。',
    tags: ['深圳约球', '双打', '南山'],
    images: [
      demoImage('night tennis court under bright floodlights, green hard court, urban city at dusk'),
      demoImage('tennis ball close up on green hard court with white line, evening light'),
      demoImage('two amateur tennis players shaking hands after a doubles match at night court'),
    ],
    likes: ['seedviewer'],
    comments: [{ from: 'seedviewer', content: '照片拍得真不错，今晚我有空，算我一个。' }],
    hoursAgo: 3,
  },
  {
    author: 'seedviewer',
    content:
      '第一次上红土场，滑步完全不会，被教练纠正了一整晚。给同样刚开始打红土的球友三个小建议：先学会刹车、重心压低、别急着追球。',
    tags: ['红土场', '新手成长', '技术分享'],
    images: [demoImage('red clay tennis court with white lines, sunny afternoon, footprints on clay', 1200, 900)],
    likes: ['seedhost'],
    comments: [],
    hoursAgo: 26,
  },
  {
    author: 'seedhost',
    content: '新到两筒球，周末练习局带上。顺便问一下：大家平时都打什么牌子的球？',
    tags: ['装备'],
    images: [],
    likes: [],
    comments: [],
    hoursAgo: 52,
  },
]

async function seedCommunity(usersByAccount: Map<string, { id: number }>): Promise<void> {
  for (const seed of POSTS) {
    const author = usersByAccount.get(seed.author)
    if (!author) continue

    const createdAt = new Date(Date.now() - seed.hoursAgo * 60 * 60 * 1000)
    const post = await prisma.post.create({
      data: { authorId: author.id, content: seed.content, status: 'ACTIVE', createdAt },
      select: { id: true },
    })

    for (const [index, image] of seed.images.entries()) {
      await prisma.postImage.create({
        data: {
          postId: post.id,
          url: demoImageUrl(image),
          sortOrder: index,
          width: image.width,
          height: image.height,
        },
      })
    }

    for (const name of seed.tags) {
      // 与发布接口一致：标签按 name upsert 后连 PostTag，不预设标签表
      const tag = await prisma.tag.upsert({ where: { name }, create: { name }, update: {} })
      await prisma.postTag.create({ data: { postId: post.id, tagId: tag.id } })
    }

    for (const account of seed.likes) {
      const user = usersByAccount.get(account)
      if (!user) continue
      await prisma.postLike.create({ data: { postId: post.id, userId: user.id } })
    }

    for (const comment of seed.comments) {
      const user = usersByAccount.get(comment.from)
      if (!user) continue
      await prisma.comment.create({
        data: {
          postId: post.id,
          authorId: user.id,
          content: comment.content,
          // 评论比帖子晚半小时，时间轴看起来才合理
          createdAt: new Date(createdAt.getTime() + 30 * 60 * 1000),
        },
      })
    }
  }
}

async function main(): Promise<void> {
  // 清库重建：先清掉旧数据，避免唯一约束与脏数据干扰
  // 社区六表先删：行内没有外键级联到 Post/Tag 之外的东西，但显式声明顺序更不容易踩坑
  await prisma.comment.deleteMany()
  await prisma.postLike.deleteMany()
  await prisma.postTag.deleteMany()
  await prisma.postImage.deleteMany()
  await prisma.post.deleteMany()
  await prisma.tag.deleteMany()
  // 聊天三表先删：Conversation 级联到成员与消息，但显式声明顺序更不容易踩坑
  await prisma.message.deleteMany()
  await prisma.conversationMember.deleteMany()
  await prisma.conversation.deleteMany()
  await prisma.matchParticipant.deleteMany()
  await prisma.matchPost.deleteMany()
  await prisma.user.deleteMany()

  const passwordHash = await bcrypt.hash(PASSWORD, 10)
  const host = await prisma.user.create({
    data: {
      account: 'seedhost',
      password: passwordHash,
      nickname: '阿发',
      levelTenths: 35,
      city: '深圳',
      district: '南山区',
      bio: '常打双打，周末有空。',
    },
  })
  const viewer = await prisma.user.create({
    data: {
      account: 'seedviewer',
      password: passwordHash,
      nickname: '小球友',
      levelTenths: 30,
      city: '深圳',
      district: '福田区',
      bio: '3.0 左右，想找水平相近的球友。',
    },
  })

  const usersByAccount = new Map([
    [host.account, host],
    [viewer.account, viewer],
  ])

  for (const [index, seed] of MATCHES.entries()) {
    const { joiners, ...fields } = seed
    const match = await prisma.matchPost.create({
      data: { ...fields, creatorId: host.id },
      select: { id: true },
    })

    // 发起人占一个名额（与 service 的行为一致）
    await prisma.matchParticipant.create({
      data: {
        matchId: match.id,
        userId: host.id,
        status: 'JOINED',
        levelAtJoinTenths: host.levelTenths,
      },
    })

    const memberIds = [host.id]
    for (const account of joiners) {
      const user = usersByAccount.get(account)
      if (!user) continue
      memberIds.push(user.id)
      await prisma.matchParticipant.create({
        data: {
          matchId: match.id,
          userId: user.id,
          status: 'JOINED',
          levelAtJoinTenths: user.levelTenths,
        },
      })
    }

    // 每场球局一个群聊，发起人与报名者都是组员（与 createMatch / joinMatch 的行为一致）
    const group = await prisma.conversation.create({
      data: {
        type: 'GROUP',
        matchId: match.id,
        members: { create: memberIds.map((userId) => ({ userId })) },
      },
      select: { id: true },
    })

    // 给第一场灌两条群消息：会话列表有「最后一条消息」，小球友看到 2 条未读
    const messages = SEED_MESSAGES[index]
    if (messages) {
      for (const message of messages) {
        const sender = usersByAccount.get(message.from)
        if (!sender) continue
        await prisma.message.create({
          data: { conversationId: group.id, senderId: sender.id, type: 'TEXT', content: message.content },
        })
      }
      await prisma.conversation.update({ where: { id: group.id }, data: { lastMessageAt: new Date() } })
    }
  }

  // 社区帖子：与约球数据无依赖，单独一段
  await seedCommunity(usersByAccount)

  console.log(
    `[seed] 完成：${usersByAccount.size} 个账号、${MATCHES.length} 场约球、${POSTS.length} 条社区帖子，密码统一为 ${PASSWORD}`,
  )
}

main()
  .catch((error) => {
    console.error('[seed] 失败', error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())