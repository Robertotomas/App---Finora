<script setup lang="ts">
/**
 * Resumo compacto do período (Movimentos / Resumo / Recorrentes):
 * linha do período + Saldo em destaque + Receitas e Despesas ao lado. Cores neutras.
 * `extra` acrescenta uma coluna opcional (ex.: Investimentos, clicável).
 */
defineProps<{
  period: string
  balance: string
  income: string
  expenses: string
  extra?: { label: string; value: string; title?: string } | null
}>()
const emit = defineEmits<{ extraClick: [] }>()
</script>

<template>
  <section class="period-summary" aria-label="Resumo do período">
    <p class="ps-period">{{ period }}</p>
    <div class="ps-row">
      <div class="ps-item ps-item--main">
        <span class="ui-label">Saldo</span>
        <span class="ps-value ps-value--main">{{ balance }}</span>
      </div>
      <div class="ps-item">
        <span class="ui-label">Receitas</span>
        <span class="ps-value">{{ income }}</span>
      </div>
      <div class="ps-item">
        <span class="ui-label">Despesas</span>
        <span class="ps-value">{{ expenses }}</span>
      </div>
      <button
        v-if="extra"
        type="button"
        class="ps-item ps-item--link"
        :title="extra.title"
        @click="emit('extraClick')"
      >
        <span class="ui-label">{{ extra.label }}</span>
        <span class="ps-value">
          {{ extra.value }}
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.period-summary {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4) var(--space-5);
  margin-bottom: var(--space-5);
}
.ps-period {
  margin: 0 0 var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.ps-row {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: var(--space-4) var(--space-10);
}
.ps-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.ps-value {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-strong);
  white-space: nowrap;
}
.ps-value--main {
  font-size: var(--text-xl);
  font-weight: var(--weight-bold);
  letter-spacing: var(--tracking-tight);
  line-height: 1.15;
}
.ps-item--link {
  border: none;
  background: transparent;
  padding: 0;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
.ps-item--link .ps-value svg {
  color: var(--color-text-subtle);
  transition: transform var(--transition-fast);
}
.ps-item--link:hover .ps-value svg {
  transform: translateX(2px);
  color: var(--color-text-strong);
}
.ps-item--link:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
  border-radius: var(--radius-sm);
}
</style>
