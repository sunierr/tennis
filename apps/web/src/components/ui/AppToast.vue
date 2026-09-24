<script setup lang="ts">
import { useToast } from '../../composables/useToast'

const { toasts, dismiss } = useToast()
</script>

<template>
  <div class="toast-layer">
    <button
      v-for="toast in toasts"
      :key="toast.id"
      class="toast"
      :class="{ 'is-error': toast.tone === 'error' }"
      @click="dismiss(toast.id)"
    >
      {{ toast.message }}
    </button>
  </div>
</template>

<style scoped>
.toast-layer {
  position: fixed;
  left: 50%;
  bottom: var(--space-6);
  transform: translateX(-50%);
  display: grid;
  gap: var(--space-2);
  justify-items: center;
  z-index: 20;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  background: var(--court);
  color: var(--white);
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-pill);
  font-size: var(--text-sm);
  font-weight: 700;
  box-shadow: var(--shadow-float);
  animation: toast-in 0.25s ease-out;
}

.toast.is-error {
  background: var(--coral);
  color: var(--ink);
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>