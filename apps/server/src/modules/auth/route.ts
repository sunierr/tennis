import { Router } from 'express'
import { validate } from '../../middleware/validate'
import type { LoginInput, RegisterInput } from '@shared/types/user'
import { loginSchema, registerSchema } from './schema'
import { login, register } from './service'

const router = Router()

// Express 5 会自动把 async rejection 交给 errorHandler，这里不写 try/catch
router.post('/register', validate(registerSchema), async (req, res) => {
  const result = await register(req.validated as RegisterInput)
  res.status(201).json(result)
})

router.post('/login', validate(loginSchema), async (req, res) => {
  res.json(await login(req.validated as LoginInput))
})

export default router