import { ref, computed, shallowRef } from 'vue'
import { dashboardApi } from '@/api/dashboard'
import type { Dashboard } from '@/types/dashboard'

const CACHE_TTL_MS = 60_000 // 1 minute

let cachedData: Dashboard | null = null
let cacheKey = ''
let cacheTime = 0

function getCacheKey(year?: number, month?: number): string {
  const now = new Date()
  const y = year ?? now.getFullYear()
  const m = month ?? now.getMonth() + 1
  return `${y}-${m}`
}

function isCacheValid(key: string): boolean {
  return cachedData !== null && cacheKey === key && Date.now() - cacheTime < CACHE_TTL_MS
}

export function useDashboard() {
  const data = shallowRef<Dashboard | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const year = ref<number | undefined>()
  const month = ref<number | undefined>()

  const totalBalance = computed(() => data.value?.totalBalance ?? 0)
  const monthlyIncome = computed(() => data.value?.monthlyIncome ?? 0)
  const monthlyExpenses = computed(() => data.value?.monthlyExpenses ?? 0)
  const monthlySavings = computed(() => data.value?.monthlySavings ?? 0)
  const expensesByCategory = computed(() => data.value?.expensesByCategory ?? [])
  const monthlyTrend = computed(() => data.value?.monthlyTrend ?? [])
  const currency = computed(() => data.value?.currency ?? 'EUR')
  const periodLabel = computed(() => {
    if (!data.value) return ''
    const names = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return `${names[data.value.month]} ${data.value.year}`
  })

  const isEmpty = computed(() => {
    if (!data.value) return true
    return (
      data.value.totalBalance === 0 &&
      data.value.monthlyIncome === 0 &&
      data.value.monthlyExpenses === 0 &&
      data.value.expensesByCategory.length === 0 &&
      data.value.monthlyTrend.length === 0
    )
  })

  const hasExpenses = computed(() => expensesByCategory.value.length > 0)
  const hasTrend = computed(() => monthlyTrend.value.length > 0)

  async function fetch(force = false) {
    const key = getCacheKey(year.value, month.value)
    if (!force && isCacheValid(key)) {
      data.value = cachedData
      return cachedData!
    }

    loading.value = true
    error.value = null
    try {
      const response = await dashboardApi.get({
        year: year.value,
        month: month.value,
        trendMonths: 6,
      })
      // Axios wraps response in { data: ... }
      const res = (response.data ?? response) as unknown as Record<string, unknown>

      // Handle both camelCase and PascalCase from API
      const raw = res
      const get = (key: string) => raw[key] ?? raw[key.charAt(0).toUpperCase() + key.slice(1)]
      const arr = (key: string) => {
        const v = get(key)
        return Array.isArray(v) ? v : []
      }

      const monthlyIncome = Number(get('monthlyIncome')) || 0
      const monthlyExpenses = Number(get('monthlyExpenses')) || 0

      const mapped: Dashboard = {
        totalBalance: Number(get('totalBalance')) || 0,
        currency: String(get('currency') || 'EUR'),
        year: Number(get('year')) || new Date().getFullYear(),
        month: Number(get('month')) || new Date().getMonth() + 1,
        monthlyIncome,
        monthlyExpenses,
        monthlySavings: Number(get('monthlySavings')) || monthlyIncome - monthlyExpenses,
        expensesByCategory: arr('expensesByCategory').map((x: Record<string, unknown>) => ({
          category: Number(x.category ?? x.Category) || 0,
          categoryName: String(x.categoryName ?? x.CategoryName ?? ''),
          amount: Number(x.amount ?? x.Amount) || 0,
          percentage: Number(x.percentage ?? x.Percentage) || 0,
        })),
        monthlyTrend: arr('monthlyTrend').map((x: Record<string, unknown>) => ({
          year: Number(x.year ?? x.Year) || 0,
          month: Number(x.month ?? x.Month) || 0,
          label: String(x.label ?? x.Label ?? ''),
          income: Number(x.income ?? x.Income) || 0,
          expenses: Number(x.expenses ?? x.Expenses) || 0,
          savings: Number(x.savings ?? x.Savings) || 0,
        })),
      }

      data.value = mapped
      cachedData = mapped
      cacheKey = key
      cacheTime = Date.now()
      return mapped
    } catch (e: unknown) {
      const err = e as { response?: { status: number; data?: { message?: string } } }
      if (err.response?.status === 404) {
        error.value = 'Household não encontrado.'
      } else if (err.response?.data?.message) {
        error.value = err.response.data.message
      } else {
        error.value = 'Erro ao carregar dashboard.'
      }
      throw e
    } finally {
      loading.value = false
    }
  }

  function setPeriod(y?: number, m?: number) {
    year.value = y
    month.value = m
  }

  function invalidateCache() {
    cachedData = null
    cacheKey = ''
  }

  return {
    data,
    loading,
    error,
    year,
    month,
    totalBalance,
    monthlyIncome,
    monthlyExpenses,
    monthlySavings,
    expensesByCategory,
    monthlyTrend,
    currency,
    periodLabel,
    isEmpty,
    hasExpenses,
    hasTrend,
    fetch,
    setPeriod,
    invalidateCache,
  }
}
