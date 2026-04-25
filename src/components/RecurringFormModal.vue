<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import type { CreateRecurringTransactionRequest, RecurringTransaction } from '@/types/recurringTransaction'
import { RecurringFrequency } from '@/types/recurringTransaction'
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_CATEGORY_LABELS,
  TransactionType,
  TransactionCategory
} from '@/types/transaction'
import type { Account } from '@/types/account'

const props = defineProps<{
  open: boolean
  recurring?: RecurringTransaction | null
  accounts: Account[]
  loading?: boolean
  isTransfer?: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: CreateRecurringTransactionRequest]
}>()

const accountId = ref('')
const destinationAccountId = ref('')
const type = ref<TransactionType>(TransactionType.Expense)
const category = ref<TransactionCategory>(TransactionCategory.Other)
const amount = ref<number>(0)
const description = ref('')
const frequency = ref<RecurringFrequency>(RecurringFrequency.Monthly)

const errors = ref<Record<string, string>>({})

const isEdit = computed(() => !!props.recurring)

const incomeCategories = [
  TransactionCategory.Salary,
  TransactionCategory.Freelance,
  TransactionCategory.Investment,
  TransactionCategory.Gift,
  TransactionCategory.Refund,
  TransactionCategory.Other
]

const expenseCategories = [
  TransactionCategory.Food,
  TransactionCategory.Transport,
  TransactionCategory.Housing,
  TransactionCategory.Utilities,
  TransactionCategory.Health,
  TransactionCategory.Entertainment,
  TransactionCategory.Shopping,
  TransactionCategory.Education,
  TransactionCategory.Other
]

const categoryOptions = computed(() =>
  type.value === TransactionType.Income ? incomeCategories : expenseCategories
)

const destinationOptions = computed(() =>
  props.accounts.filter((a) => a.id !== accountId.value)
)

const isTransferMode = computed(() => props.isTransfer || type.value === TransactionType.Transfer)

watch(
  () => props.open,
  (open) => {
    if (open) {
      errors.value = {}
      if (props.recurring) {
        accountId.value = props.recurring.accountId
        type.value = props.recurring.type
        category.value = props.recurring.category
        amount.value = props.recurring.amount
        description.value = props.recurring.description ?? ''
        destinationAccountId.value = props.recurring.destinationAccountId ?? ''
        frequency.value = props.recurring.frequency ?? RecurringFrequency.Monthly
      } else {
        accountId.value = props.accounts[0]?.id ?? ''
        type.value = props.isTransfer ? TransactionType.Transfer : TransactionType.Expense
        category.value = props.isTransfer ? TransactionCategory.Transfer : TransactionCategory.Other
        amount.value = 0
        description.value = ''
        destinationAccountId.value = ''
        frequency.value = RecurringFrequency.Monthly
      }
    }
  }
)

watch(type, () => {
  if (type.value !== TransactionType.Transfer && !categoryOptions.value.includes(category.value)) {
    category.value = categoryOptions.value[0]
  }
})

function validate(): boolean {
  const e: Record<string, string> = {}
  if (!accountId.value) e.accountId = 'Seleciona uma conta'
  if (amount.value === 0) e.amount = 'O valor não pode ser zero'
  if (isTransferMode.value) {
    if (!destinationAccountId.value) e.destinationAccountId = 'Seleciona a conta de destino'
    if (destinationAccountId.value === accountId.value) e.destinationAccountId = 'A conta de destino deve ser diferente'
  }
  errors.value = e
  return Object.keys(e).length === 0
}

function handleSubmit() {
  if (!validate()) return
  const transfer = isTransferMode.value
  emit('submit', {
    accountId: accountId.value,
    type: transfer ? TransactionType.Transfer : type.value,
    category: transfer ? TransactionCategory.Transfer : category.value,
    amount: amount.value,
    description: description.value.trim() || undefined,
    destinationAccountId: transfer ? destinationAccountId.value : undefined,
    frequency: frequency.value
  })
}

function handleClose() {
  if (!props.loading) emit('close')
}

const monthlyEquivalent = computed(() => {
  if (frequency.value !== RecurringFrequency.Annual || !amount.value) return ''
  const monthly = (amount.value / 12).toFixed(2)
  return `≈ ${monthly} €/mês`
})

const modalTitle = computed(() => {
  if (isEdit.value) {
    return isTransferMode.value ? 'Editar transferência recorrente' : 'Editar transação recorrente'
  }
  return isTransferMode.value ? 'Nova transferência recorrente' : 'Nova transação recorrente'
})
</script>

