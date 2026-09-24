// 社区：信息流 / 详情 / 发帖 / 软删 / 点赞 / 评论 / 热门标签。
//
// 两条取舍（方案 §2.4）：
// 1. 点赞数与评论数不落库，用 Prisma _count 现算；出现性能问题再换冗余计数 + 事务内自增；
// 2. 删帖是软删（status=DELETED）：信息流按 status 过滤即消失，行与图片地址都留着。

import type { Prisma } from '@prisma/client'
import type { Paginated } from '@shared/types/api'
import { POST_TAG_MAX } from '@shared/types/enums'
import type {
  CreateCommentInput,
  CreatePostInput,
  DeletePostResult,
  HotTag,
  LikeResult,
  PostCommentItem,
  PostDetail,
  PostListItem,
  PostListQuery,
} from '@shared/types/post'
import { prisma } from '../../db/prisma'
import { forbidden, notFound, tooManyRequests } from '../../lib/http-error'
import { measureStoredImage } from '../../storage'
import {
  toPostCommentItem,
  toPostListItem,
  type CommentWithAuthor,
  type PostWithRelations,
} from '../../serializers/post'

const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 50
// 详情页带前 20 条评论；MVP 不做评论分页，超出部分留在话题外
const DETAIL_COMMENT_LIMIT = 20
// 同一个人 60 秒只能发一帖：社区不做审核，这是最便宜的防刷
const POST_COOLDOWN_MS = 60_000

const authorSelect = { id: true, nickname: true, levelTenths: true, city: true } as const

const postInclude = {
  author: { select: authorSelect },
  // 九宫格顺序由 sortOrder 决定，客户端不再排序
  images: { orderBy: { sortOrder: 'asc' } },
  tags: { include: { tag: { select: { id: true, name: true } } } },
  _count: { select: { likes: true, comments: true } },
} satisfies Prisma.PostInclude

const commentInclude = { author: { select: authorSelect } } satisfies Prisma.CommentInclude

// 一次 in 查询拿「我点过赞的帖子」，避免列表里逐帖查赞
async function loadLikedPostIds(postIds: number[], viewerUserId: number | null): Promise<Set<number>> {
  if (viewerUserId === null || postIds.length === 0) return new Set()
  const rows = await prisma.postLike.findMany({
    where: { userId: viewerUserId, postId: { in: postIds } },
    select: { postId: true },
  })
  return new Set(rows.map((row) => row.postId))
}

async function requireActivePost(postId: number): Promise<PostWithRelations> {
  const post = await prisma.post.findFirst({ where: { id: postId, status: 'ACTIVE' }, include: postInclude })
  if (!post) throw notFound('帖子不存在或已被删除')
  return post
}

export async function listPosts(query: PostListQuery, viewerUserId: number | null): Promise<Paginated<PostListItem>> {
  const page = query.page ?? 1
  const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)

  const where: Prisma.PostWhereInput = {
    status: 'ACTIVE',
    ...(query.authorId === undefined ? {} : { authorId: query.authorId }),
    // 标签筛选按 name 精确匹配；PostTag 上已有 tagId 索引，这里走的是 join
    ...(query.tag === undefined ? {} : { tags: { some: { tag: { name: query.tag } } } }),
  }

  const [total, rows] = await Promise.all([
    prisma.post.count({ where }),
    prisma.post.findMany({
      where,
      // id 兜底：同一毫秒创建的两帖否则顺序不稳定，分页会漏或重
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: postInclude,
    }),
  ])

  const likedPostIds = await loadLikedPostIds(rows.map((row) => row.id), viewerUserId)
  return {
    items: rows.map((row) => toPostListItem(row, viewerUserId, likedPostIds)),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  }
}

export async function getPostDetail(postId: number, viewerUserId: number | null): Promise<PostDetail> {
  const post = await prisma.post.findFirst({
    where: { id: postId, status: 'ACTIVE' },
    include: {
      ...postInclude,
      // 评论按时间正序，读起来像对话；上限 20 条
      comments: { orderBy: { createdAt: 'asc' }, take: DETAIL_COMMENT_LIMIT, include: commentInclude },
    },
  })
  if (!post) throw notFound('帖子不存在或已被删除')

  const likedPostIds = await loadLikedPostIds([post.id], viewerUserId)
  return {
    ...toPostListItem(post, viewerUserId, likedPostIds),
    comments: post.comments.map((comment) => toPostCommentItem(comment as CommentWithAuthor, viewerUserId)),
  }
}

