<script setup lang="ts">
import { computed } from 'vue'
import type { LevelFit } from '@shared/types/enums'
import { levelDirection, levelFitText } from '@shared/level/fit'

const props = defineProps<{
  fit: LevelFit | null
  // 我的自评水平（×10）；缺省时只能给出不带方向的文案
  myLevelTenths?: number | null
  min: number
  max: number
}>()

const text = computed(() => {
  if (!props.fit) return ''
  const direction = props.myLevelTenths ? levelDirection(props.myLevelTenths, props.min, props.max) : 'SAME'
  return levelFitText(props.fit, direction)
})

const tone = computed(() => {
  if (props.fit === 'IN_RANGE') return 'is-good'
  if (props.fit === 'NEAR') return 'is-near'
  return 'is-far'
})
</script>

<template>
  <span v-if="fit" class="fit" :class="tone">{{ text }}</span>
</template>

<style scoped>
.fit {
  display: inline-flex;
  align-items: center;
  border-radius: var(--radius-pill);
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
  font-weight: 800;
  white-space: nowrap;
}

.is-good {
  background: var(--ball);
  color: var(--ink);
}

.is-near {
  background: rgba(47, 182, 177, 0.16);
  color: var(--green);
}

.is-far {
  background: var(--sand);
  color: var(--muted);
}
</style>