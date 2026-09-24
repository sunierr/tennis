// 图片上传：multipart 单文件、字段名固定 file。
// 前端（platform/upload.ts）已做同一套校验，这里再校验一次 —— 客户端校验只是体验，
// 服务端校验才是约束。落盘与 URL 拼接全部交给 storage 模块。

import type { NextFunction, Request, Response } from 'express'
import { Router } from 'express'
import multer from 'multer'
import { badRequest } from '../../lib/http-error'
import { requireAuth } from '../../middleware/auth'
import { uploadLimiter } from '../../middleware/rate-limit'
import { saveImage } from '../../storage'

const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']

// 内存存储：文件只过一遍手，落盘由 storage 统一负责（迁移 OSS 时这里零改动）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 1 },
  // 这道 mimetype 检查只是「早退」：mimetype 来自请求头，客户端能随便伪造。
  // 真正的判定在 storage.saveImage 里读文件头做内容嗅探。
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      callback(badRequest('只支持 jpg / png / webp 图片'))
      return
    }
    callback(null, true)
  },
})

// multer 的错误（超限、字段名不对）默认会落到 500，这里统一翻译成 400
function singleImage(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      next(badRequest(error.code === 'LIMIT_FILE_SIZE' ? '图片不能超过 5MB' : '图片上传失败，请重试'))
      return
    }
    next(error)
  })
}

const router = Router()

router.post('/', uploadLimiter, requireAuth, singleImage, async (req, res) => {
  if (!req.file) throw badRequest('请选择要上传的图片')
  res.status(201).json(await saveImage(req.file.buffer))
})

export default router