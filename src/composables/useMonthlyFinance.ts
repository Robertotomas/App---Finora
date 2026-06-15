import { ref, computed, watch } from 'vue'
import { dashboardApi } from '@/api/dashboard'
import { budgetsApi } from '@/api/budgets'
import type { Dashboard } from '@/types/dashboard'

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

  const expectedIncome = ref(0)
  const expectedExpenses = ref(0)

  const periodLabel = computed(() => {
    const names = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return `${names[month.value]} ${year.value}`
  })

  async function getBudgetForPeriod(): Promise<{ expectedIncome: number; expectedExpenses: number }> {
    try {
      const { data: budgets } = await budgetsApi.list(year.value)
      const match = budgets.find(b => b.month === month.value)
      return match
        ? { expectedIncome: match.expectedIncome, expectedExpenses: match.expectedExpenses }
        : { expectedIncome: 0, expectedExpenses: 0 }
    } catch {
      return { expectedIncome: 0, expectedExpenses: 0 }
    }
  }

  async function setExpectedIncome(value: number) {
    expectedIncome.value = value
    const hid = getHouseholdId()
    if (hid) {
      await budgetsApi.upsert({
        year: year.value,
        month: month.value,
        expectedIncome: value,
        expectedExpenses: expectedExpenses.value,
      })
    }
  }

  async function setExpectedExpenses(value: number) {
    expectedExpenses.value = value
    const hid = getHouseholdId()
    if (hid) {
      await budgetsApi.upsert({
        year: year.value,
        month: month.value,
        expectedIncome: expectedIncome.value,
        expectedExpenses: value,
      })
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

      const monthlyIncome = Number(get('monthlyIncome')) || 0
      const monthlyExpenses = Number(get('monthlyExpenses')) || 0
      data.value = {
        totalBalance: Number(get('totalBalance')) || 0,
        currency: String(get('currency') || 'EUR'),
        year: Number(get('year')) || year.value,
        month: Number(get('month')) || month.value,
        monthlyIncome,
        monthlyExpenses,
        monthlySavings: monthlyIncome - monthlyExpenses,
        expensesByCategory: [],
        incomeByCategory: [],
        monthlyTrend: [],
        accountBalancesAtPeriod: [],
      }

      const budget = await getBudgetForPeriod()
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

  watch([year, month], async () => {
    const budget = await getBudgetForPeriod()
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
