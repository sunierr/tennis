<script setup lang="ts">
// 帖子详情：正文 + 图 + 标签 + 点赞 + 评论列表与评论输入。
// 未登录可浏览；点赞 / 评论 / 删除要求登录（守卫只管路由，写操作自己兜一层）。
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { PostDetail } from '@shared/types/post'
import { formatChatTime, formatFullTime } from '@shared/time/format'
import { api } from '../api'
import { useUserStore } from '../stores/user'
import { useToast } from '../composables/useToast'
import { errorMessage } from '../utils/error'
import { goBack, go, replace } from '../platform/navigation'
import { ROUTE_NAMES } from '../router/routes'
import BaseModal from '../components/ui/BaseModal.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import LoadingSkeleton from '../components/ui/LoadingSkeleton.vue'
import PostImages from '../components/community/PostImages.vue'

const route = useRoute()
const user = useUserStore()
const toast = useToast()

const postId = computed(() => Number(route.params.id))
const post = ref<PostDetail | null>(null)
const loading = ref(false)
const notFound = ref(false)
const commentDraft = ref('')
const commenting = ref(false)
const confirmDelete = ref(false)
const deleting = ref(false)

onMounted(() => void load())

async function load(): Promise<void> {
  if (!Number.isInteger(postId.value) || postId.value <= 0) {
    notFound.value = true
    return
  }
  loading.value = true
  try {
    post.value = await api.posts.detail(postId.value)
    notFound.value = false
  } catch (caught) {
    notFound.value = true
    toast.error(errorMessage(caught, '帖子不存在或已被删除'))
  } finally {
    loading.value = false
  }
}

function requireLogin(action: string): boolean {
  if (user.isLoggedIn) return false
  toast.error(`登录后才能${action}`)
  go(ROUTE_NAMES.login, {}, { redirect: route.fullPath })
  return true
}

async function toggleLike(): Promise<void> {
  const current = post.value
  if (!current || requireLogin('点赞')) return
  const before = { likedByMe: current.likedByMe, likeCount: current.likeCount }
  current.likedByMe = !current.likedByMe
  current.likeCount += current.likedByMe ? 1 : -1
  try {
    const result = current.likedByMe ? await api.posts.like(current.id) : await api.posts.unlike(current.id)
    current.likedByMe = result.likedByMe
    current.likeCount = result.likeCount
  } catch (caught) {
    current.likedByMe = before.likedByMe
    current.likeCount = before.likeCount
    toast.error(errorMessage(caught, '操作失败'))
  }
}

async function submitComment(): Promise<void> {
  const current = post.value
  const content = commentDraft.value.trim()
  if (!current || !content) return
  if (requireLogin('评论')) return

  commenting.value = true
  try {
    const created = await api.posts.comment(current.id, { content })
    current.comments = [...current.comments, created]
    current.commentCount += 1
    commentDraft.value = ''
  } catch (caught) {
    toast.error(errorMessage(caught, '评论失败'))
  } finally {
    commenting.value = false
  }
}

async function removePost(): Promise<void> {
  const current = post.value
  if (!current) return
  deleting.value = true
  try {
    await api.posts.remove(current.id)
    toast.success('已删除')
    confirmDelete.value = false
    // 删完回信息流：用 replace 避免返回时又落回已删除的详情页
    replace(ROUTE_NAMES.community)
  } catch (caught) {
    toast.error(errorMessage(caught, '删除失败'))
  } finally {
    deleting.value = false
  }
}

function goTag(name: string): void {
  go(ROUTE_NAMES.community, {}, { tag: name })
}
</script>

