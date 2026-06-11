<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import BaseSelect from './BaseSelect.vue'
import CategorySelect from './CategorySelect.vue'
import BrandAutocomplete from './BrandAutocomplete.vue'
import type { CreateRecurringTransactionRequest, RecurringTransaction } from '@/types/recurringTransaction'
import {
  RecurringFrequency,
  MONTH_LABELS,
  recurringOccurrencesPerYear,
  recurringPaymentMonths,
  shortMonthLabel
} from '@/types/recurringTransaction'
import {
  TransactionType,
  TransactionCategory,
  TransactionEntityType
} from '@/types/transaction'
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '@/types/categoryMeta'
import type { Account } from '@/types/account'
import type { HouseholdMember } from '@/types/household'

const props = defineProps<{
  open: boolean
  recurring?: RecurringTransaction | null
  accounts: Account[]
  members?: HouseholdMember[]
  isCouple?: boolean
  currentUserId?: string
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
const category = ref<TransactionCategory>(TransactionCategory.OtherExpense)
const amount = ref<number | null>(null)
const description = ref('')
const entityType = ref<TransactionEntityType>(TransactionEntityType.Entity)
const entityName = ref('')
const frequency = ref<RecurringFrequency>(RecurringFrequency.Monthly)
const spread = ref(true)
const referenceMonth = ref<number>(new Date().getMonth() + 1)
// Casais: responsável pela recorrente (mesmo padrão dos movimentos).
const responsibleUserId = ref('')

const memberOptions = computed(() =>
  (props.members ?? []).map((m) => ({ value: m.id, label: `${m.firstName} ${m.lastName}` }))
)
const showResponsible = computed(
  () => !!props.isCouple && (props.members ?? []).length > 0 && !isTransferMode.value
)

const errors = ref<Record<string, string>>({})

const isEdit = computed(() => !!props.recurring)
const isPeriodic = computed(() => frequency.value !== RecurringFrequency.Monthly)

const monthOptions = computed(() =>
  Object.entries(MONTH_LABELS).map(([value, label]) => ({ value: Number(value), label }))
)

const categoryOptions = computed(() =>
  type.value === TransactionType.Income ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
)

const destinationOptions = computed(() =>
  props.accounts.filter((a) => a.id !== accountId.value)
)

const isTransferMode = computed(() => props.isTransfer || type.value === TransactionType.Transfer)

// Opções para os dropdowns personalizados (BaseSelect)
const accountOptions = computed(() => props.accounts.map((a) => ({ value: a.id, label: a.name })))
const destinationAccountOptions = computed(() =>
  destinationOptions.value.map((a) => ({ value: a.id, label: a.name }))
)
const entityTypeOptions = [
  { value: TransactionEntityType.Entity as number, label: 'Entidade' },
  { value: TransactionEntityType.Person as number, label: 'Pessoa' }
]

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
        entityType.value = props.recurring.entityType ?? TransactionEntityType.Entity
        entityName.value = props.recurring.entityName ?? ''
        destinationAccountId.value = props.recurring.destinationAccountId ?? ''
        frequency.value = props.recurring.frequency ?? RecurringFrequency.Monthly
        spread.value = props.recurring.annualMonth == null
        referenceMonth.value =
          props.recurring.annualMonth ?? props.recurring.startMonth ?? new Date().getMonth() + 1
        responsibleUserId.value = props.recurring.responsibleUserId ?? props.currentUserId ?? ''
      } else {
        accountId.value = props.accounts[0]?.id ?? ''
        type.value = props.isTransfer ? TransactionType.Transfer : TransactionType.Expense
        category.value = props.isTransfer ? TransactionCategory.Transfer : TransactionCategory.OtherExpense
        amount.value = null
        description.value = ''
        entityType.value = TransactionEntityType.Entity
        entityName.value = ''
        destinationAccountId.value = ''
        frequency.value = RecurringFrequency.Monthly
        spread.value = true
        referenceMonth.value = new Date().getMonth() + 1
        responsibleUserId.value = props.currentUserId ?? ''
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
  if (isTransferMode.value) {
    if (!destinationAccountId.value) e.destinationAccountId = 'Seleciona a conta de destino'
    if (destinationAccountId.value === accountId.value) e.destinationAccountId = 'A conta de destino deve ser diferente'
  }
  if (showResponsible.value && !responsibleUserId.value) {
    e.responsible = 'Seleciona o responsável'
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
    amount: Number(amount.value),
    description: description.value.trim() || undefined,
    entityType: transfer ? undefined : entityType.value,
    entityName: transfer ? undefined : (entityName.value.trim() || undefined),
    destinationAccountId: transfer ? destinationAccountId.value : undefined,
    frequency: frequency.value,
    annualMonth: isPeriodic.value && !spread.value ? referenceMonth.value : undefined,
    responsibleUserId: showResponsible.value ? responsibleUserId.value : undefined
  })
}

