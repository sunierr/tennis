<script setup lang="ts">
// 顶部导航栏（由 v1 的 AppHeader 改造）：
// tab 页显示「logo + 标题」，二级页显示「返回 + 标题」。
// 「发现」页额外承载城市选择 —— 它是约球列表的筛选条件，放顶栏避免与列表重复。
// 迁移小程序时整体删除，换成 pages.json 的 navigationBar。
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { goBack } from '../../platform/navigation'
import { useMatchesStore } from '../../stores/matches'
import { useUiStore } from '../../stores/ui'
import { ROUTE_NAMES } from '../../router/routes'
import BallLogo from '../brand/BallLogo.vue'

const route = useRoute()
const matches = useMatchesStore()
const ui = useUiStore()

const isTab = computed(() => Boolean(route.meta.tab))
// 页面可以覆盖标题（聊天页显示对方昵称 / 球局标题），没覆盖就用路由的静态标题
const title = computed(() => ui.pageTitle ?? String(route.meta.title ?? 'Match Point'))
const showCity = computed(() => route.name === ROUTE_NAMES.discover)

const cityDraft = ref(matches.city)

watch(
  () => matches.city,
  (next) => {
    cityDraft.value = next
  },
)

function onCityBlur(): void {
  const next = cityDraft.value.trim()
  if (!next || next === matches.city) {
    cityDraft.value = matches.city
    return
  }
  void matches.setCity(next)
}
</script>

<template>
  <header class="topbar">
    <div class="topbar-inner">
      <button v-if="!isTab" class="back" aria-label="返回" @click="goBack()">←</button>
      <BallLogo v-else :size="24" />

      <h1 class="title">{{ title }}</h1>

      <label v-if="showCity" class="city">
        <span class="city-mark">⌖</span>
        <input v-model="cityDraft" class="city-input" maxlength="32" aria-label="城市" @blur="onCityBlur" />
      </label>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 5;
  height: var(--topbar-height);
  display: flex;
  align-items: center;
  /* backdrop-filter 只做增强，实色兜底保证小程序与旧浏览器下依然可读 */
  background: var(--paper);
  border-bottom: 1px solid var(--line);
}

@supports (backdrop-filter: blur(18px)) {
  .topbar {
    background: rgba(247, 250, 245, 0.9);
    backdrop-filter: blur(18px);
  }
}

.topbar-inner {
  width: 100%;
  max-width: var(--container);
  margin: 0 auto;
  padding: 0 var(--space-5);
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.back {
  display: grid;
  place-items: center;
  width: var(--tap-min);
  height: var(--tap-min);
  margin-left: calc(-1 * var(--space-3));
  color: var(--court);
  font-size: var(--text-lg);
  font-weight: 800;
  line-height: 1;
}

.title {
  font-size: var(--text-md);
  font-weight: 850;
  letter-spacing: -0.03em;
  white-space: nowrap;
}

.city {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-left: auto;
  border: 1px solid var(--line);
  background: var(--white);
  border-radius: var(--radius-pill);
  padding: 0 var(--space-4);
  height: calc(var(--topbar-height) - var(--space-6));
}

.city-mark {
  color: var(--court);
}

.city-input {
  border: 0;
  outline: none;
  width: 5em;
  font-size: var(--text-sm);
  font-weight: 700;
  background: transparent;
}
</style>