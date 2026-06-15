import { defineStore } from 'pinia'
import { ref } from 'vue'
import { transactionsApi } from '@/api/transactions'
import { useNotificationStore } from '@/stores/notifications'
import type { GetTransactionsPagedParams } from '@/api/transactions'
import type {
  Transaction,
  CreateTransactionRequest,
  UpdateTransactionRequest
} from '@/types/transaction'

function extractError(e: unknown): string {
  const err = e as { response?: { data?: { errors?: Record<string, string[]> }; status: number } }
  if (err.response?.data?.errors) {
    const first = Object.values(err.response.data.errors)[0]
    return Array.isArray(first) ? first[0] : String(first)
  }
  if (err.response?.status === 404) return 'Household não encontrado. Cria primeiro um household.'
  return 'Ocorreu um erro. Tenta novamente.'
}

/** 403 com estes códigos é tratado na UI (modal); não mostrar barra de erro genérica */
function isHandledPlanRestrictionError(e: unknown): boolean {
  const err = e as { response?: { status?: number; data?: { code?: string } } }
  if (err.response?.status !== 403) return false
  const code = err.response?.data?.code
  return (
    code === 'PLAN_LIMIT' ||
    code === 'FREE_PRIMARY_REQUIRED' ||
    code === 'FREE_ACCOUNT_LOCKED'
  )
}

function mapTransaction(d: { id: string; accountId: string; householdId: string; type: number; category: number; amount: number; date: string; description?: string; entityType?: number; entityName?: string | null; destinationAccountId?: string; splits?: { userId: string; percentage: number }[] }): Transaction {
  return {
    id: d.id,
    accountId: d.accountId,
    householdId: d.householdId,
    type: d.type,
    category: d.category,
    amount: Number(d.amount),
    date: d.date,
    description: d.description,
    entityType: d.entityType,
    entityName: d.entityName ?? null,
    destinationAccountId: d.destinationAccountId,
    splits: (d.splits ?? []).map((s) => ({ userId: s.userId, percentage: Number(s.percentage) }))
  }
}

export const useTransactionsStore = defineStore('transactions', () => {
  const transactions = ref<Transaction[]>([])
  const totalCount = ref(0)
  const currentPage = ref(1)
  const totalPages = ref(1)
  const loading = ref(true)
  const error = ref<string | null>(null)

  async function fetchTransactions(params?: { accountId?: string; from?: string; to?: string; limit?: number }) {
    loading.value = true
    error.value = null
    try {
      const { data } = await transactionsApi.getAll(params)
      transactions.value = data.map(mapTransaction)
      return transactions.value
    } catch (e: unknown) {
      if (!isHandledPlanRestrictionError(e)) {
        error.value = extractError(e)
      } else {
        error.value = null
      }
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchTransactionsPaged(params?: GetTransactionsPagedParams) {
    loading.value = true
    error.value = null
    try {
      const { data } = await transactionsApi.getPaged(params)
      const res = data as unknown as Record<string, unknown>
      const get = (key: string) => res[key] ?? res[key.charAt(0).toUpperCase() + key.slice(1)]
      const items = get('items')
      transactions.value = Array.isArray(items) ? items.map(mapTransaction) : []
      totalCount.value = Number(get('totalCount')) || 0
      currentPage.value = Number(get('page')) || 1
      totalPages.value = Number(get('totalPages')) || 1
      return transactions.value
    } catch (e: unknown) {
      if (!isHandledPlanRestrictionError(e)) {
        error.value = extractError(e)
      } else {
        error.value = null
      }
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createTransaction(request: CreateTransactionRequest) {
    loading.value = true
    error.value = null
    try {
      const { data } = await transactionsApi.create(request)
      const tx = mapTransaction(data)
      transactions.value = [tx, ...transactions.value]
      useNotificationStore().fetchUnreadCount()
      return tx
    } catch (e: unknown) {
      if (!isHandledPlanRestrictionError(e)) {
        error.value = extractError(e)
      } else {
        error.value = null
      }
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateTransaction(id: string, request: UpdateTransactionRequest) {
    loading.value = true
    error.value = null
    try {
      const { data } = await transactionsApi.update(id, request)
      const tx = mapTransaction(data)
      const idx = transactions.value.findIndex((t) => t.id === id)
      if (idx >= 0) {
        transactions.value = [...transactions.value]
        transactions.value[idx] = tx
      } else {
        transactions.value = [tx, ...transactions.value]
      }
      useNotificationStore().fetchUnreadCount()
      return tx
    } catch (e: unknown) {
      if (!isHandledPlanRestrictionError(e)) {
        error.value = extractError(e)
      } else {
        error.value = null
      }
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteTransaction(id: string) {
    loading.value = true
    error.value = null
    try {
      await transactionsApi.delete(id)
      transactions.value = transactions.value.filter((t) => t.id !== id)
      useNotificationStore().fetchUnreadCount()
    } catch (e: unknown) {
      if (!isHandledPlanRestrictionError(e)) {
        error.value = extractError(e)
      } else {
        error.value = null
      }
      throw e
    } finally {
      loading.value = false
    }
  }

  function clearError() {
    error.value = null
  }

  return {
    transactions,
    totalCount,
    currentPage,
    totalPages,
    loading,
    error,
    fetchTransactions,
    fetchTransactionsPaged,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    clearError
  }
})
