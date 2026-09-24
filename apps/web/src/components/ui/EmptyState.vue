<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description?: string
  }>(),
  { description: '' },
)
</script>

<template>
  <div class="empty">
    <p class="empty-title">{{ title }}</p>
    <p v-if="description" class="empty-desc">{{ description }}</p>
    <div v-if="$slots.action" class="empty-action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.empty {
  grid-column: 1 / -1;
  color: var(--muted);
  padding: var(--space-6);
  text-align: center;
  background: var(--white);
  border: 1px dashed var(--line);
  border-radius: var(--radius-card);
}

.empty-title {
  font-weight: 800;
  color: var(--ink);
}

.empty-desc {
  font-size: var(--text-sm);
  margin-top: var(--space-2);
}

.empty-action {
  margin-top: var(--space-5);
  display: flex;
  justify-content: center;
  gap: var(--space-3);
}
</style>