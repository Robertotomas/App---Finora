<script setup lang="ts">
/**
 * Botão padrão da app. Variantes:
 *  - primary   → ação principal (verde sólido). No máximo 1 por zona.
 *  - secondary → ação neutra com borda.
 *  - ghost     → ação discreta sem borda (ícones, "Ver tudo").
 *  - danger    → ação destrutiva confirmada (vermelho sólido).
 *  - danger-ghost → ação destrutiva discreta (texto vermelho).
 * Tamanhos: md (36px) e sm (30px). `icon-only` para botões quadrados só com ícone
 * (passar sempre `aria-label`).
 */
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost'
    size?: 'sm' | 'md'
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    loading?: boolean
    block?: boolean
    iconOnly?: boolean
  }>(),
  { variant: 'primary', size: 'md', type: 'button' },
)
</script>

<template>
  <button
    :type="type"
    class="ui-btn"
    :class="[`ui-btn--${variant}`, `ui-btn--${size}`, { 'ui-btn--block': block, 'ui-btn--icon': iconOnly, 'is-loading': loading }]"
    :disabled="disabled || loading"
  >
    <span v-if="loading" class="ui-btn-spinner" aria-hidden="true" />
    <slot v-else name="icon" />
    <slot />
  </button>
</template>

<style scoped>
.ui-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  height: var(--control-h);
  padding: 0 var(--space-4);
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  font-family: inherit;
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast),
    box-shadow var(--transition-fast);
}
.ui-btn :deep(svg) {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
.ui-btn--sm {
  height: var(--control-h-sm);
  padding: 0 var(--space-3);
  font-size: var(--text-sm);
  gap: 6px;
}
.ui-btn--sm :deep(svg) {
  width: 14px;
  height: 14px;
}
.ui-btn--icon {
  width: var(--control-h);
  padding: 0;
}
.ui-btn--icon.ui-btn--sm {
  width: var(--control-h-sm);
}
.ui-btn--block {
  width: 100%;
}
.ui-btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.ui-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ui-btn--primary {
  background: var(--color-primary);
  color: var(--color-on-primary);
  box-shadow: var(--shadow-xs);
}
.ui-btn--primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.ui-btn--secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-xs);
}
.ui-btn--secondary:hover:not(:disabled) {
  background: var(--color-surface-muted);
}

.ui-btn--ghost {
  background: transparent;
  color: var(--color-text-secondary);
}
.ui-btn--ghost:hover:not(:disabled) {
  background: var(--color-surface-muted);
  color: var(--color-text-strong);
}

.ui-btn--danger {
  background: var(--color-danger);
  color: #fff;
}
.ui-btn--danger:hover:not(:disabled) {
  background: var(--color-danger-hover);
}

.ui-btn--danger-ghost {
  background: transparent;
  color: var(--color-danger);
}
.ui-btn--danger-ghost:hover:not(:disabled) {
  background: var(--color-danger-soft);
}

.ui-btn-spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid currentColor;
  border-right-color: transparent;
  animation: ui-btn-spin 0.7s linear infinite;
}
@keyframes ui-btn-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
