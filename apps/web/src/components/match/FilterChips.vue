<script setup lang="ts">
import type { FilterKey } from '../../stores/matches'

// chip 直接驱动服务端查询参数（不再是本地过滤）：
// 今天/本周末 → datePreset；免费场 → free；新手友好 → beginnerFriendly；水平合适 → fit=me
const props = defineProps<{
  active: FilterKey[]
  loggedIn: boolean
}>()

const emit = defineEmits<{
  toggle: [key: FilterKey]
  clear: []
  requireLogin: []
}>()

const CHIPS: Array<{ key: FilterKey; label: string; needsLogin: boolean }> = [
  { key: 'today', label: '今天', needsLogin: false },
  { key: 'weekend', label: '本周末', needsLogin: false },
  { key: 'free', label: '免费场', needsLogin: false },
  { key: 'beginnerFriendly', label: '新手友好', needsLogin: false },
  { key: 'friendlyLevel', label: '水平合适', needsLogin: true },
]

function onClick(key: FilterKey, needsLogin: boolean): void {
  if (needsLogin && !props.loggedIn) {
    emit('requireLogin')
    return
  }
  emit('toggle', key)
}
</script>

<template>
  <div class="filters">
    <button class="chip" :class="{ 'is-active': active.length === 0 }" @click="emit('clear')">全部</button>
    <button
      v-for="chip in CHIPS"
      :key="chip.key"
      class="chip"
      :class="{ 'is-active': active.includes(chip.key) }"
      @click="onClick(chip.key, chip.needsLogin)"
    >
      {{ chip.label }}
    </button>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: var(--space-6);
}
</style>