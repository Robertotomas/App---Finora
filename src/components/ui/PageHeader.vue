<script setup lang="ts">
/**
 * Cabeçalho padrão de todas as páginas: título + subtítulo à esquerda, ações à direita.
 * Slot `actions` (botões), slot `meta` (linha extra por baixo do subtítulo, opcional),
 * slot `back` (link "Voltar" acima do título, nas páginas de detalhe).
 */
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <header class="page-head">
    <div class="page-head-text">
      <div v-if="$slots.back" class="page-head-back"><slot name="back" /></div>
      <h1 class="page-head-title">{{ title }}</h1>
      <p v-if="subtitle" class="page-head-subtitle">{{ subtitle }}</p>
      <div v-if="$slots.meta" class="page-head-meta"><slot name="meta" /></div>
    </div>
    <div v-if="$slots.actions" class="page-head-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
  flex-wrap: wrap;
}
.page-head-text {
  min-width: 0;
}
.page-head-back {
  margin-bottom: var(--space-2);
}
.page-head-title {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--weight-bold);
  letter-spacing: var(--tracking-tight);
  line-height: 1.25;
  color: var(--color-text-strong);
}
.page-head-subtitle {
  margin: var(--space-1) 0 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  line-height: 1.5;
}
.page-head-meta {
  margin-top: var(--space-2);
}
.page-head-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}
@media (max-width: 640px) {
  .page-head {
    align-items: flex-start;
    margin-bottom: var(--space-5);
  }
  .page-head-title {
    font-size: 1.25rem;
  }
}
</style>
