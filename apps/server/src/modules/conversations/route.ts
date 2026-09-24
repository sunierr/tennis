import { Router } from 'express'
import type {
  DirectConversationInput,
  MarkReadInput,
  MessageQuery,
  SendMessageInput,
} from '@shared/types/chat'
import { currentUserId, requireAuth } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { broadcastMessage } from '../../realtime/gateway'
import {
  directConversationSchema,
  markReadSchema,
  messageQuerySchema,
  parseConversationId,
  sendMessageSchema,
} from './schema'
import { listConversations, listMessages, markRead, openDirectConversation, sendMessage } from './service'

const router = Router()

// 聊天全链路都要求登录：会话与消息都属于个人
router.use(requireAuth)

router.get('/', async (req, res) => {
  res.json(await listConversations(currentUserId(req)))
})

router.post('/direct', validate(directConversationSchema), async (req, res) => {
  const input = req.validated as DirectConversationInput
  res.json(await openDirectConversation(currentUserId(req), input.userId))
})

router.get('/:id/messages', validate(messageQuerySchema, 'query'), async (req, res) => {
  const query = req.validated as MessageQuery
  res.json(await listMessages(parseConversationId(req.params.id), currentUserId(req), query))
})

// 发消息走 HTTP 落库，成功后再向该会话的在线组员广播（WS 只负责加速）
router.post('/:id/messages', validate(sendMessageSchema), async (req, res) => {
  const id = parseConversationId(req.params.id)
  const message = await sendMessage(id, currentUserId(req), req.validated as SendMessageInput)
  await broadcastMessage(id, message)
  res.status(201).json(message)
})

router.post('/:id/read', validate(markReadSchema), async (req, res) => {
  const id = parseConversationId(req.params.id)
  const input = req.validated as MarkReadInput
  res.json(await markRead(id, currentUserId(req), input.lastReadMessageId))
})

export default router