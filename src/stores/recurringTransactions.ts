import { defineStore } from 'pinia'
import { ref } from 'vue'
import { recurringTransactionsApi } from '@/api/recurringTransactions'
import type {
  RecurringTransaction,
  CreateRecurringTransactionRequest,
  UpdateRecurringTransactionRequest
} from '@/types/recurringTransaction'

function extractError(e: unknown): string {
  const err = e as { response?: { data?: { errors?: Record<string, string[]> }; status: number } }
  if (err.response?.data?.errors) {
    const first = Object.values(err.response.data.errors)[0]
    return Array.isArray(first) ? first[0] : String(first)
  }
  if (err.response?.status === 404) return 'Household não encontrado. Cria primeiro um household.'
  return 'Ocorreu um erro. Tenta novamente.'
}

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

function mapRecurring(d: {
  id: string
  accountId: string
  householdId: string
  type: number
  category: number
  amount: number
  description?: string
  destinationAccountId?: string
  frequency?: number
  annualMonth?: number
  startMonth: number
  startYear: number
  endMonth?: number
  endYear?: number
}): RecurringTransaction {
  return {
    id: d.id,
    accountId: d.accountId,
    householdId: d.householdId,
    type: d.type,
    category: d.category,
    amount: Number(d.amount),
    description: d.description,
    destinationAccountId: d.destinationAccountId,
    frequency: d.frequency ?? 0,
    annualMonth: d.annualMonth,
    startMonth: d.startMonth,
    startYear: d.startYear,
    endMonth: d.endMonth,
    endYear: d.endYear
  }
}

export const useRecurringTransactionsStore = defineStore('recurringTransactions', () => {
  const recurring = ref<RecurringTransaction[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)

  async function fetchRecurring() {
    loading.value = true
    error.value = null
    try {
      const { data } = await recurringTransactionsApi.getAll()
      recurring.value = data.map(mapRecurring)
      return recurring.value
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

  async function createRecurring(request: CreateRecurringTransactionRequest) {
    loading.value = true
    error.value = null
    try {
      const { data } = await recurringTransactionsApi.create(request)
      const r = mapRecurring(data)
      recurring.value = [r, ...recurring.value]
      return r
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

  async function updateRecurring(id: string, request: UpdateRecurringTransactionRequest) {
    loading.value = true
    error.value = null
    try {
      const { data } = await recurringTransactionsApi.update(id, request)
      const r = mapRecurring(data)
      const idx = recurring.value.findIndex((x) => x.id === id)
      if (idx >= 0) {
        recurring.value = [...recurring.value]
        recurring.value[idx] = r
      } else {
        recurring.value = [r, ...recurring.value]
      }
      return r
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

  async function removeRecurring(id: string, year: number, month: number) {
    loading.value = true
    error.value = null
    try {
      await recurringTransactionsApi.remove(id, year, month)
      const idx = recurring.value.findIndex((r) => r.id === id)
      if (idx >= 0) {
        recurring.value = recurring.value.map((r) =>
          r.id === id ? { ...r, endMonth: month, endYear: year } : r
        )
      }
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
    recurring,
    loading,
    error,
    fetchRecurring,
    createRecurring,
    updateRecurring,
    removeRecurring,
    clearError
  }
})
