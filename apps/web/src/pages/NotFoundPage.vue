<script setup lang="ts">
import { go } from '../platform/navigation'
import { ROUTE_NAMES } from '../router/routes'
import EmptyState from '../components/ui/EmptyState.vue'
</script>

<template>
  <div class="container content">
    <EmptyState title="这个页面不存在" description="链接可能已经失效了，回到发现页看看新的球局吧。">
      <template #action>
        <button class="btn btn--court" @click="go(ROUTE_NAMES.discover)">回到发现页</button>
      </template>
    </EmptyState>
  </div>
</template>

<style scoped>
.content {
  padding-top: var(--space-8);
  padding-bottom: var(--space-8);
}
</style>