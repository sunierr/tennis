import { Router } from 'express'
import { validate } from '../../middleware/validate'
import { loginLimiter, registerLimiter } from '../../middleware/rate-limit'
import type { LoginInput, RegisterInput } from '@shared/types/user'
import { loginSchema, registerSchema } from './schema'
import { login, register } from './service'

const router = Router()

// Express 5 会自动把 async rejection 交给 errorHandler，这里不写 try/catch
// 限流放在 validate 之前：格式错误的垃圾请求也不该绕过计数
router.post('/register', registerLimiter, validate(registerSchema), async (req, res) => {
  const result = await register(req.validated as RegisterInput)
  res.status(201).json(result)
})

router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  res.json(await login(req.validated as LoginInput))
})

export default router