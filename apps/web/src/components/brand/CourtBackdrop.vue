<script setup lang="ts">
// hero 右下的大型球场圈线（原型 .hero:after）：极低对比的黄绿光环。
// 父容器需 position:relative + overflow:hidden。
</script>

<template>
  <span class="court-backdrop" aria-hidden="true" />
</template>

<style scoped>
.court-backdrop {
  position: absolute;
  right: -80px;
  top: -130px;
  width: 450px;
  height: 450px;
  border: 1px solid rgba(217, 247, 62, 0.18);
  border-radius: 50%;
  box-shadow: 0 0 0 36px rgba(217, 247, 62, 0.04), 0 0 0 72px rgba(217, 247, 62, 0.035);
  pointer-events: none;
}
</style>