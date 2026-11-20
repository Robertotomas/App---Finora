<script setup lang="ts">
/**
 * Ícone (i) com uma dica que aparece ao passar o rato ou ao focar com o teclado.
 * Conteúdo pelo slot por defeito (ou pela prop `text`). `placement`: 'right' (abre ao lado,
 * centrada na vertical — evita o corte no topo da página), 'left' (para elementos encostados à
 * direita), 'top' ou 'bottom-end' (abre para baixo, alinhada à direita — ex. cabeçalhos de tabela, onde
 * o contentor corta o que sai por cima).
 */
withDefaults(defineProps<{ text?: string; label?: string; placement?: 'right' | 'left' | 'top' | 'bottom-end' }>(), {
  text: '',
  label: 'Mais informação',
  placement: 'right',
})
</script>

<template>
  <span class="info-tip" :class="`info-tip--${placement}`" tabindex="0" role="button" :aria-label="label">
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="16" y2="12" /><line x1="12" x2="12.01" y1="8" y2="8" />
    </svg>
    <span class="info-tip-box" role="tooltip">
      <slot>{{ text }}</slot>
    </span>
  </span>
</template>

<style scoped>
.info-tip {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--color-text-subtle);
  cursor: help;
  outline: none;
  transition: color var(--transition-fast);
}
.info-tip:hover,
.info-tip:focus-visible {
  color: var(--color-primary-text);
}

.info-tip-box {
  position: absolute;
  z-index: var(--z-popover);
  width: max-content;
  max-width: 260px;
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
  font-size: var(--text-xs);
  font-weight: var(--weight-regular);
  line-height: 1.45;
  text-align: left;
  white-space: normal;
  /* não herdar o estilo do sítio onde está (ex.: cabeçalhos de tabela em maiúsculas) */
  text-transform: none;
  letter-spacing: normal;
  font-family: var(--font-sans);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity var(--transition-fast), transform var(--transition-fast), visibility var(--transition-fast);
}

.info-tip--right .info-tip-box {
  top: 50%;
  left: calc(100% + 8px);
  transform: translate(-4px, -50%);
}
.info-tip--left .info-tip-box {
  top: 50%;
  right: calc(100% + 8px);
  transform: translate(4px, -50%);
}
.info-tip--bottom-end .info-tip-box {
  top: calc(100% + 8px);
  right: -4px;
  transform: translateY(-4px);
}
.info-tip--top .info-tip-box {
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translate(-50%, 4px);
}

.info-tip:hover .info-tip-box,
.info-tip:focus-visible .info-tip-box {
  opacity: 1;
  visibility: visible;
}
.info-tip--right:hover .info-tip-box,
.info-tip--right:focus-visible .info-tip-box {
  transform: translate(0, -50%);
}
.info-tip--left:hover .info-tip-box,
.info-tip--left:focus-visible .info-tip-box {
  transform: translate(0, -50%);
}
.info-tip--bottom-end:hover .info-tip-box,
.info-tip--bottom-end:focus-visible .info-tip-box {
  transform: translateY(0);
}
.info-tip--top:hover .info-tip-box,
.info-tip--top:focus-visible .info-tip-box {
  transform: translate(-50%, 0);
}
</style>
