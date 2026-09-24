<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useUserStore } from '../stores/user'
import { go, goPath } from '../platform/navigation'
import { ROUTE_NAMES } from '../router/routes'
import AuthPanel from '../components/auth/AuthPanel.vue'

// 独立登录页：既服务于直访 /login，也承接守卫「requiresAuth → /login?redirect=…」
const route = useRoute()
const user = useUserStore()

const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''

function onSuccess(): void {
  if (redirect) {
    goPath(redirect)
    return
  }
  go(ROUTE_NAMES.discover)
}
</script>

<template>
  <div class="container content">
    <div v-if="user.isLoggedIn" class="card done">
      <h1>你已经登录了</h1>
      <p class="copy">当前账号：{{ user.nickname }}</p>
      <div class="actions">
        <button class="btn btn--ghost" @click="go(ROUTE_NAMES.profile)">查看个人资料</button>
        <button class="btn btn--court" @click="go(ROUTE_NAMES.discover)">去找球局</button>
      </div>
    </div>
    <AuthPanel v-else @close="go(ROUTE_NAMES.discover)" @success="onSuccess" />
  </div>
</template>

<style scoped>
.content {
  padding-top: var(--space-7);
  padding-bottom: var(--space-8);
  display: flex;
  justify-content: center;
}

.done {
  padding: var(--space-6);
  width: min(420px, 100%);
  text-align: center;
}

h1 {
  font-size: var(--text-xl);
  letter-spacing: -0.05em;
}

.copy {
  color: var(--muted);
  font-size: var(--text-base);
  margin: var(--space-4) 0 var(--space-6);
}

.actions {
  display: flex;
  justify-content: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
</style>