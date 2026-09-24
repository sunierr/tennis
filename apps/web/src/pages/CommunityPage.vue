<script setup lang="ts">
// 社区 tab：信息流 + 标签筛选 + 热门标签。未登录可浏览，发帖/点赞/评论才要求登录。
// 状态放在页面内：tab 切换会卸载重建（App.vue 没有 keep-alive），列表天然是最新的。
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { HotTag, PostListItem } from '@shared/types/post'
import { api } from '../api'
import { useUserStore } from '../stores/user'
import { useToast } from '../composables/useToast'
import { errorMessage } from '../utils/error'
import { go, replace } from '../platform/navigation'
import { ROUTE_NAMES } from '../router/routes'
import PostCard from '../components/community/PostCard.vue'
import EmptyState from '../components/ui/EmptyState.vue'
import LoadingSkeleton from '../components/ui/LoadingSkeleton.vue'

const route = useRoute()
const user = useUserStore()
const toast = useToast()

const items = ref<PostListItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 10
const hasMore = ref(false)
const loading = ref(false)
const hotTags = ref<HotTag[]>([])

// 当前筛选标签来自 query：从别处带 #标签 进来也能直接落到筛选结果
const activeTag = computed(() => (typeof route.query.tag === 'string' && route.query.tag ? route.query.tag : null))

onMounted(async () => {
  await Promise.all([load(), loadTags()])
})

watch(() => route.query.tag, () => void load())

async function loadTags(): Promise<void> {
  try {
    hotTags.value = await api.tags.hot()
  } catch {
    // 热门标签是锦上添花：拉不到就不显示推荐，不打断信息流
  }
}

async function load(): Promise<void> {
  loading.value = true
  page.value = 1
  try {
    const result = await api.posts.list({
      tag: activeTag.value ?? undefined,
      page: 1,
      pageSize,
    })
    items.value = result.items
    total.value = result.total
    hasMore.value = result.hasMore
  } catch (caught) {
    toast.error(errorMessage(caught, '加载失败'))
  } finally {
    loading.value = false
  }
}

async function loadMore(): Promise<void> {
  loading.value = true
  try {
    const next = page.value + 1
    const result = await api.posts.list({ tag: activeTag.value ?? undefined, page: next, pageSize })
    page.value = next
    // 按 id 去重：并发点赞后重新拉取时不会出现重复卡片
    const seen = new Set(items.value.map((item) => item.id))
    items.value = [...items.value, ...result.items.filter((item) => !seen.has(item.id))]
    hasMore.value = result.hasMore
  } catch (caught) {
    toast.error(errorMessage(caught, '加载失败'))
  } finally {
    loading.value = false
  }
}

function filterByTag(name: string | null): void {
  // 用 replace：反复切标签不该把历史栈堆满，语义上也还是同一个列表页
  replace(ROUTE_NAMES.community, {}, name ? { tag: name } : undefined)
}

function openPost(id: number): void {
  go(ROUTE_NAMES.postDetail, { id })
}

function requireLogin(): boolean {
  if (user.isLoggedIn) return false
  toast.error('登录后才能点赞')
  go(ROUTE_NAMES.login, {}, { redirect: route.fullPath })
  return true
}

// 点赞是乐观更新：先改本地，失败再回滚。连点交给服务端 upsert 兜底。
async function toggleLike(post: PostListItem): Promise<void> {
  if (requireLogin()) return
  const before = { likedByMe: post.likedByMe, likeCount: post.likeCount }
  post.likedByMe = !post.likedByMe
  post.likeCount += post.likedByMe ? 1 : -1
  try {
    const result = post.likedByMe ? await api.posts.like(post.id) : await api.posts.unlike(post.id)
    post.likedByMe = result.likedByMe
    post.likeCount = result.likeCount
  } catch (caught) {
    post.likedByMe = before.likedByMe
    post.likeCount = before.likeCount
    toast.error(errorMessage(caught, '操作失败'))
  }
}

function goNew(): void {
  if (!user.isLoggedIn) {
    go(ROUTE_NAMES.login, {}, { redirect: route.fullPath })
    return
  }
  go(ROUTE_NAMES.postNew)
}
</script>

<template>
  <div class="container content">
    <header class="head">
      <div>
        <h1>球友社区</h1>
        <p>分享球局、红土心得与装备，找到同频的球友。</p>
      </div>
      <button class="btn btn--court" data-testid="post-new-entry" @click="goNew">＋ 发布动态</button>
    </header>

    <div v-if="hotTags.length > 0" class="hot">
      <button class="chip chip--sm" :class="{ 'is-active': activeTag === null }" @click="filterByTag(null)">全部</button>
      <button
        v-for="tag in hotTags"
        :key="tag.name"
        class="chip chip--sm"
        :class="{ 'is-active': activeTag === tag.name }"
        @click="filterByTag(tag.name)"
      >
        #{{ tag.name }}
        <span class="num">{{ tag.postCount }}</span>
      </button>
    </div>

    <p v-if="activeTag" class="filtering">
      正在筛选标签 <b>#{{ activeTag }}</b>
      <button class="clear" @click="filterByTag(null)">清除</button>
    </p>

    <LoadingSkeleton v-if="loading && items.length === 0" :count="2" />

    <div v-else-if="items.length > 0" class="feed">
      <PostCard
        v-for="post in items"
        :key="post.id"
        :post="post"
        @select="openPost(post.id)"
        @like="toggleLike(post)"
        @tag="filterByTag"
      />
      <div class="more">
        <p class="count">共 {{ total }} 条动态</p>
        <button v-if="hasMore" class="btn btn--ghost" :disabled="loading" @click="loadMore">
          {{ loading ? '加载中…' : '加载更多' }}
        </button>
      </div>
    </div>

    <EmptyState
      v-else
      :title="activeTag ? `#${activeTag} 还没有动态` : '社区还没有动态'"
      :description="activeTag ? '换个标签看看，或者你来发第一条。' : '分享你的第一场球局或心得，让球友认识你。'"
    >
      <template #action>
        <button v-if="activeTag" class="btn btn--ghost" @click="filterByTag(null)">看全部动态</button>
        <button class="btn btn--court" @click="goNew">发布动态</button>
      </template>
    </EmptyState>
  </div>
</template>

<style scoped>
.content {
  padding-top: var(--space-6);
  padding-bottom: var(--space-8);
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-5);
  flex-wrap: wrap;
  margin-bottom: var(--space-5);
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

.hot {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
}

.chip--sm {
  min-height: 32px;
  padding: 0 var(--space-4);
  font-size: var(--text-xs);
}

.filtering {
  color: var(--muted);
  font-size: var(--text-sm);
  margin-bottom: var(--space-5);
}

.filtering b {
  color: var(--court);
}

.clear {
  color: var(--teal);
  font-weight: 800;
  margin-left: var(--space-3);
}

.feed {
  display: grid;
  gap: var(--space-5);
}

.more {
  display: grid;
  justify-items: center;
  gap: var(--space-4);
  padding-top: var(--space-3);
}

.count {
  color: var(--muted);
  font-size: var(--text-xs);
}
</style>