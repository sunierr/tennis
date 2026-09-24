import { Router } from 'express'
import { currentUserId, requireAuth } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import type { RegistrationsQuery } from '@shared/types/match'
import { registrationsQuerySchema } from './schema'
import { listMyMatches, listMyRegistrations } from './service'

// /api/me/* —— 归在 matches 模块，因为返回的都是 MatchListItem
const router = Router()

router.get('/registrations', requireAuth, validate(registrationsQuerySchema, 'query'), async (req, res) => {
  res.json(await listMyRegistrations(currentUserId(req), req.validated as RegistrationsQuery))
})

router.get('/matches', requireAuth, validate(registrationsQuerySchema, 'query'), async (req, res) => {
  res.json(await listMyMatches(currentUserId(req), req.validated as RegistrationsQuery))
})

export default router