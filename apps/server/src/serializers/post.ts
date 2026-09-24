// 社区序列化：作者白名单、标签名、点赞/评论计数都在这里收口，
// 前端拿到直接渲染 —— 不在页面里拼文案、不自己算计数。

import type { Comment, Post, PostImage, PostTag, Tag, User } from '@prisma/client'
import type { PostAuthor, PostCommentItem, PostImageItem, PostListItem } from '@shared/types/post'

export type PostAuthorRow = Pick<User, 'id' | 'nickname' | 'levelTenths' | 'city'>

export type PostWithRelations = Post & {
  author: PostAuthorRow
  images: PostImage[]
  tags: Array<PostTag & { tag: Pick<Tag, 'id' | 'name'> }>
  // 点赞数与评论数不落库，靠 _count 现算
  _count: { likes: number; comments: number }
}

export type CommentWithAuthor = Comment & { author: PostAuthorRow }

function toPostAuthor(author: PostAuthorRow): PostAuthor {
  return {
    id: author.id,
    nickname: author.nickname,
    levelTenths: author.levelTenths,
    city: author.city,
  }
}

function toPostImage(image: PostImage): PostImageItem {
  return { url: image.url, width: image.width, height: image.height }
}

// likedByMe 由调用方批量查出（一次 in 查询），避免逐帖查一次点赞表
export function toPostListItem(
  post: PostWithRelations,
  viewerUserId: number | null,
  likedPostIds: Set<number>,
): PostListItem {
  return {
    id: post.id,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    author: toPostAuthor(post.author),
    images: post.images.map(toPostImage),
    tags: post.tags.map((postTag) => postTag.tag.name),
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    likedByMe: likedPostIds.has(post.id),
    // 未登录时没有「我的帖子」概念
    isMine: viewerUserId !== null && post.authorId === viewerUserId,
  }
}

export function toPostCommentItem(comment: CommentWithAuthor, viewerUserId: number | null): PostCommentItem {
  return {
    id: comment.id,
    author: toPostAuthor(comment.author),
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    isMine: viewerUserId !== null && comment.authorId === viewerUserId,
  }
}