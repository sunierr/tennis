import { z } from 'zod'
import { POST_IMAGE_MAX, POST_TAG_MAX } from '@shared/types/enums'
import { badRequest } from '../../lib/http-error'
import { isStoredImageUrl } from '../../storage'

export const postListQuerySchema = z.object({
  tag: z.string().trim().min(1).max(20).optional(),
  authorId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
})

// 图片地址必须是我们自己上传接口给出的绝对地址：
// 1）不接相对路径与 data URL —— 小程序 <image> 加载不出来，会出现「web 能看、小程序空白」的隐性差异；
// 2）不接任意外链 —— 否则发帖人可以让所有读者的浏览器去加载他指定的域，等于站内追踪器。
const imageUrl = z
  .string()
  .trim()
  .max(255, '图片地址过长')
  .refine((value) => isStoredImageUrl(value), '图片地址不合法，请重新上传')

// 标签：自由输入，去空格后按 name 入库；最多 3 个、单个最长 20 字（与 VarChar(20) 对齐）
const tagName = z.string().trim().min(1, '标签不能为空').max(20, '标签最长 20 字')

export const createPostSchema = z
  .object({
    // 纯图帖是允许的，所以正文不做 min(1) —— 「至少要有内容」交给下面的 refine 统一判，
    // 否则这条字段级校验会先把纯图帖拦掉，refine 的图片分支永远走不到。
    content: z.string().trim().max(2000, '正文最长 2000 字').default(''),
    imageUrls: z.array(imageUrl).max(POST_IMAGE_MAX, `最多上传 ${POST_IMAGE_MAX} 张图片`).default([]),
    tags: z.array(tagName).max(POST_TAG_MAX, `最多添加 ${POST_TAG_MAX} 个标签`).default([]),
  })
  // 纯图或纯文字都行，但不能两者皆空
  .refine((value) => value.content.length > 0 || value.imageUrls.length > 0, {
    message: '请填写正文或添加图片',
    path: ['content'],
  })

export const createCommentSchema = z.object({
  content: z.string().trim().min(1, '评论不能为空').max(500, '评论最长 500 字'),
})

// 路由里路径参数一律经此解析：失败即 400，而不是把 NaN 丢给 Prisma
export function parsePostId(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw badRequest('帖子 ID 不正确')
  return id
}