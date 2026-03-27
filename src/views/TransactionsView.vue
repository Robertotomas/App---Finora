<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTransactionsStore } from '@/stores/transactions'
import { useRecurringTransactionsStore } from '@/stores/recurringTransactions'
import { useAccountsStore } from '@/stores/accounts'
import { useHouseholdStore } from '@/stores/household'
import { useAuthStore } from '@/stores/auth'
import { useSubscriptionStore } from '@/stores/subscription'
import { householdApi } from '@/api/household'
import TransactionFormModal from '@/components/TransactionFormModal.vue'
import RecurringFormModal from '@/components/RecurringFormModal.vue'
import RemoveRecurringModal from '@/components/RemoveRecurringModal.vue'
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue'
import MonthYearNavigator from '@/components/MonthYearNavigator.vue'
import BaseModal from '@/components/BaseModal.vue'
import type { Transaction, CreateTransactionRequest } from '@/types/transaction'
import type { RecurringTransaction, CreateRecurringTransactionRequest } from '@/types/recurringTransaction'
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_CATEGORY_LABELS,
  TransactionType
} from '@/types/transaction'
import type { HouseholdMember } from '@/types/household'

const transactionsStore = useTransactionsStore()
const recurringStore = useRecurringTransactionsStore()
const accountsStore = useAccountsStore()
const householdStore = useHouseholdStore()
const authStore = useAuthStore()
const subscriptionStore = useSubscriptionStore()
const router = useRouter()

const activeTab = ref<'transactions' | 'recurring'>('transactions')

const createModalOpen = ref(false)
const editModalOpen = ref(false)
const deleteModalOpen = ref(false)
const transactionToEdit = ref<Transaction | null>(null)
const transactionToDelete = ref<Transaction | null>(null)

const recurringCreateModalOpen = ref(false)
const recurringEditModalOpen = ref(false)
const recurringRemoveModalOpen = ref(false)
const recurringToEdit = ref<RecurringTransaction | null>(null)
const recurringToRemove = ref<RecurringTransaction | null>(null)

const members = ref<HouseholdMember[]>([])
const membersLoading = ref(false)

const filterAccountId = ref<string>('')
const filterFrom = ref('')
const filterTo = ref('')

const MONTH_NAMES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const TRANSACTION_MONTH_NAMES = [
  '',
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]
const now = new Date()
const filterMonth = ref<number>(now.getMonth() + 1)
const filterYear = ref<number>(now.getFullYear())

const yearOptions = computed(() => {
  const y = now.getFullYear()
  return [y, y - 1, y - 2, y - 3]
})

/** 1.º dia do mês do filtro: o limite Free aplica-se ao mês da data da transação, não ao mês do calendário “hoje”. */
const defaultDateForNewTransaction = computed(() => {
  if (filterMonth.value >= 1 && filterMonth.value <= 12) {
    const y = filterYear.value
    const m = String(filterMonth.value).padStart(2, '0')
    return `${y}-${m}-01`
  }
  return undefined
})

const page = ref(1)
const pageSize = 20

const actionLoading = ref(false)

const limitModalOpen = ref(false)
const limitModalKind = ref<'plan' | 'primary'>('plan')
const limitMessage = ref('Atualiza o teu plano para continuar.')

const needsPrimarySelection = computed(
  () => subscriptionStore.limits.needsPrimaryAccountSelection === true
)

const accountsForCreateModal = computed(() =>
  accountsStore.accounts.filter((a) => a.isActiveForPlan !== false)
)

const accountsForEditModal = computed(() => {
  const tx = transactionToEdit.value
  if (!tx) return accountsForCreateModal.value
  return accountsStore.accounts.filter(
    (a) => a.isActiveForPlan !== false || a.id === tx.accountId
  )
})

const accountsForRecurringCreate = computed(() =>
  accountsStore.accounts.filter((a) => a.isActiveForPlan !== false)
)

const accountsForRecurringEdit = computed(() => {
  const r = recurringToEdit.value
  if (!r) return accountsForRecurringCreate.value
  return accountsStore.accounts.filter(
    (a) => a.isActiveForPlan !== false || a.id === r.accountId
  )
})

