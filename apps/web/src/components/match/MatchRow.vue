<script setup lang="ts">
import { computed } from 'vue'
import type { MatchListItem } from '@shared/types/match'
import { MATCH_STATUS_LABELS } from '@shared/types/enums'
import { matchTimeLabel } from '@shared/time/format'

// 「我的报名 / 我发布的」用的紧凑行：这两个列表的关注点是状态与操作，不需要整卡视觉
const props = withDefaults(
  defineProps<{
    match: MatchListItem
    joined?: boolean
    cancellable?: boolean
  }>(),
  { joined: false, cancellable: false },
)

const emit = defineEmits<{
  select: [id: number]
  leave: [match: MatchListItem]
  cancel: [match: MatchListItem]
}>()

const time = computed(() => matchTimeLabel(props.match.startsAt, props.match.durationMinutes))
const closed = computed(() => props.match.status !== 'OPEN')
</script>

<template>
  <li class="card row">
    <button class="row-main" @click="emit('select', match.id)">
      <span class="row-head">
        <span class="tag" :class="closed ? 'tag--muted' : match.isFull ? 'tag--hot' : ''">
          {{ closed ? MATCH_STATUS_LABELS[match.status] : match.isFull ? '已满员' : '招募中' }}
        </span>
        <span class="row-title">{{ match.title }}</span>
      </span>
      <span class="row-meta num">
        {{ time.primary }} · {{ match.venue }} · {{ match.levelLabel }} · {{ match.participantCount }} /
        {{ match.capacity }} 人
      </span>
    </button>

    <div class="row-actions">
      <button class="btn btn--ghost small" @click="emit('select', match.id)">查看详情</button>
      <button v-if="joined && !closed" class="btn btn--teal small" @click="emit('leave', match)">退出报名</button>
      <button v-if="cancellable && !closed" class="btn btn--ghost small" @click="emit('cancel', match)">取消约球</button>
    </div>
  </li>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
  padding: var(--space-5);
  flex-wrap: wrap;
}

.row-main {
  display: grid;
  gap: var(--space-2);
  text-align: left;
  flex: 1 1 260px;
}

.row-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.row-title {
  font-size: var(--text-md);
  font-weight: 850;
  letter-spacing: -0.03em;
  color: var(--ink);
}

.row-meta {
  color: var(--muted);
  font-size: var(--text-sm);
}

.row-actions {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.small {
  min-height: 34px;
  font-size: var(--text-sm);
}
</style>