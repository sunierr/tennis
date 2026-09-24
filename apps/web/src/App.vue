<script setup lang="ts">
// 应用壳：顶栏 + 路由出口 + 底栏 + 全局 toast。页面级逻辑一律下沉到 pages/。
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppTabBar from './components/layout/AppTabBar.vue'
import AppTopBar from './components/layout/AppTopBar.vue'
import AppToast from './components/ui/AppToast.vue'

const route = useRoute()

// 底栏显隐由路由 meta 决定：4 个 tab 页显示，详情/发布/登录/社区二级页隐藏
const showTabBar = computed(() => Boolean(route.meta.tab))
</script>

<template>
  <div class="shell">
    <AppTopBar />
    <div class="body" :class="{ 'body--tabbar': showTabBar }">
      <RouterView />
    </div>
    <AppTabBar v-if="showTabBar" />
    <AppToast />
  </div>
</template>

<style scoped>
.shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.body {
  flex: 1;
}

/* 底栏是 fixed，内容区靠这条留白兜住最后一张卡片 */
.body--tabbar {
  padding-bottom: var(--tabbar-h);
}
</style>