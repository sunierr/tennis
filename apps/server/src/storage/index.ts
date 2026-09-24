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

// 内容嗅探：只认文件头，不信客户端声明的 Content-Type。
// 客户端可以把任意文件标成 image/png 骗过 multer 的 mimetype 检查，
// 所以「是不是真图片」这件事必须由服务端读字节来判断。
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function sniffExtension(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg'
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return '.png'
  if (
    buffer.length >= 12 &&
    buffer.toString('latin1', 0, 4) === 'RIFF' &&
    buffer.toString('latin1', 8, 12) === 'WEBP'
  ) {
    return '.webp'
  }
  return null
}

// 反向校验用的文件名规则（随机文件名 + 白名单扩展名）
const STORED_NAME = /^[0-9a-f-]{36}\.(jpg|png|webp)$/

export interface StoredImage {
  url: string
  width: number
  height: number
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

// 这个 URL 是不是我们自己发出去的（上传接口的产物）。
// 光看文件名不够：https://evil.com/<uuid>.png 也能凑出合法的文件名，
// 所以要连 origin 与 /uploads 前缀一起校验。
export function isStoredImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.origin !== new URL(baseUrl()).origin) return false
    if (!parsed.pathname.startsWith(`${UPLOAD_URL_PREFIX}/`)) return false
    return storedNameFromUrl(url) !== null
  } catch {
    return false
  }
}

// 落盘并同时量出宽高：宽高给前端做占位防抖，所以拿不到尺寸就没必要收这个文件。
// 顺序是「先校验内容 → 再量尺寸 → 最后写盘」，任一环节失败都还没产生垃圾文件。
export async function saveImage(buffer: Buffer): Promise<StoredImage> {
  const extension = sniffExtension(buffer)
  if (!extension) throw badRequest('只支持 jpg / png / webp 图片')

  let size: { width?: number; height?: number }
  try {
    size = imageSize(buffer)
  } catch {
    throw badRequest('图片已损坏，请换一张再试')
  }
  if (!size.width || !size.height) throw badRequest('图片已损坏，请换一张再试')

  const filename = `${randomUUID()}${extension}`
  await writeFile(path.join(UPLOAD_DIR, filename), buffer)

  return { url: toPublicUrl(filename), width: size.width, height: size.height }
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