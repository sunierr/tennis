<script setup lang="ts">
// 帖子图片：1 张时按原图比例大图；2、4 张用 2 列；其余用 3 列九宫格。
// 单元格固定方形 + object-fit: cover —— 列表高度不随图片加载变化（配合服务端给的宽高）。
import type { PostImageItem } from '@shared/types/post'

const props = defineProps<{ images: PostImageItem[] }>()

function layoutClass(): string {
  if (props.images.length === 1) return 'grid--single'
  if (props.images.length === 2 || props.images.length === 4) return 'grid--two'
  return 'grid--three'
}

// 单图占位比例：服务端量出了宽高就按真实比例撑开，量不到退化成 4:3
function singleRatio(): string {
  const [first] = props.images
  if (!first?.width || !first.height) return '4 / 3'
  return `${first.width} / ${first.height}`
}
</script>

<template>
  <div class="grid" :class="layoutClass()">
    <div
      v-for="(image, index) in images"
      :key="image.url"
      class="cell"
      :style="index === 0 && images.length === 1 ? { aspectRatio: singleRatio() } : undefined"
    >
      <img :src="image.url" alt="" loading="lazy" />
    </div>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  gap: var(--space-2);
}

.grid--single {
  grid-template-columns: 1fr;
}

.grid--two {
  grid-template-columns: repeat(2, 1fr);
}

.grid--three {
  grid-template-columns: repeat(3, 1fr);
}

.cell {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-sm);
  background: var(--sand);
}

/* 多图统一方形：高度可预测，图片加载前后不跳 */
.grid--two .cell,
.grid--three .cell {
  aspect-ratio: 1 / 1;
}

img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.grid--single img {
  max-height: 420px;
  object-fit: contain;
  background: var(--paper);
}
</style>