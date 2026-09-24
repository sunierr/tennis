<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { MATCH_FORMAT_LABELS, MATCH_STATUS_LABELS, SURFACE_LABELS, feeText } from '@shared/types/enums'
import { formatLevel } from '@shared/level/ntrp'
import { formatFullTime } from '@shared/time/format'
import { useMatchesStore } from '../stores/matches'
import { useUserStore } from '../stores/user'
import { api } from '../api'
import { useToast } from '../composables/useToast'
import { errorMessage } from '../utils/error'
import { go } from '../platform/navigation'
import { ROUTE_NAMES } from '../router/routes'
import AuthPanel from '../components/auth/AuthPanel.vue'
import LevelDots from '../components/level/LevelDots.vue'
import LevelFitBadge from '../components/level/LevelFitBadge.vue'
import EmptyState from '../components/ui/EmptyState.vue'

const route = useRoute()
const matches = useMatchesStore()
const user = useUserStore()
const toast = useToast()

const matchId = Number(route.params.id)
const showAuth = ref(false)
const busy = ref(false)
const notFound = ref(false)

const match = computed(() => matches.detail)
const feeLabel = computed(() => (match.value ? feeText(match.value.feeType, match.value.fee) : ''))

onMounted(load)

async function load(): Promise<void> {
  const result = await matches.fetchDetail(matchId)
  notFound.value = !result
}

// 我的报名状态以服务端为准；未登录时无状态
const myStatus = computed(() => (user.isLoggedIn ? (match.value?.myParticipantStatus ?? null) : null))
const isCreator = computed(() => Boolean(match.value && user.user?.id === match.value.creator.id))
const isOpen = computed(() => match.value?.status === 'OPEN')

const canJoin = computed(() => {
  const current = match.value
  if (!current || !isOpen.value || isCreator.value) return false
  return myStatus.value !== 'JOINED' && !current.isFull
})

const joinLabel = computed(() => {
  const current = match.value
  if (!current) return '报名'
  if (myStatus.value === 'JOINED') return '退出报名'
  if (current.isFull) return '已满员'
  return '报名'
})

async function withBusy(action: () => Promise<void>): Promise<void> {
  busy.value = true
  try {
    await action()
  } catch (caught) {
    toast.error(errorMessage(caught))
  } finally {
    busy.value = false
  }
}

function onPrimaryAction(): void {
  const current = match.value
  if (!current) return
  if (!user.isLoggedIn) {
    showAuth.value = true
    return
  }
  if (isCreator.value) return

  if (myStatus.value === 'JOINED') {
    void withBusy(async () => {
      await matches.leave(current.id)
      toast.success('已退出报名')
      await load()
    })
    return
  }
  void withBusy(async () => {
    await matches.join(current.id)
    toast.success('已报名，等你上场！')
    await load()
  })
}

function onCancel(): void {
  const current = match.value
  if (!current) return
  void withBusy(async () => {
    await matches.cancelMatch(current.id)
    toast.success('已取消该场约球')
    await load()
  })
}

function onAuthSuccess(): void {
  showAuth.value = false
  toast.success('已登录')
  void load()
}

// —— 聊天入口：群聊 + 私聊发起人 ——
const chat = computed(() => match.value?.myConversations ?? null)
// 有群 + 自己是有效组员（报名中）才让进；退出报名后 groupJoined 变 false，按钮自动置灰
const canEnterGroup = computed(() => Boolean(chat.value?.groupId && chat.value.groupJoined))
// 群人数与报名中的参与者数一致（发起人也算一名，建局时同步入群）
const groupLabel = computed(() => {
  if (!chat.value?.groupId) return '暂未开启群聊'
  if (!chat.value.groupJoined) return '报名后可加入群聊'
  return `进群聊 · ${match.value?.participantCount ?? 0} 人`
})

function onGroupChat(): void {
  if (!user.isLoggedIn) {
    showAuth.value = true
    return
  }
  const groupId = chat.value?.groupId
  if (!groupId) return
  // 按钮保持可点（未登录要能弹登录面板），非组员用提示代替静默无反应
  if (!chat.value?.groupJoined) {
    toast.error('报名后可加入群聊')
    return
  }
  go(ROUTE_NAMES.conversation, { id: groupId })
}

