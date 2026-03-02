<script setup lang="ts">
import BaseModal from './BaseModal.vue'
import type { RecurringTransaction } from '@/types/recurringTransaction'
import {
  TRANSACTION_CATEGORY_LABELS,
  TransactionType
} from '@/types/transaction'

defineProps<{
  open: boolean
  recurring: RecurringTransaction | null
  loading?: boolean
}>()

defineEmits<{
  close: []
  removeFromCurrentMonth: []
  removeFromNextMonth: []
}>()

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
    <p class="modal-message">
      Como deseja retirar
      <strong>{{ recurring ? `${TRANSACTION_CATEGORY_LABELS[recurring.category]} (${formatAmount(recurring.amount, recurring.type)})` : '' }}</strong>?
    </p>
    <div class="options">
      <button
        type="button"
        class="option-btn"
        :disabled="loading"
        @click="$emit('removeFromCurrentMonth')"
      >
        <span class="option-title">A partir deste mês</span>
        <span class="option-desc">Deixa de ser contabilizada já neste mês e nos próximos</span>
      </button>
      <button
        type="button"
        class="option-btn"
        :disabled="loading"
        @click="$emit('removeFromNextMonth')"
      >
        <span class="option-title">A partir do próximo mês</span>
        <span class="option-desc">Conta este mês, mas deixa de contar nos próximos</span>
      </button>
    </div>
    <div class="modal-actions">
      <button type="button" class="btn-cancel" @click="$emit('close')">
        Cancelar
      </button>
    </div>
  </BaseModal>
</template>

<style scoped>
.modal-message {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0 0 1rem 0;
  line-height: 1.5;
}

.modal-message strong {
  color: #334155;
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
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;
}

.option-btn:hover:not(:disabled) {
  border-color: #2563eb;
  background: #eff6ff;
}

.option-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.option-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #334155;
}

.option-desc {
  font-size: 0.8125rem;
  color: #64748b;
  margin-top: 0.25rem;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.btn-cancel {
  padding: 0.5rem 1rem;
  background: #f1f5f9;
  color: #475569;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  cursor: pointer;
}

.btn-cancel:hover {
  background: #e2e8f0;
}
</style>