<template>
  <BaseModal
    v-if="open"
    :title="modalTitle"
    @close="handleClose"
  >
    <form @submit.prevent="handleSubmit" class="recurring-form">
      <p class="form-hint">
        {{ isTransferMode ? 'Esta transferência será aplicada automaticamente ao mês atual e aos próximos.' : frequency === 0 ? 'Esta receita/despesa será aplicada automaticamente ao mês atual e aos próximos.' : 'O valor anual será dividido por 12 e contabilizado mensalmente.' }}
      </p>

      <!-- Frequency selector (not shown for transfers) -->
      <div v-if="!isTransferMode" class="form-group">
        <label for="rec-frequency">Frequência</label>
        <div class="frequency-toggle">
          <button
            type="button"
            class="freq-btn"
            :class="{ active: frequency === 0 }"
            @click="frequency = 0"
          >
            Mensal
          </button>
          <button
            type="button"
            class="freq-btn"
            :class="{ active: frequency === 1 }"
            @click="frequency = 1"
          >
            Anual
          </button>
        </div>
      </div>

      <!-- Transfer mode -->
      <template v-if="isTransferMode">
        <div class="form-group">
          <label for="rec-account">Conta de origem</label>
          <select
            id="rec-account"
            v-model="accountId"
            class="input"
            :class="{ 'input-error': errors.accountId }"
          >
            <option value="">Seleciona uma conta</option>
            <option v-for="a in accounts" :key="a.id" :value="a.id">
              {{ a.name }}
            </option>
          </select>
          <span v-if="errors.accountId" class="error-text">{{ errors.accountId }}</span>
        </div>

        <div class="form-group">
          <label for="rec-dest-account">Conta de destino</label>
          <select
            id="rec-dest-account"
            v-model="destinationAccountId"
            class="input"
            :class="{ 'input-error': errors.destinationAccountId }"
          >
            <option value="">Seleciona uma conta</option>
            <option v-for="a in destinationOptions" :key="a.id" :value="a.id">
              {{ a.name }}
            </option>
          </select>
          <span v-if="errors.destinationAccountId" class="error-text">{{ errors.destinationAccountId }}</span>
        </div>
      </template>

      <!-- Normal mode -->
      <template v-else>
        <div class="form-group">
          <label for="rec-account">Conta</label>
          <select
            id="rec-account"
            v-model="accountId"
            class="input"
            :class="{ 'input-error': errors.accountId }"
          >
            <option value="">Seleciona uma conta</option>
            <option v-for="a in accounts" :key="a.id" :value="a.id">
              {{ a.name }}
            </option>
          </select>
          <span v-if="errors.accountId" class="error-text">{{ errors.accountId }}</span>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="rec-type">Tipo</label>
            <select id="rec-type" v-model="type" class="input">
              <option
                v-for="(label, val) in TRANSACTION_TYPE_LABELS"
                :key="val"
                :value="Number(val)"
                v-show="Number(val) !== TransactionType.Transfer"
              >
                {{ label }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label for="rec-category">Categoria</label>
            <select id="rec-category" v-model="category" class="input">
              <option
                v-for="c in categoryOptions"
                :key="c"
                :value="c"
              >
                {{ TRANSACTION_CATEGORY_LABELS[c] }}
              </option>
            </select>
          </div>
        </div>
      </template>

      <div class="form-group">
        <label for="rec-amount">{{ frequency === 1 ? 'Valor anual (€)' : 'Valor (€)' }}</label>
        <input
          id="rec-amount"
          v-model.number="amount"
          type="number"
          step="0.01"
          class="input"
          :class="{ 'input-error': errors.amount }"
          :placeholder="frequency === 1 ? 'Ex: 600.00' : '0.00'"
        />
        <span v-if="errors.amount" class="error-text">{{ errors.amount }}</span>
        <span v-if="monthlyEquivalent" class="monthly-hint">{{ monthlyEquivalent }}</span>
      </div>

      <div class="form-group">
        <label for="rec-desc">Descrição (opcional)</label>
        <input
          id="rec-desc"
          v-model="description"
          type="text"
          class="input"
          placeholder="Ex: Netflix mensal"
          maxlength="500"
        />
      </div>

      <div class="modal-actions">
        <button type="button" class="btn-cancel" @click="handleClose">
          Cancelar
        </button>
        <button type="submit" class="btn-primary" :disabled="loading">
          {{ loading ? 'A guardar...' : (isEdit ? 'Guardar' : 'Criar') }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>

<style scoped>
.recurring-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-hint {
  font-size: 0.8125rem;
  color: #64748b;
  margin: 0 0 0.25rem 0;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-group label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #475569;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.input {
  padding: 0.625rem 0.875rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9375rem;
}

.input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
}

.input-error {
  border-color: #dc2626;
}

.error-text {
  font-size: 0.75rem;
  color: #dc2626;
}

.frequency-toggle {
  display: flex;
  gap: 0;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.freq-btn {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: none;
  background: transparent;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.freq-btn:first-child {
  border-right: 1px solid #e2e8f0;
}

.freq-btn.active {
  background: #166534;
  color: white;
}

.freq-btn:not(.active):hover {
  background: #f1f5f9;
}

.monthly-hint {
  font-size: 0.75rem;
  color: #166534;
  font-weight: 500;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
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

.btn-primary {
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.95;
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