// 私聊发起人：已聊过直接进，否则先幂等地取/建单聊会话
function onDirectChat(): void {
  const current = match.value
  if (!current || isCreator.value) return
  if (!user.isLoggedIn) {
    showAuth.value = true
    return
  }
  const existing = chat.value?.directWithCreatorId
  if (existing) {
    go(ROUTE_NAMES.conversation, { id: existing })
    return
  }
  void withBusy(async () => {
    const conversation = await api.conversations.direct({ userId: current.creator.id })
    // 记住会话 id：下次点击直接跳转，不必再打一次请求
    if (match.value) match.value.myConversations.directWithCreatorId = conversation.id
    go(ROUTE_NAMES.conversation, { id: conversation.id })
  })
}
</script>

<template>
  <div class="container content">
    <template v-if="match">
      <header class="head">
        <div class="head-main">
          <span class="tag" :class="isOpen ? '' : 'tag--muted'">{{ MATCH_STATUS_LABELS[match.status] }}</span>
          <h1>{{ match.title }}</h1>
          <p class="time num">{{ formatFullTime(match.startsAt) }} · 约 {{ match.durationMinutes / 60 }} 小时</p>
        </div>
        <div class="head-side">
          <p class="fee">{{ feeLabel }}</p>
          <p class="fee-copy">球场费用</p>
        </div>
      </header>

      <div class="layout">
        <section class="card panel">
          <h2>球局信息</h2>
          <ul class="facts">
            <li>
              <span class="icon-chip">⌖</span>
              <span><b>{{ match.venue }}</b><template v-if="match.venueAddress"> · {{ match.venueAddress }}</template></span>
            </li>
            <li><span class="icon-chip">◉</span><span>{{ match.city }} · {{ MATCH_FORMAT_LABELS[match.format] }} · {{ SURFACE_LABELS[match.surface] }}</span></li>
            <li>
              <span class="icon-chip">◆</span>
              <span class="level-line">
                {{ match.levelLabel }}
                <LevelDots :min="match.levelMinTenths" :max="match.levelMaxTenths" size="sm" />
                <LevelFitBadge
                  :fit="match.levelFit"
                  :my-level-tenths="user.levelTenths"
                  :min="match.levelMinTenths"
                  :max="match.levelMaxTenths"
                />
              </span>
            </li>
            <li v-if="match.beginnerFriendly"><span class="icon-chip">✓</span><span>新手友好</span></li>
            <li v-if="match.participantsLevelAvg !== null">
              <span class="icon-chip">Σ</span>
              <span class="num">队内均 {{ formatLevel(match.participantsLevelAvg) }} 级</span>
            </li>
          </ul>

          <template v-if="match.notes">
            <h2 class="mt">发起人留言</h2>
            <p class="notes">{{ match.notes }}</p>
          </template>

          <h2 class="mt">已报名球友（{{ match.participantCount }} / {{ match.capacity }}）</h2>
          <ul class="players">
            <!-- 发起人现在也是参与者行，这里统一渲染，不再单独列一行以免重复 -->
            <li v-for="participant in match.participants" :key="participant.id" class="player">
              <span class="avatar" :class="{ 'is-ball': !participant.isCreator }">
                {{ participant.nickname.slice(0, 1).toUpperCase() }}
              </span>
              <span class="player-name">{{ participant.nickname }}</span>
              <span v-if="participant.isCreator" class="tag tag--muted">发起人</span>
              <span class="player-level num">{{ formatLevel(participant.levelTenths) }} 级</span>
              <!-- 私聊入口挂在发起人这一行；自己就是发起人时不给（不能和自己聊） -->
              <button
                v-if="participant.isCreator && !isCreator"
                class="btn btn--ghost chat-btn"
                :disabled="busy"
                @click="onDirectChat"
              >
                私聊
              </button>
            </li>
            <li v-if="match.participantCount <= 1" class="muted">还没有球友报名，来做第一个吧。</li>
          </ul>
        </section>

        <aside class="card action">
          <p class="action-count num">{{ match.participantCount }} / {{ match.capacity }} 人</p>
          <p class="action-copy">
            {{ match.isFull ? '名额已满' : `还差 ${match.spotsLeft} 人成局` }}
          </p>

          <button
            v-if="!isCreator && isOpen"
            class="btn btn--court full"
            :disabled="busy || (!canJoin && myStatus !== 'JOINED')"
            @click="onPrimaryAction"
          >
            {{ busy ? '处理中…' : joinLabel }}
          </button>

          <button v-if="isCreator && isOpen" class="btn btn--ghost full" :disabled="busy" @click="onCancel">
            {{ busy ? '处理中…' : '取消这场约球' }}
          </button>

          <!-- 群聊入口：非组员置灰但仍可点（未登录弹登录面板，已登录给提示） -->
          <button
            class="btn btn--ghost full"
            :class="{ 'is-locked': !canEnterGroup }"
            :aria-disabled="!canEnterGroup"
            @click="onGroupChat"
          >
            {{ groupLabel }}
          </button>

          <p v-if="isCreator" class="action-note">你是发起人，无需报名。</p>
          <p v-else-if="!isOpen" class="action-note">{{ MATCH_STATUS_LABELS[match.status] }}，无法再报名。</p>
          <p v-else-if="!user.isLoggedIn" class="action-note">登录后即可报名。</p>
        </aside>
      </div>
    </template>

    <EmptyState
      v-else
      :title="matches.detailLoading ? '正在加载球局…' : notFound ? '这场约球不存在或已被删除' : '加载失败'"
      :description="notFound ? '它可能已经被发起人取消。' : ''"
    >
      <template #action>
        <button class="btn btn--court" @click="go(ROUTE_NAMES.discover)">回到发现页</button>
      </template>
    </EmptyState>

    <AuthPanel v-if="showAuth" @close="showAuth = false" @success="onAuthSuccess" />
  </div>
