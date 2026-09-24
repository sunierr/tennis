<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

// 统一的遮罩与关闭行为：点遮罩、按 Esc、点右上角 ×
withDefaults(defineProps<{ title?: string; wide?: boolean }>(), { title: '', wide: false })

const emit = defineEmits<{ close: [] }>()

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.body.style.overflow = 'hidden'
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div class="backdrop" @click.self="emit('close')">
      <section class="modal" :class="{ 'is-wide': wide }" role="dialog" aria-modal="true">
        <header class="modal-head">
          <h2>{{ title }}</h2>
          <button class="close" aria-label="关闭" @click="emit('close')">×</button>
        </header>
        <slot />
        <footer v-if="$slots.footer" class="modal-foot">
          <slot name="footer" />
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(13, 48, 44, 0.55);
  z-index: 10;
  padding: var(--space-5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  background: var(--paper);
  width: min(520px, 100%);
  max-height: 90vh;
  overflow-y: auto;
  border-radius: var(--radius-modal);
  padding: var(--space-6);
  box-shadow: 0 25px 70px rgba(0, 0, 0, 0.2);
}

.modal.is-wide {
  width: min(720px, 100%);
}

.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
}

h2 {
  font-size: var(--text-xl);
  letter-spacing: -0.05em;
}

.close {
  width: 30px;
  height: 30px;
  flex: none;
  border-radius: 50%;
  background: var(--sand);
  color: var(--court);
  font-size: 18px;
  line-height: 1;
}

.modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-6);
}
</style>