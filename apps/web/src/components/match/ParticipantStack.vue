<script setup lang="ts">
import { computed } from 'vue'

// 头像叠层 + 人数计数（原型 .people / .mini-avatar）
const props = withDefaults(
  defineProps<{
    count: number
    max: number
    // 详情页能拿到昵称时展示首字母，列表页缺省用色块占位
    names?: string[]
  }>(),
  { names: () => [] },
)

const MAX_AVATARS = 3

const shown = computed(() => props.names.slice(0, MAX_AVATARS))

const initials = (name: string): string => name.trim().slice(0, 1).toUpperCase() || '球'
</script>

<template>
  <div class="people">
    <span
      v-for="(name, index) in shown"
      :key="name + index"
      class="mini-avatar"
      :class="`tone-${index % 4}`"
      >{{ initials(name) }}</span
    >
    <span v-if="shown.length === 0 && count > 0" class="mini-avatar tone-0">＋</span>
    <span class="count num">{{ count }} / {{ max }} 人</span>
  </div>
</template>

<style scoped>
.people {
  display: flex;
  align-items: center;
  color: var(--muted);
  font-size: var(--text-xs);
}

.mini-avatar {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid var(--white);
  margin-left: -5px;
  font-size: 9px;
  color: var(--court);
  background: var(--sand);
}

.mini-avatar:first-child {
  margin-left: 0;
}

.tone-1 {
  background: var(--ball);
}

.tone-2 {
  background: var(--coral);
}

.tone-3 {
  background: var(--teal);
}

.count {
  margin-left: var(--space-2);
}
</style>