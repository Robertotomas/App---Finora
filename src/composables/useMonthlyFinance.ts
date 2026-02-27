import { ref, computed, watch } from 'vue'
import { dashboardApi } from '@/api/dashboard'
import type { Dashboard } from '@/types/dashboard'

const STORAGE_KEY = 'finora-monthly-budget'

type BudgetStore = Record<string, { expectedIncome: number; expectedExpenses: number }>

function loadFromStorage(): BudgetStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as BudgetStore
  } catch {
    return {}
  }
}

function saveToStorage(store: BudgetStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

function storageKey(householdId: string, year: number, month: number): string {
  return `${householdId}-${year}-${month}`
}

export interface MonthlyFinanceData {
  realIncome: number
  realExpenses: number
  realSavings: number
  expectedIncome: number
  expectedExpenses: number
  expectedSavings: number
  finalBalance: number
  savingsRate: number
  currency: string
  year: number
  month: number
  periodLabel: string
}

export function useMonthlyFinance(getHouseholdId: () => string | undefined) {
  const year = ref(new Date().getFullYear())
  const month = ref(new Date().getMonth() + 1)
  const data = ref<Dashboard | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const budgetStore = ref<BudgetStore>(loadFromStorage())

  const expectedIncome = ref(0)
  const expectedExpenses = ref(0)

  const periodLabel = computed(() => {
    const names = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return `${names[month.value]} ${year.value}`
  })

  function getBudgetForPeriod() {
    const hid = getHouseholdId()
    if (!hid) return { expectedIncome: 0, expectedExpenses: 0 }
    const key = storageKey(hid, year.value, month.value)
    return budgetStore.value[key] ?? { expectedIncome: 0, expectedExpenses: 0 }
  }

  function setExpectedIncome(value: number) {
    expectedIncome.value = value
    const hid = getHouseholdId()
    if (hid) {
      const key = storageKey(hid, year.value, month.value)
      const store = { ...budgetStore.value }
      store[key] = { ...getBudgetForPeriod(), expectedIncome: value }
      budgetStore.value = store
      saveToStorage(store)
    }
  }

  function setExpectedExpenses(value: number) {
    expectedExpenses.value = value
    const hid = getHouseholdId()
    if (hid) {
      const key = storageKey(hid, year.value, month.value)
      const store = { ...budgetStore.value }
      store[key] = { ...getBudgetForPeriod(), expectedExpenses: value }
      budgetStore.value = store
      saveToStorage(store)
    }
  }

  const monthlyData = computed<MonthlyFinanceData | null>(() => {
    if (!data.value) return null
    const realIncome = data.value.monthlyIncome
    const realExpenses = data.value.monthlyExpenses
    const realSavings = realIncome - realExpenses
    const expInc = expectedIncome.value
    const expExp = expectedExpenses.value
    const expectedSavings = expInc - expExp
    const finalBalance = realIncome - realExpenses
    const savingsRate =
      realIncome > 0 ? Math.round((realSavings / realIncome) * 100) : 0

    return {
      realIncome,
      realExpenses,
      realSavings,
      expectedIncome: expInc,
      expectedExpenses: expExp,
      expectedSavings,
      finalBalance,
      savingsRate,
      currency: data.value.currency,
      year: data.value.year,
      month: data.value.month,
      periodLabel: periodLabel.value,
    }
  })

  async function fetch() {
    const hid = getHouseholdId()
    if (!hid) {
      data.value = null
      return
    }
    loading.value = true
    error.value = null
    try {
      const response = await dashboardApi.get({
        year: year.value,
        month: month.value,
        trendMonths: 1,
      })
      const res = (response.data ?? response) as unknown as Record<string, unknown>
      const get = (key: string) =>
        res[key] ?? res[key.charAt(0).toUpperCase() + key.slice(1)]

      data.value = {
        totalBalance: Number(get('totalBalance')) || 0,
        currency: String(get('currency') || 'EUR'),
        year: Number(get('year')) || year.value,
        month: Number(get('month')) || month.value,
        monthlyIncome: Number(get('monthlyIncome')) || 0,
        monthlyExpenses: Number(get('monthlyExpenses')) || 0,
        monthlySavings: 0,
        expensesByCategory: [],
        monthlyTrend: [],
      }
      data.value.monthlySavings =
        data.value.monthlyIncome - data.value.monthlyExpenses

      const budget = getBudgetForPeriod()
      expectedIncome.value = budget.expectedIncome
      expectedExpenses.value = budget.expectedExpenses
    } catch (e: unknown) {
      const err = e as { response?: { status: number; data?: { message?: string } } }
      if (err.response?.status === 404) {
        error.value = 'Household não encontrado.'
      } else if (err.response?.data?.message) {
        error.value = err.response.data.message
      } else {
        error.value = 'Erro ao carregar dados mensais.'
      }
      throw e
    } finally {
      loading.value = false
    }
  }

  watch([year, month], () => {
    const budget = getBudgetForPeriod()
    expectedIncome.value = budget.expectedIncome
    expectedExpenses.value = budget.expectedExpenses
  })

  return {
    year,
    month,
    data,
    loading,
    error,
    expectedIncome,
    expectedExpenses,
    periodLabel,
    monthlyData,
    setExpectedIncome,
    setExpectedExpenses,
    fetch,
  }
}
