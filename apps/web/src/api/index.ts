// 平台无关的接口实例：把 web 的 axios adapter 注入 shared 的 createApi。
// 小程序侧只需换成 uni adapter，这里以及所有调用方零改动。

import { createApi } from '@shared/api/endpoints'
import { http } from '../platform/http'

export const api = createApi(http)
export type { Api } from '@shared/api/endpoints'