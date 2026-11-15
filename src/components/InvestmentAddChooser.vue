<script setup lang="ts">
/**
 * Primeiro passo do "Adicionar" nos Investimentos: escolher o que registar antes de abrir o formulário
 * certo (compra/venda, depósito, dividendo ou importar o extrato da corretora).
 */
import BaseModal from './BaseModal.vue'

export type InvestmentAddKind = 'trade' | 'deposit' | 'dividend' | 'import'

const props = defineProps<{
  open: boolean
  /** Sem posições não há a que associar um dividendo. */
  canAddDividend?: boolean
}>()

const emit = defineEmits<{
  close: []
  choose: [kind: InvestmentAddKind]
}>()

interface Option {
  kind: InvestmentAddKind
  title: string
  description: string
  icon: string
}

const OPTIONS: Option[] = [
  {
    kind: 'trade',
    title: 'Compra ou venda',
    description: 'Ações, ETFs e outros instrumentos.',
    icon: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  },
  {
    kind: 'deposit',
    title: 'Depósito ou levantamento',
    description: 'Dinheiro que transferiu para a corretora ou que retirou.',
    icon: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  },
  {
    kind: 'dividend',
    title: 'Dividendo',
    description: 'Rendimento recebido de uma posição.',
    icon: '<line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  },
  {
    kind: 'import',
    title: 'Importar extrato da corretora',
    description: 'Excel ou CSV da XTB, Trading 212, DEGIRO, IBKR e outras.',
    icon: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  },
]

function isDisabled(o: Option): boolean {
  return o.kind === 'dividend' && !props.canAddDividend
}
</script>

<template>
  <BaseModal v-if="open" title="Adicionar" subtitle="O que quer registar?" size="sm" @close="emit('close')">
    <ul class="chooser">
      <li v-for="o in OPTIONS" :key="o.kind">
        <button
          type="button"
          class="chooser-item"
          :disabled="isDisabled(o)"
          :title="isDisabled(o) ? 'Adicione primeiro uma posição' : undefined"
          @click="emit('choose', o.kind)"
        >
          <span class="chooser-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              v-html="o.icon"
            />
          </span>
          <span class="chooser-text">
            <span class="chooser-title">{{ o.title }}</span>
            <span class="chooser-desc">{{ isDisabled(o) ? 'Adicione primeiro uma posição.' : o.description }}</span>
          </span>
          <svg class="chooser-chev" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </li>
    </ul>
  </BaseModal>
</template>

<style scoped>
.chooser {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.chooser-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}
.chooser-item:hover:not(:disabled) {
  background: var(--color-surface-hover);
  border-color: var(--color-border-strong);
}
.chooser-item:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.chooser-item:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.chooser-icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  color: var(--color-primary-text);
}
.chooser-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.chooser-title {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}
.chooser-desc {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
.chooser-chev {
  flex: none;
  color: var(--color-text-subtle);
}
</style>
