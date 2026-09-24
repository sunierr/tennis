<script setup lang="ts" generic="T extends string">
// 分段控件：赛制三选一与费用三态共用。
// 迁移小程序：换成 <picker> 或自绘 tab，调用方零改动。
defineProps<{
  modelValue: T
  options: readonly T[]
  labels: Record<T, string>
  label?: string
  error?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: T]
}>()
</script>

<template>
  <div class="field">
    <span v-if="label" class="field__label">{{ label }}</span>
    <div class="segmented" role="radiogroup">
      <button
        v-for="option in options"
        :key="option"
        type="button"
        role="radio"
        :aria-checked="option === modelValue"
        class="segmented__item"
        :class="{ 'is-active': option === modelValue }"
        @click="emit('update:modelValue', option)"
      >
        {{ labels[option] }}
      </button>
    </div>
    <p v-if="error" class="field__error">{{ error }}</p>
  </div>
</template>

<style scoped>
.segmented {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-1);
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
}

.segmented__item {
  flex: 1;
  min-height: var(--tap-min);
  border-radius: var(--radius-icon);
  font-size: var(--text-base);
  font-weight: 800;
  color: var(--muted);
  transition: background 0.15s, color 0.15s;
}

.segmented__item.is-active {
  background: var(--court);
  color: var(--white);
}
</style>