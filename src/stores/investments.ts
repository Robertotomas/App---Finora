import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { investmentsApi } from '@/api/investments'
import type {
  InvestmentHolding,
  InvestmentTransaction,
  InvestmentDepositItem,
  InvestmentDividends,
  InvestmentDividendItem,
  SaveDividendRequest,
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
    previousClose: num(h.previousClose),
    dayChangeEur: num(h.dayChangeEur),
    dayChangePct: num(h.dayChangePct),
    realizedGainEur: Number(h.realizedGainEur) || 0,
    realizedCostEur: Number(h.realizedCostEur) || 0,
    dividendsEur: Number(h.dividendsEur) || 0,
    totalReturnEur: num(h.totalReturnEur),
    totalReturnPct: num(h.totalReturnPct),
    transactions: Array.isArray(h.transactions) ? h.transactions.map(mapTx) : [],
  }
}

export const useInvestmentsStore = defineStore('investments', () => {
  const holdings = ref<InvestmentHolding[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)
  const depositsTotalEur = ref(0)
  const uninvestedCashEur = ref(0)
  const deposits = ref<InvestmentDepositItem[]>([])
  const dividends = ref<InvestmentDividendItem[]>([])
  const dividendsTotalNetEur = ref(0)
  const dividendsTotalGrossEur = ref(0)
  const dividendsTotalTaxEur = ref(0)
  /** Taxa de conversão da corretora (%) aplicada ao valor das posições em moeda estrangeira. */
  const brokerFxFeePercent = ref(0)

  // Posições abertas (quantidade > 0); as fechadas/negativas não entram na lista nem nos totais.
  const activeHoldings = computed(() => holdings.value.filter((h) => h.quantity > 1e-9))

  const totalCurrentValueEur = computed(() =>
    activeHoldings.value.reduce((sum, h) => sum + (h.currentValueEur ?? h.investedEur), 0),
  )
  const totalInvestedEur = computed(() => activeHoldings.value.reduce((sum, h) => sum + h.investedEur, 0))
  // Ganhos realizados (vendas) de todas as posições, abertas ou fechadas.
  const totalRealizedGainEur = computed(() => holdings.value.reduce((sum, h) => sum + h.realizedGainEur, 0))
  // Retorno não realizado das posições abertas (valor − custo; sem cotação conta 0).
  const totalUnrealizedEur = computed(() => totalCurrentValueEur.value - totalInvestedEur.value)
  // Retorno total = não realizado + realizado + dividendos (líquidos).
  const totalReturnEur = computed(
    () => totalUnrealizedEur.value + totalRealizedGainEur.value + dividendsTotalNetEur.value,
  )
  // O que os investimentos valem no Património Total: posições + dinheiro parado na corretora.
  const patrimonyValueEur = computed(() => totalCurrentValueEur.value + uninvestedCashEur.value)

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
      void fetchDeposits() // compras/vendas mexem no dinheiro por investir
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
      void fetchDeposits()
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
      void fetchDeposits()
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
      void fetchDeposits()
    } catch (e: unknown) {
      error.value = extractError(e)
      throw e
    }
  }

  function applyDeposits(data: { totalEur: number; uninvestedCashEur?: number; items: InvestmentDepositItem[] }) {
    depositsTotalEur.value = Number(data.totalEur) || 0
    uninvestedCashEur.value = Number(data.uninvestedCashEur) || 0
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

  function applyDividends(data: InvestmentDividends) {
    dividendsTotalNetEur.value = Number(data.totalNetEur) || 0
    dividendsTotalGrossEur.value = Number(data.totalGrossEur) || 0
    dividendsTotalTaxEur.value = Number(data.totalTaxEur) || 0
    dividends.value = Array.isArray(data.items)
      ? data.items.map((d) => ({
          ...d,
          amountGross: Number(d.amountGross),
          withholdingTax: Number(d.withholdingTax),
          amountNet: Number(d.amountNet),
          fxRateToEur: Number(d.fxRateToEur),
          grossEur: Number(d.grossEur),
          taxEur: Number(d.taxEur),
          netEur: Number(d.netEur),
        }))
      : []
  }

  // Carregamento "lazy" e tolerante: se falhar (ex.: migração dos dividendos ainda por aplicar),
  // fica como "sem dividendos" e sem banner de erro.
  async function fetchDividends() {
    try {
      const { data } = await investmentsApi.dividends()
      applyDividends(data)
    } catch {
      applyDividends({ totalGrossEur: 0, totalTaxEur: 0, totalNetEur: 0, count: 0, items: [] })
    }
    return dividendsTotalNetEur.value
  }

  // Os dividendos entram no retorno de cada posição (calculado no backend) → refaz as posições também.
  async function afterDividendChange(data: InvestmentDividends) {
    applyDividends(data)
    await fetchHoldings().catch(() => {})
  }

  async function addDividend(request: SaveDividendRequest) {
    const { data } = await investmentsApi.addDividend(request)
    await afterDividendChange(data)
    return data
  }

  async function updateDividend(id: string, request: SaveDividendRequest) {
    const { data } = await investmentsApi.updateDividend(id, request)
    await afterDividendChange(data)
    return data
  }

  async function deleteDividend(id: string) {
    const { data } = await investmentsApi.deleteDividend(id)
    await afterDividendChange(data)
    return data
  }

  // Tolerante: se falhar (ex.: migração por aplicar), assume 0 (sem taxa) e sem banner.
  async function fetchSettings() {
    try {
      const { data } = await investmentsApi.settings()
      brokerFxFeePercent.value = Number(data.brokerFxFeePercent) || 0
    } catch {
      brokerFxFeePercent.value = 0
    }
    return brokerFxFeePercent.value
  }

  // A taxa muda o valor das posições (calculado no backend) → refaz as posições.
  async function saveSettings(percent: number) {
    const { data } = await investmentsApi.saveSettings({ brokerFxFeePercent: percent })
    brokerFxFeePercent.value = Number(data.brokerFxFeePercent) || 0
    await fetchHoldings().catch(() => {})
    return brokerFxFeePercent.value
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
    uninvestedCashEur,
    deposits,
    dividends,
    dividendsTotalNetEur,
    dividendsTotalGrossEur,
    dividendsTotalTaxEur,
    totalRealizedGainEur,
    totalUnrealizedEur,
    totalReturnEur,
    brokerFxFeePercent,
    fetchSettings,
    saveSettings,
    fetchDividends,
    addDividend,
    updateDividend,
    deleteDividend,
    totalCurrentValueEur,
    totalInvestedEur,
    patrimonyValueEur,
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
