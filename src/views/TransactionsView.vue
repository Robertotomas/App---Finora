<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useTransactionsStore } from '@/stores/transactions'
import { useAccountsStore } from '@/stores/accounts'
import { useHouseholdStore } from '@/stores/household'
import { useAuthStore } from '@/stores/auth'
import { householdApi } from '@/api/household'
import TransactionFormModal from '@/components/TransactionFormModal.vue'
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue'
import type { Transaction, CreateTransactionRequest } from '@/types/transaction'
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_CATEGORY_LABELS,
  TransactionType
} from '@/types/transaction'
import type { HouseholdMember } from '@/types/household'

const transactionsStore = useTransactionsStore()
const accountsStore = useAccountsStore()
const householdStore = useHouseholdStore()
const authStore = useAuthStore()

const createModalOpen = ref(false)
const editModalOpen = ref(false)
const deleteModalOpen = ref(false)
const transactionToEdit = ref<Transaction | null>(null)
const transactionToDelete = ref<Transaction | null>(null)

const members = ref<HouseholdMember[]>([])
const membersLoading = ref(false)

const filterAccountId = ref<string>('')
const filterFrom = ref('')
const filterTo = ref('')

const page = ref(1)
const pageSize = 20

const actionLoading = ref(false)

const paginatedTransactions = computed(() => {
  const list = transactionsStore.transactions
  const start = (page.value - 1) * pageSize
  return list.slice(start, start + pageSize)
})

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
  try {
    await householdStore.fetchHousehold()
    if (householdStore.household) {
      await accountsStore.fetchAccounts()
      await loadMembers()
      await fetchWithFilters()
    }
  } catch {
    // Handled in stores
  }
})

async function fetchWithFilters() {
  const params: { accountId?: string; from?: string; to?: string } = {}
  if (filterAccountId.value) params.accountId = filterAccountId.value
  if (filterFrom.value) params.from = filterFrom.value
  if (filterTo.value) params.to = filterTo.value
  try {
    await transactionsStore.fetchTransactions(params)
    page.value = 1
  } catch {
    // Handled in store
  }
}

watch([filterAccountId, filterFrom, filterTo], () => {
  fetchWithFilters()
})

function openCreateModal() {
  transactionsStore.clearError()
  createModalOpen.value = true
}

function closeCreateModal() {
  createModalOpen.value = false
}

function openEditModal(tx: Transaction) {
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
    closeCreateModal()
  } catch {
    // Error shown in store
  } finally {
    actionLoading.value = false
  }
}

async function handleEdit(payload: CreateTransactionRequest) {
  if (!transactionToEdit.value) return
  actionLoading.value = true
  try {
    await transactionsStore.updateTransaction(transactionToEdit.value.id, payload)
    closeEditModal()
  } catch {
    // Error shown in store
  } finally {
    actionLoading.value = false
  }
}

async function handleDelete() {
  if (!transactionToDelete.value) return
  actionLoading.value = true
  try {
    await transactionsStore.deleteTransaction(transactionToDelete.value.id)
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
      <div v-if="transactionsStore.error" class="global-error">
        {{ transactionsStore.error }}
      </div>

      <div class="toolbar">
        <div class="filters">
          <select v-model="filterAccountId" class="filter-select">
            <option value="">Todas as contas</option>
            <option v-for="a in accountsStore.accounts" :key="a.id" :value="a.id">
              {{ a.name }}
            </option>
          </select>
          <input
            v-model="filterFrom"
            type="date"
            class="filter-input"
            placeholder="De"
          />
          <input
            v-model="filterTo"
            type="date"
            class="filter-input"
            placeholder="Até"
          />
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
                <button type="button" class="btn-icon" @click="openEditModal(tx)">
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

    <TransactionFormModal
      :open="createModalOpen"
      :accounts="accountsStore.accounts"
      :members="members"
      :is-couple="householdStore.isCouple"
      :current-user-id="authStore.user?.id ?? ''"
      :loading="actionLoading"
      @close="closeCreateModal"
      @submit="handleCreate"
    />

    <TransactionFormModal
      :open="editModalOpen"
      :transaction="transactionToEdit"
      :accounts="accountsStore.accounts"
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
  </div>
</template>

<style scoped>
.transactions-view {
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 0.25rem 0;
}

.subtitle {
  color: #64748b;
  font-size: 0.9375rem;
  margin: 0;
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
  border: 3px solid #e2e8f0;
  border-top-color: #2563eb;
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

.global-error {
  padding: 0.75rem 1rem;
  background: #fef2f2;
  color: #dc2626;
  border-radius: 8px;
  font-size: 0.875rem;
  margin-bottom: 1rem;
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
  gap: 0.5rem;
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

.btn-delete:hover {
  color: #dc2626;
  border-color: #fecaca;
  background: #fef2f2;
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
