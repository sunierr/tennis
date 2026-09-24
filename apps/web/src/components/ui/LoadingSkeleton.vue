<script setup lang="ts">
withDefaults(defineProps<{ count?: number }>(), { count: 3 })
</script>

<template>
  <div class="grid">
    <div v-for="index in count" :key="index" class="skeleton-card">
      <span class="skeleton line line--short" />
      <span class="skeleton line line--title" />
      <span class="skeleton line" />
      <span class="skeleton line" />
      <span class="skeleton line line--short" />
    </div>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-5);
}

.skeleton-card {
  display: grid;
  gap: var(--space-4);
  background: var(--white);
  border: 1px solid var(--line);
  border-radius: var(--radius-card);
  padding: var(--space-5);
}

.line {
  height: 12px;
}

.line--short {
  width: 40%;
}

.line--title {
  height: 20px;
  width: 75%;
}

@media (max-width: 800px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 560px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>