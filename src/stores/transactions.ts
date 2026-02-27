import { defineStore } from 'pinia'
import { ref } from 'vue'
import { transactionsApi } from '@/api/transactions'
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

function mapTransaction(d: { id: string; accountId: string; householdId: string; type: number; category: number; amount: number; date: string; description?: string; splits?: { userId: string; percentage: number }[] }): Transaction {
  return {
    id: d.id,
    accountId: d.accountId,
    householdId: d.householdId,
    type: d.type,
    category: d.category,
    amount: Number(d.amount),
    date: d.date,
    description: d.description,
    splits: (d.splits ?? []).map((s) => ({ userId: s.userId, percentage: Number(s.percentage) }))
  }
}

export const useTransactionsStore = defineStore('transactions', () => {
  const transactions = ref<Transaction[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchTransactions(params?: { accountId?: string; from?: string; to?: string }) {
    loading.value = true
    error.value = null
    try {
      const { data } = await transactionsApi.getAll(params)
      transactions.value = data.map(mapTransaction)
      return transactions.value
    } catch (e: unknown) {
      error.value = extractError(e)
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
      return tx
    } catch (e: unknown) {
      error.value = extractError(e)
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
      return tx
    } catch (e: unknown) {
      error.value = extractError(e)
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
    } catch (e: unknown) {
      error.value = extractError(e)
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
    loading,
    error,
    fetchTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    clearError
  }
})
