<script setup lang="ts">
// 聊天页（全屏，隐藏底栏）。
// 正确性来源是 HTTP：进入取最近 30 条、向上用 beforeId 翻页、重连后用 afterId 补缺口；
// WS 推送只是加速 —— 收到帧时追加并去重，不刷新页面。
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { ChatMessage, ConversationListItem } from '@shared/types/chat'
import { formatChatTime } from '@shared/time/format'
import { api } from '../api'
import { replace } from '../platform/navigation'
import { onReconnect, subscribe } from '../platform/realtime'
import { ROUTE_NAMES } from '../router/routes'
import { useToast } from '../composables/useToast'
import { errorMessage } from '../utils/error'
import { useUiStore } from '../stores/ui'
import { useUserStore } from '../stores/user'

const route = useRoute()
const toast = useToast()
const ui = useUiStore()
const user = useUserStore()

const conversationId = Number(route.params.id)
const conversation = ref<ConversationListItem | null>(null)
const messages = ref<ChatMessage[]>([])
const draft = ref('')
const loading = ref(false)
const loadingEarlier = ref(false)
const sending = ref(false)
const hasMore = ref(false)
const listEl = ref<HTMLElement | null>(null)

// 乐观插入的本地消息（负数 id 与真实消息区分），发送成功后由服务端消息替换
interface PendingMessage {
  tempId: number
  content: string
}
const pending = ref<PendingMessage[]>([])
let tempSeq = 0
// 已上报的已读游标：只前进，避免重复请求
let readCursor = 0

const myUserId = computed(() => user.user?.id ?? null)

let unsubscribeMessage: (() => void) | null = null
let unsubscribeReconnect: (() => void) | null = null

onMounted(async () => {
  await load()
  // 403 时 load 已经跳回列表，不再订阅
  if (!conversation.value) return

  unsubscribeMessage = subscribe(conversationId, (message) => {
    appendMessage(message)
    void markReadUpTo(message.id)
    void scrollToBottom()
  })
  // 断线期间的缺口靠 afterId 补拉补回来
  unsubscribeReconnect = onReconnect(() => void catchUp())
})

onUnmounted(() => {
  unsubscribeMessage?.()
  unsubscribeReconnect?.()
  ui.setPageTitle(null)
})

async function load(): Promise<void> {
  loading.value = true
  try {
    // 标题来自会话列表；消息来自消息接口。两个都成功说明我是有效成员。
    const [list, page] = await Promise.all([
      api.conversations.list(),
      api.conversations.messages(conversationId),
    ])
    const found = list.find((item) => item.id === conversationId) ?? null
    if (!found) {
      leaveWithToast('你还没有加入这个会话')
      return
    }
    conversation.value = found
    ui.setPageTitle(found.title)
    messages.value = page.items
    hasMore.value = page.hasMore
    const last = page.items[page.items.length - 1]
    if (last) await markReadUpTo(last.id)
    await scrollToBottom()
  } catch (caught) {
    // 未报名的第三个人手输 URL 硬闯会落到这里（服务端 403）
    leaveWithToast(errorMessage(caught))
  } finally {
    loading.value = false
  }
}

function leaveWithToast(message: string): void {
  toast.error(message)
  replace(ROUTE_NAMES.messages)
}

function appendMessage(message: ChatMessage): void {
  if (messages.value.some((item) => item.id === message.id)) return
  messages.value = [...messages.value, message]
}

async function markReadUpTo(messageId: number): Promise<void> {
  if (messageId <= readCursor) return
  readCursor = messageId
  try {
    await api.conversations.read(conversationId, { lastReadMessageId: messageId })
  } catch {
    // 已读上报失败不影响阅读，下一次收到消息会再报一次
  }
}

async function catchUp(): Promise<void> {
  const last = messages.value[messages.value.length - 1]
  if (!last) {
    // 断线时列表是空的（例如进入页面就断网），整体重来一次
    await load()
    return
  }
  try {
    const page = await api.conversations.messages(conversationId, { afterId: last.id })
    if (page.items.length === 0) return
    for (const message of page.items) appendMessage(message)
    await markReadUpTo(page.items[page.items.length - 1].id)
    await scrollToBottom()
  } catch {
    // 补拉失败不打扰用户：下次重连或下次进入页面会再补
  }
}

