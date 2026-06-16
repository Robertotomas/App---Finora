import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { investmentsApi } from '@/api/investments'
import type {
  InvestmentHolding,
  InvestmentTransaction,
  AddTransactionRequest,
  UpdateTransactionRequest,
} from '@/types/investment'

function extractError(e: unknown): string {
  const err = e as {
    response?: { data?: { errors?: Record<string, string[]>; message?: string }; status: number }
  }
  if (err.response?.data?.message) return err.response.data.message
  if (err.response?.data?.errors) {
    const first = Object.values(err.response.data.errors)[0]
    return Array.isArray(first) ? first[0] : String(first)
  }
  return 'Ocorreu um erro. Tente novamente.'
}

function num(v: number | null | undefined): number | null {
  return v === null || v === undefined ? null : Number(v)
}

function mapTx(t: InvestmentTransaction): InvestmentTransaction {
  return {
    id: t.id,
    operation: t.operation,
    date: t.date,
    quantity: Number(t.quantity),
    unitPrice: Number(t.unitPrice),
    commission: Number(t.commission),
    fxFeePercent: Number(t.fxFeePercent),
  }
}

function mapHolding(h: InvestmentHolding): InvestmentHolding {
  return {
    ...h,
    quantity: Number(h.quantity),
    averageCost: Number(h.averageCost),
    currentPrice: num(h.currentPrice),
    investedEur: Number(h.investedEur),
    currentValueEur: num(h.currentValueEur),
    returnEur: num(h.returnEur),
    returnPct: num(h.returnPct),
    transactions: Array.isArray(h.transactions) ? h.transactions.map(mapTx) : [],
  }
}

export const useInvestmentsStore = defineStore('investments', () => {
  const holdings = ref<InvestmentHolding[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)

  const totalCurrentValueEur = computed(() =>
    holdings.value.reduce((sum, h) => sum + (h.currentValueEur ?? h.investedEur), 0),
  )
  const totalInvestedEur = computed(() => holdings.value.reduce((sum, h) => sum + h.investedEur, 0))

  function upsert(h: InvestmentHolding) {
    const idx = holdings.value.findIndex((x) => x.id === h.id)
    if (idx >= 0) {
      holdings.value = [...holdings.value]
      holdings.value[idx] = h
    } else {
      holdings.value = [...holdings.value, h]
    }
  }

  function remove(id: string) {
    holdings.value = holdings.value.filter((h) => h.id !== id)
  }

  async function fetchHoldings() {
    loading.value = true
    error.value = null
    try {
      const { data } = await investmentsApi.getAll()
      holdings.value = data.map(mapHolding)
      return holdings.value
    } catch (e: unknown) {
      error.value = extractError(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function addTransaction(request: AddTransactionRequest) {
    error.value = null
    try {
      const { data } = await investmentsApi.addTransaction(request)
      const h = mapHolding(data)
      upsert(h)
      return h
    } catch (e: unknown) {
      error.value = extractError(e)
      throw e
    }
  }

  async function updateTransaction(txId: string, request: UpdateTransactionRequest) {
    error.value = null
    try {
      const { data } = await investmentsApi.updateTransaction(txId, request)
      const h = mapHolding(data)
      upsert(h)
      return h
    } catch (e: unknown) {
      error.value = extractError(e)
      throw e
    }
  }

  async function deleteTransaction(holdingId: string, txId: string) {
    error.value = null
    try {
      const { data } = await investmentsApi.deleteTransaction(txId)
      if (data && typeof data === 'object' && 'id' in data) {
        upsert(mapHolding(data as InvestmentHolding))
      } else {
        remove(holdingId)
      }
    } catch (e: unknown) {
      error.value = extractError(e)
      throw e
    }
  }

  async function deleteHolding(id: string) {
    error.value = null
    try {
      await investmentsApi.delete(id)
      remove(id)
    } catch (e: unknown) {
      error.value = extractError(e)
      throw e
    }
  }

  async function refresh() {
    error.value = null
    try {
      const { data } = await investmentsApi.refresh()
      holdings.value = data.map(mapHolding)
      return holdings.value
    } catch (e: unknown) {
      error.value = extractError(e)
      throw e
    }
  }

  function clearError() {
    error.value = null
  }

  return {
    holdings,
    loading,
    error,
    totalCurrentValueEur,
    totalInvestedEur,
    fetchHoldings,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    deleteHolding,
    refresh,
    clearError,
  }
})
