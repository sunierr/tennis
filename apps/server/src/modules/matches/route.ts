import { Router } from 'express'
import { currentUserId, optionalAuth, requireAuth } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import type { CreateMatchInput, JoinMatchInput, MatchListQuery } from '@shared/types/match'
import { createMatchSchema, joinMatchSchema, matchListQuerySchema, parseMatchId } from './schema'
import { cancelMatch, createMatch, getMatchDetail, joinMatch, leaveMatch, listMatches } from './service'

const router = Router()

router.get('/', optionalAuth, validate(matchListQuerySchema, 'query'), async (req, res) => {
  res.json(await listMatches(req.validated as MatchListQuery, req.auth?.userId ?? null))
})

router.get('/:id', optionalAuth, async (req, res) => {
  res.json(await getMatchDetail(parseMatchId(req.params.id), req.auth?.userId ?? null))
})

router.post('/', requireAuth, validate(createMatchSchema), async (req, res) => {
  res.status(201).json(await createMatch(req.validated as CreateMatchInput, currentUserId(req)))
})

router.post('/:id/cancel', requireAuth, async (req, res) => {
  res.json(await cancelMatch(parseMatchId(req.params.id), currentUserId(req)))
})

router.post('/:id/participants', requireAuth, validate(joinMatchSchema), async (req, res) => {
  const id = parseMatchId(req.params.id)
  res.status(201).json(await joinMatch(id, currentUserId(req), req.validated as JoinMatchInput))
})

router.delete('/:id/participants/me', requireAuth, async (req, res) => {
  res.json(await leaveMatch(parseMatchId(req.params.id), currentUserId(req)))
})

export default router