async function loadEarlier(): Promise<void> {
  const first = messages.value[0]
  if (!first || loadingEarlier.value || !hasMore.value) return
  loadingEarlier.value = true
  const el = listEl.value
  const beforeHeight = el?.scrollHeight ?? 0
  try {
    const page = await api.conversations.messages(conversationId, { beforeId: first.id })
    messages.value = [...page.items, ...messages.value]
    hasMore.value = page.hasMore
    await nextTick()
    // 前置插入后把滚动位置顶回原处，否则视口会跳到最上面
    if (el) el.scrollTop = el.scrollHeight - beforeHeight
  } catch (caught) {
    toast.error(errorMessage(caught))
  } finally {
    loadingEarlier.value = false
  }
}

async function send(): Promise<void> {
  const content = draft.value.trim()
  if (!content || sending.value) return

  const tempId = -(tempSeq += 1)
  pending.value = [...pending.value, { tempId, content }]
  draft.value = ''
  await scrollToBottom()

  sending.value = true
  try {
    const saved = await api.conversations.send(conversationId, { content })
    pending.value = pending.value.filter((item) => item.tempId !== tempId)
    appendMessage(saved)
    await markReadUpTo(saved.id)
    await scrollToBottom()
  } catch (caught) {
    // 失败回滚：撤回气泡并把内容退回输入框，省得重打一遍
    pending.value = pending.value.filter((item) => item.tempId !== tempId)
    draft.value = content
    toast.error(errorMessage(caught))
  } finally {
    sending.value = false
  }
}

async function scrollToBottom(): Promise<void> {
  await nextTick()
  const el = listEl.value
  if (el) el.scrollTop = el.scrollHeight
}
</script>

<template>
  <div class="chat">
    <div ref="listEl" class="messages">
      <p v-if="loading" class="hint">正在加载消息…</p>
      <template v-else>
        <button v-if="hasMore" class="earlier btn btn--ghost" :disabled="loadingEarlier" @click="loadEarlier">
          {{ loadingEarlier ? '加载中…' : '加载更早的消息' }}
        </button>
        <p v-if="messages.length === 0" class="hint">还没有消息，打个招呼吧。</p>

        <div
          v-for="message in messages"
          :key="message.id"
          class="row"
          :class="{ 'row--me': message.senderId === myUserId }"
        >
          <div class="bubble">
            <p v-if="message.senderId !== myUserId" class="sender">{{ message.senderNickname }}</p>
            <img v-if="message.type === 'IMAGE'" class="image" :src="message.content" alt="图片消息" />
            <p v-else class="text">{{ message.content }}</p>
            <span class="stamp num">{{ formatChatTime(message.createdAt) }}</span>
          </div>
        </div>

        <div v-for="item in pending" :key="item.tempId" class="row row--me row--pending">
          <div class="bubble">
            <p class="text">{{ item.content }}</p>
            <span class="stamp">发送中…</span>
          </div>
        </div>
      </template>
    </div>

    <form class="composer" @submit.prevent="send">
      <input v-model="draft" class="input" maxlength="1000" placeholder="说点什么…" aria-label="消息内容" />
      <button class="btn btn--court" type="submit" :disabled="sending || draft.trim().length === 0">
        {{ sending ? '发送中…' : '发送' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.chat {
  /* 顶栏是 sticky，这里占满它之下的剩余高度；
     桌面端收成与底栏一致的手机宽度居中。 */
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--topbar-height));
  width: 100%;
  max-width: var(--tabbar-max);
  margin: 0 auto;
  padding: 0 var(--space-5);
}

.messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5) 0;
}

.earlier {
  align-self: center;
  flex: none;
}

.hint {
  color: var(--muted);
  font-size: var(--text-sm);
  text-align: center;
  padding: var(--space-5) 0;
}

.row {
  display: flex;
  justify-content: flex-start;
}

.row--me {
  justify-content: flex-end;
}

.bubble {
  max-width: 78%;
  background: var(--white);
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  padding: var(--space-3) var(--space-4);
  display: grid;
  gap: var(--space-1);
}

.row--me .bubble {
  background: var(--court);
  border-color: var(--court);
  color: var(--white);
}

.row--pending .bubble {
  opacity: 0.65;
}

.sender {
  font-size: var(--text-xs);
  font-weight: 800;
  color: var(--teal);
}

.text {
  font-size: var(--text-base);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.image {
  display: block;
  width: 180px;
  max-width: 100%;
  border-radius: var(--radius-sm);
}

.stamp {
  font-size: var(--text-xs);
  color: var(--muted);
  justify-self: end;
}

.row--me .stamp {
  color: rgba(255, 255, 255, 0.7);
}

.composer {
  flex: none;
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4) 0 calc(var(--space-4) + var(--safe-bottom));
  border-top: 1px solid var(--line);
}
</style>