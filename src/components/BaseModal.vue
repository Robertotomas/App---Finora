<script setup lang="ts">
import { useId } from 'vue'

/**
 * Modal base da app. Overlay com blur, painel centrado (bottom sheet em ecrãs ≤640px),
 * cabeçalho fixo, corpo com scroll e rodapé opcional (slot `footer`, botões alinhados à direita).
 *
 * Tamanhos: sm (420px), md (500px, defeito), lg (640px).
 *
 * Também define o "kit de formulário" partilhado pelos modais (ver <style> não-scoped):
 * `.modal-form`, `.form-group`, `.form-row`, `.input`, `.input-error`, `.error-text`, `.hint`,
 * `.amount-wrap`/`.amount-suffix`/`.amount-input`, `.type-toggle`/`.type-toggle-btn`.
 */
withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { size: 'md' },
)

defineEmits<{
  close: []
}>()

const titleId = `bm-title-${useId()}`
</script>

<template>
  <div class="bm-overlay" @click.self="$emit('close')">
    <div class="bm-panel" :class="`bm-panel--${size}`" role="dialog" aria-modal="true" :aria-labelledby="titleId">
      <header class="bm-header">
        <div class="bm-heading">
          <h2 :id="titleId" class="bm-title">{{ title }}</h2>
          <p v-if="subtitle" class="bm-subtitle">{{ subtitle }}</p>
        </div>
        <button type="button" class="bm-close" aria-label="Fechar" @click="$emit('close')">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
        </button>
      </header>
      <div class="bm-body">
        <slot />
      </div>
      <footer v-if="$slots.footer" class="bm-footer">
        <slot name="footer" />
      </footer>
    </div>
  </div>
</template>

<style scoped>
.bm-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: var(--color-modal-overlay);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  animation: bm-fade 160ms ease-out;
}

.bm-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 500px;
  max-height: calc(100vh - 2rem);
  max-height: calc(100dvh - 2rem);
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  animation: bm-in 160ms cubic-bezier(0.4, 0, 0.2, 1);
}
.bm-panel--sm {
  max-width: 420px;
}
.bm-panel--lg {
  max-width: 640px;
}

.bm-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-5) var(--space-4);
  flex-shrink: 0;
}
.bm-heading {
  min-width: 0;
}
.bm-title {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  line-height: 1.35;
  letter-spacing: -0.01em;
  color: var(--color-text-strong);
}
.bm-subtitle {
  margin: 2px 0 0;
  font-size: var(--text-sm);
  line-height: 1.45;
  color: var(--color-text-muted);
}
.bm-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin: -4px -6px 0 0;
  padding: 0;
  flex-shrink: 0;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.bm-close:hover {
  background: var(--color-surface-muted);
  color: var(--color-text-strong);
}
.bm-close:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.bm-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 var(--space-5) var(--space-5);
}

.bm-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--color-border-subtle);
  flex-shrink: 0;
}

