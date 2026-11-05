<script setup lang="ts">
/**
 * Estado vazio padrão: ícone em círculo suave + título + descrição + ação (slot).
 * `compact` para usar dentro de cartões pequenos (ex.: widgets do dashboard).
 */
defineProps<{
  title: string
  description?: string
  compact?: boolean
}>()
</script>

<template>
  <div class="empty" :class="{ 'empty--compact': compact }">
    <div class="empty-icon" aria-hidden="true">
      <slot name="icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
      </slot>
    </div>
    <p class="empty-title">{{ title }}</p>
    <p v-if="description" class="empty-desc">{{ description }}</p>
    <div v-if="$slots.default" class="empty-action"><slot /></div>
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--space-12) var(--space-6);
}
.empty--compact {
  padding: var(--space-8) var(--space-4);
}
.empty-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-full);
  background: var(--color-primary-soft);
  color: var(--color-primary-text);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-4);
}
.empty--compact .empty-icon {
  width: 40px;
  height: 40px;
  margin-bottom: var(--space-3);
}
.empty-icon :deep(svg) {
  width: 22px;
  height: 22px;
}
.empty--compact .empty-icon :deep(svg) {
  width: 18px;
  height: 18px;
}
.empty-title {
  margin: 0;
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}
.empty--compact .empty-title {
  font-size: var(--text-base);
}
.empty-desc {
  margin: var(--space-1) 0 0;
  max-width: 26rem;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  line-height: 1.5;
}
.empty-action {
  margin-top: var(--space-5);
  display: flex;
  gap: var(--space-2);
}
.empty--compact .empty-action {
  margin-top: var(--space-4);
}
</style>
