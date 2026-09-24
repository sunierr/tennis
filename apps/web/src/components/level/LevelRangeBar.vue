<script setup lang="ts">
import { computed } from 'vue'
import {
  LEVEL_TENTHS_MAX,
  LEVEL_TENTHS_MIN,
  LEVEL_TENTHS_STEP,
  formatLevelRangeWithTier,
} from '@shared/level/ntrp'
import LevelDots from './LevelDots.vue'

// 约球的水平要求始终是区间，单值场景令 min === max。
// 迁移小程序：两个 <input type="range"> 换成 <picker>，组件外部零改动。
const props = defineProps<{
  min: number
  max: number
  label?: string
  error?: string | null
}>()

const emit = defineEmits<{
  'update:min': [value: number]
  'update:max': [value: number]
}>()

const summary = computed(() => formatLevelRangeWithTier(props.min, props.max))

// 拖 min 超过 max 时把 max 一起推上去（保持 min <= max 恒成立）
function onMin(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  emit('update:min', value)
  if (value > props.max) emit('update:max', value)
}

function onMax(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value)
  emit('update:max', value)
  if (value < props.min) emit('update:min', value)
}
</script>

<template>
  <div class="range">
    <div class="range-head">
      <span class="field__label">{{ label ?? '可接受的水平区间' }}</span>
      <span class="range-summary">{{ summary }}</span>
    </div>
    <div class="range-body">
      <LevelDots :min="min" :max="max" />
      <div class="range-sliders">
        <input
          class="slider"
          type="range"
          :min="LEVEL_TENTHS_MIN"
          :max="LEVEL_TENTHS_MAX"
          :step="LEVEL_TENTHS_STEP"
          :value="min"
          aria-label="最低水平"
          @input="onMin"
        />
        <input
          class="slider"
          type="range"
          :min="LEVEL_TENTHS_MIN"
          :max="LEVEL_TENTHS_MAX"
          :step="LEVEL_TENTHS_STEP"
          :value="max"
          aria-label="最高水平"
          @input="onMax"
        />
      </div>
    </div>
    <p v-if="error" class="field__error">{{ error }}</p>
  </div>
</template>

<style scoped>
.range {
  display: grid;
  gap: var(--space-2);
}

.range-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.range-summary {
  font-size: var(--text-sm);
  font-weight: 800;
  color: var(--court);
}

.range-body {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex-wrap: wrap;
}

.range-sliders {
  display: grid;
  gap: var(--space-1);
  flex: 1 1 200px;
  min-width: 180px;
}

.slider {
  width: 100%;
  accent-color: var(--green);
  background: transparent;
}
</style>