function handleClose() {
  if (!props.loading) emit('close')
}

const amountLabel = computed(() => {
  switch (frequency.value) {
    case RecurringFrequency.Quarterly: return 'Montante por trimestre'
    case RecurringFrequency.SemiAnnual: return 'Montante por semestre'
    case RecurringFrequency.Annual: return 'Montante anual'
    default: return 'Montante'
  }
})

const referenceMonthTooltip = computed(() => {
  switch (frequency.value) {
    case RecurringFrequency.Quarterly:
      return 'É o primeiro mês em que o pagamento sai. Os seguintes repetem-se de 3 em 3 meses.'
    case RecurringFrequency.SemiAnnual:
      return 'É o primeiro mês em que o pagamento sai. O outro é 6 meses depois.'
    default:
      return 'É o mês em que o pagamento sai.'
  }
})

const frequencyHint = computed(() => {
  if (!isPeriodic.value || !amount.value) return ''
  if (spread.value) {
    const occ = recurringOccurrencesPerYear(frequency.value)
    const monthly = (Number(amount.value) * occ / 12).toFixed(2)
    return `≈ ${monthly} €/mês (diluído)`
  }
  const labels = recurringPaymentMonths(frequency.value, referenceMonth.value)
    .map((m) => shortMonthLabel(m))
    .join(', ')
  return `${Number(amount.value).toFixed(2)} € em ${labels}`
})

const modalTitle = computed(() => {
  if (isEdit.value) {
    return isTransferMode.value ? 'Editar transferência recorrente' : 'Editar movimento recorrente'
  }
  return isTransferMode.value ? 'Nova transferência recorrente' : 'Novo movimento recorrente'
})
</script>

<template>
  <BaseModal
    v-if="open"
    :title="modalTitle"
    @close="handleClose"
  >
    <form @submit.prevent="handleSubmit" class="recurring-form">
      <!-- Frequência -->
      <div class="form-group">
        <label>Frequência</label>
        <div class="type-toggle type-toggle--freq">
          <button
            type="button"
            class="type-toggle-btn"
            :class="{ 'active-neutral': frequency === RecurringFrequency.Monthly }"
            @click="frequency = RecurringFrequency.Monthly"
          >
            Mensal
          </button>
          <button
            type="button"
            class="type-toggle-btn"
            :class="{ 'active-neutral': frequency === RecurringFrequency.Quarterly }"
            @click="frequency = RecurringFrequency.Quarterly"
          >
            Trimestral
          </button>
          <button
            type="button"
            class="type-toggle-btn"
            :class="{ 'active-neutral': frequency === RecurringFrequency.SemiAnnual }"
            @click="frequency = RecurringFrequency.SemiAnnual"
          >
            Semestral
          </button>
          <button
            type="button"
            class="type-toggle-btn"
            :class="{ 'active-neutral': frequency === RecurringFrequency.Annual }"
            @click="frequency = RecurringFrequency.Annual"
          >
            Anual
          </button>
        </div>
      </div>

      <!-- Opções de periodicidade (trimestral/semestral/anual) -->
      <template v-if="isPeriodic">
        <div class="form-group">
          <label class="checkbox-row">
            <input type="checkbox" v-model="spread" />
            <span>Diluir pelos 12 meses</span>
          </label>
          <span class="field-hint">
            Distribui o montante igualmente por todos os meses no orçamento. Desmarca para o lançar
            apenas no mês em que sai.
          </span>
        </div>

        <div v-if="!spread" class="form-group">
          <div class="label-row">
            <label>Mês de referência</label>
            <span class="info-tip" tabindex="0" role="button" aria-label="O que é o mês de referência?">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg>
              <span class="info-tooltip" role="tooltip">{{ referenceMonthTooltip }}</span>
            </span>
          </div>
          <BaseSelect
            :model-value="referenceMonth"
            :options="monthOptions"
            @update:model-value="(v) => (referenceMonth = Number(v))"
          />
        </div>
      </template>

      <!-- Transferência -->
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

        <div class="form-group">
          <label for="rec-amount-t">{{ amountLabel }}</label>
          <div class="amount-wrap">
            <input
              id="rec-amount-t"
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
          <span v-if="frequencyHint" class="monthly-hint">{{ frequencyHint }}</span>
        </div>

        <div class="form-group">
          <label for="rec-desc-t">Descrição</label>
          <input
            id="rec-desc-t"
            v-model="description"
            type="text"
            class="input"
            placeholder="Ex: Poupança"
            maxlength="16"
          />
        </div>
      </template>

      <!-- Receita / Despesa -->
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
          <label for="rec-name">Nome</label>
          <input
            id="rec-name"
            v-model="description"
            type="text"
            class="input"
            placeholder="Ex: Netflix"
            maxlength="16"
          />
        </div>

        <div class="form-group">
          <label for="rec-amount">{{ amountLabel }}</label>
          <div class="amount-wrap">
            <input
              id="rec-amount"
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
          <span v-if="frequencyHint" class="monthly-hint">{{ frequencyHint }}</span>
        </div>

        <div class="form-group">
          <label>Categoria</label>
          <CategorySelect
            :model-value="category"
            :type="type === TransactionType.Income ? 'income' : 'expense'"
            @update:model-value="(v) => (category = v as TransactionCategory)"
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
            <label for="rec-entity-name">
              {{ entityType === TransactionEntityType.Person ? 'Nome da pessoa' : 'Entidade' }}
            </label>
            <BrandAutocomplete
              v-if="entityType !== TransactionEntityType.Person"
              id="rec-entity-name"
              v-model="entityName"
              scope="all"
              placeholder="Ex: Netflix"
              :maxlength="200"
            />
            <input
              v-else
              id="rec-entity-name"
              v-model="entityName"
              type="text"
              class="input"
              placeholder="Ex: João Silva"
              maxlength="200"
            />
          </div>
        </div>
      </template>

      <div v-if="showResponsible" class="form-group">
        <label>Responsável pela recorrente</label>
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
.recurring-form {
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

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-row--entity {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr);
}

