import { ref } from 'vue'

const STORAGE_KEY = 'finora-monthly-budget'

type BudgetEntry = { expectedIncome: number; expectedExpenses: number }
type BudgetStore = Record<string, BudgetEntry>

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

export function useMonthlyBudget() {
  const budgetStore = ref<BudgetStore>(loadFromStorage())

  function getBudget(householdId: string | undefined, year: number, month: number): BudgetEntry {
    if (!householdId) return { expectedIncome: 0, expectedExpenses: 0 }
    const key = storageKey(householdId, year, month)
    return budgetStore.value[key] ?? { expectedIncome: 0, expectedExpenses: 0 }
  }

  function hasBudget(householdId: string | undefined, year: number, month: number): boolean {
    if (!householdId) return false
    const key = storageKey(householdId, year, month)
    return key in budgetStore.value
  }

  function setBudget(
    householdId: string | undefined,
    year: number,
    month: number,
    expectedIncome: number,
    expectedExpenses: number
  ) {
    if (!householdId) return
    const key = storageKey(householdId, year, month)
    const store = { ...budgetStore.value }
    store[key] = { expectedIncome, expectedExpenses }
    budgetStore.value = store
    saveToStorage(store)
  }

  function clearBudget(householdId: string | undefined, year: number, month: number) {
    if (!householdId) return
    const key = storageKey(householdId, year, month)
    const store = { ...budgetStore.value }
    delete store[key]
    budgetStore.value = store
    saveToStorage(store)
  }

  return {
    budgetStore,
    getBudget,
    hasBudget,
    setBudget,
    clearBudget,
  }
}