<template>
  <div class="container content">
    <LoadingSkeleton v-if="loading && !post" :count="1" />

    <EmptyState v-else-if="notFound || !post" title="帖子不存在或已被删除" description="它可能被作者删除了。">
      <template #action>
        <button class="btn btn--court" @click="goBack(ROUTE_NAMES.community)">返回社区</button>
      </template>
    </EmptyState>

    <template v-else>
      <article class="card detail">
        <header class="head">
          <span class="avatar">{{ post.author.nickname.slice(0, 1) }}</span>
          <div class="who">
            <p class="nick">{{ post.author.nickname }}</p>
            <p class="meta">
              {{ formatFullTime(post.createdAt) }}
              <template v-if="post.author.city"> · {{ post.author.city }}</template>
            </p>
          </div>
          <button v-if="post.isMine" class="btn btn--ghost danger" data-testid="post-delete" @click="confirmDelete = true">
            删除
          </button>
        </header>

        <p class="body">{{ post.content }}</p>

        <PostImages v-if="post.images.length > 0" :images="post.images" />

        <div v-if="post.tags.length > 0" class="tags">
          <button v-for="name in post.tags" :key="name" class="tag chip-tag" @click="goTag(name)">#{{ name }}</button>
        </div>

        <footer class="foot">
          <button
            class="like"
            :class="{ 'is-on': post.likedByMe }"
            :aria-pressed="post.likedByMe"
            data-testid="post-like"
            @click="toggleLike"
          >
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 20.1l-1.2-1.1C6.1 14.9 3.2 12.3 3.2 9.1 3.2 6.5 5.2 4.4 7.8 4.4c1.5 0 2.9.7 4.2 2 1.3-1.3 2.7-2 4.2-2 2.6 0 4.6 2.1 4.6 4.7 0 3.2-2.9 5.8-7.6 9.9z"
              />
            </svg>
            <span class="num" data-testid="post-like-count">{{ post.likeCount }}</span>
            <span>点赞</span>
          </button>
          <span class="comments-count num">{{ post.commentCount }} 条评论</span>
        </footer>
      </article>

      <section class="comments">
        <h2>评论</h2>

        <ul v-if="post.comments.length > 0" class="list">
          <li v-for="comment in post.comments" :key="comment.id" class="card item">
            <span class="avatar avatar--sm">{{ comment.author.nickname.slice(0, 1) }}</span>
            <div class="item__body">
              <p class="item__head">
                <b>{{ comment.author.nickname }}</b>
                <span class="time">{{ formatChatTime(comment.createdAt) }}</span>
              </p>
              <p class="item__text">{{ comment.content }}</p>
            </div>
          </li>
        </ul>
        <p v-else class="empty-hint">还没有评论，来说点什么吧。</p>

        <form class="card write" @submit.prevent="submitComment">
          <textarea
            v-model="commentDraft"
            class="input"
            rows="2"
            maxlength="500"
            placeholder="友善地聊两句…"
            data-testid="comment-input"
          />
          <button class="btn btn--court" type="submit" :disabled="commenting || !commentDraft.trim()" data-testid="comment-submit">
            {{ commenting ? '发送中…' : '发表评论' }}
          </button>
        </form>
      </section>
    </template>

    <BaseModal v-if="confirmDelete" title="删除这条动态？" @close="confirmDelete = false">
      <p class="confirm">删除后将从社区信息流中消失，且无法恢复。</p>
      <template #footer>
        <button class="btn btn--ghost" @click="confirmDelete = false">再想想</button>
        <button class="btn btn--court" :disabled="deleting" @click="removePost">
          {{ deleting ? '删除中…' : '确认删除' }}
        </button>
      </template>
    </BaseModal>
  </div>
</template>

<style scoped>
.content {
  padding-top: var(--space-6);
  padding-bottom: var(--space-8);
}

.detail {
  display: grid;
  gap: var(--space-5);
  padding: var(--space-6);
}

.head {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.avatar {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  flex: none;
  border-radius: 50%;
  background: var(--sand);
  color: var(--court);
  font-size: var(--text-md);
  font-weight: 850;
}

.avatar--sm {
  width: 32px;
  height: 32px;
  font-size: var(--text-base);
}

.who {
  flex: 1;
  min-width: 0;
}

.nick {
  font-weight: 850;
  letter-spacing: -0.03em;
}

.meta {
  color: var(--muted);
  font-size: var(--text-xs);
  margin-top: var(--space-1);
}

.danger {
  color: var(--coral);
}

.body {
  font-size: var(--text-md);
  line-height: 1.75;
  white-space: pre-wrap;
  word-break: break-word;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.chip-tag {
  color: #51721a;
}

.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--line);
}

.like {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--tap-min);
  padding: 0 var(--space-5);
  border-radius: var(--radius-pill);
  border: 1px solid var(--line);
  color: var(--muted);
  font-size: var(--text-sm);
  font-weight: 800;
}

.like.is-on {
  border-color: var(--coral);
  color: var(--coral);
}

.icon {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.like.is-on .icon {
  fill: currentColor;
}

.comments-count {
  color: var(--muted);
  font-size: var(--text-xs);
  font-weight: 800;
}

.comments {
  margin-top: var(--space-7);
}

h2 {
  font-size: var(--text-lg);
  letter-spacing: -0.04em;
  margin-bottom: var(--space-5);
}

.list {
  display: grid;
  gap: var(--space-4);
}

.item {
  display: flex;
  gap: var(--space-4);
  padding: var(--space-5);
}

.item__body {
  min-width: 0;
  flex: 1;
}

.item__head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-sm);
}

.time {
  color: var(--muted);
  font-size: var(--text-xs);
  font-weight: 600;
}

.item__text {
  font-size: var(--text-base);
  line-height: 1.7;
  margin-top: var(--space-2);
  white-space: pre-wrap;
  word-break: break-word;
}

.empty-hint {
  color: var(--muted);
  font-size: var(--text-sm);
  padding: var(--space-5) 0;
}

.write {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-5);
  margin-top: var(--space-5);
}

.write .btn {
  justify-self: end;
}

textarea.input {
  resize: vertical;
}

.confirm {
  color: var(--muted);
  font-size: var(--text-base);
}
</style>