import { ref } from 'vue'
import { budgetsApi } from '@/api/budgets'

type BudgetEntry = { expectedIncome: number; expectedExpenses: number }
type BudgetStore = Record<string, BudgetEntry>

function storageKey(householdId: string, year: number, month: number): string {
  return `${householdId}-${year}-${month}`
}

const budgetStoreRef = ref<BudgetStore>({})
let loaded = false

async function ensureLoaded() {
  if (loaded) return
  try {
    const { data } = await budgetsApi.list()
    const store: BudgetStore = {}
    for (const b of data) {
      // We don't have householdId from the API response, but all results belong to the user's household.
      // We'll use a placeholder that gets resolved at access time.
      store[`_-${b.year}-${b.month}`] = { expectedIncome: b.expectedIncome, expectedExpenses: b.expectedExpenses }
    }
    budgetStoreRef.value = store
    loaded = true
  } catch {
    // If API fails, keep empty store
  }
}

/** Remove todos os orçamentos mensais locais deste agregado (ex.: após reset financeiro no servidor). */
export function clearAllBudgetsForHousehold(_householdId: string) {
  budgetStoreRef.value = {}
  loaded = false
}

export function useMonthlyBudget() {
  // Trigger load on first use
  ensureLoaded()

  function getBudget(householdId: string | undefined, year: number, month: number): BudgetEntry {
    if (!householdId) return { expectedIncome: 0, expectedExpenses: 0 }
    // Try household-specific key first, then generic key from API
    const key = storageKey(householdId, year, month)
    const genericKey = `_-${year}-${month}`
    return budgetStoreRef.value[key] ?? budgetStoreRef.value[genericKey] ?? { expectedIncome: 0, expectedExpenses: 0 }
  }

  function hasBudget(householdId: string | undefined, year: number, month: number): boolean {
    if (!householdId) return false
    const key = storageKey(householdId, year, month)
    const genericKey = `_-${year}-${month}`
    return key in budgetStoreRef.value || genericKey in budgetStoreRef.value
  }

  async function setBudget(
    householdId: string | undefined,
    year: number,
    month: number,
    expectedIncome: number,
    expectedExpenses: number
  ) {
    if (!householdId) return
    try {
      await budgetsApi.upsert({ year, month, expectedIncome, expectedExpenses })
      const key = storageKey(householdId, year, month)
      const genericKey = `_-${year}-${month}`
      const store = { ...budgetStoreRef.value }
      store[key] = { expectedIncome, expectedExpenses }
      store[genericKey] = { expectedIncome, expectedExpenses }
      budgetStoreRef.value = store
    } catch {
      // Silently fail — the UI will still show stale data
    }
  }

  async function clearBudget(householdId: string | undefined, year: number, month: number) {
    if (!householdId) return
    try {
      await budgetsApi.remove(year, month)
      const key = storageKey(householdId, year, month)
      const genericKey = `_-${year}-${month}`
      const store = { ...budgetStoreRef.value }
      delete store[key]
      delete store[genericKey]
      budgetStoreRef.value = store
    } catch {
      // Silently fail
    }
  }

  /** Force reload from API */
  async function reload() {
    loaded = false
    await ensureLoaded()
  }

  return {
    budgetStore: budgetStoreRef,
    getBudget,
    hasBudget,
    setBudget,
    clearBudget,
    reload,
  }
}