@keyframes bm-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes bm-in {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes bm-sheet-in {
  from { opacity: 0.6; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Mobile: bottom sheet */
@media (max-width: 640px) {
  .bm-overlay {
    align-items: flex-end;
    padding: 0;
  }
  .bm-panel,
  .bm-panel--sm,
  .bm-panel--lg {
    max-width: none;
    max-height: 90vh;
    max-height: 90dvh;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    border-bottom: none;
    animation: bm-sheet-in 200ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .bm-header {
    padding: var(--space-4) var(--space-4) var(--space-3);
  }
  .bm-body {
    padding: 0 var(--space-4) var(--space-4);
  }
  .bm-footer {
    padding: var(--space-3) var(--space-4) calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
  }
  .bm-footer > :deep(*) {
    flex: 1 1 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bm-overlay,
  .bm-panel {
    animation: none;
  }
}
</style>

<!--
  Kit de formulário partilhado pelos modais (não-scoped, mas limitado ao corpo do modal).
  Os modais usam estas classes em vez de repetir CSS de campos.
-->
<style>
.bm-body .modal-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.bm-body .form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.bm-body .form-group > label,
.bm-body .form-label {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
  line-height: 1.3;
}
.bm-body .form-label-optional {
  font-weight: var(--weight-regular);
  color: var(--color-text-muted);
}

.bm-body .form-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}
.bm-body .form-row--3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
@media (max-width: 520px) {
  .bm-body .form-row,
  .bm-body .form-row--3 {
    grid-template-columns: minmax(0, 1fr);
  }
}

.bm-body .input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: var(--text-base);
  color: var(--color-text-strong);
  box-sizing: border-box;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.bm-body textarea.input {
  height: auto;
  min-height: 80px;
  padding: 10px 12px;
  line-height: 1.5;
  resize: vertical;
}
.bm-body .input::placeholder {
  color: var(--color-text-subtle);
}
.bm-body .input:hover:not(:disabled):not(:focus) {
  border-color: var(--color-text-subtle);
}
.bm-body .input:focus,
.bm-body .input:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--focus-ring);
}
.bm-body .input:disabled {
  background: var(--color-surface-2);
  color: var(--color-text-muted);
  cursor: not-allowed;
}
.bm-body .input.input-error,
.bm-body .input-error .input {
  border-color: var(--color-danger);
}
.bm-body .input.input-error:focus {
  box-shadow: 0 0 0 3px var(--color-danger-soft);
}

.bm-body .error-text {
  margin: 0;
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-danger);
}
.bm-body .hint,
.bm-body .field-hint {
  margin: 0;
  font-size: var(--text-xs);
  line-height: 1.45;
  color: var(--color-text-muted);
}

/* Montante: € dentro do campo, à direita; sem setas */
.bm-body .amount-wrap {
  position: relative;
}
.bm-body .amount-input {
  padding-right: 34px;
  font-variant-numeric: tabular-nums;
  -moz-appearance: textfield;
  appearance: textfield;
}
.bm-body .amount-input::-webkit-outer-spin-button,
.bm-body .amount-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.bm-body .amount-suffix {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  color: var(--color-text-muted);
  pointer-events: none;
}

/* Toggle segmentado (tipo Despesa/Receita, frequência, operação) */
.bm-body .type-toggle {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: 2px;
  padding: 3px;
  height: 40px;
  box-sizing: border-box;
  background: var(--color-surface-muted);
  border-radius: var(--radius-sm);
}
.bm-body .type-toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  padding: 0 var(--space-2);
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-muted);
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
}
.bm-body .type-toggle-btn:hover:not(:disabled) {
  color: var(--color-text-strong);
}
.bm-body .type-toggle-btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.bm-body .type-toggle-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.bm-body .type-toggle-btn.active-expense {
  background: var(--color-danger-soft);
  border-color: var(--color-danger-border);
  color: var(--color-danger);
}
.bm-body .type-toggle-btn.active-income {
  background: var(--color-success-soft);
  border-color: var(--color-primary-soft-border);
  color: var(--color-success);
}
.bm-body .type-toggle-btn.active-neutral {
  background: var(--color-surface);
  color: var(--color-text-strong);
  box-shadow: var(--shadow-sm);
}

/* Checkbox em linha */
.bm-body .checkbox-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text);
  cursor: pointer;
}
.bm-body .checkbox-row input[type='checkbox'] {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--color-primary);
  cursor: pointer;
}

/* Caixas de aviso dentro de modais */
.bm-body .modal-note {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--color-text-secondary);
}
.bm-body .modal-note--warning {
  background: var(--color-warning-soft);
  border-color: var(--color-warning-border);
  color: var(--color-text);
}
.bm-body .modal-note--danger {
  background: var(--color-danger-soft);
  border-color: var(--color-danger-border);
  color: var(--color-text);
}
.bm-body .modal-note svg {
  flex-shrink: 0;
  margin-top: 1px;
}
.bm-body .modal-note--warning svg {
  color: var(--color-warning);
}
.bm-body .modal-note--danger svg {
  color: var(--color-danger);
}
</style>
