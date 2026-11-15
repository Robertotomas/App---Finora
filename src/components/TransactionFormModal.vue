<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import BaseSelect from './BaseSelect.vue'
import CategorySelect from './CategorySelect.vue'
import BrandAutocomplete from './BrandAutocomplete.vue'
import DatePicker from './DatePicker.vue'
import UiButton from './ui/UiButton.vue'
import type { Transaction, CreateTransactionRequest } from '@/types/transaction'
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
const category = ref<TransactionCategory>(TransactionCategory.OtherExpense)
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

const categoryOptions = computed(() =>
  type.value === TransactionType.Income ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
)

const destinationOptions = computed(() =>
  props.accounts.filter((a) => a.id !== accountId.value)
)

// Opções para os dropdowns personalizados (BaseSelect)
const accountOptions = computed(() => props.accounts.map((a) => ({ value: a.id, label: a.name })))
const destinationAccountOptions = computed(() =>
  destinationOptions.value.map((a) => ({ value: a.id, label: a.name }))
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
        category.value = props.isTransfer ? TransactionCategory.Transfer : TransactionCategory.OtherExpense
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
  if (!accountId.value) e.accountId = 'Selecione uma conta'
  if (!amount.value || amount.value === 0) e.amount = 'Indique o montante'
  if (!date.value) e.date = 'Data é obrigatória'
  if (props.isTransfer || type.value === TransactionType.Transfer) {
    if (!destinationAccountId.value) e.destinationAccountId = 'Selecione a conta de destino'
    if (destinationAccountId.value === accountId.value) e.destinationAccountId = 'A conta de destino deve ser diferente'
  }
  if (props.isCouple && type.value !== TransactionType.Transfer && !props.isTransfer && !responsibleUserId.value) {
    e.responsible = 'Selecione o responsável'
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
    <form id="transaction-form" class="modal-form" @submit.prevent="handleSubmit">
      <!-- Transfer mode: source & destination accounts -->
      <template v-if="isTransferMode">
        <div class="form-group">
          <label>Conta de origem</label>
          <BaseSelect
            :model-value="accountId"
            :options="accountOptions"
            placeholder="Selecione uma conta"
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
            placeholder="Selecione uma conta"
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
            <DatePicker id="tx-date-t" v-model="date" editable :error="!!errors.date" />
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
            placeholder="Ex: Poupança"
            maxlength="16"
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
            placeholder="Selecione uma conta"
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
            placeholder="Ex: Supermercado"
            maxlength="16"
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
            <DatePicker id="tx-date" v-model="date" editable :error="!!errors.date" />
            <span v-if="errors.date" class="error-text">{{ errors.date }}</span>
          </div>
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
            <label for="tx-entity-name">
              {{ entityType === TransactionEntityType.Person ? 'Nome da pessoa' : 'Entidade' }}
            </label>
            <BrandAutocomplete
              v-if="entityType !== TransactionEntityType.Person"
              id="tx-entity-name"
              v-model="entityName"
              scope="all"
              placeholder="Ex: Continente"
              :maxlength="200"
            />
            <input
              v-else
              id="tx-entity-name"
              v-model="entityName"
              type="text"
              class="input"
              placeholder="Ex: João Silva"
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
          placeholder="Selecione o responsável"
          :error="!!errors.responsible"
          @update:model-value="(v) => (responsibleUserId = String(v))"
        />
        <span v-if="errors.responsible" class="error-text">{{ errors.responsible }}</span>
      </div>

    </form>

    <template #footer>
      <UiButton variant="secondary" :disabled="loading" @click="handleClose">Cancelar</UiButton>
      <UiButton type="submit" form="transaction-form" :loading="loading">
        {{ isEdit ? 'Guardar' : 'Criar' }}
      </UiButton>
    </template>
  </BaseModal>
</template>

<style scoped>
/* Tipo de entidade (curto) + nome (mais largo) */
.bm-body .form-row--entity {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr);
}
@media (max-width: 520px) {
  .bm-body .form-row--entity {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