</template>

<style scoped>
.content {
  padding-top: var(--space-6);
  padding-bottom: var(--space-8);
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: var(--space-5);
  flex-wrap: wrap;
  margin-bottom: var(--space-6);
}

.head-main h1 {
  font-size: var(--text-xl);
  letter-spacing: -0.05em;
  margin: var(--space-4) 0 var(--space-2);
}

.time {
  color: var(--muted);
  font-size: var(--text-base);
}

.head-side {
  text-align: right;
}

.fee {
  font-size: var(--text-xl);
  font-weight: 850;
  color: var(--court);
}

.fee-copy {
  color: var(--muted);
  font-size: var(--text-xs);
}

.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: var(--space-5);
  align-items: start;
}

.panel {
  padding: var(--space-6);
}

h2 {
  font-size: var(--text-md);
  letter-spacing: -0.03em;
  margin-bottom: var(--space-4);
}

.mt {
  margin-top: var(--space-6);
}

.facts {
  display: grid;
  gap: var(--space-3);
  color: var(--muted);
  font-size: var(--text-base);
}

.facts li {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.facts b {
  color: var(--ink);
}

.level-line {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.notes {
  color: var(--ink);
  background: var(--paper);
  border-radius: var(--radius-sm);
  padding: var(--space-5);
  line-height: 1.7;
}

.players {
  display: grid;
  gap: var(--space-3);
}

.player {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--line);
  font-size: var(--text-base);
}

.avatar {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex: none;
  border-radius: 50%;
  background: var(--sand);
  color: var(--court);
  font-size: var(--text-sm);
  font-weight: 800;
}

.avatar.is-ball {
  background: var(--ball);
}

.player-name {
  font-weight: 700;
}

.player-level {
  margin-left: auto;
  color: var(--muted);
  font-size: var(--text-sm);
}

.chat-btn {
  margin-left: var(--space-3);
  padding: 0 var(--space-4);
  font-size: var(--text-sm);
}

.muted {
  color: var(--muted);
  font-size: var(--text-sm);
}

.action {
  padding: var(--space-6);
  display: grid;
  gap: var(--space-2);
}

.action-count {
  font-size: var(--text-lg);
  font-weight: 850;
  color: var(--court);
}

.action-copy {
  color: var(--muted);
  font-size: var(--text-sm);
  margin-bottom: var(--space-4);
}

.full {
  width: 100%;
}

/* 置灰但仍可点：未登录要能弹出登录面板，所以不用 disabled */
.is-locked {
  opacity: 0.5;
}

.action-note {
  color: var(--muted);
  font-size: var(--text-xs);
}

@media (max-width: 800px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>