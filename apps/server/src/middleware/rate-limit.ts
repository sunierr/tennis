// 请求限流：按来源 IP 的固定窗口计数。
//
// 定位是「防脚本」而不是「防用户」——阈值都放得比正常人手速宽得多，
// 真正需要按人区分的场景（同一用户 60 秒只能发一帖）由 posts/service 用
// 数据库行锁兜底，见 createPost。
//
// 计数存内存：单实例够用；多实例部署需要换成共享 store（如 rate-limit-redis），
// 否则每个实例各算一份，实际阈值会被实例数放大。这一取舍与 WS 单进程一致。

import type { RequestHandler } from 'express'
import rateLimit from 'express-rate-limit'
import { tooManyRequests } from '../lib/http-error'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

function createLimiter(windowMs: number, limit: number, message: string): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // 不用库自带的 429 响应体：交给 errorHandler 统一组装 {code, message}
    handler: (_req, _res, next) => next(tooManyRequests(message)),
  })
}

// 认证接口是暴力破解的入口，这里是最该限的地方：单 IP 5 分钟 10 次足够正常人试错
export const loginLimiter = createLimiter(5 * MINUTE, 10, '登录尝试过于频繁，请 5 分钟后再试')
export const registerLimiter = createLimiter(HOUR, 5, '注册过于频繁，请稍后再试')

// 上传要连续 9 张图，窗口内额度必须大于九宫格上限
export const uploadLimiter = createLimiter(MINUTE, 30, '上传过于频繁，请稍后再试')
export const postCreateLimiter = createLimiter(MINUTE, 20, '发帖过于频繁，请稍后再试')
export const commentLimiter = createLimiter(MINUTE, 20, '评论过于频繁，请稍后再试')
export const messageLimiter = createLimiter(MINUTE, 60, '发消息过于频繁，请稍后再试')