const paginatedTransactions = computed(() => {
  const list = transactionsStore.transactions
  const start = (page.value - 1) * pageSize
  return list.slice(start, start + pageSize)
})

const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1
const activeRecurring = computed(() =>
  recurringStore.recurring.filter((r) => {
    if (!r.endMonth || !r.endYear) return true
    if (r.endYear > currentYear) return true
    if (r.endYear === currentYear && r.endMonth > currentMonth) return true
    return false
  })
)

const totalPages = computed(() =>
  Math.max(1, Math.ceil(transactionsStore.transactions.length / pageSize))
)

const canPrevPage = computed(() => page.value > 1)
const canNextPage = computed(() => page.value < totalPages.value)

function prevPage() {
  if (canPrevPage.value) page.value--
}

function nextPage() {
  if (canNextPage.value) page.value++
}

async function loadMembers() {
  membersLoading.value = true
  try {
    const { data } = await householdApi.getMembers()
    members.value = data
  } catch {
    members.value = []
  } finally {
    membersLoading.value = false
  }
}

onMounted(async () => {
  const range = getDateRangeFromMonth()
  if (range) {
    filterFrom.value = range.from
    filterTo.value = range.to
  }
  try {
    await householdStore.fetchHousehold()
    if (householdStore.household) {
      await accountsStore.fetchAccounts()
      await loadMembers()
      await fetchWithFilters()
      await recurringStore.fetchRecurring()
    }
    await subscriptionStore.fetchSubscription()
  } catch {
    // Handled in stores
  }
})

