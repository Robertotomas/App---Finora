<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BaseModal from './BaseModal.vue'
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
  const formatted = new Intl.NumberFormat('pt-PT', {
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
        </button>
        <button type="button" class="option-btn" :disabled="loading" @click="choose('next')">
          <span class="option-title">A partir do próximo mês</span>
          <span class="option-desc">Conta este mês, mas deixa de contar nos próximos</span>
        </button>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn-cancel" @click="$emit('close')">
          Cancelar
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
      <div class="modal-actions">
        <button type="button" class="btn-cancel" :disabled="loading" @click="step = 'choose'">
          Voltar
        </button>
        <button type="button" class="btn-confirm" :disabled="loading" @click="confirm">
          {{ loading ? 'A retirar…' : 'Confirmar' }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
.modal-message {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0 0 1rem 0;
  line-height: 1.5;
}

.modal-message strong {
  color: var(--color-text);
}

.options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.option-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;
}

.option-btn:hover:not(:disabled) {
  border-color: #166534;
  background: var(--color-table-row-hover);
}

.option-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.option-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
}

.option-desc {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin-top: 0.25rem;
}

.confirm-box {
  padding: 1rem;
  margin-bottom: 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg);
}

.confirm-heading {
  margin: 0 0 0.375rem;
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-text);
}

.confirm-text {
  margin: 0;
  font-size: 0.8438rem;
  line-height: 1.5;
  color: var(--color-text-muted);
}

.remove-error {
  margin: 0 0 1rem;
  padding: 0.625rem 0.75rem;
  font-size: 0.8125rem;
  color: #dc2626;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.btn-cancel {
  padding: 0.5rem 1rem;
  background: transparent;
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 0.875rem;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-cancel:hover:not(:disabled) {
  background: var(--color-table-row-hover);
}

.btn-cancel:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-confirm {
  padding: 0.5rem 1.125rem;
  background: linear-gradient(135deg, #166534 0%, #15803d 100%);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 650;
  font-family: inherit;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}

.btn-confirm:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(22, 101, 52, 0.25);
}

.btn-confirm:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
