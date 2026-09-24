<script setup lang="ts">
// 图片选择器：选图后立刻本地预览、并行上传，成功才把绝对地址交给父组件。
// 支持删除与左右排序（顺序即九宫格顺序）。上传收口在 platform/upload.ts。
import { onBeforeUnmount, ref } from 'vue'
import { POST_IMAGE_MAX } from '@shared/types/enums'
import { useToast } from '../../composables/useToast'
import { errorMessage } from '../../utils/error'
import { uploadImage } from '../../platform/upload'

interface PickerItem {
  id: string
  // 本地预览地址（object URL）或上传成功后的正式地址
  preview: string
  // 上传完成才有值；父组件只拿到已完成的地址
  url: string | null
  uploading: boolean
}

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
  // 还有图在上传：父组件据此禁用提交，避免「提交了但图没带上」
  busy: [value: boolean]
}>()

const toast = useToast()
const items = ref<PickerItem[]>([])
const fileInput = ref<HTMLInputElement | null>(null)

let sequence = 0

function sync(): void {
  emit(
    'update:modelValue',
    items.value.filter((item) => item.url !== null).map((item) => item.url as string),
  )
  emit(
    'busy',
    items.value.some((item) => item.uploading),
  )
}

function pick(): void {
  fileInput.value?.click()
}

async function upload(item: PickerItem, file: File): Promise<void> {
  try {
    const result = await uploadImage(file)
    item.url = result.url
    item.preview = result.url
  } catch (caught) {
    // 失败就撤掉这张，避免用户以为它已经上传好了
    items.value = items.value.filter((current) => current.id !== item.id)
    URL.revokeObjectURL(item.preview)
    toast.error(errorMessage(caught, '图片上传失败'))
  } finally {
    item.uploading = false
    sync()
  }
}

function onFiles(event: Event): void {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  // 允许重复选同一张图：先清空，否则同名文件不会再触发 change
  input.value = ''

  const slots = Math.max(0, POST_IMAGE_MAX - items.value.length)
  if (files.length > slots) {
    toast.error(`最多上传 ${POST_IMAGE_MAX} 张图片`)
  }

  for (const file of files.slice(0, slots)) {
    const preview = URL.createObjectURL(file)
    const item: PickerItem = { id: `local-${++sequence}`, preview, url: null, uploading: true }
    items.value = [...items.value, item]
    void upload(item, file)
  }
  sync()
}

function remove(id: string): void {
  const target = items.value.find((item) => item.id === id)
  if (!target) return
  URL.revokeObjectURL(target.preview)
  items.value = items.value.filter((item) => item.id !== id)
  sync()
}

// 排序：与相邻项交换位置，越界时什么都不做
function move(index: number, delta: number): void {
  const next = index + delta
  if (next < 0 || next >= items.value.length) return
  const list = [...items.value]
  const [target] = list.splice(index, 1)
  if (!target) return
  list.splice(next, 0, target)
  items.value = list
  sync()
}

onBeforeUnmount(() => {
  for (const item of items.value) URL.revokeObjectURL(item.preview)
})
</script>

<template>
  <div class="field">
    <span class="field__label">图片（最多 {{ POST_IMAGE_MAX }} 张）</span>

    <div class="grid">
      <div v-for="(item, index) in items" :key="item.id" class="cell">
        <img :src="item.preview" alt="" />
        <span v-if="item.uploading" class="overlay">上传中…</span>
        <button class="drop" aria-label="删除图片" @click="remove(item.id)">×</button>
        <div class="order">
          <button :disabled="index === 0" aria-label="前移" @click="move(index, -1)">←</button>
          <button :disabled="index === items.length - 1" aria-label="后移" @click="move(index, 1)">→</button>
        </div>
      </div>

      <button v-if="items.length < POST_IMAGE_MAX" class="cell add" @click="pick">
        <span class="add__plus">＋</span>
        <span class="add__text">{{ items.length }}/{{ POST_IMAGE_MAX }}</span>
      </button>
    </div>

    <input
      ref="fileInput"
      class="file"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      multiple
      @change="onFiles"
    />
    <span class="hint">支持 jpg / png / webp，单张不超过 5MB；顺序即发布后的排列顺序。</span>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
}

.cell {
  position: relative;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background: var(--sand);
}

img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.overlay {
  position: absolute;
  inset: auto 0 0;
  background: rgba(13, 48, 44, 0.62);
  color: var(--white);
  font-size: var(--text-xs);
  font-weight: 800;
  text-align: center;
  padding: var(--space-1) 0;
}

.drop {
  position: absolute;
  top: var(--space-1);
  right: var(--space-1);
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(13, 48, 44, 0.6);
  color: var(--white);
  font-size: var(--text-md);
  line-height: 1;
}

.order {
  position: absolute;
  top: var(--space-1);
  left: var(--space-1);
  display: flex;
  gap: var(--space-1);
}

.order button {
  width: 22px;
  height: 22px;
  border-radius: var(--radius-icon);
  background: rgba(255, 255, 255, 0.85);
  color: var(--court);
  font-size: var(--text-xs);
  font-weight: 800;
}

.order button:disabled {
  opacity: 0.35;
}

.add {
  display: grid;
  place-content: center;
  gap: var(--space-1);
  border: 1px dashed var(--line);
  background: var(--white);
  color: var(--muted);
}

.add__plus {
  font-size: var(--text-lg);
  color: var(--court);
  line-height: 1;
}

.add__text {
  font-size: var(--text-xs);
  font-weight: 800;
}

.file {
  display: none;
}

.hint {
  font-size: var(--text-xs);
  color: var(--muted);
}
</style>