<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { MatchListItem } from '@shared/types/match'
import { api } from '../api'
import { useMatchesStore } from '../stores/matches'
import { useToast } from '../composables/useToast'
import { errorMessage } from '../utils/error'
import { go } from '../platform/navigation'
import { ROUTE_NAMES } from '../router/routes'
import EmptyState from '../components/ui/EmptyState.vue'
import LoadingSkeleton from '../components/ui/LoadingSkeleton.vue'
import MatchRow from '../components/match/MatchRow.vue'

type Scope = 'upcoming' | 'past'

const matches = useMatchesStore()
const toast = useToast()

const scope = ref<Scope>('upcoming')
const items = ref<MatchListItem[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

onMounted(() => {
  void load()
})

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const result = await api.me.registrations({ scope: scope.value, pageSize: 50 })
    items.value = result.items
  } catch (caught) {
    error.value = errorMessage(caught, '加载失败')
    items.value = []
  } finally {
    loading.value = false
  }
}

function switchScope(next: Scope): void {
  if (next === scope.value) return
  scope.value = next
  void load()
}

async function onLeave(match: MatchListItem): Promise<void> {
  try {
    await matches.leave(match.id)
    toast.success('已退出报名')
    await load()
  } catch (caught) {
    toast.error(errorMessage(caught, '退出失败'))
  }
}
</script>

<template>
  <div class="container content">
    <header class="head">
      <h1>我的报名</h1>
      <p>这里是你报名过的球局，记得准时上场。</p>
    </header>

    <div class="filters">
      <button class="chip" :class="{ 'is-active': scope === 'upcoming' }" @click="switchScope('upcoming')">
        即将开始
      </button>
      <button class="chip" :class="{ 'is-active': scope === 'past' }" @click="switchScope('past')">已结束</button>
    </div>

    <LoadingSkeleton v-if="loading && items.length === 0" :count="2" />
    <ul v-else-if="items.length > 0" class="rows">
      <MatchRow
        v-for="match in items"
        :key="match.id"
        :match="match"
        joined
        @select="go(ROUTE_NAMES.matchDetail, { id: $event })"
        @leave="onLeave"
      />
    </ul>
    <EmptyState
      v-else
      :title="error ?? (scope === 'upcoming' ? '还没有报名任何球局' : '没有已结束的报名')"
      :description="error ? '请稍后重试。' : '去发现页看看，找一场水平相近的球局。'"
    >
      <template #action>
        <button class="btn btn--court" @click="go(ROUTE_NAMES.discover)">去发现约球</button>
      </template>
    </EmptyState>
  </div>
</template>

<style scoped>
.content {
  padding-top: var(--space-7);
  padding-bottom: var(--space-8);
}

h1 {
  font-size: var(--text-xl);
  letter-spacing: -0.05em;
}

.head p {
  color: var(--muted);
  font-size: var(--text-base);
  margin-top: var(--space-2);
}

.filters {
  display: flex;
  gap: var(--space-2);
  margin: var(--space-6) 0;
}

.rows {
  display: grid;
  gap: var(--space-4);
}
</style>