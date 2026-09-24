<script setup lang="ts">
// 数字步进器：练习局的人数上限用。
// 迁移小程序：换成 <uni-number-box> 等价物或自绘 stepper，调用方零改动。
const props = withDefaults(
  defineProps<{
    modelValue: number
    min: number
    max: number
    label?: string
    // 数值后缀，例如「人」
    suffix?: string
    error?: string | null
  }>(),
  { label: undefined, suffix: '', error: null },
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

function step(delta: number): void {
  const next = Math.min(props.max, Math.max(props.min, props.modelValue + delta))
  if (next !== props.modelValue) emit('update:modelValue', next)
}
</script>

<template>
  <div class="field">
    <span v-if="label" class="field__label">{{ label }}</span>
    <div class="stepper">
      <button type="button" class="stepper__btn" :disabled="modelValue <= min" @click="step(-1)">−</button>
      <span class="stepper__value num">{{ modelValue }}{{ suffix }}</span>
      <button type="button" class="stepper__btn" :disabled="modelValue >= max" @click="step(1)">＋</button>
    </div>
    <p v-if="error" class="field__error">{{ error }}</p>
  </div>
</template>

<style scoped>
.stepper {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-1);
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
}

.stepper__btn {
  width: var(--tap-min);
  height: var(--tap-min);
  border-radius: var(--radius-icon);
  background: var(--white);
  color: var(--court);
  font-size: var(--text-md);
  font-weight: 850;
  border: 1px solid var(--line);
}

.stepper__btn:disabled {
  opacity: 0.4;
}

.stepper__value {
  flex: 1;
  text-align: center;
  font-size: var(--text-md);
  font-weight: 850;
  color: var(--ink);
}
</style>