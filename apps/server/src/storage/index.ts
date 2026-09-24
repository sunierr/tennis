// 全站唯一的文件存储接触点（迁移 OSS 时只改这个文件）。
// 当前实现：本地磁盘 apps/server/uploads + express.static 对外提供。
//
// 两条硬约束：
// 1. 返回给前端的必须是绝对 URL（PUBLIC_BASE_URL 拼接）—— 小程序 <image> 没有
//    「当前域名」概念，相对路径 /uploads/x.jpg 加载不出来；
// 2. 文件名由服务端随机生成，不接受客户端传来的名字 —— 从根上杜绝路径穿越与
//    中文名/空格带来的兼容问题。

import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { imageSize } from 'image-size'
import { env } from '../env'
import { badRequest } from '../lib/http-error'

// uploads 目录与进程工作目录绑定（apps/server/uploads），启动时自动创建
export const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads')
export const UPLOAD_URL_PREFIX = '/uploads'

// 白名单：值即落盘扩展名。不在此表里的 mime 一律拒绝。
const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

// 反向校验用的文件名规则（随机文件名 + 白名单扩展名）
const STORED_NAME = /^[0-9a-f-]{36}\.(jpg|png|webp)$/

export interface StoredImage {
  url: string
  width: number | null
  height: number | null
}

export function ensureUploadDir(): void {
  mkdirSync(UPLOAD_DIR, { recursive: true })
}

function baseUrl(): string {
  return env.PUBLIC_BASE_URL.replace(/\/+$/, '')
}

export function toPublicUrl(filename: string): string {
  return `${baseUrl()}${UPLOAD_URL_PREFIX}/${filename}`
}

// 只认自己发出去的 URL：外部地址（例如种子里的网图）不参与删除与测量
function storedNameFromUrl(url: string): string | null {
  const name = url.split('?')[0]?.split('/').pop() ?? ''
  return STORED_NAME.test(name) ? name : null
}

// 落盘并同时量出宽高：宽高用于前端占位防抖，量不出来也不影响上传成功
export async function saveImage(buffer: Buffer, mime: string): Promise<StoredImage> {
  const extension = MIME_EXTENSION[mime]
  if (!extension) throw badRequest('只支持 jpg / png / webp 图片')

  const filename = `${randomUUID()}${extension}`
  await writeFile(path.join(UPLOAD_DIR, filename), buffer)

  let width: number | null = null
  let height: number | null = null
  try {
    const size = imageSize(buffer)
    width = size.width ?? null
    height = size.height ?? null
  } catch {
    // 损坏或非图片内容：文件已落盘，宽高留空
  }

  return { url: toPublicUrl(filename), width, height }
}

// 帖子落库时为每张图补宽高（客户端只回传 url，尺寸不想让前端说了算）。
// 外部 URL 或文件已被清理时返回 null —— 前端会退化成固定比例，不影响展示。
export async function measureStoredImage(url: string): Promise<{ width: number | null; height: number | null } | null> {
  const name = storedNameFromUrl(url)
  if (!name) return null
  try {
    const size = imageSize(await readFile(path.join(UPLOAD_DIR, name)))
    return { width: size.width ?? null, height: size.height ?? null }
  } catch {
    return null
  }
}