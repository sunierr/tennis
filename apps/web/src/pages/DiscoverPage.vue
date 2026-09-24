<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { MatchListItem } from '@shared/types/match'
import { useMatchesStore, type FilterKey } from '../stores/matches'
import { useUserStore } from '../stores/user'
import { useToast } from '../composables/useToast'
import { errorMessage } from '../utils/error'
import { go } from '../platform/navigation'
import { ROUTE_NAMES } from '../router/routes'
import CourtBackdrop from '../components/brand/CourtBackdrop.vue'
import FilterChips from '../components/match/FilterChips.vue'
import MatchCard from '../components/match/MatchCard.vue'
import AuthPanel from '../components/auth/AuthPanel.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import LoadingSkeleton from '../components/ui/LoadingSkeleton.vue'

const matches = useMatchesStore()
const user = useUserStore()
const toast = useToast()

const showAuth = ref(false)
// 未登录点报名时先记住意图，登录成功后自动续上
const pendingJoin = ref<MatchListItem | null>(null)

onMounted(() => {
  if (matches.items.length === 0) void matches.fetchList()
})

function scrollToExplore(): void {
  document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function toggleFilter(key: FilterKey): void {
  const next = matches.hasFilter(key)
    ? matches.filters.filter((current) => current !== key)
    : [...matches.filters, key]
  void matches.applyFilters(next)
}

function clearFilters(): void {
  void matches.applyFilters([])
}

async function performJoin(match: MatchListItem): Promise<void> {
  try {
    await matches.join(match.id)
    toast.success('已报名，等你上场！')
  } catch (caught) {
    toast.error(errorMessage(caught, '报名失败'))
  }
}

function onJoin(match: MatchListItem): void {
  if (!user.isLoggedIn) {
    pendingJoin.value = match
    showAuth.value = true
    return
  }
  void performJoin(match)
}

// 「水平合适」chip 需要登录用户的水平，未登录时先弹面板、不记挂报名意图
function onRequireLogin(): void {
  pendingJoin.value = null
  showAuth.value = true
}

function onAuthSuccess(): void {
  showAuth.value = false
  const pending = pendingJoin.value
  pendingJoin.value = null
  if (!pending) {
    toast.success('欢迎来到 Match Point')
    return
  }
  const fresh = matches.items.find((item) => item.id === pending.id) ?? pending
  void performJoin(fresh)
}
</script>

<template>
  <div>
    <section class="hero">
      <CourtBackdrop />
      <div class="hero-inner container">
        <p class="eyebrow">Find your next rally</p>
        <h1>今天，和同频的人<br />打场好球。</h1>
        <p class="hero-copy">浏览附近的网球约球，找到合适的场地、时间和球友。轻松发起，随时加入。</p>
        <div class="hero-actions">
          <button class="btn btn--primary" @click="go(ROUTE_NAMES.publish)">＋ 发布约球</button>
          <button class="btn btn--outline" @click="scrollToExplore">探索附近球局</button>
        </div>
      </div>
    </section>

    <main id="explore" class="content container">
      <div v-if="user.isLoggedIn && user.needLevelSetup" class="notice">
        <div>
          <p class="notice-title">还差一步：填写自评水平</p>
          <p class="notice-copy">有了自评水平，才能帮你匹配水平相近的球友。</p>
        </div>
        <button class="btn btn--court" @click="go(ROUTE_NAMES.profile)">去填写</button>
      </div>

      <div class="section-head">
        <div>
          <h2>附近的约球</h2>
          <p v-if="matches.loading">正在为你找球局…</p>
          <p v-else>共找到 {{ matches.total }} 场正在招募的球局</p>
        </div>
      </div>

      <FilterChips
        :active="matches.filters"
        :logged-in="user.isLoggedIn"
        @toggle="toggleFilter"
        @clear="clearFilters"
        @require-login="onRequireLogin"
      />

      <LoadingSkeleton v-if="matches.loading && matches.items.length === 0" />
      <div v-else-if="matches.items.length > 0" class="grid">
        <MatchCard
          v-for="match in matches.items"
          :key="match.id"
          :match="match"
          :pulsing="matches.pulseId === match.id"
          :my-level-tenths="user.levelTenths"
          @select="go(ROUTE_NAMES.matchDetail, { id: $event })"
          @join="onJoin"
        />
      </div>
      <EmptyState
        v-else
        :title="matches.error ?? '暂时没有符合条件的球局'"
        :description="matches.error ? '请稍后重试，或换个城市看看。' : '试试放宽筛选条件，或自己发起一场。'"
      >
        <template #action>
          <button class="btn btn--ghost" @click="clearFilters">清空筛选</button>
          <button class="btn btn--court" @click="go(ROUTE_NAMES.publish)">发布约球</button>
        </template>
      </EmptyState>

      <div v-if="matches.hasMore && matches.items.length > 0" class="more">
        <button class="btn btn--ghost" :disabled="matches.loading" @click="matches.loadMore()">
          {{ matches.loading ? '加载中…' : '加载更多' }}
        </button>
      </div>
    </main>

    <AuthPanel v-if="showAuth" @close="showAuth = false" @success="onAuthSuccess" />
  </div>
</template>

<style scoped>
.hero {
  position: relative;
  overflow: hidden;
  background: var(--court);
  color: var(--white);
}

.hero-inner {
  position: relative;
  z-index: 1;
  padding-top: var(--space-8);
  padding-bottom: var(--space-8);
}

.eyebrow {
  color: var(--ball);
  font-size: var(--text-xs);
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

h1 {
  font-size: var(--text-hero);
  line-height: 0.98;
  letter-spacing: -0.07em;
  margin: var(--space-4) 0 var(--space-5);
  max-width: 680px;
}

.hero-copy {
  color: #c9dbd4;
  line-height: 1.65;
  max-width: 520px;
  font-size: var(--text-md);
}

.hero-actions {
  display: flex;
  gap: var(--space-4);
  margin-top: var(--space-6);
  flex-wrap: wrap;
}

.btn--outline {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: var(--white);
}

.content {
  padding-top: var(--space-7);
  padding-bottom: var(--space-8);
}

.notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
  flex-wrap: wrap;
  background: var(--white);
  border: 1px solid var(--ball);
  border-radius: var(--radius-card);
  padding: var(--space-5);
  margin-bottom: var(--space-6);
}

.notice-title {
  font-weight: 850;
  letter-spacing: -0.03em;
}

.notice-copy {
  color: var(--muted);
  font-size: var(--text-sm);
  margin-top: var(--space-1);
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: var(--space-5);
  margin-bottom: var(--space-5);
  flex-wrap: wrap;
}

h2 {
  font-size: var(--text-xl);
  letter-spacing: -0.05em;
}

.section-head p {
  color: var(--muted);
  font-size: var(--text-base);
  margin-top: var(--space-2);
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-5);
}

.more {
  display: flex;
  justify-content: center;
  margin-top: var(--space-6);
}

@media (max-width: 800px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 560px) {
  .grid {
    grid-template-columns: 1fr;
  }

  .section-head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>