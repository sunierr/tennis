<script setup lang="ts">
import { computed } from 'vue'
import type { MatchListItem } from '@shared/types/match'
import { MATCH_FORMAT_LABELS, MATCH_STATUS_LABELS, SURFACE_LABELS, feeText } from '@shared/types/enums'
import { formatLevel } from '@shared/level/ntrp'
import { matchTimeLabel } from '@shared/time/format'
import LevelDots from '../level/LevelDots.vue'
import LevelFitBadge from '../level/LevelFitBadge.vue'
import ParticipantStack from './ParticipantStack.vue'

const props = withDefaults(
  defineProps<{
    match: MatchListItem
    // 「我的报名」列表里全部是已报名，直接给按钮终态
    joined?: boolean
    pulsing?: boolean
    myLevelTenths?: number | null
  }>(),
  { joined: false, pulsing: false, myLevelTenths: null },
)

const emit = defineEmits<{
  select: [id: number]
  join: [match: MatchListItem]
}>()

const time = computed(() => matchTimeLabel(props.match.startsAt, props.match.durationMinutes))

// 服务端已算好 spotsLeft，前端不重复减一次
const remaining = computed(() => props.match.spotsLeft)

const feeLabel = computed(() => feeText(props.match.feeType, props.match.fee))

const cancelled = computed(() => props.match.status !== 'OPEN')

// 角标优先级：已取消 > 满员 > 免费场 > 新手友好 > 即将成局 > 今天/周末
const badge = computed<{ text: string; tone: string }>(() => {
  const match = props.match
  if (cancelled.value) return { text: MATCH_STATUS_LABELS[match.status], tone: 'tag--muted' }
  if (match.isFull) return { text: '已满员', tone: 'tag--hot' }
  if (match.tags.includes('free')) return { text: '免费场', tone: '' }
  if (match.tags.includes('beginnerFriendly')) return { text: '新手友好', tone: '' }
  if (remaining.value <= 1) return { text: '即将成局', tone: 'tag--hot' }
  if (match.tags.includes('today')) return { text: '今天', tone: '' }
  if (match.tags.includes('weekend')) return { text: '周末局', tone: '' }
  return { text: '招募中', tone: '' }
})
</script>

<template>
  <article
    class="card listing"
    :class="{ 'rally-pulse': pulsing, 'is-cancelled': cancelled }"
    role="button"
    tabindex="0"
    @click="emit('select', match.id)"
    @keydown.enter="emit('select', match.id)"
  >
    <div class="listing-top">
      <span class="tag" :class="badge.tone">{{ badge.text }}</span>
      <div class="date num">
        {{ time.primary }}
        <span>{{ time.secondary }}</span>
      </div>
    </div>

    <h3>{{ match.title }}</h3>

    <div class="meta">
      <div>
        <span class="icon-chip">⌖</span><b>{{ match.venue }}</b>
      </div>
      <div>
        <span class="icon-chip">◉</span>
        <span>
          {{ feeLabel }}
          <template v-if="remaining > 0"> · 还差 <b class="num">{{ remaining }}</b> 人</template>
          <template v-else> · 已满员</template>
        </span>
      </div>
      <div>
        <span class="icon-chip">◆</span>
        <span>{{ match.levelLabel }}</span>
      </div>
      <div>
        <span class="icon-chip">▣</span>
        <span>{{ MATCH_FORMAT_LABELS[match.format] }} · {{ SURFACE_LABELS[match.surface] }}</span>
      </div>
    </div>

    <div class="fit-row">
      <LevelDots :min="match.levelMinTenths" :max="match.levelMaxTenths" size="sm" />
      <LevelFitBadge
        :fit="match.levelFit"
        :my-level-tenths="myLevelTenths"
        :min="match.levelMinTenths"
        :max="match.levelMaxTenths"
      />
      <span v-if="match.participantsLevelAvg !== null" class="avg num">
        队内均 {{ formatLevel(match.participantsLevelAvg) }} 级
      </span>
    </div>

    <div class="card-foot">
      <ParticipantStack :count="match.participantCount" :max="match.capacity" />
      <button
        v-if="!cancelled"
        class="btn join"
        :class="joined ? 'btn--teal' : 'btn--court'"
        @click.stop="emit('join', match)"
      >
        {{ joined ? '退出报名' : '报名' }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.listing {
  display: grid;
  padding: var(--space-5);
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: pointer;
}

.listing:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-float);
}

.is-cancelled {
  opacity: 0.72;
}

.listing-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.date {
  text-align: right;
  color: var(--court);
  font-weight: 850;
  font-size: var(--text-base);
  line-height: 1.35;
}

.date span {
  display: block;
  color: var(--muted);
  font-size: var(--text-xs);
  font-weight: 600;
}

h3 {
  font-size: var(--text-lg);
  letter-spacing: -0.04em;
  margin-bottom: var(--space-4);
}

.meta {
  display: grid;
  gap: var(--space-2);
  color: var(--muted);
  font-size: var(--text-sm);
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--line);
}

.meta div {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.meta b {
  color: var(--ink);
  font-weight: 700;
}

.fit-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding-top: var(--space-4);
}

.avg {
  color: var(--muted);
  font-size: var(--text-xs);
  font-weight: 700;
}

.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding-top: var(--space-4);
}

.join {
  min-height: 32px;
  padding: 0 var(--space-5);
  font-size: var(--text-xs);
}
</style>