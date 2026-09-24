<script setup lang="ts">
// 网球 logo：零图片资源（径向渐变球体 + 两条 ±38° 接缝弧线），可任意缩放。
// 尺寸走 em：font-size 决定整体大小，接缝按比例跟着变。
withDefaults(defineProps<{ size?: number }>(), { size: 30 })
</script>

<template>
  <span class="ball" :style="{ fontSize: `${size}px` }" aria-hidden="true" />
</template>

<style scoped>
.ball {
  position: relative;
  display: inline-block;
  width: 1em;
  height: 1em;
  flex: none;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #eaff6b, var(--ball) 45%, #b8d829);
  box-shadow: inset -0.133em -0.133em 0 rgba(16, 42, 42, 0.1);
}

/* 两条接缝：上边框着色 + 另外三边透明，再各转 ±38° */
.ball::before,
.ball::after {
  content: '';
  position: absolute;
  width: 0.867em;
  height: 0.5em;
  left: 0.067em;
  top: 0.267em;
  border: 0.05em solid var(--court);
  border-color: var(--court) transparent transparent transparent;
  border-radius: 50%;
  transform: rotate(-38deg);
}

.ball::after {
  transform: rotate(142deg);
  top: 0.233em;
}
</style>