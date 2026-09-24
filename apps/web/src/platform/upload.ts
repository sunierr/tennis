// 全站唯一上传点（迁移小程序 → uni.uploadFile）。
// 前端校验只是为了快速反馈，服务端仍会按同一套约束再校验一次。

import { PATHS } from '@shared/api/endpoints'
import { ApiError } from '@shared/http/client'
import { postForm } from './http'

export interface UploadResult {
  url: string
  width?: number
  height?: number
}

const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function uploadImage(file: File): Promise<UploadResult> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new ApiError(400, 'VALIDATION_ERROR', '只支持 jpg / png / webp 图片')
  }
  if (file.size > MAX_SIZE) {
    throw new ApiError(400, 'VALIDATION_ERROR', '图片不能超过 5MB')
  }

  const form = new FormData()
  // 字段名与后端 multer 约定一致；文件名由服务端随机生成（避免路径穿越与中文名问题）
  form.append('file', file)
  return postForm<UploadResult>(PATHS.uploads, form)
}