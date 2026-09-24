<script setup lang="ts">
import { computed } from 'vue'
import { instantToShanghaiInput, shanghaiInputToInstant } from '@shared/time/format'

// 全站唯一的 datetime-local 接触点。
// 迁移小程序：这里换成 <picker mode="date"> + <picker mode="time">，其余页面零改动。
// 值为上海挂钟字符串 "2026-09-27T09:00"，对外只暴露 ISO 瞬间。
const props = defineProps<{
  // ISO 瞬间；空字符串表示未选择
  modelValue: string
  label?: string
  error?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: [value: string]
}>()

const inputValue = computed(() => (props.modelValue ? instantToShanghaiInput(props.modelValue) : ''))

function onInput(event: Event): void {
  const raw = (event.target as HTMLInputElement).value
  const instant = raw ? shanghaiInputToInstant(raw) : ''
  emit('update:modelValue', instant ?? '')
  emit('change', instant ?? '')
}
</script>

<template>
  <div class="field">
    <span class="field__label">{{ label ?? '日期与时间' }}</span>
    <input class="input" type="datetime-local" :value="inputValue" @input="onInput" />
    <p v-if="error" class="field__error">{{ error }}</p>
  </div>
</template>