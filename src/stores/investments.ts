import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { investmentsApi } from '@/api/investments'
import type {
  InvestmentHolding,
  InvestmentTransaction,
  InvestmentDepositItem,
  AddTransactionRequest,
  UpdateTransactionRequest,
  AddDepositRequest,
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
  const depositsTotalEur = ref(0)
  const deposits = ref<InvestmentDepositItem[]>([])

  // Posições abertas (quantidade > 0); as fechadas/negativas não entram na lista nem nos totais.
  const activeHoldings = computed(() => holdings.value.filter((h) => h.quantity > 1e-9))

  const totalCurrentValueEur = computed(() =>
    activeHoldings.value.reduce((sum, h) => sum + (h.currentValueEur ?? h.investedEur), 0),
  )
  const totalInvestedEur = computed(() => activeHoldings.value.reduce((sum, h) => sum + h.investedEur, 0))

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

  // Deduplica pedidos concorrentes (ex.: o card do dashboard e a página a montar ao mesmo tempo):
  // enquanto um getAll está em curso, os outros recebem a mesma Promise em vez de um novo GET.
  let inFlight: Promise<InvestmentHolding[]> | null = null

  function fetchHoldings() {
    if (inFlight) return inFlight
    loading.value = true
    error.value = null
    inFlight = (async () => {
      try {
        const { data } = await investmentsApi.getAll()
        holdings.value = data.map(mapHolding)
        return holdings.value
      } catch (e: unknown) {
        error.value = extractError(e)
        throw e
      } finally {
        loading.value = false
        inFlight = null
      }
    })()
    return inFlight
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

  function applyDeposits(data: { totalEur: number; items: InvestmentDepositItem[] }) {
    depositsTotalEur.value = Number(data.totalEur) || 0
    deposits.value = Array.isArray(data.items)
      ? data.items.map((d) => ({ ...d, amount: Number(d.amount) }))
      : []
  }

  async function fetchDeposits() {
    try {
      const { data } = await investmentsApi.deposits()
      applyDeposits(data)
      return depositsTotalEur.value
    } catch {
      return depositsTotalEur.value
    }
  }

  async function addDeposit(request: AddDepositRequest) {
    error.value = null
    try {
      const { data } = await investmentsApi.addDeposit(request)
      applyDeposits(data)
      return data
    } catch (e: unknown) {
      error.value = extractError(e)
      throw e
    }
  }

  async function updateDeposit(id: string, request: AddDepositRequest) {
    error.value = null
    try {
      const { data } = await investmentsApi.updateDeposit(id, request)
      applyDeposits(data)
      return data
    } catch (e: unknown) {
      error.value = extractError(e)
      throw e
    }
  }

  async function deleteDeposit(id: string) {
    error.value = null
    try {
      const { data } = await investmentsApi.deleteDeposit(id)
      applyDeposits(data)
      return data
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
    activeHoldings,
    loading,
    error,
    depositsTotalEur,
    deposits,
    totalCurrentValueEur,
    totalInvestedEur,
    fetchHoldings,
    fetchDeposits,
    addDeposit,
    updateDeposit,
    deleteDeposit,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    deleteHolding,
    refresh,
    clearError,
  }
})
