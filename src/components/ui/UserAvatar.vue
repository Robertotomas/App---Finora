<script setup lang="ts">
import { computed } from 'vue'

/** Avatar com iniciais (substitui o ícone genérico igual para todos). */
const props = withDefaults(defineProps<{ firstName?: string | null; lastName?: string | null; size?: number }>(), {
  size: 32,
})

const initials = computed(() => {
  const a = (props.firstName ?? '').trim().charAt(0)
  const b = (props.lastName ?? '').trim().charAt(0)
  return (a + b).toUpperCase() || '?'
})
</script>

<template>
  <span
    class="avatar"
    :style="{ width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.38) + 'px' }"
    aria-hidden="true"
  >{{ initials }}</span>
</template>

<style scoped>
.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  background: var(--color-primary-soft);
  color: var(--color-primary-text);
  border: 1px solid var(--color-primary-soft-border);
  font-weight: var(--weight-bold);
  letter-spacing: 0.02em;
  user-select: none;
}
</style>
