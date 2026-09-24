<script setup lang="ts">
// 标签输入：自由输入（回车 / 逗号提交），最多 3 个；下方给热门标签当推荐词。
// 只做「字符串数组」的增减，去重与上限在服务端还有一层兜底。
import { computed, ref } from 'vue'
import { POST_TAG_MAX } from '@shared/types/enums'

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    suggestions?: string[]
    max?: number
  }>(),
  { suggestions: () => [], max: POST_TAG_MAX },
)

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const draft = ref('')

const full = computed(() => props.modelValue.length >= props.max)
// 已经加过的推荐词不再出现，避免重复点击
const available = computed(() => props.suggestions.filter((name) => !props.modelValue.includes(name)))

function commit(raw: string): void {
  const name = raw.trim().slice(0, 20)
  draft.value = ''
  if (!name || full.value || props.modelValue.includes(name)) return
  emit('update:modelValue', [...props.modelValue, name])
}

function remove(name: string): void {
  emit(
    'update:modelValue',
    props.modelValue.filter((item) => item !== name),
  )
}

// 逗号（中英文）与回车都当作提交：中文输入法下打逗号很自然
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' || event.key === ',' || event.key === '，') {
    event.preventDefault()
    commit(draft.value)
  }
}

function onBlur(): void {
  if (draft.value.trim()) commit(draft.value)
}
</script>

<template>
  <div class="field">
    <span class="field__label">标签（最多 {{ max }} 个，可留空）</span>

    <div class="picked">
      <span v-for="name in modelValue" :key="name" class="tag picked__item">
        #{{ name }}
        <button class="picked__remove" :aria-label="`移除标签 ${name}`" @click="remove(name)">×</button>
      </span>
    </div>

    <input
      v-model="draft"
      class="input"
      maxlength="20"
      :disabled="full"
      :placeholder="full ? `最多 ${max} 个标签` : '输入后按回车添加，例如：深圳约球'"
      @keydown="onKeydown"
      @blur="onBlur"
    />

    <div v-if="available.length > 0 && !full" class="suggest">
      <span class="suggest__label">热门标签</span>
      <button v-for="name in available" :key="name" class="chip chip--sm" @click="commit(name)">
        #{{ name }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.picked {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.picked:empty {
  display: none;
}

.picked__item {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: #51721a;
}

.picked__remove {
  color: inherit;
  font-size: var(--text-md);
  line-height: 1;
  padding: 0 var(--space-1);
}

.suggest {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}

.suggest__label {
  font-size: var(--text-xs);
  color: var(--muted);
  font-weight: 800;
}

.chip--sm {
  min-height: 28px;
  padding: 0 var(--space-4);
  font-size: var(--text-xs);
}
</style>