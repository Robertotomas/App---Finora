<script setup lang="ts">
import { PT_GROUPING } from '@/utils/numberFormat'
import { ref, computed, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import UiButton from './ui/UiButton.vue'
import type { RecurringTransaction } from '@/types/recurringTransaction'
import {
  TRANSACTION_CATEGORY_LABELS,
  TransactionType
} from '@/types/transaction'

const props = defineProps<{
  open: boolean
  recurring: RecurringTransaction | null
  loading?: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  close: []
  removeFromCurrentMonth: []
  removeFromNextMonth: []
}>()

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
]

const step = ref<'choose' | 'confirm'>('choose')
const chosen = ref<'current' | 'next'>('current')

// Reinicia para o passo de escolha sempre que o modal (re)abre.
watch(
  () => props.open,
  (open) => { if (open) step.value = 'choose' }
)

const now = new Date()
const currentMonthLabel = MONTH_NAMES[now.getMonth()]
const nextMonthLabel = MONTH_NAMES[new Date(now.getFullYear(), now.getMonth() + 1, 1).getMonth()]

const explanation = computed(() => {
  if (chosen.value === 'current') {
    return `Deixa de ser contabilizada já a partir de ${currentMonthLabel} (este mês) — sai logo desta lista. Os meses anteriores em que esteve ativa mantêm-se inalterados.`
  }
  return `Ainda conta em ${currentMonthLabel} (este mês) e deixa de ser contabilizada a partir de ${nextMonthLabel}. Por isso continua a aparecer na lista deste mês.`
})

function choose(option: 'current' | 'next') {
  chosen.value = option
  step.value = 'confirm'
}

function confirm() {
  if (chosen.value === 'current') emit('removeFromCurrentMonth')
  else emit('removeFromNextMonth')
}

function formatAmount(amount: number, type: TransactionType): string {
  const formatted = new Intl.NumberFormat('pt-PT', { ...PT_GROUPING,
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2
  }).format(Math.abs(amount))
  return type === TransactionType.Expense ? `-${formatted}` : formatted
}
</script>

<template>
  <BaseModal
    v-if="open && recurring"
    title="Retirar conta recorrente"
    size="sm"
    @close="$emit('close')"
  >
    <!-- Passo 1: escolher a opção -->
    <template v-if="step === 'choose'">
      <p class="modal-message">
        Como deseja retirar
        <strong>{{ recurring ? `${TRANSACTION_CATEGORY_LABELS[recurring.category]} (${formatAmount(recurring.amount, recurring.type)})` : '' }}</strong>?
      </p>
      <div class="options">
        <button type="button" class="option-btn" :disabled="loading" @click="choose('current')">
          <span class="option-title">A partir deste mês</span>
          <span class="option-desc">Deixa de ser contabilizada já neste mês e nos próximos</span>
          <svg class="option-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
        <button type="button" class="option-btn" :disabled="loading" @click="choose('next')">
          <span class="option-title">A partir do próximo mês</span>
          <span class="option-desc">Conta este mês, mas deixa de contar nos próximos</span>
          <svg class="option-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>
    </template>

    <!-- Passo 2: confirmar com explicação -->
    <template v-else>
      <div class="confirm-box">
        <p class="confirm-heading">{{ chosen === 'current' ? 'A partir deste mês' : 'A partir do próximo mês' }}</p>
        <p class="confirm-text">{{ explanation }}</p>
      </div>
      <p v-if="error" class="remove-error">{{ error }}</p>
    </template>

    <template #footer>
      <UiButton v-if="step === 'choose'" variant="secondary" @click="$emit('close')">Cancelar</UiButton>
      <template v-else>
        <UiButton variant="secondary" :disabled="loading" @click="step = 'choose'">Voltar</UiButton>
        <UiButton variant="danger" :loading="loading" @click="confirm">Confirmar</UiButton>
      </template>
    </template>
  </BaseModal>
</template>

<style scoped>
.modal-message {
  margin: 0 0 var(--space-4);
  font-size: var(--text-base);
  line-height: 1.55;
  color: var(--color-text-secondary);
}
.modal-message strong {
  color: var(--color-text-strong);
}

.options {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.option-btn {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: var(--space-3) 40px var(--space-3) var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast), box-shadow var(--transition-fast);
}
.option-btn:hover:not(:disabled) {
  border-color: var(--color-primary-soft-border);
  background: var(--color-surface-hover);
}
.option-btn:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--focus-ring);
}
.option-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.option-title {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}
.option-desc {
  font-size: var(--text-sm);
  line-height: 1.4;
  color: var(--color-text-muted);
}
.option-chevron {
  position: absolute;
  right: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-subtle);
}

.confirm-box {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}
.confirm-heading {
  margin: 0 0 6px;
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}
.confirm-text {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.55;
  color: var(--color-text-secondary);
}

.remove-error {
  margin: var(--space-3) 0 0;
  padding: 10px 12px;
  font-size: var(--text-sm);
  color: var(--color-danger);
  background: var(--color-danger-soft);
  border: 1px solid var(--color-danger-border);
  border-radius: var(--radius-sm);
}
</style>
