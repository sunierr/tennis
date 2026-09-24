import { Router } from 'express'
import { listHotTags } from '../posts/service'

const router = Router()

// 热门标签是公开数据：未登录也能看到，用于发帖页的推荐词
router.get('/hot', async (_req, res) => {
  res.json(await listHotTags())
})

export default router