.form-row .input {
  min-width: 0;
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

.type-toggle {
  display: flex;
  gap: 4px;
  padding: 4px;
  border: 1.5px solid var(--color-border, #e2e8f0);
  border-radius: 10px;
  background: var(--color-bg, #f8fafc);
}

.type-toggle--freq .type-toggle-btn {
  font-size: 0.8125rem;
  padding: 0.5rem 0.25rem;
}

.checkbox-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-weight: 500;
  color: var(--color-text, #1e293b);
}

.checkbox-row input {
  width: 16px;
  height: 16px;
  accent-color: #166534;
  cursor: pointer;
}

.field-hint {
  font-size: 0.75rem;
  color: var(--color-text-muted, #64748b);
  line-height: 1.4;
}

/* ── Label com info (i) ── */
.label-row {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.info-tip {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted, #64748b);
  cursor: help;
  outline: none;
  flex-shrink: 0;
  transition: color 0.15s ease;
}

.info-tip:hover,
.info-tip:focus-visible {
  color: #166534;
}

html.dark .info-tip:hover,
html.dark .info-tip:focus-visible {
  color: #4ade80;
}

.info-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  width: max-content;
  max-width: 240px;
  padding: 0.625rem 0.75rem;
  background: var(--color-bg-card, #ffffff);
  color: var(--color-text, #0f172a);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 10px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.4;
  white-space: normal;
  z-index: 30;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s;
}

.info-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: var(--color-border, #e2e8f0);
}

.info-tip:hover .info-tooltip,
.info-tip:focus-visible .info-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
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

.type-toggle-btn.active-neutral {
  background: #166534;
  color: #fff;
}

html.dark .type-toggle-btn.active-income {
  background: #047857;
}

html.dark .type-toggle-btn.active-neutral {
  background: #15803d;
}

.amount-wrap {
  position: relative;
}

.amount-input {
  width: 100%;
  padding-right: 2rem;
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

.monthly-hint {
  font-size: 0.75rem;
  color: #166534;
  font-weight: 500;
}

html.dark .monthly-hint {
  color: #4ade80;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.btn-cancel {
  padding: 0.5rem 1rem;
  background: var(--color-btn-secondary-hover, #f1f5f9);
  color: var(--color-text-muted, #475569);
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  cursor: pointer;
  font-family: inherit;
}

.btn-cancel:hover {
  opacity: 0.85;
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
  font-family: inherit;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.95;
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
