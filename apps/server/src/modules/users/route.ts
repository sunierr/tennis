import { Router } from 'express'
import { currentUserId, requireAuth } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import type { UpdateProfileInput } from '@shared/types/user'
import { updateProfileSchema } from './schema'
import { getMe, updateMe } from './service'

const router = Router()

router.get('/me', requireAuth, async (req, res) => {
  res.json(await getMe(currentUserId(req)))
})

router.patch('/me', requireAuth, validate(updateProfileSchema), async (req, res) => {
  res.json(await updateMe(currentUserId(req), req.validated as UpdateProfileInput))
})

export default router