<script setup lang="ts">
/**
 * Cartão padrão. Cabeçalho opcional (title/subtitle + slot `actions`), corpo no slot default.
 * `flush` remove o padding do corpo (tabelas/listas que vão até à borda).
 */
defineProps<{
  title?: string
  subtitle?: string
  flush?: boolean
}>()
</script>

<template>
  <section class="ui-card" :class="{ 'ui-card--flush': flush }">
    <header v-if="title || $slots.actions || $slots.header" class="ui-card-head">
      <slot name="header">
        <div class="ui-card-head-text">
          <h2 v-if="title" class="ui-card-title">{{ title }}</h2>
          <p v-if="subtitle" class="ui-card-subtitle">{{ subtitle }}</p>
        </div>
      </slot>
      <div v-if="$slots.actions" class="ui-card-actions"><slot name="actions" /></div>
    </header>
    <div class="ui-card-body"><slot /></div>
  </section>
</template>

<style scoped>
.ui-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xs);
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.ui-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-border-subtle);
}
.ui-card-head-text {
  min-width: 0;
}
.ui-card-title {
  margin: 0;
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
  letter-spacing: -0.01em;
}
.ui-card-subtitle {
  margin: 2px 0 0;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
.ui-card-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
}
.ui-card-body {
  padding: var(--space-5);
  flex: 1;
  min-width: 0;
}
.ui-card--flush .ui-card-body {
  padding: 0;
}
</style>
