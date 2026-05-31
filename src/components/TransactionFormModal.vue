<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import BaseSelect from './BaseSelect.vue'
import type { Transaction, CreateTransactionRequest } from '@/types/transaction'
import {
  TRANSACTION_CATEGORY_LABELS,
  TransactionType,
  TransactionCategory,
  TransactionEntityType
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
  /** Para nova transação: data inicial (yyyy-MM-dd), p.ex. 1.º dia do mês do filtro na lista */
  defaultDateForNew?: string | null
  /** Se true, o form mostra modo transferência (sem tipo/categoria, com conta destino) */
  isTransfer?: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: CreateTransactionRequest]
}>()

const accountId = ref('')
const destinationAccountId = ref('')
const type = ref<TransactionType>(TransactionType.Expense)
const category = ref<TransactionCategory>(TransactionCategory.Other)
const amount = ref<number | null>(null)
const date = ref('')
const description = ref('')
const entityType = ref<TransactionEntityType>(TransactionEntityType.Entity)
const entityName = ref('')

/** Data de hoje em formato local yyyy-MM-dd (evita o desvio de fuso do toISOString). */
function todayLocal(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

// Casais: responsável pelo movimento (substitui a antiga repartição por %).
const responsibleUserId = ref('')

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

const destinationOptions = computed(() =>
  props.accounts.filter((a) => a.id !== accountId.value)
)

// Opções para os dropdowns personalizados (BaseSelect)
const accountOptions = computed(() => props.accounts.map((a) => ({ value: a.id, label: a.name })))
const destinationAccountOptions = computed(() =>
  destinationOptions.value.map((a) => ({ value: a.id, label: a.name }))
)
const categorySelectOptions = computed(() =>
  categoryOptions.value.map((c) => ({ value: c as number, label: TRANSACTION_CATEGORY_LABELS[c] }))
)
const entityTypeOptions = [
  { value: TransactionEntityType.Entity as number, label: 'Entidade' },
  { value: TransactionEntityType.Person as number, label: 'Pessoa' }
]
const memberOptions = computed(() =>
  props.members.map((m) => ({ value: m.id, label: `${m.firstName} ${m.lastName}` }))
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
        entityType.value = props.transaction.entityType ?? TransactionEntityType.Entity
        entityName.value = props.transaction.entityName ?? ''
        destinationAccountId.value = props.transaction.destinationAccountId ?? ''
        // Responsável = quem tem maior peso no movimento (compatível com dados antigos de repartição).
        const top = [...props.transaction.splits].sort((a, b) => b.percentage - a.percentage)[0]
        responsibleUserId.value = top?.userId ?? props.currentUserId
      } else {
        accountId.value = props.accounts[0]?.id ?? ''
        type.value = props.isTransfer ? TransactionType.Transfer : TransactionType.Expense
        category.value = props.isTransfer ? TransactionCategory.Transfer : TransactionCategory.Other
        amount.value = null
        // Data por defeito = sempre o dia atual.
        date.value = todayLocal()
        description.value = ''
        entityType.value = TransactionEntityType.Entity
        entityName.value = ''
        destinationAccountId.value = ''
        responsibleUserId.value = props.currentUserId
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
  if (!amount.value || amount.value === 0) e.amount = 'Indica o montante'
  if (!date.value) e.date = 'Data é obrigatória'
  if (props.isTransfer || type.value === TransactionType.Transfer) {
    if (!destinationAccountId.value) e.destinationAccountId = 'Seleciona a conta de destino'
    if (destinationAccountId.value === accountId.value) e.destinationAccountId = 'A conta de destino deve ser diferente'
  }
  if (props.isCouple && type.value !== TransactionType.Transfer && !props.isTransfer && !responsibleUserId.value) {
    e.responsible = 'Seleciona o responsável'
  }
  errors.value = e
  return Object.keys(e).length === 0
}

function handleSubmit() {
  if (!validate()) return
  const isTransferMode = props.isTransfer || type.value === TransactionType.Transfer
  const payload: CreateTransactionRequest = {
    accountId: accountId.value,
    type: isTransferMode ? TransactionType.Transfer : type.value,
    category: isTransferMode ? TransactionCategory.Transfer : category.value,
    amount: Number(amount.value),
    date: date.value,
    description: description.value.trim() || undefined,
    entityType: isTransferMode ? undefined : entityType.value,
    entityName: isTransferMode ? undefined : (entityName.value.trim() || undefined),
    destinationAccountId: isTransferMode ? destinationAccountId.value : undefined
  }
  if (props.isCouple && !isTransferMode && responsibleUserId.value) {
    // Sem repartição: o responsável fica com 100% do movimento.
    payload.splits = [{ userId: responsibleUserId.value, percentage: 100 }]
  }
  emit('submit', payload)
}

function handleClose() {
  if (!props.loading) emit('close')
}

const isTransferMode = computed(() => props.isTransfer || type.value === TransactionType.Transfer)

const modalTitle = computed(() => {
  if (isEdit.value) {
    return isTransferMode.value ? 'Editar transferência' : 'Editar movimento'
  }
  return isTransferMode.value ? 'Nova transferência' : 'Novo movimento'
})
</script>

<template>
  <BaseModal
    v-if="open"
    :title="modalTitle"
    @close="handleClose"
  >
    <form @submit.prevent="handleSubmit" class="transaction-form">
      <!-- Transfer mode: source & destination accounts -->
      <template v-if="isTransferMode">
        <div class="form-group">
          <label>Conta de origem</label>
          <BaseSelect
            :model-value="accountId"
            :options="accountOptions"
            placeholder="Seleciona uma conta"
            :error="!!errors.accountId"
            @update:model-value="(v) => (accountId = String(v))"
          />
          <span v-if="errors.accountId" class="error-text">{{ errors.accountId }}</span>
        </div>

        <div class="form-group">
          <label>Conta de destino</label>
          <BaseSelect
            :model-value="destinationAccountId"
            :options="destinationAccountOptions"
            placeholder="Seleciona uma conta"
            :error="!!errors.destinationAccountId"
            @update:model-value="(v) => (destinationAccountId = String(v))"
          />
          <span v-if="errors.destinationAccountId" class="error-text">{{ errors.destinationAccountId }}</span>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="tx-amount-t">Montante</label>
            <div class="amount-wrap">
              <input
                id="tx-amount-t"
                v-model.number="amount"
                type="number"
                step="0.01"
                class="input amount-input"
                :class="{ 'input-error': errors.amount }"
                placeholder="0,00"
              />
              <span class="amount-suffix">€</span>
            </div>
            <span v-if="errors.amount" class="error-text">{{ errors.amount }}</span>
          </div>
          <div class="form-group">
            <label for="tx-date-t">Data</label>
            <input
              id="tx-date-t"
              v-model="date"
              type="date"
              class="input"
              :class="{ 'input-error': errors.date }"
            />
            <span v-if="errors.date" class="error-text">{{ errors.date }}</span>
          </div>
        </div>

        <div class="form-group">
          <label for="tx-desc-t">Descrição</label>
          <input
            id="tx-desc-t"
            v-model="description"
            type="text"
            class="input"
            placeholder="Ex: Transferência para poupança"
            maxlength="500"
          />
        </div>
      </template>

      <!-- Normal mode: account + type/category -->
      <template v-else>
        <div class="form-group">
          <label>Conta</label>
          <BaseSelect
            :model-value="accountId"
            :options="accountOptions"
            placeholder="Seleciona uma conta"
            :error="!!errors.accountId"
            @update:model-value="(v) => (accountId = String(v))"
          />
          <span v-if="errors.accountId" class="error-text">{{ errors.accountId }}</span>
        </div>

        <div class="form-group">
          <label>Tipo</label>
          <div class="type-toggle">
            <button
              type="button"
              class="type-toggle-btn"
              :class="{ 'active-expense': type === TransactionType.Expense }"
              @click="type = TransactionType.Expense"
            >
              Despesa
            </button>
            <button
              type="button"
              class="type-toggle-btn"
              :class="{ 'active-income': type === TransactionType.Income }"
              @click="type = TransactionType.Income"
            >
              Receita
            </button>
          </div>
        </div>

        <div class="form-group">
          <label for="tx-name">Nome</label>
          <input
            id="tx-name"
            v-model="description"
            type="text"
            class="input"
            placeholder="Ex: Compras no supermercado"
            maxlength="500"
          />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="tx-amount">Montante</label>
            <div class="amount-wrap">
              <input
                id="tx-amount"
                v-model.number="amount"
                type="number"
                step="0.01"
                class="input amount-input"
                :class="{ 'input-error': errors.amount }"
                placeholder="0,00"
              />
              <span class="amount-suffix">€</span>
            </div>
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
          <label>Categoria</label>
          <BaseSelect
            :model-value="category"
            :options="categorySelectOptions"
            @update:model-value="(v) => (category = Number(v) as TransactionCategory)"
          />
        </div>

        <div class="form-row form-row--entity">
          <div class="form-group">
            <label>Tipo de entidade</label>
            <BaseSelect
              :model-value="entityType"
              :options="entityTypeOptions"
              @update:model-value="(v) => (entityType = Number(v) as TransactionEntityType)"
            />
          </div>
          <div class="form-group">
            <label for="tx-entity-name">
              {{ entityType === TransactionEntityType.Person ? 'Nome da pessoa' : 'Entidade' }}
            </label>
            <input
              id="tx-entity-name"
              v-model="entityName"
              type="text"
              class="input"
              :placeholder="entityType === TransactionEntityType.Person ? 'Ex: João Silva' : 'Ex: Continente'"
              maxlength="200"
            />
          </div>
        </div>
      </template>

      <div v-if="isCouple && members.length > 0 && !isTransferMode" class="form-group">
        <label>Responsável pelo movimento</label>
        <BaseSelect
          :model-value="responsibleUserId"
          :options="memberOptions"
          placeholder="Seleciona o responsável"
          :error="!!errors.responsible"
          @update:model-value="(v) => (responsibleUserId = String(v))"
        />
        <span v-if="errors.responsible" class="error-text">{{ errors.responsible }}</span>
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
  color: var(--color-text-muted, #475569);
}

.type-toggle {
  display: flex;
  gap: 4px;
  padding: 4px;
  border: 1.5px solid var(--color-border, #e2e8f0);
  border-radius: 10px;
  background: var(--color-bg, #f8fafc);
}

.type-toggle-btn {
  flex: 1;
  padding: 0.625rem 0.5rem;
  border: none;
  background: transparent;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text-muted, #64748b);
  cursor: pointer;
  border-radius: 7px;
  transition: background 0.15s, color 0.15s;
  font-family: inherit;
}

.type-toggle-btn:hover {
  color: var(--color-text, #1e293b);
}

.type-toggle-btn.active-expense {
  background: #dc2626;
  color: #fff;
}

.type-toggle-btn.active-income {
  background: #059669;
  color: #fff;
}

html.dark .type-toggle-btn.active-income {
  background: #047857;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

/* Tipo de entidade (curto) + nome (mais largo) */
.form-row--entity {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr);
}

.form-row .input {
  min-width: 0;
}

.amount-wrap {
  position: relative;
}

.amount-input {
  width: 100%;
  padding-right: 2rem;
  /* Esconde as setas do input numérico para o € ficar limpo */
  -moz-appearance: textfield;
  appearance: textfield;
}

.amount-input::-webkit-outer-spin-button,
.amount-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.amount-suffix {
  position: absolute;
  right: 0.875rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text-muted, #64748b);
  pointer-events: none;
}

.input {
  padding: 0.625rem 0.875rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9375rem;
}

.input:focus {
  outline: none;
  border-color: #166534;
  box-shadow: 0 0 0 2px rgba(22, 101, 52, 0.2);
}

html.dark .input:focus {
  border-color: #4ade80;
  box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.2);
}

.input-error {
  border-color: #dc2626;
}

.error-text {
  font-size: 0.75rem;
  color: #dc2626;
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
  background: linear-gradient(135deg, #166534 0%, #15803d 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
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
