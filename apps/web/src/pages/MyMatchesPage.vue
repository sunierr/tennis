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

const matches = useMatchesStore()
const toast = useToast()

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
    const result = await api.me.matches({ pageSize: 50 })
    items.value = result.items
  } catch (caught) {
    error.value = errorMessage(caught, '加载失败')
    items.value = []
  } finally {
    loading.value = false
  }
}

async function onCancel(match: MatchListItem): Promise<void> {
  try {
    await matches.cancelMatch(match.id)
    toast.success('已取消该场约球')
    await load()
  } catch (caught) {
    toast.error(errorMessage(caught, '取消失败'))
  }
}
</script>

<template>
  <div class="container content">
    <header class="head">
      <h1>我发布的</h1>
      <p>管理你发起的球局：看看谁报名了，或取消这场约球。</p>
    </header>

    <div class="actions">
      <button class="btn btn--court" @click="go(ROUTE_NAMES.publish)">＋ 发布新约球</button>
    </div>

    <LoadingSkeleton v-if="loading && items.length === 0" :count="2" />
    <ul v-else-if="items.length > 0" class="rows">
      <MatchRow
        v-for="match in items"
        :key="match.id"
        :match="match"
        cancellable
        @select="go(ROUTE_NAMES.matchDetail, { id: $event })"
        @cancel="onCancel"
      />
    </ul>
    <EmptyState
      v-else
      :title="error ?? '还没有发布过约球'"
      :description="error ? '请稍后重试。' : '发起一场球局，邀请水平相近的球友一起上场。'"
    >
      <template #action>
        <button class="btn btn--court" @click="go(ROUTE_NAMES.publish)">发布约球</button>
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

.actions {
  display: flex;
  gap: var(--space-3);
  margin: var(--space-6) 0;
}

.rows {
  display: grid;
  gap: var(--space-4);
}
</style>