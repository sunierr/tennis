<script setup lang="ts">
// 消息 tab：群聊与单聊混排，靠类型标识区分。
// 消息靠 WS 推送触发「重新拉一次列表」——列表是真相，推送只负责提醒。
import { onMounted, onUnmounted, ref } from 'vue'
import type { ConversationListItem } from '@shared/types/chat'
import { CONVERSATION_TYPE_LABELS } from '@shared/types/enums'
import { formatChatTime } from '@shared/time/format'
import { api } from '../api'
import { go, switchTab } from '../platform/navigation'
import { subscribeAll } from '../platform/realtime'
import { ROUTE_NAMES } from '../router/routes'
import { useToast } from '../composables/useToast'
import { errorMessage } from '../utils/error'
import EmptyState from '../components/ui/EmptyState.vue'
import LoadingSkeleton from '../components/ui/LoadingSkeleton.vue'

const toast = useToast()

const items = ref<ConversationListItem[]>([])
const loading = ref(false)
// 连续多条推送只刷一次列表
const REFRESH_DEBOUNCE = 400
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let unsubscribe: (() => void) | null = null

onMounted(async () => {
  await load()
  unsubscribe = subscribeAll(scheduleRefresh)
})

onUnmounted(() => {
  unsubscribe?.()
  if (refreshTimer !== null) clearTimeout(refreshTimer)
})

async function load(): Promise<void> {
  loading.value = true
  try {
    items.value = await api.conversations.list()
  } catch (caught) {
    toast.error(errorMessage(caught))
  } finally {
    loading.value = false
  }
}

function scheduleRefresh(): void {
  if (refreshTimer !== null) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    refreshTimer = null
    void load()
  }, REFRESH_DEBOUNCE)
}

function open(item: ConversationListItem): void {
  go(ROUTE_NAMES.conversation, { id: item.id })
}

function preview(item: ConversationListItem): string {
  const last = item.lastMessage
  if (!last) return '还没有人说话'
  const body = last.type === 'IMAGE' ? '[图片]' : last.content
  return `${last.senderNickname}：${body}`
}
</script>

<template>
  <div class="container content">
    <LoadingSkeleton v-if="loading && items.length === 0" :count="3" />

    <ul v-else-if="items.length > 0" class="list">
      <li v-for="item in items" :key="item.id">
        <button class="card row" @click="open(item)">
          <span class="avatar" :class="item.type === 'GROUP' ? 'avatar--group' : 'avatar--peer'">
            {{ item.type === 'GROUP' ? '群' : item.title.slice(0, 1).toUpperCase() }}
          </span>
          <span class="body">
            <span class="line line--top">
              <span class="title">{{ item.title }}</span>
              <span class="time num">{{ formatChatTime(item.lastMessageAt ?? '') }}</span>
            </span>
            <span class="line">
              <span class="preview">{{ preview(item) }}</span>
              <span v-if="item.unreadCount > 0" class="badge num">{{ item.unreadCount > 99 ? '99+' : item.unreadCount }}</span>
            </span>
            <span class="meta">
              {{ CONVERSATION_TYPE_LABELS[item.type] }}
              <template v-if="item.type === 'GROUP' && item.match"> · {{ item.match.venue }} · {{ item.memberCount }} 人</template>
            </span>
          </span>
        </button>
      </li>
    </ul>

    <EmptyState
      v-else
      title="还没有聊天"
      description="报名一场球局后会自动加入那场球的群聊；也可以在球局详情里私聊发起人。"
    >
      <template #action>
        <button class="btn btn--court" @click="switchTab(ROUTE_NAMES.discover)">去发现约球</button>
      </template>
    </EmptyState>
  </div>
</template>

<style scoped>
.content {
  padding-top: var(--space-6);
  padding-bottom: var(--space-8);
}

.list {
  display: grid;
  gap: var(--space-4);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  width: 100%;
  padding: var(--space-5);
  text-align: left;
  transition: transform 0.2s;
}

.row:hover {
  transform: translateY(-2px);
}

.avatar {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex: none;
  border-radius: 50%;
  font-size: var(--text-md);
  font-weight: 800;
}

.avatar--group {
  background: var(--ball);
  color: var(--ink);
}

.avatar--peer {
  background: var(--sand);
  color: var(--court);
}

.body {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
  flex: 1;
}

.line {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.line--top {
  justify-content: space-between;
}

.title {
  font-weight: 800;
  font-size: var(--text-md);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.time {
  color: var(--muted);
  font-size: var(--text-xs);
  flex: none;
}

.preview {
  color: var(--muted);
  font-size: var(--text-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.badge {
  flex: none;
  min-width: 20px;
  padding: 0 var(--space-2);
  height: 20px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-pill);
  background: var(--coral);
  color: var(--white);
  font-size: var(--text-xs);
  font-weight: 800;
}

.meta {
  color: var(--muted);
  font-size: var(--text-xs);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>