<script setup lang="ts">
// 底部导航栏：发现 / 社区 / (发布 FAB) / 消息 / 我的。
// 「发布」是动作入口 —— push 到二级页，不保持选中态。
// 迁移小程序时整体删除，换成 pages.json 的 tabBar（中间槽位对应 midButton）。
import { useRoute } from 'vue-router'
import { go, switchTab } from '../../platform/navigation'
import { ROUTE_NAMES, type RouteName } from '../../router/routes'

interface TabSlot {
  label: string
  // 图标用 path 数据而不是图片资源：底色跟 currentColor 走，选中态不需要换图
  icon: string[]
  route?: RouteName
  fab?: boolean
}

const SLOTS: TabSlot[] = [
  {
    label: '发现',
    route: ROUTE_NAMES.discover,
    icon: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1z'],
  },
  {
    label: '社区',
    route: ROUTE_NAMES.community,
    icon: [
      'M9 11.5a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2z',
      'M2.8 20.2a6.2 6.2 0 0 1 12.4 0',
      'M16.4 4.9a3.1 3.1 0 0 1 0 6',
      'M18 20.2a5.9 5.9 0 0 0-1.8-4.3',
    ],
  },
  { label: '发布', fab: true, icon: ['M12 6.4v11.2', 'M6.4 12h11.2'] },
  {
    label: '消息',
    route: ROUTE_NAMES.messages,
    icon: ['M4 6.6A2.6 2.6 0 0 1 6.6 4h10.8A2.6 2.6 0 0 1 20 6.6v7.2a2.6 2.6 0 0 1-2.6 2.6H10l-6 4.2z'],
  },
  {
    label: '我的',
    route: ROUTE_NAMES.profile,
    icon: ['M12 11.6a3.9 3.9 0 1 0 0-7.8 3.9 3.9 0 0 0 0 7.8z', 'M4.6 20.4a7.4 7.4 0 0 1 14.8 0'],
  },
]

const route = useRoute()

function isActive(slot: TabSlot): boolean {
  return Boolean(slot.route) && route.name === slot.route
}

function onSelect(slot: TabSlot): void {
  if (slot.fab) {
    go(ROUTE_NAMES.publish)
    return
  }
  if (slot.route) switchTab(slot.route)
}
</script>

<template>
  <nav class="tabbar" aria-label="主导航">
    <div class="tabbar-inner">
      <button
        v-for="slot in SLOTS"
        :key="slot.label"
        class="tab"
        :class="{ 'is-active': isActive(slot), 'is-fab': slot.fab }"
        :aria-current="isActive(slot) ? 'page' : undefined"
        @click="onSelect(slot)"
      >
        <span class="ico">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path v-for="d in slot.icon" :key="d" :d="d" />
          </svg>
        </span>
        <span v-if="!slot.fab" class="label">{{ slot.label }}</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.tabbar {
  position: fixed;
  inset: auto 0 0;
  z-index: 6;
  background: var(--paper);
  border-top: 1px solid var(--line);
  padding-bottom: var(--safe-bottom);
}

.tabbar-inner {
  max-width: var(--tabbar-max);
  margin: 0 auto;
  height: var(--tabbar-base);
  display: flex;
  align-items: center;
}

.tab {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  color: var(--muted);
  font-size: var(--text-xs);
  font-weight: 800;
  transition: color 0.2s;
}

/* 选中态：图标外一层浅色胶囊 + 文案转 --court，不做下划线 */
.ico {
  display: grid;
  place-items: center;
  width: 40px;
  height: 26px;
  border-radius: var(--radius-pill);
  transition: background 0.2s;
}

.tab.is-active {
  color: var(--court);
}

.tab.is-active .ico {
  background: var(--tabbar-active);
}

.icon {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* 发布：--ball 实心圆 + --white 描边环，不发光 */
.tab.is-fab {
  color: var(--court);
}

.tab.is-fab .ico {
  width: var(--tabbar-fab);
  height: var(--tabbar-fab);
  background: var(--ball);
  border: 3px solid var(--white);
  transform: translateY(calc(-1 * var(--space-4)));
}

.tab.is-fab .icon {
  width: 24px;
  height: 24px;
  stroke-width: 2.2;
}
</style>