function getDateRangeFromMonth(): { from: string; to: string } | null {
  if (filterMonth.value < 1 || filterMonth.value > 12) return null
  const y = filterYear.value
  const m = filterMonth.value
  const firstDay = `${y}-${String(m).padStart(2, '0')}-01`
  const lastDate = new Date(y, m, 0)
  const toStr = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}-${String(lastDate.getDate()).padStart(2, '0')}`
  return { from: firstDay, to: toStr }
}

async function fetchWithFilters() {
  const params: { accountId?: string; from?: string; to?: string } = {}
  if (filterAccountId.value) params.accountId = filterAccountId.value

  const monthRange = getDateRangeFromMonth()
  if (monthRange) {
    params.from = monthRange.from
    params.to = monthRange.to
  } else if (filterFrom.value || filterTo.value) {
    if (filterFrom.value) params.from = filterFrom.value
    if (filterTo.value) params.to = filterTo.value
  }

  try {
    await transactionsStore.fetchTransactions(params)
    page.value = 1
  } catch {
    // Handled in store
  }
}

watch([filterMonth, filterYear], () => {
  const range = getDateRangeFromMonth()
  if (range) {
    filterFrom.value = range.from
    filterTo.value = range.to
  } else {
    filterFrom.value = ''
    filterTo.value = ''
  }
})

watch([filterAccountId, filterFrom, filterTo, filterMonth, filterYear], () => {
  fetchWithFilters()
})

function openCreateModal() {
  if (needsPrimarySelection.value) {
    limitModalKind.value = 'primary'
    limitMessage.value =
      'Tens mais do que uma conta no plano Free. Vai a Contas e escolhe qual fica ativa para movimentos antes de continuar.'
    limitModalOpen.value = true
    return
  }
  transactionsStore.clearError()
  createModalOpen.value = true
}

function closeCreateModal() {
  createModalOpen.value = false
}

/** Fecha o aviso de limite/plano, limpa erros e volta ao separador Transações (e à rota, se necessário). */
function dismissLimitModal() {
  limitModalOpen.value = false
  transactionsStore.clearError()
  recurringStore.clearError()
  closeCreateModal()
  closeEditModal()
  closeRecurringCreateModal()
  closeRecurringEditModal()
  activeTab.value = 'transactions'
  if (router.currentRoute.value.name !== 'transactions') {
    void router.push({ name: 'transactions' })
  }
}

function openEditModal(tx: Transaction) {
  if (needsPrimarySelection.value) {
    limitModalKind.value = 'primary'
    limitMessage.value =
      'Tens mais do que uma conta no plano Free. Vai a Contas e escolhe a conta principal antes de editar movimentos.'
    limitModalOpen.value = true
    return
  }
  const acc = accountsStore.accounts.find((a) => a.id === tx.accountId)
  if (acc && acc.isActiveForPlan === false) {
    limitModalKind.value = 'primary'
    limitMessage.value =
      'Esta transação está numa conta que não é a principal no plano Free. Só podes editar movimentos na conta principal, ou altera a conta principal em Contas.'
    limitModalOpen.value = true
    return
  }
  transactionsStore.clearError()
  transactionToEdit.value = tx
  editModalOpen.value = true
}

function closeEditModal() {
  editModalOpen.value = false
  transactionToEdit.value = null
}

function openDeleteModal(tx: Transaction) {
  transactionToDelete.value = tx
  deleteModalOpen.value = true
}

function closeDeleteModal() {
  deleteModalOpen.value = false
  transactionToDelete.value = null
}

async function handleCreate(payload: CreateTransactionRequest) {
  actionLoading.value = true
  try {
    await transactionsStore.createTransaction(payload)
    await accountsStore.fetchAccounts()
    closeCreateModal()
  } catch (e: unknown) {
    const err = e as { response?: { status?: number; data?: { code?: string; message?: string } } }
    const code = err.response?.data?.code
    if (err.response?.status === 403 && code === 'PLAN_LIMIT') {
      closeCreateModal()
      limitModalKind.value = 'plan'
      limitMessage.value = payload.type === TransactionType.Income
        ? 'Atingiste o limite de receitas do plano Free: só podes adicionar 1 receita por mês. Atualiza para Pro ou Couple para continuares.'
        : 'Atingiste o limite de despesas do plano Free: só podes adicionar 5 despesas por mês. Atualiza para Pro ou Couple para continuares.'
      limitModalOpen.value = true
    } else if (err.response?.status === 403 && code === 'FREE_PRIMARY_REQUIRED') {
      closeCreateModal()
      limitModalKind.value = 'primary'
      limitMessage.value =
        err.response?.data?.message ??
        'Tens mais do que uma conta no plano Free. Escolhe a conta principal em Contas antes de adicionar movimentos.'
      limitModalOpen.value = true
    } else if (err.response?.status === 403 && code === 'FREE_ACCOUNT_LOCKED') {
      closeCreateModal()
      limitModalKind.value = 'primary'
      limitMessage.value =
        err.response?.data?.message ??
        'No plano Free só podes usar a conta principal para movimentos. Altera a conta principal em Contas.'
      limitModalOpen.value = true
    }
  } finally {
    actionLoading.value = false
  }
}

async function handleEdit(payload: CreateTransactionRequest) {
  if (!transactionToEdit.value) return
  actionLoading.value = true
  try {
    await transactionsStore.updateTransaction(transactionToEdit.value.id, payload)
    await accountsStore.fetchAccounts()
    closeEditModal()
  } catch (e: unknown) {
    const err = e as { response?: { status?: number; data?: { code?: string; message?: string } } }
    const code = err.response?.data?.code
    if (err.response?.status === 403 && code === 'FREE_PRIMARY_REQUIRED') {
      closeEditModal()
      limitModalKind.value = 'primary'
      limitMessage.value =
        err.response?.data?.message ??
        'Escolhe a conta principal em Contas antes de editar movimentos.'
      limitModalOpen.value = true
    } else if (err.response?.status === 403 && code === 'FREE_ACCOUNT_LOCKED') {
      closeEditModal()
      limitModalKind.value = 'primary'
      limitMessage.value =
        err.response?.data?.message ??
        'No plano Free só podes alterar movimentos na conta principal.'
      limitModalOpen.value = true
    }
  } finally {
    actionLoading.value = false
  }
}

async function handleDelete() {
  if (!transactionToDelete.value) return
  actionLoading.value = true
  try {
    await transactionsStore.deleteTransaction(transactionToDelete.value.id)
    await accountsStore.fetchAccounts()
    closeDeleteModal()
  } catch {
    // Error shown in store
  } finally {
    actionLoading.value = false
  }
}

function formatAmount(amount: number, type: TransactionType): string {
  const formatted = new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2
  }).format(Math.abs(amount))
  return type === TransactionType.Expense ? `-${formatted}` : formatted
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

function getResponsibleDisplay(tx: Transaction): string {
  if (tx.splits.length === 0) return '-'
  if (tx.splits.length === 1 && tx.splits[0].percentage === 100) {
    const m = members.value.find((x) => x.id === tx.splits[0].userId)
    if (m) return m.id === authStore.user?.id ? 'Tu' : `${m.firstName} ${m.lastName}`
    return 'Tu'
  }
  return tx.splits
    .map((s) => {
      const m = members.value.find((x) => x.id === s.userId)
      const name = m ? (m.id === authStore.user?.id ? 'Tu' : m.firstName) : '?'
      return `${name} ${s.percentage}%`
    })
    .join(', ')
}

function getSplitsDisplay(tx: Transaction): string {
  if (tx.splits.length <= 1) return '-'
  return tx.splits.map((s) => `${s.percentage}%`).join(' / ')
}

function openRecurringCreateModal() {
  if (needsPrimarySelection.value) {
    limitModalKind.value = 'primary'
    limitMessage.value =
      'Tens mais do que uma conta no plano Free. Vai a Contas e escolhe a conta principal antes de criar recorrentes.'
    limitModalOpen.value = true
    return
  }
  recurringStore.clearError()
  recurringCreateModalOpen.value = true
}

function closeRecurringCreateModal() {
  recurringCreateModalOpen.value = false
}

function openRecurringEditModal(r: RecurringTransaction) {
  if (needsPrimarySelection.value) {
    limitModalKind.value = 'primary'
    limitMessage.value =
      'Tens mais do que uma conta no plano Free. Vai a Contas e escolhe a conta principal antes de editar recorrentes.'
    limitModalOpen.value = true
    return
  }
  const acc = accountsStore.accounts.find((a) => a.id === r.accountId)
  if (acc && acc.isActiveForPlan === false) {
    limitModalKind.value = 'primary'
    limitMessage.value =
      'Esta recorrente está numa conta que não é a principal no plano Free. Só podes editar na conta principal, ou altera a conta principal em Contas.'
    limitModalOpen.value = true
    return
  }
  recurringStore.clearError()
  recurringToEdit.value = r
  recurringEditModalOpen.value = true
}

function closeRecurringEditModal() {
  recurringEditModalOpen.value = false
  recurringToEdit.value = null
}

function openRecurringRemoveModal(r: RecurringTransaction) {
  recurringToRemove.value = r
  recurringRemoveModalOpen.value = true
}

function closeRecurringRemoveModal() {
  recurringRemoveModalOpen.value = false
  recurringToRemove.value = null
}

async function handleRecurringCreate(payload: CreateRecurringTransactionRequest) {
  actionLoading.value = true
  try {
    await recurringStore.createRecurring(payload)
    closeRecurringCreateModal()
  } catch (e: unknown) {
    const err = e as { response?: { status?: number; data?: { code?: string; message?: string } } }
    const code = err.response?.data?.code
    if (err.response?.status === 403 && code === 'PLAN_LIMIT') {
      closeRecurringCreateModal()
      limitModalKind.value = 'plan'
      limitMessage.value = payload.type === TransactionType.Income
        ? 'Atingiste o limite de receitas do plano Free: só podes adicionar 1 receita por mês. Atualiza para Pro ou Couple para continuares.'
        : 'Atingiste o limite de despesas do plano Free: só podes adicionar 5 despesas por mês. Atualiza para Pro ou Couple para continuares.'
      limitModalOpen.value = true
      return
    }
    if (err.response?.status === 403 && code === 'FREE_PRIMARY_REQUIRED') {
      closeRecurringCreateModal()
      limitModalKind.value = 'primary'
      limitMessage.value =
        err.response?.data?.message ??
        'Escolhe a conta principal em Contas antes de adicionar recorrentes.'
      limitModalOpen.value = true
      return
    }
    if (err.response?.status === 403 && code === 'FREE_ACCOUNT_LOCKED') {
      closeRecurringCreateModal()
      limitModalKind.value = 'primary'
      limitMessage.value =
        err.response?.data?.message ??
        'No plano Free só podes usar recorrentes na conta principal.'
      limitModalOpen.value = true
      return
    }
    // Error shown in store
  } finally {
    actionLoading.value = false
  }
}

async function handleRecurringEdit(payload: CreateRecurringTransactionRequest) {
  if (!recurringToEdit.value) return
  actionLoading.value = true
  try {
    await recurringStore.updateRecurring(recurringToEdit.value.id, payload)
    closeRecurringEditModal()
  } catch (e: unknown) {
    const err = e as { response?: { status?: number; data?: { code?: string; message?: string } } }
    const code = err.response?.data?.code
    if (err.response?.status === 403 && code === 'FREE_PRIMARY_REQUIRED') {
      closeRecurringEditModal()
      limitModalKind.value = 'primary'
      limitMessage.value =
        err.response?.data?.message ??
        'Escolhe a conta principal em Contas antes de editar recorrentes.'
      limitModalOpen.value = true
    } else if (err.response?.status === 403 && code === 'FREE_ACCOUNT_LOCKED') {
      closeRecurringEditModal()
      limitModalKind.value = 'primary'
      limitMessage.value =
        err.response?.data?.message ??
        'No plano Free só podes editar recorrentes na conta principal.'
      limitModalOpen.value = true
    }
  } finally {
    actionLoading.value = false
  }
}

async function handleRecurringRemoveFromCurrentMonth() {
  if (!recurringToRemove.value) return
  actionLoading.value = true
  try {
    await recurringStore.removeRecurring(recurringToRemove.value.id, currentYear, currentMonth)
    closeRecurringRemoveModal()
  } catch {
    // Error shown in store
  } finally {
    actionLoading.value = false
  }
}

async function handleRecurringRemoveFromNextMonth() {
  if (!recurringToRemove.value) return
  actionLoading.value = true
  try {
    let y = currentYear
    let m = currentMonth + 1
    if (m > 12) {
      m = 1
      y++
    }
    await recurringStore.removeRecurring(recurringToRemove.value.id, y, m)
    closeRecurringRemoveModal()
  } catch {
    // Error shown in store
  } finally {
    actionLoading.value = false
  }
}

function getAccountName(accountId: string): string {
  return accountsStore.accounts.find((a) => a.id === accountId)?.name ?? '-'
}

function isTxAccountLocked(tx: Transaction): boolean {
  if (needsPrimarySelection.value) return true
  const acc = accountsStore.accounts.find((a) => a.id === tx.accountId)
  return acc?.isActiveForPlan === false
}

function isRecurringAccountLocked(r: RecurringTransaction): boolean {
  if (needsPrimarySelection.value) return true
  const acc = accountsStore.accounts.find((a) => a.id === r.accountId)
  return acc?.isActiveForPlan === false
}
</script>

<template>
  <div class="transactions-view">
    <div class="page-header">
      <h1>Transações</h1>
      <p class="subtitle">Gerir receitas e despesas</p>
    </div>

    <div v-if="!householdStore.household && !householdStore.loading" class="empty-state">
      <p>Configura primeiro o teu household.</p>
      <router-link to="/household" class="link">Ir para Household</router-link>
    </div>

    <div v-else-if="householdStore.loading && !householdStore.household" class="loading-state">
      <div class="spinner"></div>
      <p>A carregar...</p>
    </div>

    <div v-else-if="householdStore.error && !householdStore.household" class="error-state">
      <p>{{ householdStore.error }}</p>
    </div>

    <div v-else class="content">
      <div class="tabs">
        <button
          type="button"
          :class="['tab', { active: activeTab === 'transactions' }]"
          @click="activeTab = 'transactions'"
        >
          Transações
        </button>
        <button
          type="button"
          :class="['tab', { active: activeTab === 'recurring' }]"
          @click="activeTab = 'recurring'"
        >
          Transações Recorrentes
        </button>
      </div>

      <div v-if="activeTab === 'transactions' && transactionsStore.error" class="global-error">
        {{ transactionsStore.error }}
      </div>
      <div v-if="activeTab === 'recurring' && recurringStore.error" class="global-error">
        {{ recurringStore.error }}
      </div>

      <div v-show="activeTab === 'transactions'" class="tab-content">
      <div v-if="needsPrimarySelection" class="primary-inline-hint">
        <router-link :to="{ name: 'accounts' }" class="primary-inline-link">Escolhe a conta principal em Contas</router-link>
        <span> para poderes adicionar ou editar transações no plano Free com várias contas.</span>
      </div>
      <div class="toolbar">
        <div class="filters">
          <select v-model="filterAccountId" class="filter-select">
            <option value="">Todas as contas</option>
            <option v-for="a in accountsStore.accounts" :key="a.id" :value="a.id">
              {{ a.name }}
            </option>
          </select>
          <MonthYearNavigator
            v-model:month="filterMonth"
            v-model:year="filterYear"
            :years="yearOptions"
            :month-names="TRANSACTION_MONTH_NAMES"
            allow-all-months
            all-months-in-year-title="Todos os meses"
            all-months-in-year-button="Todos os meses"
          />
          <template v-if="filterMonth === 0">
            <input
              v-model="filterFrom"
              type="date"
              class="filter-input"
              placeholder="De"
              title="Data inicial"
            />
            <input
              v-model="filterTo"
              type="date"
              class="filter-input"
              placeholder="Até"
              title="Data final"
            />
          </template>
        </div>
        <button type="button" class="btn-add" @click="openCreateModal">
          + Nova transação
        </button>
      </div>

      <div v-if="transactionsStore.loading && transactionsStore.transactions.length === 0" class="loading-state">
        <div class="spinner"></div>
        <p>A carregar transações...</p>
      </div>

      <div v-else-if="transactionsStore.transactions.length === 0" class="empty-state">
        <p>Nenhuma transação ainda. Cria a tua primeira transação.</p>
        <button type="button" class="btn-add" @click="openCreateModal">
          + Nova transação
        </button>
      </div>

      <div v-else class="table-container">
        <table class="transactions-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Categoria</th>
              <th>Tipo</th>
              <th class="amount-col">Valor</th>
              <th>Responsável</th>
              <th v-if="householdStore.isCouple">Repartição</th>
              <th class="actions-col"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="tx in paginatedTransactions"
              :key="tx.id"
              class="table-row"
            >
              <td>{{ formatDate(tx.date) }}</td>
              <td>{{ TRANSACTION_CATEGORY_LABELS[tx.category] }}</td>
              <td>
                <span :class="['type-badge', tx.type === TransactionType.Income ? 'type-income' : 'type-expense']">
                  {{ TRANSACTION_TYPE_LABELS[tx.type] }}
                </span>
              </td>
              <td class="amount-col" :class="{ 'amount-income': tx.type === TransactionType.Income, 'amount-expense': tx.type === TransactionType.Expense }">
                {{ formatAmount(tx.amount, tx.type) }}
              </td>
              <td>{{ getResponsibleDisplay(tx) }}</td>
              <td v-if="householdStore.isCouple">{{ getSplitsDisplay(tx) }}</td>
                <td class="actions-col">
                <button
                  type="button"
                  class="btn-icon"
                  :disabled="isTxAccountLocked(tx)"
                  @click="openEditModal(tx)"
                >
                  Editar
                </button>
                <button type="button" class="btn-icon btn-delete" @click="openDeleteModal(tx)">
                  Eliminar
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="totalPages > 1" class="pagination">
          <button
            type="button"
            class="btn-page"
            :disabled="!canPrevPage"
            @click="prevPage"
          >
            Anterior
          </button>
          <span class="page-info">
            Página {{ page }} de {{ totalPages }}
          </span>
          <button
            type="button"
            class="btn-page"
            :disabled="!canNextPage"
            @click="nextPage"
          >
            Seguinte
          </button>
        </div>
      </div>
      </div>

      <div v-show="activeTab === 'recurring'" class="tab-content">
        <div v-if="needsPrimarySelection" class="primary-inline-hint">
          <router-link :to="{ name: 'accounts' }" class="primary-inline-link">Escolhe a conta principal em Contas</router-link>
          <span> para gerires recorrentes no plano Free com várias contas.</span>
        </div>
        <div class="toolbar">
          <p class="recurring-hint">Receitas e despesas que se repetem mensalmente. São contabilizadas a partir do mês atual.</p>
          <button type="button" class="btn-add" @click="openRecurringCreateModal">
            + Nova transação recorrente
          </button>
        </div>
        <div v-if="recurringStore.loading && activeRecurring.length === 0" class="loading-state">
          <div class="spinner"></div>
          <p>A carregar contas recorrentes...</p>
        </div>
        <div v-else-if="activeRecurring.length === 0" class="empty-state">
          <p>Nenhuma conta recorrente. Adiciona uma receita ou despesa mensal.</p>
          <button type="button" class="btn-add" @click="openRecurringCreateModal">
            + Nova transação recorrente
          </button>
        </div>
        <div v-else class="table-container">
          <table class="transactions-table">
            <thead>
              <tr>
                <th>Conta</th>
                <th>Categoria</th>
                <th>Tipo</th>
                <th class="amount-col">Valor</th>
                <th>Início</th>
                <th class="actions-col"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in activeRecurring"
                :key="r.id"
                class="table-row"
              >
                <td>{{ getAccountName(r.accountId) }}</td>
                <td>{{ TRANSACTION_CATEGORY_LABELS[r.category] }}</td>
                <td>
                  <span :class="['type-badge', r.type === TransactionType.Income ? 'type-income' : 'type-expense']">
                    {{ TRANSACTION_TYPE_LABELS[r.type] }}
                  </span>
                </td>
                <td class="amount-col" :class="{ 'amount-income': r.type === TransactionType.Income, 'amount-expense': r.type === TransactionType.Expense }">
                  {{ formatAmount(r.amount, r.type) }}
                </td>
                <td>{{ MONTH_NAMES[r.startMonth] }} {{ r.startYear }}</td>
                <td class="actions-col">
                  <button
                    type="button"
                    class="btn-icon"
                    :disabled="isRecurringAccountLocked(r)"
                    @click="openRecurringEditModal(r)"
                  >
                    Editar
                  </button>
                  <button type="button" class="btn-icon btn-delete" @click="openRecurringRemoveModal(r)">
                    Retirar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <TransactionFormModal
      :open="createModalOpen"
      :accounts="accountsForCreateModal"
      :members="members"
      :is-couple="householdStore.isCouple"
      :current-user-id="authStore.user?.id ?? ''"
      :loading="actionLoading"
      :default-date-for-new="defaultDateForNewTransaction"
      @close="closeCreateModal"
      @submit="handleCreate"
    />

    <TransactionFormModal
      :open="editModalOpen"
      :transaction="transactionToEdit"
      :accounts="accountsForEditModal"
      :members="members"
      :is-couple="householdStore.isCouple"
      :current-user-id="authStore.user?.id ?? ''"
      :loading="actionLoading"
      @close="closeEditModal"
      @submit="handleEdit"
    />

    <ConfirmDeleteModal
      :open="deleteModalOpen"
      title="Eliminar transação"
      :message="transactionToDelete
        ? `Tem a certeza que deseja eliminar esta transação de ${formatAmount(transactionToDelete.amount, transactionToDelete.type)}?`
        : ''"
      :loading="actionLoading"
      @close="closeDeleteModal"
      @confirm="handleDelete"
    />

    <RecurringFormModal
      :open="recurringCreateModalOpen"
      :accounts="accountsForRecurringCreate"
      :loading="actionLoading"
      @close="closeRecurringCreateModal"
      @submit="handleRecurringCreate"
    />

    <RecurringFormModal
      :open="recurringEditModalOpen"
      :recurring="recurringToEdit"
      :accounts="accountsForRecurringEdit"
      :loading="actionLoading"
      @close="closeRecurringEditModal"
      @submit="handleRecurringEdit"
    />

    <RemoveRecurringModal
      :open="recurringRemoveModalOpen"
      :recurring="recurringToRemove"
      :loading="actionLoading"
      @close="closeRecurringRemoveModal"
      @remove-from-current-month="handleRecurringRemoveFromCurrentMonth"
      @remove-from-next-month="handleRecurringRemoveFromNextMonth"
    />

    <BaseModal
      v-if="limitModalOpen"
      :title="limitModalKind === 'primary' ? 'Conta principal' : 'Limite do plano Free'"
      @close="dismissLimitModal"
    >
      <div class="locked-modal-body">
        <p>{{ limitMessage }}</p>
        <div class="locked-modal-actions">
          <button type="button" class="btn-secondary" @click="dismissLimitModal">Agora não</button>
          <router-link
            v-if="limitModalKind === 'primary'"
            :to="{ name: 'accounts' }"
            class="locked-modal-cta"
            @click="dismissLimitModal"
          >
            Ir para Contas
          </router-link>
          <router-link
            v-else
            :to="{ name: 'subscription' }"
            class="locked-modal-cta"
            @click="dismissLimitModal"
          >
            Ver planos
          </router-link>
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<style scoped>
.transactions-view {
  max-width: min(960px, 100%);
  margin: 0 auto;
  padding: 0 0 2.5rem;
}

.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: #64748b;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border);
  border-top-color: #166534;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state p {
  color: #dc2626;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.link {
  color: #2563eb;
  border-bottom: 1px solid transparent;
}

.link:hover {
  border-bottom-color: #2563eb;
}

.tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.tab {
  padding: 0.625rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #64748b;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  margin-bottom: -1px;
}

.tab:hover {
  color: #334155;
}

.tab.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
}

.tab-content {
  margin-top: 0;
}

.recurring-hint {
  font-size: 0.8125rem;
  color: #64748b;
  margin: 0;
  flex: 1;
}

.global-error {
  padding: 0.75rem 1rem;
  background: #fef2f2;
  color: #dc2626;
  border-radius: 8px;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.primary-inline-hint {
  margin-bottom: 1rem;
  padding: 0.65rem 1rem;
  font-size: 0.875rem;
  line-height: 1.45;
  color: #78350f;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
}

.primary-inline-link {
  color: #1d4ed8;
  font-weight: 600;
  text-decoration: underline;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem 1rem;
}

.filter-select,
.filter-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.875rem;
}

.btn-add {
  padding: 0.625rem 1.25rem;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
}

.btn-add:hover {
  opacity: 0.95;
}

.table-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border: 1px solid #f1f5f9;
  overflow: hidden;
}

.transactions-table {
  width: 100%;
  border-collapse: collapse;
}

.transactions-table th {
  text-align: left;
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.transactions-table td {
  padding: 0.875rem 1rem;
  font-size: 0.875rem;
  color: #334155;
  border-bottom: 1px solid #f1f5f9;
}

.table-row:hover {
  background: #f8fafc;
}

.amount-col {
  font-weight: 600;
  white-space: nowrap;
}

.amount-income {
  color: #059669;
}

.amount-expense {
  color: #dc2626;
}

.actions-col {
  width: 1%;
  white-space: nowrap;
}

.type-badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 500;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
}

.type-income {
  background: #d1fae5;
  color: #047857;
}

.type-expense {
  background: #fee2e2;
  color: #b91c1c;
}

.btn-icon {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  color: #64748b;
  background: transparent;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
  margin-right: 0.25rem;
}

.btn-icon:hover {
  background: #f8fafc;
  color: #334155;
}

.btn-icon:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-delete:hover {
  color: #dc2626;
  border-color: #fecaca;
  background: #fef2f2;
}

.locked-modal-body p {
  margin: 0;
  color: var(--color-text-muted);
  line-height: 1.45;
}

.locked-modal-actions {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.locked-modal-actions .btn-secondary,
.locked-modal-actions .locked-modal-cta {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.5rem 0.85rem;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.locked-modal-actions .btn-secondary {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text);
}

.locked-modal-actions .locked-modal-cta {
  background: #166534;
  color: #fff;
}

.locked-modal-actions .locked-modal-cta:hover {
  background: #15803d;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1rem;
  border-top: 1px solid #f1f5f9;
}

.btn-page {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  color: #475569;
  background: #f1f5f9;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.btn-page:hover:not(:disabled) {
  background: #e2e8f0;
  color: #334155;
}

.btn-page:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 0.875rem;
  color: #64748b;
}
</style>
