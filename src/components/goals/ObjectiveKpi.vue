<script setup lang="ts">
/**
 * Indicador do resumo de poupança dos Objetivos: rótulo + (i) com explicação + valor.
 * `negative` pinta o valor a vermelho; `highlight` destaca o valor principal (disponível).
 */
defineProps<{
  label: string
  value: string
  hint: string
  negative?: boolean
  highlight?: boolean
  note?: string
}>()
</script>

<template>
  <div class="kpi" :class="{ 'kpi--highlight': highlight }">
    <div class="kpi-head">
      <span class="ui-label">{{ label }}</span>
      <span class="kpi-info" tabindex="0" role="button" :aria-label="`O que é «${label}»?`">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg>
        <span class="kpi-tooltip" role="tooltip">{{ hint }}</span>
      </span>
    </div>
    <p class="kpi-value ui-amount" :class="{ 'ui-amount--neg': negative }">{{ value }}</p>
    <p v-if="note" class="kpi-note">{{ note }}</p>
  </div>
</template>

<style scoped>
.kpi {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}
.kpi-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.kpi-value {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--weight-bold);
  letter-spacing: var(--tracking-tight);
  line-height: 1.2;
}
.kpi--highlight .kpi-value:not(.ui-amount--neg) {
  color: var(--color-primary-text);
}
.kpi-note {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-danger);
  line-height: 1.4;
}

/* (i) com tooltip */
.kpi-info {
  position: relative;
  display: inline-flex;
  color: var(--color-text-subtle);
  cursor: help;
  outline: none;
  transition: color var(--transition-fast);
}
.kpi-info:hover,
.kpi-info:focus-visible {
  color: var(--color-primary-text);
}
.kpi-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  width: max-content;
  max-width: 240px;
  padding: 10px 12px;
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  line-height: 1.45;
  white-space: pre-line;
  text-transform: none;
  letter-spacing: normal;
  z-index: 30;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity var(--transition-fast), transform var(--transition-fast), visibility var(--transition-fast);
}
.kpi-info:hover .kpi-tooltip,
.kpi-info:focus-visible .kpi-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}
@media (max-width: 640px) {
  .kpi { padding: var(--space-4); }
  .kpi-value { font-size: var(--text-lg); }
  .kpi-tooltip { left: 0; transform: translateY(4px); }
  .kpi-info:hover .kpi-tooltip,
  .kpi-info:focus-visible .kpi-tooltip { transform: translateY(0); }
}
</style>
