import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../stores/user'
import { ROUTE_NAMES, routes } from './routes'

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

// 守卫只判断「有没有 token」，不校验有效性：token 失效由 hydrate / 401 回调统一清理
router.beforeEach((to) => {
  if (!to.meta.requiresAuth) return true
  const user = useUserStore()
  if (user.token) return true
  return { name: ROUTE_NAMES.login, query: { redirect: to.fullPath } }
})

export { ROUTE_NAMES }
export type { RouteName } from './routes'