// 标签去重（同名只留一个）并截断到上限：前端是自由输入，重复与超量都从服务端兜底
function normalizeTags(tags: string[]): string[] {
  const unique: string[] = []
  for (const tag of tags) {
    const name = tag.trim()
    if (name && !unique.includes(name)) unique.push(name)
    if (unique.length >= POST_TAG_MAX) break
  }
  return unique
}

export async function createPost(input: CreatePostInput, authorId: number): Promise<PostDetail> {
  // 图片宽高由服务端从落盘文件量出来（客户端只回传 url），量不到就留空
  const measured = await Promise.all(
    input.imageUrls.map(async (url) => ({ url, size: await measureStoredImage(url) })),
  )
  const tags = normalizeTags(input.tags)

  const created = await prisma.$transaction(async (tx) => {
    // 冷却校验必须和插入在同一个事务里，并且先锁住「作者本人这一行」作为串行点。
    // 否则两个并发请求会同时读到「还没有新帖」，双双通过校验，限流形同虚设。
    await tx.$queryRaw`SELECT id FROM User WHERE id = ${authorId} FOR UPDATE`

    // 这里刻意用加锁读而不是 tx.post.findFirst：普通查询走事务快照，
    // 在并发下可能读不到另一个事务刚刚提交的帖子，会漏判冷却窗口。
    const latest = await tx.$queryRaw<Array<{ createdAt: Date }>>`
      SELECT createdAt FROM Post WHERE authorId = ${authorId} ORDER BY createdAt DESC LIMIT 1 FOR UPDATE
    `
    const last = latest[0]
    if (last && Date.now() - last.createdAt.getTime() < POST_COOLDOWN_MS) {
      throw tooManyRequests('发帖太频繁了，等一会儿再发')
    }

    const post = await tx.post.create({
      data: {
        authorId,
        content: input.content,
        images: {
          create: measured.map((image, index) => ({
            url: image.url,
            sortOrder: index,
            width: image.size?.width ?? null,
            height: image.size?.height ?? null,
          })),
        },
      },
      select: { id: true },
    })

    for (const name of tags) {
      // 标签按 name upsert：中文标签直接以 name 做唯一键，不引入 slug
      const tag = await tx.tag.upsert({ where: { name }, create: { name }, update: {} })
      await tx.postTag.create({ data: { postId: post.id, tagId: tag.id } })
    }

    return post
  })

  return getPostDetail(created.id, authorId)
}

export async function deletePost(postId: number, userId: number): Promise<DeletePostResult> {
  const post = await prisma.post.findFirst({
    where: { id: postId, status: 'ACTIVE' },
    select: { id: true, authorId: true },
  })
  if (!post) throw notFound('帖子不存在或已被删除')
  if (post.authorId !== userId) throw forbidden('只能删除自己发布的帖子')

  await prisma.post.update({ where: { id: postId }, data: { status: 'DELETED' } })
  return { id: postId, status: 'DELETED' }
}

async function countLikes(postId: number): Promise<number> {
  return prisma.postLike.count({ where: { postId } })
}

export async function likePost(postId: number, userId: number): Promise<LikeResult> {
  await requireActivePost(postId)
  // upsert 而不是 create：连点两次不应该变成 500（唯一索引会撞）
  await prisma.postLike.upsert({
    where: { postId_userId: { postId, userId } },
    create: { postId, userId },
    update: {},
  })
  return { likeCount: await countLikes(postId), likedByMe: true }
}

export async function unlikePost(postId: number, userId: number): Promise<LikeResult> {
  await requireActivePost(postId)
  await prisma.postLike.deleteMany({ where: { postId, userId } })
  return { likeCount: await countLikes(postId), likedByMe: false }
}

export async function createComment(
  postId: number,
  userId: number,
  input: CreateCommentInput,
): Promise<PostCommentItem> {
  await requireActivePost(postId)
  const comment = await prisma.comment.create({
    data: { postId, authorId: userId, content: input.content },
    include: commentInclude,
  })
  return toPostCommentItem(comment as CommentWithAuthor, userId)
}

export async function listHotTags(limit = 10): Promise<HotTag[]> {
  const rows = await prisma.tag.findMany({
    // 只数落在「正常帖子」上的标签：软删的帖子不该把标签顶成热门，
    // 否则用户点进去是一个空流
    select: { name: true, _count: { select: { posts: { where: { post: { status: 'ACTIVE' } } } } } },
    orderBy: [{ posts: { _count: 'desc' } }, { name: 'asc' }],
    take: limit,
  })

  return rows
    .map((row) => ({ name: row.name, postCount: row._count.posts }))
    .filter((tag) => tag.postCount > 0)
}