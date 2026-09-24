// 社区域类型：帖子、图片、标签、点赞、评论。三端共用（Web / Node / 小程序）。
// 点赞数与评论数不落库：服务端用 Prisma _count 现算后放进这些 DTO。

import type { PostStatus } from './enums'

// 作者只暴露展示白名单：与 MatchCreator 同源，不带 account / password
export interface PostAuthor {
  id: number
  nickname: string
  levelTenths: number | null
  city: string | null
}

export interface PostImageItem {
  // 绝对地址（PUBLIC_BASE_URL 拼好），小程序 <image> 可直接加载
  url: string
  // 预留占位防抖：拿不到时为 null，前端退化成固定比例
  width: number | null
  height: number | null
}

export interface PostListItem {
  id: number
  content: string
  createdAt: string
  author: PostAuthor
  images: PostImageItem[]
  // 只有标签名：标签的 id 对前端没有用，展示与筛选都用 name
  tags: string[]
  likeCount: number
  commentCount: number
  // 未登录时恒为 false
  likedByMe: boolean
  // 我发的帖才渲染删除入口
  isMine: boolean
}

export interface PostCommentItem {
  id: number
  author: PostAuthor
  content: string
  createdAt: string
  isMine: boolean
}

export interface PostDetail extends PostListItem {
  // 只是首屏快照（前 20 条），不是全集：需要翻更多评论时走独立的分页接口，
  // 不要把这里的长度当成评论总数（总数看 commentCount）。
  comments: PostCommentItem[]
}

export interface HotTag {
  name: string
  postCount: number
}

export interface PostListQuery {
  // 按标签筛选（精确匹配 name）
  tag?: string
  authorId?: number
  page?: number
  pageSize?: number
}

export interface CreatePostInput {
  content: string
  // 图片必须先经 POST /api/uploads 拿到绝对地址（最多 9 张）
  imageUrls: string[]
  // 自由输入，最多 3 个；服务端按 name upsert 后连 PostTag
  tags: string[]
}

export interface CreateCommentInput {
  content: string
}

export interface LikeResult {
  likeCount: number
  likedByMe: boolean
}

export interface DeletePostResult {
  id: number
  status: PostStatus
}