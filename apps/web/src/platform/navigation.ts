// 全站唯一的跳转接触点（迁移小程序 → uni.navigateTo，用 query string 传参）。
// 用路由 name 而不是 path：小程序 pages.json 的路径与 web 路由规则不同，
// 只写 name 才能让迁移时只改这一个文件。

import type { Router } from 'vue-router'
import type { RouteName } from '../router/routes'

export type RouteParams = Record<string, string | number>
export type RouteQuery = Record<string, string | number>

// router 由 main.ts 注入：navigation 只 import 类型（编译期擦除），
// 因此不会和 router/index.ts → pages → components → navigation 形成运行时环。
let routerRef: Router | null = null

export function setRouter(router: Router): void {
  routerRef = router
}

export function go(name: RouteName, params: RouteParams = {}, query?: RouteQuery): void {
  void routerRef?.push({ name, params, query })
}

export function replace(name: RouteName, params: RouteParams = {}, query?: RouteQuery): void {
  void routerRef?.replace({ name, params, query })
}

// 底栏切 tab 用 replace 而不是 push：tab 之间来回切不该把历史栈越堆越深，
// 语义等同小程序的 uni.switchTab（关掉所有非 tab 页）。
export function switchTab(name: RouteName): void {
  void routerRef?.replace({ name })
}

// 登录后回跳用：redirect 是守卫写下的完整路径，不是路由 name
export function goPath(path: string): void {
  void routerRef?.push(path)
}

export function goBack(fallback: RouteName = 'discover'): void {
  if (globalThis.history?.length > 1) {
    routerRef?.back()
    return
  }
  go(fallback)
}

// 当前地址，用于登录后回跳（守卫把 redirect 放进 query）
export function currentFullPath(): string {
  return routerRef?.currentRoute.value.fullPath ?? '/'
}