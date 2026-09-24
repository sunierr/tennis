// 环境变量唯一入口：先 dotenv 读 .env，再用 zod 校验，缺失即启动失败（而不是跑起来才报错）。
import 'dotenv/config'
import { z } from 'zod'

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL 不能为空'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET 至少需要 32 位'),
    PORT: z.coerce.number().int().positive().default(3000),
    // 逗号分隔的白名单；不填则允许所有来源（开发期方便，生产必须填）
    CORS_ORIGIN: z.string().optional(),
    // 上传文件的对外基地址：拼成绝对 URL 返回给前端（小程序没有「当前域名」概念，
    // 相对路径的 /uploads/x.jpg 在 <image> 里加载不出来）。
    PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  })
  .superRefine((value, ctx) => {
    // 开发期不填 CORS_ORIGIN 等于放开所有来源，这个便利不能带进生产：
    // 忘了配就直接启动失败，好过静默地对全世界开放。
    if (value.NODE_ENV === 'production' && !value.CORS_ORIGIN?.trim()) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ORIGIN'],
        message: '生产环境必须配置 CORS_ORIGIN（逗号分隔的来源白名单）',
      })
    }
  })

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('[env] 环境变量校验失败，请检查 apps/server/.env：')
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
  }
  process.exit(1)
}

export const env = parsed.data

export const isProduction = env.NODE_ENV === 'production'