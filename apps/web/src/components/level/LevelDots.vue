<script setup lang="ts">
import { computed } from 'vue'
import { formatLevel } from '@shared/level/ntrp'

// 7 个球点代表 NTRP 1.0 - 7.0：未点亮用球场划线感的空心描边
const props = withDefaults(
  defineProps<{
    // 单值模式：点亮 <= tenths 的点
    tenths?: number | null
    // 区间模式（给了 min/max 时优先）：点亮区间内的点
    min?: number | null
    max?: number | null
    size?: 'sm' | 'md'
  }>(),
  { tenths: null, min: null, max: null, size: 'md' },
)

const DOTS = [10, 20, 30, 40, 50, 60, 70]

const rangeMode = computed(() => props.min !== null && props.max !== null)

const activeDots = computed(() => {
  if (rangeMode.value) {
    return DOTS.filter((dot) => dot >= (props.min as number) && dot <= (props.max as number))
  }
  if (props.tenths === null) return []
  return DOTS.filter((dot) => dot <= (props.tenths as number))
})

const label = computed(() => {
  if (rangeMode.value) return `${formatLevel(props.min)} - ${formatLevel(props.max)} 级`
  return props.tenths === null ? '未填写水平' : `${formatLevel(props.tenths)} 级`
})
</script>

<template>
  <span class="dots" :class="`dots--${size}`" role="img" :aria-label="`自评水平 ${label}`">
    <i v-for="dot in DOTS" :key="dot" class="dot" :class="{ 'is-on': activeDots.includes(dot) }" />
  </span>
</template>

<style scoped>
.dots {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  flex: none;
}

.dot {
  display: block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid var(--line);
  background: transparent;
}

.dot.is-on {
  border-color: var(--ball);
  background: var(--ball);
}

.dots--sm .dot {
  width: 6px;
  height: 6px;
}

.dots--md .dot {
  width: 10px;
  height: 10px;
}
</style>