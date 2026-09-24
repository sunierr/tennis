import { Router } from 'express'
import type { CreateCommentInput, CreatePostInput, PostListQuery } from '@shared/types/post'
import { currentUserId, optionalAuth, requireAuth } from '../../middleware/auth'
import { commentLimiter, postCreateLimiter } from '../../middleware/rate-limit'
import { validate } from '../../middleware/validate'
import { createCommentSchema, createPostSchema, parsePostId, postListQuerySchema } from './schema'
import { createComment, createPost, deletePost, getPostDetail, likePost, listPosts, unlikePost } from './service'

const router = Router()

// 浏览不要求登录（游客可看信息流），写操作逐条 requireAuth
router.get('/', optionalAuth, validate(postListQuerySchema, 'query'), async (req, res) => {
  res.json(await listPosts(req.validated as PostListQuery, req.auth?.userId ?? null))
})

router.get('/:id', optionalAuth, async (req, res) => {
  res.json(await getPostDetail(parsePostId(req.params.id), req.auth?.userId ?? null))
})

router.post('/', postCreateLimiter, requireAuth, validate(createPostSchema), async (req, res) => {
  res.status(201).json(await createPost(req.validated as CreatePostInput, currentUserId(req)))
})

router.delete('/:id', requireAuth, async (req, res) => {
  res.json(await deletePost(parsePostId(req.params.id), currentUserId(req)))
})

router.post('/:id/like', requireAuth, async (req, res) => {
  res.json(await likePost(parsePostId(req.params.id), currentUserId(req)))
})

// 取消点赞用 DELETE 同一路径：语义上是「移除我的点赞这一资源」
router.delete('/:id/like', requireAuth, async (req, res) => {
  res.json(await unlikePost(parsePostId(req.params.id), currentUserId(req)))
})

router.post('/:id/comments', commentLimiter, requireAuth, validate(createCommentSchema), async (req, res) => {
  const id = parsePostId(req.params.id)
  res.status(201).json(await createComment(id, currentUserId(req), req.validated as CreateCommentInput))
})

export default router