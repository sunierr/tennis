<script setup lang="ts">
// 社区信息流卡片：作者 → 正文（超 4 行折叠）→ 九宫格图 → 标签 → 点赞 / 评论 / 时间。
// 点赞与评论都只 emit，交互与请求留在页面里（卡片保持纯展示，便于复用到「我的帖子」）。
import type { PostListItem } from '@shared/types/post'
import { formatChatTime } from '@shared/time/format'
import PostImages from './PostImages.vue'

defineProps<{ post: PostListItem }>()

const emit = defineEmits<{
  select: []
  like: []
  tag: [name: string]
}>()
</script>

<template>
  <article class="card post">
    <header class="head">
      <button class="avatar" @click="emit('select')">{{ post.author.nickname.slice(0, 1) }}</button>
      <div class="who">
        <p class="nick">{{ post.author.nickname }}</p>
        <p class="meta">
          <span>{{ formatChatTime(post.createdAt) }}</span>
          <template v-if="post.author.city"> · {{ post.author.city }}</template>
        </p>
      </div>
      <span v-if="post.isMine" class="tag">我的</span>
    </header>

    <p class="body" @click="emit('select')">{{ post.content }}</p>

    <PostImages v-if="post.images.length > 0" class="images" :images="post.images" />

    <div v-if="post.tags.length > 0" class="tags">
      <button v-for="name in post.tags" :key="name" class="tag chip-tag" @click="emit('tag', name)">
        #{{ name }}
      </button>
    </div>

    <footer class="foot">
      <button class="action" :class="{ 'is-on': post.likedByMe }" :aria-pressed="post.likedByMe" @click="emit('like')">
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 20.1l-1.2-1.1C6.1 14.9 3.2 12.3 3.2 9.1 3.2 6.5 5.2 4.4 7.8 4.4c1.5 0 2.9.7 4.2 2 1.3-1.3 2.7-2 4.2-2 2.6 0 4.6 2.1 4.6 4.7 0 3.2-2.9 5.8-7.6 9.9z"
          />
        </svg>
        <span class="num">{{ post.likeCount }}</span>
      </button>
      <button class="action" @click="emit('select')">
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6.6A2.6 2.6 0 0 1 6.6 4h10.8A2.6 2.6 0 0 1 20 6.6v7.2a2.6 2.6 0 0 1-2.6 2.6H10l-6 4.2z" />
        </svg>
        <span class="num">{{ post.commentCount }}</span>
      </button>
    </footer>
  </article>
</template>

<style scoped>
.post {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-5);
}

.head {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.avatar {
  width: 38px;
  height: 38px;
  flex: none;
  border-radius: 50%;
  background: var(--sand);
  color: var(--court);
  font-size: var(--text-md);
  font-weight: 850;
}

.who {
  min-width: 0;
  flex: 1;
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

.body {
  font-size: var(--text-base);
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  cursor: pointer;
  /* 信息流里最多 4 行，超出折叠；点卡片进详情看全文 */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  overflow: hidden;
}

.images {
  cursor: pointer;
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
  gap: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--line);
}

.action {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--tap-min);
  color: var(--muted);
  font-size: var(--text-sm);
  font-weight: 800;
}

.action.is-on {
  color: var(--coral);
}

.num {
  font-variant-numeric: tabular-nums;
}

/* 点赞心形：未点时描边，点过之后填充（同一 path，只换 fill） */
.icon {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.action.is-on .icon {
  fill: currentColor;
}
</style>