<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import type { Transaction, CreateTransactionRequest, TransactionSplitInput } from '@/types/transaction'
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_CATEGORY_LABELS,
  TransactionType,
  TransactionCategory
} from '@/types/transaction'
import type { Account } from '@/types/account'
import type { HouseholdMember } from '@/types/household'

const props = defineProps<{
  open: boolean
  transaction?: Transaction | null
  accounts: Account[]
  members: HouseholdMember[]
  isCouple: boolean
  currentUserId: string
  loading?: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: CreateTransactionRequest]
}>()

const accountId = ref('')
const type = ref<TransactionType>(TransactionType.Expense)
const category = ref<TransactionCategory>(TransactionCategory.Other)
const amount = ref<number>(0)
const date = ref('')
const description = ref('')

// For couples: splits e.g. [{ userId, percentage }]
const splits = ref<{ userId: string; percentage: number }[]>([])

const errors = ref<Record<string, string>>({})

const isEdit = computed(() => !!props.transaction)

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

const splitsTotal = computed(() =>
  splits.value.reduce((sum, s) => sum + s.percentage, 0)
)

watch(
  () => props.open,
  (open) => {
    if (open) {
      errors.value = {}
      if (props.transaction) {
        accountId.value = props.transaction.accountId
        type.value = props.transaction.type
        category.value = props.transaction.category
        amount.value = props.transaction.amount
        date.value = props.transaction.date.slice(0, 10)
        description.value = props.transaction.description ?? ''
        if (props.transaction.splits.length > 0) {
          splits.value = props.transaction.splits.map((s) => ({
            userId: s.userId,
            percentage: s.percentage
          }))
        } else {
          splits.value = props.isCouple
            ? props.members.map((m) => ({ userId: m.id, percentage: 100 / props.members.length }))
            : [{ userId: props.currentUserId, percentage: 100 }]
        }
      } else {
        accountId.value = props.accounts[0]?.id ?? ''
        type.value = TransactionType.Expense
        category.value = TransactionCategory.Other
        amount.value = 0
        date.value = new Date().toISOString().slice(0, 10)
        description.value = ''
        if (props.isCouple && props.members.length >= 2) {
          const n = props.members.length
          const base = Math.floor(100 / n)
          const remainder = 100 - base * n
          splits.value = props.members.map((m, i) => ({
            userId: m.id,
            percentage: base + (i < remainder ? 1 : 0)
          }))
        } else {
          splits.value = [{ userId: props.currentUserId, percentage: 100 }]
        }
      }
    }
  }
)

watch(type, () => {
  if (!categoryOptions.value.includes(category.value)) {
    category.value = categoryOptions.value[0]
  }
})

function validate(): boolean {
  const e: Record<string, string> = {}
  if (!accountId.value) e.accountId = 'Seleciona uma conta'
  if (amount.value === 0) e.amount = 'O valor não pode ser zero'
  if (!date.value) e.date = 'Data é obrigatória'
  if (props.isCouple && splits.value.length > 0) {
    const total = splitsTotal.value
    if (Math.abs(total - 100) > 0.01) e.splits = 'As percentagens devem somar 100%'
    const invalid = splits.value.some((s) => s.percentage <= 0 || s.percentage > 100)
    if (invalid) e.splits = e.splits ?? 'Percentagens inválidas'
  }
  errors.value = e
  return Object.keys(e).length === 0
}

function handleSubmit() {
  if (!validate()) return
  const payload: CreateTransactionRequest = {
    accountId: accountId.value,
    type: type.value,
    category: category.value,
    amount: amount.value,
    date: date.value,
    description: description.value.trim() || undefined
  }
  if (props.isCouple && splits.value.length > 0) {
    payload.splits = splits.value.map((s) => ({
      userId: s.userId,
      percentage: s.percentage
    })) as TransactionSplitInput[]
  }
  emit('submit', payload)
}

function handleClose() {
  if (!props.loading) emit('close')
}

function getMemberName(userId: string): string {
  const m = props.members.find((x) => x.id === userId)
  return m ? `${m.firstName} ${m.lastName}` : '?'
}
</script>

<template>
  <BaseModal
    v-if="open"
    :title="isEdit ? 'Editar transação' : 'Nova transação'"
    @close="handleClose"
  >
    <form @submit.prevent="handleSubmit" class="transaction-form">
      <div class="form-group">
        <label for="tx-account">Conta</label>
        <select
          id="tx-account"
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
          <label for="tx-type">Tipo</label>
          <select id="tx-type" v-model="type" class="input">
            <option
              v-for="(label, val) in TRANSACTION_TYPE_LABELS"
              :key="val"
              :value="Number(val)"
            >
              {{ label }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label for="tx-category">Categoria</label>
          <select id="tx-category" v-model="category" class="input">
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

      <div class="form-row">
        <div class="form-group">
          <label for="tx-amount">Valor (€)</label>
          <input
            id="tx-amount"
            v-model.number="amount"
            type="number"
            step="0.01"
            class="input"
            :class="{ 'input-error': errors.amount }"
            placeholder="0.00"
          />
          <span v-if="errors.amount" class="error-text">{{ errors.amount }}</span>
        </div>
        <div class="form-group">
          <label for="tx-date">Data</label>
          <input
            id="tx-date"
            v-model="date"
            type="date"
            class="input"
            :class="{ 'input-error': errors.date }"
          />
          <span v-if="errors.date" class="error-text">{{ errors.date }}</span>
        </div>
      </div>

      <div class="form-group">
        <label for="tx-desc">Descrição (opcional)</label>
        <input
          id="tx-desc"
          v-model="description"
          type="text"
          class="input"
          placeholder="Ex: Supermercado"
          maxlength="500"
        />
      </div>

      <div v-if="isCouple && members.length > 0" class="form-group splits-section">
        <label>Repartição (%)</label>
        <p class="splits-hint">Percentagens devem somar 100%</p>
        <div v-for="(s, i) in splits" :key="s.userId" class="split-row">
          <span class="split-name">{{ getMemberName(s.userId) }}</span>
          <input
            v-model.number="splits[i].percentage"
            type="number"
            min="0"
            max="100"
            step="1"
            class="input split-input"
          />
          <span class="split-pct">%</span>
        </div>
        <span v-if="errors.splits" class="error-text">{{ errors.splits }}</span>
        <span v-else-if="splits.length > 0" class="split-total" :class="{ 'total-ok': Math.abs(splitsTotal - 100) < 0.01 }">
          Total: {{ splitsTotal.toFixed(1) }}%
        </span>
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
.transaction-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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

.splits-section {
  padding-top: 0.5rem;
  border-top: 1px solid #f1f5f9;
}

.splits-hint {
  font-size: 0.75rem;
  color: #64748b;
  margin: 0 0 0.5rem 0;
}

.split-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.split-name {
  flex: 1;
  font-size: 0.875rem;
  color: #334155;
}

.split-input {
  width: 70px;
}

.split-pct {
  font-size: 0.875rem;
  color: #64748b;
}

.split-total {
  font-size: 0.8125rem;
  color: #dc2626;
  margin-top: 0.25rem;
}

.split-total.total-ok {
  color: #059669;
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
