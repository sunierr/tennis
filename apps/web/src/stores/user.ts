import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AuthResponse, CurrentUser, LoginInput, RegisterInput, UpdateProfileInput } from '@shared/types/user'
import { api } from '../api'
import { clearToken, readToken, writeToken } from '../platform/storage'
import { setUnauthorizedHandler } from '../platform/http'
import { disconnect as disconnectRealtime } from '../platform/realtime'

export const useUserStore = defineStore('user', () => {
  // token 是「是否已登录」的唯一判据（守卫、header、报名都读它）
  const token = ref<string | null>(readToken())
  const user = ref<CurrentUser | null>(null)
  const needLevelSetup = ref(false)
  const hydrating = ref(false)

  const isLoggedIn = computed(() => Boolean(token.value))
  const levelTenths = computed(() => user.value?.levelTenths ?? null)
  const nickname = computed(() => user.value?.nickname ?? '')
  const city = computed(() => user.value?.city ?? null)

  function applySession(auth: AuthResponse): void {
    token.value = auth.token
    writeToken(auth.token)
    user.value = auth.user
    needLevelSetup.value = auth.user.levelTenths === null
  }

  function clearSession(): void {
    token.value = null
    clearToken()
    user.value = null
    needLevelSetup.value = false
    // 顺带断掉实时连接：token 已失效，带着它重连只是徒劳
    disconnectRealtime()
  }

  // 401 时由 http 层回调：清会话，页面据 isLoggedIn 自动回落到未登录形态
  setUnauthorizedHandler(clearSession)

  // 启动时用 token 换回用户信息：/users/me 是用户数据的唯一真相源
  async function hydrate(): Promise<void> {
    if (!token.value || hydrating.value) return
    hydrating.value = true
    try {
      const me = await api.users.me()
      user.value = me.user
      needLevelSetup.value = me.needLevelSetup
    } catch {
      // token 失效或服务不可用：不阻塞启动，先按未登录渲染
      clearSession()
    } finally {
      hydrating.value = false
    }
  }

  async function login(input: LoginInput): Promise<CurrentUser> {
    const auth = await api.auth.login(input)
    applySession(auth)
    return auth.user
  }

  async function register(input: RegisterInput): Promise<CurrentUser> {
    const auth = await api.auth.register(input)
    applySession(auth)
    return auth.user
  }

  async function updateProfile(input: UpdateProfileInput): Promise<CurrentUser> {
    const me = await api.users.updateMe(input)
    user.value = me.user
    needLevelSetup.value = me.needLevelSetup
    return me.user
  }

  function logout(): void {
    clearSession()
  }

  return {
    token,
    user,
    needLevelSetup,
    hydrating,
    isLoggedIn,
    levelTenths,
    nickname,
    city,
    hydrate,
    login,
    register,
    updateProfile,
    logout,
    clearSession,
  }
})