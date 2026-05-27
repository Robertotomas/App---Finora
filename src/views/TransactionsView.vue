<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useTransactionsStore } from '@/stores/transactions'
import { useRecurringTransactionsStore } from '@/stores/recurringTransactions'
import { useAccountsStore } from '@/stores/accounts'
import { useHouseholdStore } from '@/stores/household'
import { useAuthStore } from '@/stores/auth'
import { useSubscriptionStore } from '@/stores/subscription'
import { householdApi } from '@/api/household'
import { transactionsApi } from '@/api/transactions'
import TransactionFormModal from '@/components/TransactionFormModal.vue'
import RecurringFormModal from '@/components/RecurringFormModal.vue'
import TransactionTypeSelectionModal from '@/components/TransactionTypeSelectionModal.vue'
import RemoveRecurringModal from '@/components/RemoveRecurringModal.vue'
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue'
import BaseModal from '@/components/BaseModal.vue'
import type { Transaction, CreateTransactionRequest } from '@/types/transaction'
import type { RecurringTransaction, CreateRecurringTransactionRequest } from '@/types/recurringTransaction'
import { RecurringFrequency, RECURRING_FREQUENCY_LABELS } from '@/types/recurringTransaction'
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_CATEGORY_LABELS,
  TransactionType,
  TransactionCategory
} from '@/types/transaction'
import type { HouseholdMember } from '@/types/household'

const transactionsStore = useTransactionsStore()
const recurringStore = useRecurringTransactionsStore()
const accountsStore = useAccountsStore()
const householdStore = useHouseholdStore()
const authStore = useAuthStore()
const subscriptionStore = useSubscriptionStore()
const router = useRouter()
const routeRef = useRoute()

const tabFromQuery = routeRef.query.tab as string | undefined
const initialTab = tabFromQuery === 'recurring' ? 'recurring' : tabFromQuery === 'movements' ? 'movements' : 'dashboard'
const activeTab = ref<'dashboard' | 'movements' | 'recurring'>(initialTab)

watch(() => routeRef.query.tab, (tab) => {
  if (tab === 'recurring') activeTab.value = 'recurring'
  else if (tab === 'movements') activeTab.value = 'movements'
  else activeTab.value = 'dashboard'
})

watch(() => routeRef.query.action, (action) => {
  if (action === 'new') {
    if (activeTab.value === 'recurring') openRecurringCreateModal()
    else openCreateModal()
    router.replace({ query: { ...routeRef.query, action: undefined } })
  }
})

const typeSelectionModalOpen = ref(false)
const isTransferMode = ref(false)
const recTypeSelectionModalOpen = ref(false)
const isRecTransferMode = ref(false)

const createModalOpen = ref(false)
const editModalOpen = ref(false)
const deleteModalOpen = ref(false)
const transactionToEdit = ref<Transaction | null>(null)
const transactionToDelete = ref<Transaction | null>(null)

const recurringCreateModalOpen = ref(false)
const recurringEditModalOpen = ref(false)
const recurringRemoveModalOpen = ref(false)
const recurringToEdit = ref<RecurringTransaction | null>(null)
const recurringToRemove = ref<RecurringTransaction | null>(null)

const members = ref<HouseholdMember[]>([])
const membersLoading = ref(false)
const membersLoaded = ref(false)

const membersMap = computed(() => {
  const map = new Map<string, HouseholdMember>()
  for (const m of members.value) map.set(m.id, m)
  return map
})

const filterAccountId = ref<string>('')
const _txInitToday = new Date()
const _txInitMonthStart = `${_txInitToday.getFullYear()}-${String(_txInitToday.getMonth() + 1).padStart(2, '0')}-01`
const _txInitTodayStr = `${_txInitToday.getFullYear()}-${String(_txInitToday.getMonth() + 1).padStart(2, '0')}-${String(_txInitToday.getDate()).padStart(2, '0')}`
const filterFrom = ref(_txInitMonthStart)
const filterTo = ref(_txInitTodayStr)
const filterType = ref<'' | 'income' | 'expense' | 'transfer'>('')
const filterCategory = ref<string>('')

const catDropOpen = ref(false)
const accDropOpen = ref(false)
const catDropRef = ref<HTMLElement | null>(null)
const accDropRef = ref<HTMLElement | null>(null)

function toggleCatDrop() { catDropOpen.value = !catDropOpen.value; accDropOpen.value = false }
function toggleAccDrop() { accDropOpen.value = !accDropOpen.value; catDropOpen.value = false }

function pickType(val: '' | 'income' | 'expense' | 'transfer') { filterType.value = val }
function pickCategory(val: string) { filterCategory.value = val; catDropOpen.value = false }
function pickAccount(val: string) { filterAccountId.value = val; accDropOpen.value = false }

const categoryLabel = computed(() => {
  if (filterCategory.value) return TRANSACTION_CATEGORY_LABELS[Number(filterCategory.value) as TransactionCategory] || 'Categoria'
  return 'Todas as categorias'
})
const accountLabel = computed(() => {
  if (filterAccountId.value) return accountsStore.accounts.find(a => a.id === filterAccountId.value)?.name || 'Conta'
  return 'Todas as contas'
})

const incomeCategories = [TransactionCategory.Salary, TransactionCategory.Freelance, TransactionCategory.Investment, TransactionCategory.Gift, TransactionCategory.Refund]
const expenseCategories = [TransactionCategory.Food, TransactionCategory.Transport, TransactionCategory.Housing, TransactionCategory.Utilities, TransactionCategory.Health, TransactionCategory.Entertainment, TransactionCategory.Shopping, TransactionCategory.Education, TransactionCategory.Other]

const availableCategories = computed(() => {
  let cats: TransactionCategory[]
  if (filterType.value === 'income') cats = incomeCategories
  else if (filterType.value === 'expense') cats = expenseCategories
  else cats = [...incomeCategories, ...expenseCategories]
  const result: Record<number, string> = {}
  for (const c of cats) result[c] = TRANSACTION_CATEGORY_LABELS[c]
  return result
})

watch(filterType, () => {
  filterCategory.value = ''
})

const MONTH_NAMES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const now = new Date()

/** 1.º dia do mês do filtro: o limite Free aplica-se ao mês da data da transação, não ao mês do calendário “hoje”. */
const defaultDateForNewTransaction = computed(() => {
  if (filterFrom.value) return filterFrom.value
  return undefined
})

const page = ref(1)
const pageSize = 10

const actionLoading = ref(false)

const limitModalOpen = ref(false)
const limitModalKind = ref<'plan' | 'primary'>('plan')
const limitMessage = ref('Atualiza o teu plano para continuar.')

const needsPrimarySelection = computed(
  () => subscriptionStore.limits.needsPrimaryAccountSelection === true
)

const accountsForCreateModal = computed(() =>
  accountsStore.accounts.filter((a) => a.isActiveForPlan !== false && !a.isArchived)
)

const accountsForEditModal = computed(() => {
  const tx = transactionToEdit.value
  if (!tx) return accountsForCreateModal.value
  return accountsStore.accounts.filter(
    (a) => (!a.isArchived && a.isActiveForPlan !== false) || a.id === tx.accountId || a.id === tx.destinationAccountId
  )
})

/* ── Summary tab state ── */
const _initToday = new Date()
const _initMonthStart = `${_initToday.getFullYear()}-${String(_initToday.getMonth() + 1).padStart(2, '0')}-01`
const _initTodayStr = `${_initToday.getFullYear()}-${String(_initToday.getMonth() + 1).padStart(2, '0')}-${String(_initToday.getDate()).padStart(2, '0')}`
const summaryDateFrom = ref(_initMonthStart)
const summaryDateTo = ref(_initTodayStr)
const summaryFilterType = ref<'' | 'income' | 'expense'>('')
const summaryFilterCategory = ref<'' | string>('')
const summaryFilterAccount = ref('')

const sumTypeDropOpen = ref(false)
const sumCatDropOpen = ref(false)
const sumAccDropOpen = ref(false)
const sumTypeDropRef = ref<HTMLElement | null>(null)
const sumCatDropRef = ref<HTMLElement | null>(null)
const sumAccDropRef = ref<HTMLElement | null>(null)

function toggleSumTypeDrop() { sumTypeDropOpen.value = !sumTypeDropOpen.value; sumCatDropOpen.value = false; sumAccDropOpen.value = false }
function toggleSumCatDrop() { sumCatDropOpen.value = !sumCatDropOpen.value; sumTypeDropOpen.value = false; sumAccDropOpen.value = false }
function toggleSumAccDrop() { sumAccDropOpen.value = !sumAccDropOpen.value; sumTypeDropOpen.value = false; sumCatDropOpen.value = false }

function pickSumType(val: '' | 'income' | 'expense') { summaryFilterType.value = val; sumTypeDropOpen.value = false }
function pickSumCategory(val: string) { summaryFilterCategory.value = val; sumCatDropOpen.value = false }
function pickSumAccount(val: string) { summaryFilterAccount.value = val; sumAccDropOpen.value = false }

const sumTypeLabel = computed(() => {
  if (summaryFilterType.value === 'income') return 'Receitas'
  if (summaryFilterType.value === 'expense') return 'Despesas'
  return 'Todos os tipos'
})
const sumCategoryLabel = computed(() => {
  if (summaryFilterCategory.value) return TRANSACTION_CATEGORY_LABELS[Number(summaryFilterCategory.value) as TransactionCategory] || 'Categoria'
  return 'Todas as categorias'
})
const sumAccountLabel = computed(() => {
  if (summaryFilterAccount.value) return accountsStore.accounts.find(a => a.id === summaryFilterAccount.value)?.name || 'Conta'
  return 'Todas as contas'
})

const sumAvailableCategories = computed(() => {
  let cats: TransactionCategory[]
  if (summaryFilterType.value === 'income') cats = incomeCategories
  else if (summaryFilterType.value === 'expense') cats = expenseCategories
  else cats = [...incomeCategories, ...expenseCategories]
  const result: Record<number, string> = {}
  for (const c of cats) result[c] = TRANSACTION_CATEGORY_LABELS[c]
  return result
})

watch(summaryFilterType, () => {
  summaryFilterCategory.value = ''
})
const summarySearch = ref('')
const summaryTransactions = ref<Transaction[]>([])
const summaryLoading = ref(true)


/* ── Date Range Picker ── */
const datePickerOpen = ref(false)
const datePickerRef = ref<HTMLElement | null>(null)
const PICKER_MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const PICKER_WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

// Left calendar state (for "from")
const pickerLeftYear = ref(new Date().getFullYear())
const pickerLeftMonth = ref(new Date().getMonth()) // 0-based

// Right calendar is always leftMonth + 1
const pickerRightYear = computed(() => pickerLeftMonth.value === 11 ? pickerLeftYear.value + 1 : pickerLeftYear.value)
const pickerRightMonth = computed(() => pickerLeftMonth.value === 11 ? 0 : pickerLeftMonth.value + 1)

function initPickerFromValues() {
  if (summaryDateFrom.value) {
    const d = new Date(summaryDateFrom.value + 'T00:00:00')
    pickerLeftYear.value = d.getFullYear()
    pickerLeftMonth.value = d.getMonth()
  }
}

function pickerPrevMonth() {
  if (pickerLeftMonth.value === 0) {
    pickerLeftMonth.value = 11
    pickerLeftYear.value--
  } else {
    pickerLeftMonth.value--
  }
}

function pickerNextMonth() {
  if (pickerLeftMonth.value === 11) {
    pickerLeftMonth.value = 0
    pickerLeftYear.value++
  } else {
    pickerLeftMonth.value++
  }
}

function calendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay()
  // Convert Sunday=0 to Monday-based: Mon=0 ... Sun=6
  const startOffset = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells
}

const leftDays = computed(() => calendarDays(pickerLeftYear.value, pickerLeftMonth.value))
const rightDays = computed(() => calendarDays(pickerRightYear.value, pickerRightMonth.value))

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function isInRange(y: number, m: number, d: number): boolean {
  if (!summaryDateFrom.value || !summaryDateTo.value) return false
  const ds = toDateStr(y, m, d)
  return ds >= summaryDateFrom.value && ds <= summaryDateTo.value
}

function isStart(y: number, m: number, d: number): boolean {
  return toDateStr(y, m, d) === summaryDateFrom.value
}

function isEnd(y: number, m: number, d: number): boolean {
  return toDateStr(y, m, d) === summaryDateTo.value
}

// Selection state: first click sets "from", second click sets "to"
const pickerSelectStep = ref<'from' | 'to'>('from')

function toggleDatePicker() {
  datePickerOpen.value = !datePickerOpen.value
  if (datePickerOpen.value) {
    initPickerFromValues()
    if (!summaryDateTo.value) pickerSelectStep.value = 'to'
    else pickerSelectStep.value = 'from'
  }
}

const activePreset = ref<string>('month')

function applyPreset(preset: string) {
  const today = new Date()
  const toStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  activePreset.value = preset
  summaryDateTo.value = toStr(today)

  if (preset === 'month') {
    summaryDateFrom.value = toStr(new Date(today.getFullYear(), today.getMonth(), 1))
  } else if (preset === '30d') {
    const d = new Date(); d.setDate(d.getDate() - 30)
    summaryDateFrom.value = toStr(d)
  } else if (preset === '3m') {
    const d = new Date(); d.setMonth(d.getMonth() - 3)
    summaryDateFrom.value = toStr(d)
  } else if (preset === 'year') {
    summaryDateFrom.value = toStr(new Date(today.getFullYear(), 0, 1))
  }

  initPickerFromValues()
  pickerSelectStep.value = 'from'
  datePickerOpen.value = false
}

// Clear preset when user picks custom dates
function pickDay(y: number, m: number, d: number) {
  const ds = toDateStr(y, m, d)
  activePreset.value = ''
  if (pickerSelectStep.value === 'from') {
    summaryDateFrom.value = ds
    summaryDateTo.value = ''
    pickerSelectStep.value = 'to'
  } else {
    if (ds < summaryDateFrom.value) {
      summaryDateFrom.value = ds
      summaryDateTo.value = ''
      pickerSelectStep.value = 'to'
    } else {
      summaryDateTo.value = ds
      pickerSelectStep.value = 'from'
      datePickerOpen.value = false
    }
  }
}

const presetLabels: Record<string, string> = { month: 'Este mês', '30d': '30 dias', '3m': '3 meses', year: 'Este ano' }

const datePickerLabel = computed(() => {
  if (activePreset.value && presetLabels[activePreset.value]) return presetLabels[activePreset.value]
  if (!summaryDateFrom.value && !summaryDateTo.value) return 'Selecionar período'
  const fmt = (s: string) => {
    const d = new Date(s + 'T00:00:00')
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  if (summaryDateFrom.value && summaryDateTo.value) return `${fmt(summaryDateFrom.value)} – ${fmt(summaryDateTo.value)}`
  if (summaryDateFrom.value) return `${fmt(summaryDateFrom.value)} – ...`
  return 'Selecionar período'
})

function onDatePickerOutsideClick(e: MouseEvent) {
  if (!datePickerOpen.value || !datePickerRef.value) return
  if (!datePickerRef.value.contains(e.target as Node)) {
    datePickerOpen.value = false
  }
}

/* ── Transactions tab date range picker ── */
const txDatePickerOpen = ref(false)
const txDatePickerRef = ref<HTMLElement | null>(null)
const txPickerLeftYear = ref(new Date().getFullYear())
const txPickerLeftMonth = ref(new Date().getMonth())
const txPickerRightYear = computed(() => txPickerLeftMonth.value === 11 ? txPickerLeftYear.value + 1 : txPickerLeftYear.value)
const txPickerRightMonth = computed(() => txPickerLeftMonth.value === 11 ? 0 : txPickerLeftMonth.value + 1)
const txPickerSelectStep = ref<'from' | 'to'>('from')
const txActivePreset = ref<string>('month')

const txLeftDays = computed(() => calendarDays(txPickerLeftYear.value, txPickerLeftMonth.value))
const txRightDays = computed(() => calendarDays(txPickerRightYear.value, txPickerRightMonth.value))

// Init transactions filter to current month
;(() => {
  const t = new Date()
  const y = t.getFullYear()
  const m = t.getMonth()
  filterFrom.value = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const last = new Date(y, m + 1, 0)
  filterTo.value = `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
})()

function txInitPickerFromValues() {
  if (filterFrom.value) {
    const d = new Date(filterFrom.value + 'T00:00:00')
    txPickerLeftYear.value = d.getFullYear()
    txPickerLeftMonth.value = d.getMonth()
  }
}

function txPickerPrevMonth() {
  if (txPickerLeftMonth.value === 0) { txPickerLeftMonth.value = 11; txPickerLeftYear.value-- }
  else txPickerLeftMonth.value--
}

function txPickerNextMonth() {
  if (txPickerLeftMonth.value === 11) { txPickerLeftMonth.value = 0; txPickerLeftYear.value++ }
  else txPickerLeftMonth.value++
}

function txIsInRange(y: number, m: number, d: number): boolean {
  if (!filterFrom.value || !filterTo.value) return false
  const ds = toDateStr(y, m, d)
  return ds >= filterFrom.value && ds <= filterTo.value
}
function txIsStart(y: number, m: number, d: number): boolean { return toDateStr(y, m, d) === filterFrom.value }
function txIsEnd(y: number, m: number, d: number): boolean { return toDateStr(y, m, d) === filterTo.value }

function txPickDay(y: number, m: number, d: number) {
  const ds = toDateStr(y, m, d)
  txActivePreset.value = ''
  if (txPickerSelectStep.value === 'from') {
    filterFrom.value = ds
    filterTo.value = ''
    txPickerSelectStep.value = 'to'
  } else {
    if (ds < filterFrom.value) {
      filterFrom.value = ds
      filterTo.value = ''
      txPickerSelectStep.value = 'to'
    } else {
      filterTo.value = ds
      txPickerSelectStep.value = 'from'
      txDatePickerOpen.value = false
    }
  }
}

function txApplyPreset(preset: string) {
  const today = new Date()
  const toStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  txActivePreset.value = preset
  filterTo.value = toStr(today)

  if (preset === 'month') {
    filterFrom.value = toStr(new Date(today.getFullYear(), today.getMonth(), 1))
  } else if (preset === '30d') {
    const d = new Date(); d.setDate(d.getDate() - 30)
    filterFrom.value = toStr(d)
  } else if (preset === '3m') {
    const d = new Date(); d.setMonth(d.getMonth() - 3)
    filterFrom.value = toStr(d)
  } else if (preset === 'year') {
    filterFrom.value = toStr(new Date(today.getFullYear(), 0, 1))
  }

  txInitPickerFromValues()
  txPickerSelectStep.value = 'from'
  txDatePickerOpen.value = false
}

function toggleTxDatePicker() {
  txDatePickerOpen.value = !txDatePickerOpen.value
  if (txDatePickerOpen.value) {
    txInitPickerFromValues()
    if (!filterTo.value) txPickerSelectStep.value = 'to'
    else txPickerSelectStep.value = 'from'
  }
}

const txDatePickerLabel = computed(() => {
  if (txActivePreset.value && presetLabels[txActivePreset.value]) return presetLabels[txActivePreset.value]
  if (!filterFrom.value && !filterTo.value) return 'Selecionar período'
  const fmt = (s: string) => {
    const d = new Date(s + 'T00:00:00')
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  if (filterFrom.value && filterTo.value) return `${fmt(filterFrom.value)} – ${fmt(filterTo.value)}`
  if (filterFrom.value) return `${fmt(filterFrom.value)} – ...`
  return 'Selecionar período'
})

function onTxDatePickerOutsideClick(e: MouseEvent) {
  if (!txDatePickerOpen.value || !txDatePickerRef.value) return
  if (!txDatePickerRef.value.contains(e.target as Node)) txDatePickerOpen.value = false
}

function onDropdownOutsideClick(e: MouseEvent) {
  const t = e.target as Node
  if (catDropOpen.value && catDropRef.value && !catDropRef.value.contains(t)) catDropOpen.value = false
  if (accDropOpen.value && accDropRef.value && !accDropRef.value.contains(t)) accDropOpen.value = false
  if (sumTypeDropOpen.value && sumTypeDropRef.value && !sumTypeDropRef.value.contains(t)) sumTypeDropOpen.value = false
  if (sumCatDropOpen.value && sumCatDropRef.value && !sumCatDropRef.value.contains(t)) sumCatDropOpen.value = false
  if (sumAccDropOpen.value && sumAccDropRef.value && !sumAccDropRef.value.contains(t)) sumAccDropOpen.value = false
  if (recCatDropOpen.value && recCatDropRef.value && !recCatDropRef.value.contains(t)) recCatDropOpen.value = false
  if (recAccDropOpen.value && recAccDropRef.value && !recAccDropRef.value.contains(t)) recAccDropOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', onDatePickerOutsideClick, true)
  document.addEventListener('click', onTxDatePickerOutsideClick, true)
  document.addEventListener('click', onRecDatePickerOutsideClick, true)
  document.addEventListener('click', onDropdownOutsideClick, true)
})
onUnmounted(() => {
  document.removeEventListener('click', onDatePickerOutsideClick, true)
  document.removeEventListener('click', onTxDatePickerOutsideClick, true)
  document.removeEventListener('click', onRecDatePickerOutsideClick, true)
  document.removeEventListener('click', onDropdownOutsideClick, true)
})

async function fetchSummaryTransactions() {
  summaryLoading.value = true
  try {
    const params: { from?: string; to?: string; accountId?: string } = {}
    if (summaryDateFrom.value) params.from = summaryDateFrom.value
    if (summaryDateTo.value) params.to = summaryDateTo.value
    if (summaryFilterAccount.value) params.accountId = summaryFilterAccount.value
    const [txResponse] = await Promise.all([
      transactionsApi.getAll(params),
      recurringStore.recurring.length === 0 ? recurringStore.fetchRecurring() : Promise.resolve(recurringStore.recurring),
    ])
    const regular: Transaction[] = (txResponse.data ?? []) as Transaction[]

    // Expand recurring transactions into virtual entries for each month in range
    // Use YYYY-MM string comparison to avoid timezone issues
    const fromYM = summaryDateFrom.value ? summaryDateFrom.value.slice(0, 7) : null  // "2026-04"
    const toYM = summaryDateTo.value ? summaryDateTo.value.slice(0, 7) : null
    const virtual: Transaction[] = []
    for (const r of recurringStore.recurring) {
      if (summaryFilterAccount.value && r.accountId !== summaryFilterAccount.value && r.destinationAccountId !== summaryFilterAccount.value) continue
      let y = r.startYear
      let m = r.startMonth
      const endY = r.endYear ?? new Date().getFullYear()
      const endM = r.endMonth ?? new Date().getMonth() + 1
      while (y < endY || (y === endY && m <= endM)) {
        const ym = `${y}-${String(m).padStart(2, '0')}`
        const inRange = (!fromYM || ym >= fromYM) && (!toYM || ym <= toYM)
        if (inRange) {
          const amt = r.frequency === RecurringFrequency.Annual
            ? Math.round((r.amount / 12) * 100) / 100
            : r.amount
          virtual.push({
            id: `recurring-${r.id}-${y}-${m}`,
            accountId: r.accountId,
            householdId: r.householdId,
            type: r.type,
            category: r.category,
            amount: amt,
            description: r.description ?? '',
            date: `${y}-${String(m).padStart(2, '0')}-01`,
            splits: []
          })
        }
        m++
        if (m > 12) { m = 1; y++ }
      }
    }
    summaryTransactions.value = [...regular, ...virtual]
  } catch { /* handled */ } finally {
    summaryLoading.value = false
  }
}

const summaryFiltered = computed(() => {
  let list = [...summaryTransactions.value]
  if (summaryFilterType.value === 'income') list = list.filter(t => t.type === TransactionType.Income)
  else if (summaryFilterType.value === 'expense') list = list.filter(t => t.type === TransactionType.Expense)
  // Exclude transfers from summary totals view (they don't affect net income/expenses)
  list = list.filter(t => t.type !== TransactionType.Transfer)
  if (summaryFilterCategory.value) list = list.filter(t => String(t.category) === summaryFilterCategory.value)
  if (summarySearch.value) {
    const q = summarySearch.value.toLowerCase()
    list = list.filter(t => (t.description || '').toLowerCase().includes(q) || (TRANSACTION_CATEGORY_LABELS[t.category] || '').toLowerCase().includes(q))
  }
  list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return list
})

const summaryPage = ref(1)
const summaryTotalPages = computed(() => Math.max(1, Math.ceil(summaryFiltered.value.length / pageSize)))
const summaryPaginated = computed(() => {
  const start = (summaryPage.value - 1) * pageSize
  return summaryFiltered.value.slice(start, start + pageSize)
})
const canPrevSummaryPage = computed(() => summaryPage.value > 1)
const canNextSummaryPage = computed(() => summaryPage.value < summaryTotalPages.value)
function prevSummaryPage() { if (canPrevSummaryPage.value) summaryPage.value-- }
function nextSummaryPage() { if (canNextSummaryPage.value) summaryPage.value++ }
function goToSummaryPage(p: number) { summaryPage.value = p }
const visibleSummaryPages = computed(() => {
  const total = summaryTotalPages.value
  const current = summaryPage.value
  const pages: (number | '...')[] = []
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    pages.push(1)
    if (current > 3) pages.push('...')
    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    if (current < total - 2) pages.push('...')
    pages.push(total)
  }
  return pages
})

const summaryTotalIncome = computed(() => summaryFiltered.value.filter(t => t.type === TransactionType.Income).reduce((s, t) => s + t.amount, 0))
const summaryTotalExpenses = computed(() => summaryFiltered.value.filter(t => t.type === TransactionType.Expense).reduce((s, t) => s + t.amount, 0))
const summaryBalance = computed(() => summaryTotalIncome.value - summaryTotalExpenses.value)

const summaryExpensesByCategory = computed(() => {
  const map = new Map<number, { name: string; total: number }>()
  summaryFiltered.value.filter(t => t.type === TransactionType.Expense).forEach(t => {
    const existing = map.get(t.category)
    if (existing) existing.total += t.amount
    else map.set(t.category, { name: TRANSACTION_CATEGORY_LABELS[t.category] || 'Outro', total: t.amount })
  })
  return [...map.entries()].map(([cat, v]) => ({ category: cat, name: v.name, total: v.total })).sort((a, b) => b.total - a.total)
})

const summaryIncomeByCategory = computed(() => {
  const map = new Map<number, { name: string; total: number }>()
  summaryFiltered.value.filter(t => t.type === TransactionType.Income).forEach(t => {
    const existing = map.get(t.category)
    if (existing) existing.total += t.amount
    else map.set(t.category, { name: TRANSACTION_CATEGORY_LABELS[t.category] || 'Outro', total: t.amount })
  })
  return [...map.entries()].map(([cat, v]) => ({ category: cat, name: v.name, total: v.total })).sort((a, b) => b.total - a.total)
})


/* ── Sankey diagram computeds ── */
const sankeyWidth = 200
const sankeyNodeGap = 18
const sankeyMinHeight = 4

interface SankeyNode { name: string; total: number; color: string; height: number; y: number; category: number }
interface SankeyLink { path: string; color: string; thickness: number }

// Dynamic height: grows with number of nodes to keep proportional differences visible
const sankeyHeight = computed(() => {
  const maxNodes = Math.max(summaryIncomeByCategory.value.length, summaryExpensesByCategory.value.length, 1)
  return Math.max(280, maxNodes * 40 + 40)
})

function buildSankeyNodes(items: { category: number; name: string; total: number }[], scaleTotal: number, totalHeight: number): SankeyNode[] {
  if (items.length === 0) return []
  const n = items.length
  const gapsTotal = (n - 1) * sankeyNodeGap
  const itemsTotal = items.reduce((s, it) => s + it.total, 0)
  const ratio = scaleTotal > 0 ? itemsTotal / scaleTotal : 1
  // Available height for bars (no gaps), scaled by ratio
  const barsHeight = (totalHeight - gapsTotal) * ratio
  // Reserve minHeight per node, then distribute the rest proportionally
  const baseTotal = n * sankeyMinHeight
  const extra = Math.max(0, barsHeight - baseTotal)
  const nodes: SankeyNode[] = items.map(item => ({
    ...item,
    color: categoryColors[item.category] || '#94a3b8',
    height: sankeyMinHeight + (itemsTotal > 0 ? (item.total / itemsTotal) * extra : 0),
    y: 0,
  }))
  let yy = 0
  nodes.forEach(nd => { nd.y = yy; yy += nd.height + sankeyNodeGap })
  // Center vertically
  const totalUsed = yy - sankeyNodeGap
  const offset = (totalHeight - totalUsed) / 2
  nodes.forEach(nd => { nd.y += offset })
  return nodes
}

// Income scales to income total; expenses scale to their own total (so differences are visible)
const sankeyIncomeNodes = computed(() => buildSankeyNodes(summaryIncomeByCategory.value, summaryTotalIncome.value, sankeyHeight.value))
const sankeyExpenseNodes = computed(() => buildSankeyNodes(summaryExpensesByCategory.value, summaryTotalExpenses.value, sankeyHeight.value))

const sankeyCenterHeight = computed(() => {
  const incNodes = sankeyIncomeNodes.value
  if (incNodes.length === 0) return 40
  // Sum of bar heights only (no gaps)
  return Math.max(40, incNodes.reduce((s, n) => s + n.height, 0))
})

function makeSankeyPath(srcY: number, srcH: number, dstY: number, dstH: number, width: number): string {
  const x0 = 0
  const x1 = width
  const cx = width * 0.5
  return `M${x0},${srcY} C${cx},${srcY} ${cx},${dstY} ${x1},${dstY} L${x1},${dstY + dstH} C${cx},${dstY + dstH} ${cx},${srcY + srcH} ${x0},${srcY + srcH} Z`
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

const sankeyIncomeLinks = computed<SankeyLink[]>(() => {
  const nodes = sankeyIncomeNodes.value
  const centerH = sankeyCenterHeight.value
  const h = sankeyHeight.value
  const centerTop = (h - centerH) / 2
  if (nodes.length === 0) return []
  const total = nodes.reduce((s, n) => s + n.height, 0)
  let destY = centerTop
  return nodes.map(n => {
    const dstH = (n.height / total) * centerH
    const link = { path: makeSankeyPath(n.y, n.height, destY, dstH, sankeyWidth), color: hexToRgba(n.color, 0.35), thickness: n.height }
    destY += dstH
    return link
  })
})

const sankeyExpenseLinksRight = computed<SankeyLink[]>(() => {
  const nodes = sankeyExpenseNodes.value
  const centerH = sankeyCenterHeight.value
  const h = sankeyHeight.value
  const centerTop = (h - centerH) / 2
  if (nodes.length === 0) return []
  const expenseRatio = summaryTotalIncome.value > 0 ? summaryTotalExpenses.value / summaryTotalIncome.value : 1
  const expenseCenterH = centerH * Math.min(1, expenseRatio)
  const nodesTotal = nodes.reduce((s, n) => s + n.height, 0)
  let srcY = centerTop
  return nodes.map(n => {
    const srcH = nodesTotal > 0 ? (n.height / nodesTotal) * expenseCenterH : expenseCenterH / nodes.length
    const link = { path: makeSankeyPath(srcY, srcH, n.y, n.height, sankeyWidth), color: hexToRgba(n.color, 0.35), thickness: n.height }
    srcY += srcH
    return link
  })
})

function formatCurrencySummary(value: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(value)
}

function accountName(accountId: string): string {
  return accountsStore.accounts.find(a => a.id === accountId)?.name ?? ''
}

// Category colors for the bars
const categoryColors: Record<number, string> = {
  0: '#059669', 1: '#10b981', 2: '#0ea5e9', 3: '#8b5cf6', 4: '#6366f1',
  10: '#ef4444', 11: '#f97316', 12: '#eab308', 13: '#84cc16', 14: '#ec4899',
  15: '#a855f7', 16: '#f43f5e', 17: '#14b8a6', 99: '#94a3b8',
  100: '#2563eb'
}

watch([summaryDateFrom, summaryDateTo, summaryFilterAccount], () => {
  summaryPage.value = 1
  if (activeTab.value === 'dashboard') fetchSummaryTransactions()
})

watch(activeTab, (tab) => {
  if (tab === 'dashboard') fetchSummaryTransactions()
})

const accountsForRecurringCreate = computed(() =>
  accountsStore.accounts.filter((a) => a.isActiveForPlan !== false && !a.isArchived)
)

const accountsForRecurringEdit = computed(() => {
  const r = recurringToEdit.value
  if (!r) return accountsForRecurringCreate.value
  return accountsStore.accounts.filter(
    (a) => (!a.isArchived && a.isActiveForPlan !== false) || a.id === r.accountId || a.id === r.destinationAccountId
  )
})

const filteredTransactions = computed(() => {
  let list = transactionsStore.transactions
  if (filterType.value) {
    const typeVal = filterType.value === 'income' ? TransactionType.Income : filterType.value === 'transfer' ? TransactionType.Transfer : TransactionType.Expense
    list = list.filter(tx => tx.type === typeVal)
  }
  if (filterCategory.value) {
    const catVal = Number(filterCategory.value)
    list = list.filter(tx => tx.category === catVal)
  }
  return list
})

const paginatedTransactions = computed(() => filteredTransactions.value)

const recurringInRange = computed(() => {
  const fromYM = filterFrom.value ? filterFrom.value.slice(0, 7) : null
  const toYM = filterTo.value ? filterTo.value.slice(0, 7) : null
  const entries: { type: number; amount: number }[] = []
  for (const r of recurringStore.recurring) {
    let y = r.startYear
    let m = r.startMonth
    const endY = r.endYear ?? new Date().getFullYear()
    const endM = r.endMonth ?? new Date().getMonth() + 1
    while (y < endY || (y === endY && m <= endM)) {
      const ym = `${y}-${String(m).padStart(2, '0')}`
      const inRange = (!fromYM || ym >= fromYM) && (!toYM || ym <= toYM)
      if (inRange) {
        const amt = r.frequency === RecurringFrequency.Annual
          ? Math.round((r.amount / 12) * 100) / 100
          : r.amount
        entries.push({ type: r.type, amount: amt })
      }
      m++
      if (m > 12) { m = 1; y++ }
    }
  }
  return entries
})

const allTransactionsFiltered = computed(() => {
  let list = transactionsStore.transactions
  if (filterCategory.value) {
    const catVal = Number(filterCategory.value)
    list = list.filter(tx => tx.category === catVal)
  }
  return list
})

const txTotalIncome = computed(() => {
  const fromTx = allTransactionsFiltered.value
    .filter(tx => tx.type === TransactionType.Income)
    .reduce((sum, tx) => sum + tx.amount, 0)
  const fromRec = recurringInRange.value
    .filter(e => e.type === TransactionType.Income)
    .reduce((sum, e) => sum + e.amount, 0)
  return fromTx + fromRec
})
const txTotalExpenses = computed(() => {
  const fromTx = allTransactionsFiltered.value
    .filter(tx => tx.type === TransactionType.Expense)
    .reduce((sum, tx) => sum + tx.amount, 0)
  const fromRec = recurringInRange.value
    .filter(e => e.type === TransactionType.Expense)
    .reduce((sum, e) => sum + e.amount, 0)
  return fromTx + fromRec
})
const txBalance = computed(() => txTotalIncome.value - txTotalExpenses.value)

const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1
const activeRecurring = computed(() => {
  const fromYM = recFilterFrom.value ? recFilterFrom.value.slice(0, 7) : null
  const toYM = recFilterTo.value ? recFilterTo.value.slice(0, 7) : null
  return recurringStore.recurring.filter((r) => {
    const startYM = `${r.startYear}-${String(r.startMonth).padStart(2, '0')}`
    if (toYM && startYM > toYM) return false
    if (r.endYear && r.endMonth) {
      const endYM = `${r.endYear}-${String(r.endMonth).padStart(2, '0')}`
      if (fromYM && endYM < fromYM) return false
    }
    return true
  })
})

// Recurring tab filters
const recFilterType = ref<'' | 'income' | 'expense' | 'transfer'>('')
const recFilterCategory = ref<string>('')
const recFilterAccount = ref<string>('')

const recCatDropOpen = ref(false)
const recAccDropOpen = ref(false)
const recCatDropRef = ref<HTMLElement | null>(null)
const recAccDropRef = ref<HTMLElement | null>(null)

function toggleRecCatDrop() { recCatDropOpen.value = !recCatDropOpen.value; recAccDropOpen.value = false; recDatePickerOpen.value = false }
function toggleRecAccDrop() { recAccDropOpen.value = !recAccDropOpen.value; recCatDropOpen.value = false; recDatePickerOpen.value = false }

function pickRecCategory(val: string) { recFilterCategory.value = val; recCatDropOpen.value = false }
function pickRecAccount(val: string) { recFilterAccount.value = val; recAccDropOpen.value = false }

const recCategoryLabel = computed(() => {
  if (recFilterCategory.value) return TRANSACTION_CATEGORY_LABELS[Number(recFilterCategory.value) as TransactionCategory] || 'Categoria'
  return 'Todas as categorias'
})
const recAccountLabel = computed(() => {
  if (recFilterAccount.value) return accountsStore.accounts.find(a => a.id === recFilterAccount.value)?.name || 'Conta'
  return 'Todas as contas'
})

const recAvailableCategories = computed(() => {
  let cats: TransactionCategory[]
  if (recFilterType.value === 'income') cats = incomeCategories
  else if (recFilterType.value === 'expense') cats = expenseCategories
  else cats = [...incomeCategories, ...expenseCategories]
  const result: Record<number, string> = {}
  for (const c of cats) result[c] = TRANSACTION_CATEGORY_LABELS[c]
  return result
})

watch(recFilterType, () => { recFilterCategory.value = '' })

const recAllFiltered = computed(() => {
  let list = activeRecurring.value
  if (recFilterCategory.value) {
    const catVal = Number(recFilterCategory.value)
    list = list.filter(r => r.category === catVal)
  }
  if (recFilterAccount.value) {
    list = list.filter(r => r.accountId === recFilterAccount.value || r.destinationAccountId === recFilterAccount.value)
  }
  return list
})

const recExpandedTotals = computed(() => {
  const fromYM = recFilterFrom.value ? recFilterFrom.value.slice(0, 7) : null
  const toYM = recFilterTo.value ? recFilterTo.value.slice(0, 7) : null
  let income = 0
  let expenses = 0
  for (const r of recAllFiltered.value) {
    let y = r.startYear
    let m = r.startMonth
    const endY = r.endYear ?? new Date().getFullYear()
    const endM = r.endMonth ?? new Date().getMonth() + 1
    while (y < endY || (y === endY && m <= endM)) {
      const ym = `${y}-${String(m).padStart(2, '0')}`
      const inRange = (!fromYM || ym >= fromYM) && (!toYM || ym <= toYM)
      if (inRange) {
        const amt = r.frequency === RecurringFrequency.Annual
          ? Math.round((r.amount / 12) * 100) / 100
          : r.amount
        if (r.type === TransactionType.Income) income += amt
        else if (r.type === TransactionType.Expense) expenses += amt
      }
      m++
      if (m > 12) { m = 1; y++ }
    }
  }
  return { income, expenses }
})

const recTxInRange = computed(() => {
  return transactionsStore.transactions.filter(tx => {
    if (recFilterFrom.value && tx.date < recFilterFrom.value) return false
    if (recFilterTo.value && tx.date > recFilterTo.value) return false
    return true
  })
})

const recTotalIncome = computed(() => {
  const fromTx = recTxInRange.value
    .filter(tx => tx.type === TransactionType.Income)
    .reduce((sum, tx) => sum + tx.amount, 0)
  return fromTx + recExpandedTotals.value.income
})
const recTotalExpenses = computed(() => {
  const fromTx = recTxInRange.value
    .filter(tx => tx.type === TransactionType.Expense)
    .reduce((sum, tx) => sum + tx.amount, 0)
  return fromTx + recExpandedTotals.value.expenses
})
const recBalance = computed(() => recTotalIncome.value - recTotalExpenses.value)

function pickRecTypeToggle(val: '' | 'income' | 'expense' | 'transfer') { recFilterType.value = val }

const recDatePickerRef = ref<HTMLElement | null>(null)
const recDatePickerOpen = ref(false)
const _recInitToday = new Date()
const _recInitMonthStart = `${_recInitToday.getFullYear()}-${String(_recInitToday.getMonth() + 1).padStart(2, '0')}-01`
const _recInitLast = new Date(_recInitToday.getFullYear(), _recInitToday.getMonth() + 1, 0)
const _recInitMonthEnd = `${_recInitToday.getFullYear()}-${String(_recInitToday.getMonth() + 1).padStart(2, '0')}-${String(_recInitLast.getDate()).padStart(2, '0')}`
const recFilterFrom = ref(_recInitMonthStart)
const recFilterTo = ref(_recInitMonthEnd)
const recActivePreset = ref<string>('month')

const recPickerLeftYear = ref(_recInitToday.getFullYear())
const recPickerLeftMonth = ref(_recInitToday.getMonth())
const recPickerRightYear = computed(() => recPickerLeftMonth.value === 11 ? recPickerLeftYear.value + 1 : recPickerLeftYear.value)
const recPickerRightMonth = computed(() => recPickerLeftMonth.value === 11 ? 0 : recPickerLeftMonth.value + 1)
const recPickerSelectStep = ref<'from' | 'to'>('from')

const recLeftDays = computed(() => calendarDays(recPickerLeftYear.value, recPickerLeftMonth.value))
const recRightDays = computed(() => calendarDays(recPickerRightYear.value, recPickerRightMonth.value))

function recInitPickerFromValues() {
  if (recFilterFrom.value) {
    const d = new Date(recFilterFrom.value + 'T00:00:00')
    recPickerLeftYear.value = d.getFullYear()
    recPickerLeftMonth.value = d.getMonth()
  }
}

function recPickerPrevMonth() {
  if (recPickerLeftMonth.value === 0) { recPickerLeftMonth.value = 11; recPickerLeftYear.value-- }
  else recPickerLeftMonth.value--
}

function recPickerNextMonth() {
  if (recPickerLeftMonth.value === 11) { recPickerLeftMonth.value = 0; recPickerLeftYear.value++ }
  else recPickerLeftMonth.value++
}

function recIsInRange(y: number, m: number, d: number): boolean {
  if (!recFilterFrom.value || !recFilterTo.value) return false
  const ds = toDateStr(y, m, d)
  return ds >= recFilterFrom.value && ds <= recFilterTo.value
}
function recIsStart(y: number, m: number, d: number): boolean { return toDateStr(y, m, d) === recFilterFrom.value }
function recIsEnd(y: number, m: number, d: number): boolean { return toDateStr(y, m, d) === recFilterTo.value }

function recPickDay(y: number, m: number, d: number) {
  const ds = toDateStr(y, m, d)
  recActivePreset.value = ''
  if (recPickerSelectStep.value === 'from') {
    recFilterFrom.value = ds
    recFilterTo.value = ''
    recPickerSelectStep.value = 'to'
  } else {
    if (ds < recFilterFrom.value) {
      recFilterFrom.value = ds
      recFilterTo.value = ''
      recPickerSelectStep.value = 'to'
    } else {
      recFilterTo.value = ds
      recPickerSelectStep.value = 'from'
      recDatePickerOpen.value = false
    }
  }
}

function recApplyPreset(preset: string) {
  const today = new Date()
  const toStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  recActivePreset.value = preset
  recFilterTo.value = toStr(today)

  if (preset === 'month') {
    recFilterFrom.value = toStr(new Date(today.getFullYear(), today.getMonth(), 1))
  } else if (preset === '30d') {
    const d = new Date(); d.setDate(d.getDate() - 30)
    recFilterFrom.value = toStr(d)
  } else if (preset === '3m') {
    const d = new Date(); d.setMonth(d.getMonth() - 3)
    recFilterFrom.value = toStr(d)
  } else if (preset === 'year') {
    recFilterFrom.value = toStr(new Date(today.getFullYear(), 0, 1))
  }

  recInitPickerFromValues()
  recPickerSelectStep.value = 'from'
  recDatePickerOpen.value = false
}

function toggleRecDatePicker() {
  recDatePickerOpen.value = !recDatePickerOpen.value
  if (recDatePickerOpen.value) {
    recInitPickerFromValues()
    if (!recFilterTo.value) recPickerSelectStep.value = 'to'
    else recPickerSelectStep.value = 'from'
  }
}

const recDatePickerLabel = computed(() => {
  if (recActivePreset.value && presetLabels[recActivePreset.value]) return presetLabels[recActivePreset.value]
  if (!recFilterFrom.value && !recFilterTo.value) return 'Selecionar período'
  const fmt = (s: string) => {
    const d = new Date(s + 'T00:00:00')
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  if (recFilterFrom.value && recFilterTo.value) return `${fmt(recFilterFrom.value)} – ${fmt(recFilterTo.value)}`
  if (recFilterFrom.value) return `${fmt(recFilterFrom.value)} – ...`
  return 'Selecionar período'
})

function onRecDatePickerOutsideClick(e: MouseEvent) {
  if (!recDatePickerOpen.value || !recDatePickerRef.value) return
  if (!recDatePickerRef.value.contains(e.target as Node)) recDatePickerOpen.value = false
}

const filteredRecurring = computed(() => {
  let list = activeRecurring.value
  if (recFilterType.value) {
    const typeVal = recFilterType.value === 'income' ? TransactionType.Income : recFilterType.value === 'transfer' ? TransactionType.Transfer : TransactionType.Expense
    list = list.filter(r => r.type === typeVal)
  }
  if (recFilterCategory.value) {
    const catVal = Number(recFilterCategory.value)
    list = list.filter(r => r.category === catVal)
  }
  if (recFilterAccount.value) {
    list = list.filter(r => r.accountId === recFilterAccount.value || r.destinationAccountId === recFilterAccount.value)
  }
  return list
})

const recPage = ref(1)
const recTotalPages = computed(() => Math.max(1, Math.ceil(filteredRecurring.value.length / pageSize)))
const paginatedRecurring = computed(() => {
  const start = (recPage.value - 1) * pageSize
  return filteredRecurring.value.slice(start, start + pageSize)
})
const canPrevRecPage = computed(() => recPage.value > 1)
const canNextRecPage = computed(() => recPage.value < recTotalPages.value)
function prevRecPage() { if (canPrevRecPage.value) recPage.value-- }
function nextRecPage() { if (canNextRecPage.value) recPage.value++ }
function goToRecPage(p: number) { recPage.value = p }
const visibleRecPages = computed(() => {
  const total = recTotalPages.value
  const current = recPage.value
  const pages: (number | '...')[] = []
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    pages.push(1)
    if (current > 3) pages.push('...')
    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    if (current < total - 2) pages.push('...')
    pages.push(total)
  }
  return pages
})

const totalPages = computed(() => transactionsStore.totalPages)

const canPrevPage = computed(() => page.value > 1)
const canNextPage = computed(() => page.value < totalPages.value)

function prevPage() {
  if (canPrevPage.value) {
    page.value--
    fetchWithFilters(false)
  }
}

function nextPage() {
  if (canNextPage.value) {
    page.value++
    fetchWithFilters(false)
  }
}

function goToPage(p: number) {
  page.value = p
  fetchWithFilters(false)
}

const visiblePages = computed(() => {
  const total = totalPages.value
  const current = page.value
  const pages: (number | '...')[] = []
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    pages.push(1)
    if (current > 3) pages.push('...')
    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    if (current < total - 2) pages.push('...')
    pages.push(total)
  }
  return pages
})

async function loadMembers() {
  if (membersLoaded.value) return
  membersLoading.value = true
  try {
    const { data } = await householdApi.getMembers()
    members.value = data
    membersLoaded.value = true
  } catch {
    members.value = []
  } finally {
    membersLoading.value = false
  }
}

onMounted(async () => {
  try {
    await householdStore.fetchHousehold()
    if (householdStore.household) {
      await Promise.all([
        accountsStore.fetchAccounts(),
        fetchWithFilters(),
        recurringStore.fetchRecurring(),
        subscriptionStore.fetchSubscription(),
        loadMembers(),
      ])
      if (activeTab.value === 'dashboard') await fetchSummaryTransactions()
    } else {
      await subscriptionStore.fetchSubscription()
    }
  } catch {
    // Handled in stores
  }
  if (routeRef.query.action === 'new') {
    if (activeTab.value === 'recurring') openRecurringCreateModal()
    else openCreateModal()
    router.replace({ query: { ...routeRef.query, action: undefined } })
  }
})

async function fetchWithFilters(resetPage = true) {
  if (resetPage) page.value = 1
  const params: { accountId?: string; from?: string; to?: string; page?: number; pageSize?: number } = {
    page: page.value,
    pageSize,
  }
  if (filterAccountId.value) params.accountId = filterAccountId.value
  if (filterFrom.value) params.from = filterFrom.value
  if (filterTo.value) params.to = filterTo.value

  try {
    await transactionsStore.fetchTransactionsPaged(params)
  } catch {
    // Handled in store
  }
}

watch([filterAccountId, filterFrom, filterTo], () => {
  fetchWithFilters()
})

function openCreateModal() {
  if (needsPrimarySelection.value) {
    limitModalKind.value = 'primary'
    limitMessage.value =
      'Tens mais do que uma conta no plano Free. Vai a Contas e escolhe qual fica ativa para movimentos antes de continuar.'
    limitModalOpen.value = true
    return
  }
  typeSelectionModalOpen.value = true
}

function handleTypeSelection(type: 'income-expense' | 'transfer') {
  typeSelectionModalOpen.value = false
  isTransferMode.value = type === 'transfer'
  transactionsStore.clearError()
  loadMembers()
  createModalOpen.value = true
}

function closeCreateModal() {
  createModalOpen.value = false
  isTransferMode.value = false
}

/** Fecha o aviso de limite/plano, limpa erros e volta ao separador Transações (e à rota, se necessário). */
function dismissLimitModal() {
  limitModalOpen.value = false
  transactionsStore.clearError()
  recurringStore.clearError()
  closeCreateModal()
  closeEditModal()
  closeRecurringCreateModal()
  closeRecurringEditModal()
  activeTab.value = 'movements'
  if (router.currentRoute.value.name !== 'transactions') {
    void router.push({ name: 'movimentos' })
  }
}

function openEditModal(tx: Transaction) {
  if (needsPrimarySelection.value) {
    limitModalKind.value = 'primary'
    limitMessage.value =
      'Tens mais do que uma conta no plano Free. Vai a Contas e escolhe a conta principal antes de editar movimentos.'
    limitModalOpen.value = true
    return
  }
  const acc = accountsStore.accounts.find((a) => a.id === tx.accountId)
  if (acc && acc.isActiveForPlan === false) {
    limitModalKind.value = 'primary'
    limitMessage.value =
      'Esta transação está numa conta que não é a principal no plano Free. Só podes editar movimentos na conta principal, ou altera a conta principal em Contas.'
    limitModalOpen.value = true
    return
  }
  transactionsStore.clearError()
  loadMembers()
  transactionToEdit.value = tx
  isTransferMode.value = tx.type === TransactionType.Transfer
  editModalOpen.value = true
}

function closeEditModal() {
  editModalOpen.value = false
  transactionToEdit.value = null
  isTransferMode.value = false
}

function openDeleteModal(tx: Transaction) {
  transactionToDelete.value = tx
  deleteModalOpen.value = true
}

function closeDeleteModal() {
  deleteModalOpen.value = false
  transactionToDelete.value = null
}

async function handleCreate(payload: CreateTransactionRequest) {
  actionLoading.value = true
  try {
    await transactionsStore.createTransaction(payload)
    // Update account balances locally instead of re-fetching
    if (payload.type === TransactionType.Transfer && payload.destinationAccountId) {
      accountsStore.adjustBalance(payload.accountId, -payload.amount)
      accountsStore.adjustBalance(payload.destinationAccountId, payload.amount)
    } else {
      const delta = payload.type === TransactionType.Income ? payload.amount : -payload.amount
      accountsStore.adjustBalance(payload.accountId, delta)
    }
    await fetchWithFilters(false)
    closeCreateModal()
  } catch (e: unknown) {
    const err = e as { response?: { status?: number; data?: { code?: string; message?: string } } }
    const code = err.response?.data?.code
    if (err.response?.status === 403 && code === 'PLAN_LIMIT') {
      closeCreateModal()
      limitModalKind.value = 'plan'
      limitMessage.value = payload.type === TransactionType.Income
        ? 'Atingiste o limite de receitas do plano Free: só podes adicionar 1 receita por mês. Atualiza para Pro ou Couple para continuares.'
        : 'Atingiste o limite de despesas do plano Free: só podes adicionar 5 despesas por mês. Atualiza para Pro ou Couple para continuares.'
      limitModalOpen.value = true
    } else if (err.response?.status === 403 && code === 'FREE_PRIMARY_REQUIRED') {
      closeCreateModal()
      limitModalKind.value = 'primary'
      limitMessage.value =
        err.response?.data?.message ??
        'Tens mais do que uma conta no plano Free. Escolhe a conta principal em Contas antes de adicionar movimentos.'
      limitModalOpen.value = true
    } else if (err.response?.status === 403 && code === 'FREE_ACCOUNT_LOCKED') {
      closeCreateModal()
      limitModalKind.value = 'primary'
      limitMessage.value =
        err.response?.data?.message ??
        'No plano Free só podes usar a conta principal para movimentos. Altera a conta principal em Contas.'
      limitModalOpen.value = true
    }
  } finally {
    actionLoading.value = false
  }
}

async function handleEdit(payload: CreateTransactionRequest) {
  if (!transactionToEdit.value) return
  actionLoading.value = true
  const old = transactionToEdit.value
  try {
    await transactionsStore.updateTransaction(old.id, payload)
    // Revert old balance effects locally
    if (old.type === TransactionType.Transfer && old.destinationAccountId) {
      accountsStore.adjustBalance(old.accountId, old.amount)
      accountsStore.adjustBalance(old.destinationAccountId, -old.amount)
    } else {
      const revertDelta = old.type === TransactionType.Income ? -old.amount : old.amount
      accountsStore.adjustBalance(old.accountId, revertDelta)
    }
    // Apply new balance effects locally
    if (payload.type === TransactionType.Transfer && payload.destinationAccountId) {
      accountsStore.adjustBalance(payload.accountId, -payload.amount)
      accountsStore.adjustBalance(payload.destinationAccountId, payload.amount)
    } else {
      const applyDelta = payload.type === TransactionType.Income ? payload.amount : -payload.amount
      accountsStore.adjustBalance(payload.accountId, applyDelta)
    }
    closeEditModal()
  } catch (e: unknown) {
    const err = e as { response?: { status?: number; data?: { code?: string; message?: string } } }
    const code = err.response?.data?.code
    if (err.response?.status === 403 && code === 'FREE_PRIMARY_REQUIRED') {
      closeEditModal()
      limitModalKind.value = 'primary'
      limitMessage.value =
        err.response?.data?.message ??
        'Escolhe a conta principal em Contas antes de editar movimentos.'
      limitModalOpen.value = true
    } else if (err.response?.status === 403 && code === 'FREE_ACCOUNT_LOCKED') {
      closeEditModal()
      limitModalKind.value = 'primary'
      limitMessage.value =
        err.response?.data?.message ??
        'No plano Free só podes alterar movimentos na conta principal.'
      limitModalOpen.value = true
    }
  } finally {
    actionLoading.value = false
  }
}

async function handleDelete() {
  if (!transactionToDelete.value) return
  actionLoading.value = true
  const tx = transactionToDelete.value
  try {
    await transactionsStore.deleteTransaction(tx.id)
    // Revert balance effects locally
    if (tx.type === TransactionType.Transfer && tx.destinationAccountId) {
      accountsStore.adjustBalance(tx.accountId, tx.amount)
      accountsStore.adjustBalance(tx.destinationAccountId, -tx.amount)
    } else {
      const revertDelta = tx.type === TransactionType.Income ? -tx.amount : tx.amount
      accountsStore.adjustBalance(tx.accountId, revertDelta)
    }
    await fetchWithFilters(false)
    closeDeleteModal()
  } catch {
    // Error shown in store
  } finally {
    actionLoading.value = false
  }
}

function formatAmount(amount: number, type: TransactionType): string {
  const formatted = new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2
  }).format(Math.abs(amount))
  if (type === TransactionType.Transfer) return formatted
  return type === TransactionType.Expense ? `-${formatted}` : formatted
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

function getResponsibleDisplay(tx: Transaction): string {
  if (tx.splits.length === 0) return '-'
  const map = membersMap.value
  if (tx.splits.length === 1 && tx.splits[0].percentage === 100) {
    const m = map.get(tx.splits[0].userId)
    if (m) return m.id === authStore.user?.id ? 'Tu' : `${m.firstName} ${m.lastName}`
    return 'Tu'
  }
  return tx.splits
    .map((s) => {
      const m = map.get(s.userId)
      const name = m ? (m.id === authStore.user?.id ? 'Tu' : m.firstName) : '?'
      return `${name} ${s.percentage}%`
    })
    .join(', ')
}

function getSplitsDisplay(tx: Transaction): string {
  if (tx.splits.length <= 1) return '-'
  return tx.splits.map((s) => `${s.percentage}%`).join(' / ')
}

function openRecurringCreateModal() {
  if (needsPrimarySelection.value) {
    limitModalKind.value = 'primary'
    limitMessage.value =
      'Tens mais do que uma conta no plano Free. Vai a Contas e escolhe a conta principal antes de criar recorrentes.'
    limitModalOpen.value = true
    return
  }
  recTypeSelectionModalOpen.value = true
}

function handleRecTypeSelection(type: 'income-expense' | 'transfer') {
  recTypeSelectionModalOpen.value = false
  isRecTransferMode.value = type === 'transfer'
  recurringStore.clearError()
  recurringCreateModalOpen.value = true
}

function closeRecurringCreateModal() {
  recurringCreateModalOpen.value = false
  isRecTransferMode.value = false
}

function openRecurringEditModal(r: RecurringTransaction) {
  if (needsPrimarySelection.value) {
    limitModalKind.value = 'primary'
    limitMessage.value =
      'Tens mais do que uma conta no plano Free. Vai a Contas e escolhe a conta principal antes de editar recorrentes.'
    limitModalOpen.value = true
    return
  }
  const acc = accountsStore.accounts.find((a) => a.id === r.accountId)
  if (acc && acc.isActiveForPlan === false) {
    limitModalKind.value = 'primary'
    limitMessage.value =
      'Esta recorrente está numa conta que não é a principal no plano Free. Só podes editar na conta principal, ou altera a conta principal em Contas.'
    limitModalOpen.value = true
    return
  }
  recurringStore.clearError()
  recurringToEdit.value = r
  isRecTransferMode.value = r.type === TransactionType.Transfer
  recurringEditModalOpen.value = true
}

function closeRecurringEditModal() {
  recurringEditModalOpen.value = false
  recurringToEdit.value = null
  isRecTransferMode.value = false
}

function openRecurringRemoveModal(r: RecurringTransaction) {
  recurringToRemove.value = r
  recurringRemoveModalOpen.value = true
}

function closeRecurringRemoveModal() {
  recurringRemoveModalOpen.value = false
  recurringToRemove.value = null
}

async function handleRecurringCreate(payload: CreateRecurringTransactionRequest) {
  actionLoading.value = true
  try {
    await recurringStore.createRecurring(payload)
    closeRecurringCreateModal()
  } catch (e: unknown) {
    const err = e as { response?: { status?: number; data?: { code?: string; message?: string } } }
    const code = err.response?.data?.code
    if (err.response?.status === 403 && code === 'PLAN_LIMIT') {
      closeRecurringCreateModal()
      limitModalKind.value = 'plan'
      limitMessage.value = payload.type === TransactionType.Income
        ? 'Atingiste o limite de receitas do plano Free: só podes adicionar 1 receita por mês. Atualiza para Pro ou Couple para continuares.'
        : 'Atingiste o limite de despesas do plano Free: só podes adicionar 5 despesas por mês. Atualiza para Pro ou Couple para continuares.'
      limitModalOpen.value = true
      return
    }
    if (err.response?.status === 403 && code === 'FREE_PRIMARY_REQUIRED') {
      closeRecurringCreateModal()
      limitModalKind.value = 'primary'
      limitMessage.value =
        err.response?.data?.message ??
        'Escolhe a conta principal em Contas antes de adicionar recorrentes.'
      limitModalOpen.value = true
      return
    }
    if (err.response?.status === 403 && code === 'FREE_ACCOUNT_LOCKED') {
      closeRecurringCreateModal()
      limitModalKind.value = 'primary'
      limitMessage.value =
        err.response?.data?.message ??
        'No plano Free só podes usar recorrentes na conta principal.'
      limitModalOpen.value = true
      return
    }
    // Error shown in store
  } finally {
    actionLoading.value = false
  }
}

async function handleRecurringEdit(payload: CreateRecurringTransactionRequest) {
  if (!recurringToEdit.value) return
  actionLoading.value = true
  try {
    await recurringStore.updateRecurring(recurringToEdit.value.id, payload)
    closeRecurringEditModal()
  } catch (e: unknown) {
    const err = e as { response?: { status?: number; data?: { code?: string; message?: string } } }
    const code = err.response?.data?.code
    if (err.response?.status === 403 && code === 'FREE_PRIMARY_REQUIRED') {
      closeRecurringEditModal()
      limitModalKind.value = 'primary'
      limitMessage.value =
        err.response?.data?.message ??
        'Escolhe a conta principal em Contas antes de editar recorrentes.'
      limitModalOpen.value = true
    } else if (err.response?.status === 403 && code === 'FREE_ACCOUNT_LOCKED') {
      closeRecurringEditModal()
      limitModalKind.value = 'primary'
      limitMessage.value =
        err.response?.data?.message ??
        'No plano Free só podes editar recorrentes na conta principal.'
      limitModalOpen.value = true
    }
  } finally {
    actionLoading.value = false
  }
}

async function handleRecurringRemoveFromCurrentMonth() {
  if (!recurringToRemove.value) return
  actionLoading.value = true
  try {
    await recurringStore.removeRecurring(recurringToRemove.value.id, currentYear, currentMonth)
    closeRecurringRemoveModal()
  } catch {
    // Error shown in store
  } finally {
    actionLoading.value = false
  }
}

async function handleRecurringRemoveFromNextMonth() {
  if (!recurringToRemove.value) return
  actionLoading.value = true
  try {
    let y = currentYear
    let m = currentMonth + 1
    if (m > 12) {
      m = 1
      y++
    }
    await recurringStore.removeRecurring(recurringToRemove.value.id, y, m)
    closeRecurringRemoveModal()
  } catch {
    // Error shown in store
  } finally {
    actionLoading.value = false
  }
}

function getAccountName(accountId: string): string {
  return accountsStore.accounts.find((a) => a.id === accountId)?.name ?? '-'
}

function isTxAccountLocked(tx: Transaction): boolean {
  if (needsPrimarySelection.value) return true
  const acc = accountsStore.accounts.find((a) => a.id === tx.accountId)
  return acc?.isActiveForPlan === false
}

function isRecurringAccountLocked(r: RecurringTransaction): boolean {
  if (needsPrimarySelection.value) return true
  const acc = accountsStore.accounts.find((a) => a.id === r.accountId)
  return acc?.isActiveForPlan === false
}
</script>

<template>
  <div class="transactions-view">
    <div class="page-header">
      <h1>{{ activeTab === 'recurring' ? 'Transações Recorrentes' : activeTab === 'dashboard' ? 'Dashboard' : 'Movimentos' }}</h1>
      <p class="subtitle">{{ activeTab === 'recurring' ? 'Receitas e despesas que se repetem mensalmente e/ou anualmente.' : activeTab === 'dashboard' ? 'Visão geral das receitas e despesas' : 'Gerir receitas e despesas' }}</p>
    </div>

    <div v-if="!householdStore.household && !householdStore.loading" class="empty-state">
      <p>Configura primeiro o teu household.</p>
      <router-link to="/inicio" class="link">Ir para o painel</router-link>
    </div>

    <div v-else-if="householdStore.loading && !householdStore.household" class="loading-state">
      <div class="spinner"></div>
      <p>A carregar...</p>
    </div>

    <div v-else-if="householdStore.error && !householdStore.household" class="error-state">
      <p>{{ householdStore.error }}</p>
    </div>

    <div v-else class="content">
      <div v-if="activeTab === 'movements' && transactionsStore.error" class="global-error">
        {{ transactionsStore.error }}
      </div>
      <div v-if="activeTab === 'recurring' && recurringStore.error" class="global-error">
        {{ recurringStore.error }}
      </div>

      <!-- ═══ SUMMARY TAB ═══ -->
      <div v-show="activeTab === 'dashboard'" class="tab-content">
        <!-- Filters -->
        <div class="summary-filters">
          <div ref="datePickerRef" class="date-range-picker">
            <button type="button" class="date-range-btn" @click.stop="toggleDatePicker">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
              <span>{{ datePickerLabel }}</span>
              <svg class="date-range-chevron" :class="{ open: datePickerOpen }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <Transition name="panel">
              <div v-show="datePickerOpen" class="date-range-panel" @click.stop>
                <div class="dr-presets">
                  <button type="button" class="dr-preset-btn" :class="{ active: activePreset === 'month' }" @click="applyPreset('month')">Este mês</button>
                  <button type="button" class="dr-preset-btn" :class="{ active: activePreset === '30d' }" @click="applyPreset('30d')">30 dias</button>
                  <button type="button" class="dr-preset-btn" :class="{ active: activePreset === '3m' }" @click="applyPreset('3m')">3 meses</button>
                  <button type="button" class="dr-preset-btn" :class="{ active: activePreset === 'year' }" @click="applyPreset('year')">Este ano</button>
                </div>
                <div class="date-range-calendars">
                  <!-- Left calendar -->
                  <div class="dr-calendar">
                    <div class="dr-cal-header">
                      <button type="button" class="dr-cal-nav" @click="pickerPrevMonth">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                      </button>
                      <span class="dr-cal-title">{{ PICKER_MONTH_NAMES[pickerLeftMonth] }} {{ pickerLeftYear }}</span>
                      <span style="width:28px"></span>
                    </div>
                    <div class="dr-cal-weekdays">
                      <span v-for="wd in PICKER_WEEKDAYS" :key="wd">{{ wd }}</span>
                    </div>
                    <div class="dr-cal-grid">
                      <button
                        v-for="(d, i) in leftDays"
                        :key="'l'+i"
                        type="button"
                        class="dr-day"
                        :class="{
                          empty: d === null,
                          'in-range': d !== null && isInRange(pickerLeftYear, pickerLeftMonth, d),
                          'is-start': d !== null && isStart(pickerLeftYear, pickerLeftMonth, d),
                          'is-end': d !== null && isEnd(pickerLeftYear, pickerLeftMonth, d),
                        }"
                        :disabled="d === null"
                        @click="d !== null && pickDay(pickerLeftYear, pickerLeftMonth, d)"
                      >
                        {{ d ?? '' }}
                      </button>
                    </div>
                  </div>
                  <!-- Right calendar -->
                  <div class="dr-calendar">
                    <div class="dr-cal-header">
                      <span style="width:28px"></span>
                      <span class="dr-cal-title">{{ PICKER_MONTH_NAMES[pickerRightMonth] }} {{ pickerRightYear }}</span>
                      <button type="button" class="dr-cal-nav" @click="pickerNextMonth">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                      </button>
                    </div>
                    <div class="dr-cal-weekdays">
                      <span v-for="wd in PICKER_WEEKDAYS" :key="wd">{{ wd }}</span>
                    </div>
                    <div class="dr-cal-grid">
                      <button
                        v-for="(d, i) in rightDays"
                        :key="'r'+i"
                        type="button"
                        class="dr-day"
                        :class="{
                          empty: d === null,
                          'in-range': d !== null && isInRange(pickerRightYear, pickerRightMonth, d),
                          'is-start': d !== null && isStart(pickerRightYear, pickerRightMonth, d),
                          'is-end': d !== null && isEnd(pickerRightYear, pickerRightMonth, d),
                        }"
                        :disabled="d === null"
                        @click="d !== null && pickDay(pickerRightYear, pickerRightMonth, d)"
                      >
                        {{ d ?? '' }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
          <div ref="sumTypeDropRef" class="custom-dropdown">
            <button type="button" class="custom-dropdown-btn" :class="{ active: summaryFilterType !== '' }" @click.stop="toggleSumTypeDrop">
              <span>{{ sumTypeLabel }}</span>
              <svg class="custom-dropdown-chevron" :class="{ open: sumTypeDropOpen }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <Transition name="panel">
              <div v-show="sumTypeDropOpen" class="custom-dropdown-panel" @click.stop>
                <button type="button" class="custom-dropdown-item" :class="{ selected: summaryFilterType === '' }" @click="pickSumType('')">Todos os tipos</button>
                <button type="button" class="custom-dropdown-item" :class="{ selected: summaryFilterType === 'income' }" @click="pickSumType('income')">Receitas</button>
                <button type="button" class="custom-dropdown-item" :class="{ selected: summaryFilterType === 'expense' }" @click="pickSumType('expense')">Despesas</button>
              </div>
            </Transition>
          </div>
          <div ref="sumCatDropRef" class="custom-dropdown">
            <button type="button" class="custom-dropdown-btn" :class="{ active: summaryFilterCategory !== '' }" @click.stop="toggleSumCatDrop">
              <span>{{ sumCategoryLabel }}</span>
              <svg class="custom-dropdown-chevron" :class="{ open: sumCatDropOpen }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <Transition name="panel">
              <div v-show="sumCatDropOpen" class="custom-dropdown-panel" @click.stop>
                <button type="button" class="custom-dropdown-item" :class="{ selected: summaryFilterCategory === '' }" @click="pickSumCategory('')">Todas as categorias</button>
                <button v-for="(label, key) in sumAvailableCategories" :key="key" type="button" class="custom-dropdown-item" :class="{ selected: summaryFilterCategory === String(key) }" @click="pickSumCategory(String(key))">{{ label }}</button>
              </div>
            </Transition>
          </div>
          <div ref="sumAccDropRef" class="custom-dropdown">
            <button type="button" class="custom-dropdown-btn" :class="{ active: summaryFilterAccount !== '' }" @click.stop="toggleSumAccDrop">
              <span>{{ sumAccountLabel }}</span>
              <svg class="custom-dropdown-chevron" :class="{ open: sumAccDropOpen }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <Transition name="panel">
              <div v-show="sumAccDropOpen" class="custom-dropdown-panel" @click.stop>
                <button type="button" class="custom-dropdown-item" :class="{ selected: summaryFilterAccount === '' }" @click="pickSumAccount('')">Todas as contas</button>
                <button v-for="a in accountsStore.accounts" :key="a.id" type="button" class="custom-dropdown-item" :class="{ selected: summaryFilterAccount === a.id }" @click="pickSumAccount(a.id)">{{ a.name }}</button>
              </div>
            </Transition>
          </div>
          <div class="summary-search">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>
            <input v-model="summarySearch" type="text" placeholder="Pesquisar movimentos..." class="summary-search-input" />
          </div>
        </div>

        <!-- Summary content with loading overlay -->
        <div class="summary-content-area">
          <transition name="fade">
            <div v-if="summaryLoading" class="summary-loading-overlay">
              <div class="spinner"></div>
              <p>A carregar...</p>
            </div>
          </transition>

        <!-- Summary cards -->
        <div v-show="!summaryLoading" class="summary-totals">
          <div class="summary-total-card">
            <span class="summary-total-label">Saldo</span>
            <span class="summary-total-value" :class="summaryBalance >= 0 ? 'positive' : 'negative'">
              {{ summaryBalance >= 0 ? '+' : '' }}{{ formatCurrencySummary(summaryBalance) }}
            </span>
          </div>
          <div class="summary-total-card">
            <span class="summary-total-label">Receitas</span>
            <span class="summary-total-value positive">+{{ formatCurrencySummary(summaryTotalIncome) }}</span>
          </div>
          <div class="summary-total-card">
            <span class="summary-total-label">Despesas</span>
            <span class="summary-total-value negative">-{{ formatCurrencySummary(summaryTotalExpenses) }}</span>
          </div>
        </div>

        <!-- Category breakdown chart -->
        <div v-if="!summaryLoading && summaryFiltered.length > 0 && (summaryIncomeByCategory.length > 0 || summaryExpensesByCategory.length > 0)" class="sankey-section">
          <div class="sankey-card">
            <div class="sankey-container" :style="{ height: sankeyHeight + 'px' }">
              <!-- Left: Income labels -->
              <div class="sankey-col sankey-col-left">
                <div
                  v-for="(node, i) in sankeyIncomeNodes"
                  :key="'il'+i"
                  class="sankey-node"
                  :style="{ height: node.height + 'px', top: node.y + 'px' }"
                >
                  <span class="sankey-node-label sankey-node-label-left">
                    <span class="sankey-node-name">{{ node.name }}</span>
                    <span class="sankey-node-amount">{{ formatCurrencySummary(node.total) }}</span>
                  </span>
                  <div class="sankey-node-bar" :style="{ background: node.color }"></div>
                </div>
              </div>

              <!-- SVG paths: Income → Center -->
              <svg class="sankey-svg" :viewBox="`0 0 ${sankeyWidth} ${sankeyHeight}`" preserveAspectRatio="none">
                <path
                  v-for="(link, i) in sankeyIncomeLinks"
                  :key="'li'+i"
                  :d="link.path"
                  :fill="link.color"
                  opacity="1"
                />
              </svg>

              <!-- Center: Total block -->
              <div class="sankey-col sankey-col-center">
                <div class="sankey-center-node" :style="{ height: sankeyCenterHeight + 'px' }">
                  <div class="sankey-center-bar"></div>
                  <span class="sankey-center-label">
                    <span class="sankey-center-amount">{{ formatCurrencySummary(summaryTotalIncome) }}</span>
                    <span class="sankey-center-sub">Total receitas</span>
                  </span>
                </div>
              </div>

              <!-- SVG paths: Center → Expenses -->
              <svg class="sankey-svg" :viewBox="`0 0 ${sankeyWidth} ${sankeyHeight}`" preserveAspectRatio="none">
                <path
                  v-for="(link, i) in sankeyExpenseLinksRight"
                  :key="'re'+i"
                  :d="link.path"
                  :fill="link.color"
                  opacity="1"
                />
              </svg>

              <!-- Right: Expense labels -->
              <div class="sankey-col sankey-col-right">
                <div
                  v-for="(node, i) in sankeyExpenseNodes"
                  :key="'er'+i"
                  class="sankey-node"
                  :style="{ height: node.height + 'px', top: node.y + 'px' }"
                >
                  <div class="sankey-node-bar" :style="{ background: node.color }"></div>
                  <span class="sankey-node-label sankey-node-label-right">
                    <span class="sankey-node-name">{{ node.name }}</span>
                    <span class="sankey-node-amount">{{ formatCurrencySummary(node.total) }}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Transactions table -->
        <div v-if="!summaryLoading && summaryFiltered.length > 0" class="summary-table-wrap">
          <table class="summary-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Conta</th>
                <th class="text-center">Valor</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="tx in summaryPaginated" :key="tx.id">
                <td class="summary-td-date">{{ new Date(tx.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }) }}</td>
                <td class="summary-td-desc">{{ tx.description || TRANSACTION_CATEGORY_LABELS[tx.category] || '—' }}</td>
                <td>
                  <span class="summary-cat-badge" :style="{ background: (categoryColors[tx.category] || '#94a3b8') + '18', color: categoryColors[tx.category] || '#94a3b8' }">
                    {{ TRANSACTION_CATEGORY_LABELS[tx.category] || 'Outro' }}
                  </span>
                </td>
                <td class="summary-td-account">{{ accountName(tx.accountId) }}</td>
                <td class="text-center">
                  <span :class="tx.type === TransactionType.Income ? 'val-income' : 'val-expense'">
                    {{ tx.type === TransactionType.Income ? '+' : '-' }}{{ formatCurrencySummary(tx.amount) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="summaryTotalPages > 1" class="pagination">
            <button type="button" class="pg-arrow" :disabled="!canPrevSummaryPage" @click="prevSummaryPage" aria-label="Anterior">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <template v-for="(p, i) in visibleSummaryPages" :key="i">
              <span v-if="p === '...'" class="pg-dots">...</span>
              <button v-else type="button" class="pg-num" :class="{ active: p === summaryPage }" @click="goToSummaryPage(p)">{{ p }}</button>
            </template>
            <button type="button" class="pg-arrow" :disabled="!canNextSummaryPage" @click="nextSummaryPage" aria-label="Seguinte">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
        </div>
        <div v-else-if="!summaryLoading" class="section-empty">
          <p>Nenhum movimento encontrado para o período selecionado.</p>
        </div>
        </div><!-- /summary-content-area -->
      </div>

      <!-- ═══ TRANSACTIONS TAB ═══ -->
      <div v-show="activeTab === 'movements'" class="tab-content">
      <div v-if="needsPrimarySelection" class="primary-inline-hint">
        <router-link :to="{ name: 'contas' }" class="primary-inline-link">Escolhe a conta principal em Contas</router-link>
        <span> para poderes adicionar ou editar transações no plano Free com várias contas.</span>
      </div>
      <div class="toolbar" style="align-items:flex-start">
        <div class="tx-totals">
          <span class="tx-totals-balance">{{ formatCurrencySummary(txBalance) }}</span>
          <div class="tx-totals-detail">
            <span class="tx-totals-income">Receitas <strong>{{ formatCurrencySummary(txTotalIncome) }}</strong></span>
            <span class="tx-totals-sep">&middot;</span>
            <span class="tx-totals-expense">Despesas <strong>{{ formatCurrencySummary(txTotalExpenses) }}</strong></span>
          </div>
        </div>
        <button type="button" class="btn-add" @click="openCreateModal">
          + Adicionar
        </button>
      </div>

      <div class="tx-filters-row">
        <div class="filters">
        <div ref="txDatePickerRef" class="date-range-picker">
          <button type="button" class="date-range-btn" @click.stop="toggleTxDatePicker">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
            <span>{{ txDatePickerLabel }}</span>
            <svg class="date-range-chevron" :class="{ open: txDatePickerOpen }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <Transition name="panel">
            <div v-show="txDatePickerOpen" class="date-range-panel" @click.stop>
              <div class="dr-presets">
                <button type="button" class="dr-preset-btn" :class="{ active: txActivePreset === 'month' }" @click="txApplyPreset('month')">Este mês</button>
                <button type="button" class="dr-preset-btn" :class="{ active: txActivePreset === '30d' }" @click="txApplyPreset('30d')">30 dias</button>
                <button type="button" class="dr-preset-btn" :class="{ active: txActivePreset === '3m' }" @click="txApplyPreset('3m')">3 meses</button>
                <button type="button" class="dr-preset-btn" :class="{ active: txActivePreset === 'year' }" @click="txApplyPreset('year')">Este ano</button>
              </div>
              <div class="date-range-calendars">
                <div class="dr-calendar">
                  <div class="dr-cal-header">
                    <button type="button" class="dr-cal-nav" @click="txPickerPrevMonth">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    </button>
                    <span class="dr-cal-title">{{ PICKER_MONTH_NAMES[txPickerLeftMonth] }} {{ txPickerLeftYear }}</span>
                    <span style="width:28px"></span>
                  </div>
                  <div class="dr-cal-weekdays">
                    <span v-for="wd in PICKER_WEEKDAYS" :key="wd">{{ wd }}</span>
                  </div>
                  <div class="dr-cal-grid">
                    <button
                      v-for="(d, i) in txLeftDays"
                      :key="'tl'+i"
                      type="button"
                      class="dr-day"
                      :class="{
                        empty: d === null,
                        'in-range': d !== null && txIsInRange(txPickerLeftYear, txPickerLeftMonth, d),
                        'is-start': d !== null && txIsStart(txPickerLeftYear, txPickerLeftMonth, d),
                        'is-end': d !== null && txIsEnd(txPickerLeftYear, txPickerLeftMonth, d),
                      }"
                      :disabled="d === null"
                      @click="d !== null && txPickDay(txPickerLeftYear, txPickerLeftMonth, d)"
                    >
                      {{ d ?? '' }}
                    </button>
                  </div>
                </div>
                <div class="dr-calendar">
                  <div class="dr-cal-header">
                    <span style="width:28px"></span>
                    <span class="dr-cal-title">{{ PICKER_MONTH_NAMES[txPickerRightMonth] }} {{ txPickerRightYear }}</span>
                    <button type="button" class="dr-cal-nav" @click="txPickerNextMonth">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </button>
                  </div>
                  <div class="dr-cal-weekdays">
                    <span v-for="wd in PICKER_WEEKDAYS" :key="wd">{{ wd }}</span>
                  </div>
                  <div class="dr-cal-grid">
                    <button
                      v-for="(d, i) in txRightDays"
                      :key="'tr'+i"
                      type="button"
                      class="dr-day"
                      :class="{
                        empty: d === null,
                        'in-range': d !== null && txIsInRange(txPickerRightYear, txPickerRightMonth, d),
                        'is-start': d !== null && txIsStart(txPickerRightYear, txPickerRightMonth, d),
                        'is-end': d !== null && txIsEnd(txPickerRightYear, txPickerRightMonth, d),
                      }"
                      :disabled="d === null"
                      @click="d !== null && txPickDay(txPickerRightYear, txPickerRightMonth, d)"
                    >
                      {{ d ?? '' }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Transition>
        </div>
        <div ref="catDropRef" class="custom-dropdown">
          <button type="button" class="custom-dropdown-btn" :class="{ active: filterCategory !== '' }" @click.stop="toggleCatDrop">
            <span>{{ categoryLabel }}</span>
            <svg class="custom-dropdown-chevron" :class="{ open: catDropOpen }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <Transition name="panel">
            <div v-show="catDropOpen" class="custom-dropdown-panel" @click.stop>
              <button type="button" class="custom-dropdown-item" :class="{ selected: filterCategory === '' }" @click="pickCategory('')">Todas as categorias</button>
              <button v-for="(label, key) in availableCategories" :key="key" type="button" class="custom-dropdown-item" :class="{ selected: filterCategory === String(key) }" @click="pickCategory(String(key))">{{ label }}</button>
            </div>
          </Transition>
        </div>
        <div ref="accDropRef" class="custom-dropdown">
          <button type="button" class="custom-dropdown-btn" :class="{ active: filterAccountId !== '' }" @click.stop="toggleAccDrop">
            <span>{{ accountLabel }}</span>
            <svg class="custom-dropdown-chevron" :class="{ open: accDropOpen }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <Transition name="panel">
            <div v-show="accDropOpen" class="custom-dropdown-panel" @click.stop>
              <button type="button" class="custom-dropdown-item" :class="{ selected: filterAccountId === '' }" @click="pickAccount('')">Todas as contas</button>
              <button v-for="a in accountsStore.accounts" :key="a.id" type="button" class="custom-dropdown-item" :class="{ selected: filterAccountId === a.id }" @click="pickAccount(a.id)">{{ a.name }}</button>
            </div>
          </Transition>
        </div>
        </div>
        <div class="type-toggle-bar">
          <button type="button" class="type-toggle-btn" :class="{ active: filterType === '' }" @click="pickType('')">Todos</button>
          <button type="button" class="type-toggle-btn" :class="{ active: filterType === 'income', 'type-income': filterType === 'income' }" @click="pickType('income')">Receitas</button>
          <button type="button" class="type-toggle-btn" :class="{ active: filterType === 'expense', 'type-expense': filterType === 'expense' }" @click="pickType('expense')">Despesas</button>
          <button type="button" class="type-toggle-btn" :class="{ active: filterType === 'transfer', 'type-transfer': filterType === 'transfer' }" @click="pickType('transfer')">Transferências</button>
        </div>
      </div>

      <div v-if="transactionsStore.loading && transactionsStore.transactions.length === 0" class="loading-state">
        <div class="spinner"></div>
        <p>A carregar transações...</p>
      </div>

      <div v-else-if="transactionsStore.transactions.length === 0" class="empty-state">
        <p>Nenhuma transação ainda. Cria a tua primeira transação.</p>
        <button type="button" class="btn-add" @click="openCreateModal">
          + Nova transação
        </button>
      </div>

      <div v-else-if="filteredTransactions.length === 0" class="empty-state">
        <p>Nenhuma transação encontrada com os filtros selecionados.</p>
      </div>

      <div v-else class="table-container">
        <table class="transactions-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Categoria</th>
              <th>Tipo</th>
              <th class="amount-col">Valor</th>
              <th>Responsável</th>
              <th v-if="householdStore.isCouple">Repartição</th>
              <th class="actions-col"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="tx in paginatedTransactions"
              :key="tx.id"
              class="table-row"
            >
              <td>{{ formatDate(tx.date) }}</td>
              <td>
                {{ TRANSACTION_CATEGORY_LABELS[tx.category] }}
                <span v-if="tx.type === TransactionType.Transfer" class="transfer-accounts-hint">
                  {{ getAccountName(tx.accountId) }} → {{ getAccountName(tx.destinationAccountId ?? '') }}
                </span>
              </td>
              <td>
                <span :class="['type-badge', tx.type === TransactionType.Income ? 'type-income' : tx.type === TransactionType.Transfer ? 'type-transfer' : 'type-expense']">
                  {{ TRANSACTION_TYPE_LABELS[tx.type] }}
                </span>
              </td>
              <td class="amount-col" :class="{ 'amount-income': tx.type === TransactionType.Income, 'amount-expense': tx.type === TransactionType.Expense, 'amount-transfer': tx.type === TransactionType.Transfer }">
                {{ formatAmount(tx.amount, tx.type) }}
              </td>
              <td>{{ getResponsibleDisplay(tx) }}</td>
              <td v-if="householdStore.isCouple">{{ getSplitsDisplay(tx) }}</td>
                <td class="actions-col">
                <button
                  type="button"
                  class="btn-icon"
                  :disabled="isTxAccountLocked(tx)"
                  @click="openEditModal(tx)"
                >
                  Editar
                </button>
                <button type="button" class="btn-icon btn-delete" @click="openDeleteModal(tx)">
                  Eliminar
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="totalPages > 1" class="pagination">
          <button type="button" class="pg-arrow" :disabled="!canPrevPage" @click="prevPage" aria-label="Anterior">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <template v-for="(p, i) in visiblePages" :key="i">
            <span v-if="p === '...'" class="pg-dots">...</span>
            <button v-else type="button" class="pg-num" :class="{ active: p === page }" @click="goToPage(p)">{{ p }}</button>
          </template>
          <button type="button" class="pg-arrow" :disabled="!canNextPage" @click="nextPage" aria-label="Seguinte">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
      </div>
      </div>

      <div v-show="activeTab === 'recurring'" class="tab-content">
        <div v-if="needsPrimarySelection" class="primary-inline-hint">
          <router-link :to="{ name: 'contas' }" class="primary-inline-link">Escolhe a conta principal em Contas</router-link>
          <span> para gerires recorrentes no plano Free com várias contas.</span>
        </div>
        <div class="toolbar" style="align-items:flex-start">
          <div class="tx-totals">
            <span class="tx-totals-balance">{{ formatCurrencySummary(recBalance) }}</span>
            <div class="tx-totals-detail">
              <span class="tx-totals-income">Receitas <strong>{{ formatCurrencySummary(recTotalIncome) }}</strong></span>
              <span class="tx-totals-sep">&middot;</span>
              <span class="tx-totals-expense">Despesas <strong>{{ formatCurrencySummary(recTotalExpenses) }}</strong></span>
            </div>
          </div>
          <button type="button" class="btn-add" @click="openRecurringCreateModal">
            + Adicionar
          </button>
        </div>

        <div class="tx-filters-row">
          <div class="filters">
            <div ref="recDatePickerRef" class="date-range-picker">
              <button type="button" class="date-range-btn" @click.stop="toggleRecDatePicker">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                <span>{{ recDatePickerLabel }}</span>
                <svg class="date-range-chevron" :class="{ open: recDatePickerOpen }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              <Transition name="panel">
                <div v-show="recDatePickerOpen" class="date-range-panel" @click.stop>
                  <div class="dr-presets">
                    <button type="button" class="dr-preset-btn" :class="{ active: recActivePreset === 'month' }" @click="recApplyPreset('month')">Este mês</button>
                    <button type="button" class="dr-preset-btn" :class="{ active: recActivePreset === '30d' }" @click="recApplyPreset('30d')">30 dias</button>
                    <button type="button" class="dr-preset-btn" :class="{ active: recActivePreset === '3m' }" @click="recApplyPreset('3m')">3 meses</button>
                    <button type="button" class="dr-preset-btn" :class="{ active: recActivePreset === 'year' }" @click="recApplyPreset('year')">Este ano</button>
                  </div>
                  <div class="date-range-calendars">
                    <div class="dr-calendar">
                      <div class="dr-cal-header">
                        <button type="button" class="dr-cal-nav" @click="recPickerPrevMonth">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        </button>
                        <span class="dr-cal-title">{{ PICKER_MONTH_NAMES[recPickerLeftMonth] }} {{ recPickerLeftYear }}</span>
                        <span style="width:28px"></span>
                      </div>
                      <div class="dr-cal-weekdays">
                        <span v-for="wd in PICKER_WEEKDAYS" :key="wd">{{ wd }}</span>
                      </div>
                      <div class="dr-cal-grid">
                        <button
                          v-for="(d, i) in recLeftDays"
                          :key="'rl'+i"
                          type="button"
                          class="dr-day"
                          :class="{
                            empty: d === null,
                            'in-range': d !== null && recIsInRange(recPickerLeftYear, recPickerLeftMonth, d),
                            'is-start': d !== null && recIsStart(recPickerLeftYear, recPickerLeftMonth, d),
                            'is-end': d !== null && recIsEnd(recPickerLeftYear, recPickerLeftMonth, d),
                          }"
                          :disabled="d === null"
                          @click="d !== null && recPickDay(recPickerLeftYear, recPickerLeftMonth, d)"
                        >
                          {{ d ?? '' }}
                        </button>
                      </div>
                    </div>
                    <div class="dr-calendar">
                      <div class="dr-cal-header">
                        <span style="width:28px"></span>
                        <span class="dr-cal-title">{{ PICKER_MONTH_NAMES[recPickerRightMonth] }} {{ recPickerRightYear }}</span>
                        <button type="button" class="dr-cal-nav" @click="recPickerNextMonth">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                        </button>
                      </div>
                      <div class="dr-cal-weekdays">
                        <span v-for="wd in PICKER_WEEKDAYS" :key="wd">{{ wd }}</span>
                      </div>
                      <div class="dr-cal-grid">
                        <button
                          v-for="(d, i) in recRightDays"
                          :key="'rr'+i"
                          type="button"
                          class="dr-day"
                          :class="{
                            empty: d === null,
                            'in-range': d !== null && recIsInRange(recPickerRightYear, recPickerRightMonth, d),
                            'is-start': d !== null && recIsStart(recPickerRightYear, recPickerRightMonth, d),
                            'is-end': d !== null && recIsEnd(recPickerRightYear, recPickerRightMonth, d),
                          }"
                          :disabled="d === null"
                          @click="d !== null && recPickDay(recPickerRightYear, recPickerRightMonth, d)"
                        >
                          {{ d ?? '' }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>
            <div ref="recCatDropRef" class="custom-dropdown">
              <button type="button" class="custom-dropdown-btn" :class="{ active: recFilterCategory !== '' }" @click.stop="toggleRecCatDrop">
                <span>{{ recCategoryLabel }}</span>
                <svg class="custom-dropdown-chevron" :class="{ open: recCatDropOpen }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              <Transition name="panel">
                <div v-show="recCatDropOpen" class="custom-dropdown-panel" @click.stop>
                  <button type="button" class="custom-dropdown-item" :class="{ selected: recFilterCategory === '' }" @click="pickRecCategory('')">Todas as categorias</button>
                  <button v-for="(label, key) in recAvailableCategories" :key="key" type="button" class="custom-dropdown-item" :class="{ selected: recFilterCategory === String(key) }" @click="pickRecCategory(String(key))">{{ label }}</button>
                </div>
              </Transition>
            </div>
            <div ref="recAccDropRef" class="custom-dropdown">
              <button type="button" class="custom-dropdown-btn" :class="{ active: recFilterAccount !== '' }" @click.stop="toggleRecAccDrop">
                <span>{{ recAccountLabel }}</span>
                <svg class="custom-dropdown-chevron" :class="{ open: recAccDropOpen }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              <Transition name="panel">
                <div v-show="recAccDropOpen" class="custom-dropdown-panel" @click.stop>
                  <button type="button" class="custom-dropdown-item" :class="{ selected: recFilterAccount === '' }" @click="pickRecAccount('')">Todas as contas</button>
                  <button v-for="a in accountsStore.accounts" :key="a.id" type="button" class="custom-dropdown-item" :class="{ selected: recFilterAccount === a.id }" @click="pickRecAccount(a.id)">{{ a.name }}</button>
                </div>
              </Transition>
            </div>
          </div>
          <div class="type-toggle-bar">
            <button type="button" class="type-toggle-btn" :class="{ active: recFilterType === '' }" @click="pickRecTypeToggle('')">Todos</button>
            <button type="button" class="type-toggle-btn" :class="{ active: recFilterType === 'income', 'type-income': recFilterType === 'income' }" @click="pickRecTypeToggle('income')">Receitas</button>
            <button type="button" class="type-toggle-btn" :class="{ active: recFilterType === 'expense', 'type-expense': recFilterType === 'expense' }" @click="pickRecTypeToggle('expense')">Despesas</button>
            <button type="button" class="type-toggle-btn" :class="{ active: recFilterType === 'transfer', 'type-transfer': recFilterType === 'transfer' }" @click="pickRecTypeToggle('transfer')">Transferências</button>
          </div>
        </div>
        <div v-if="recurringStore.loading && activeRecurring.length === 0" class="loading-state">
          <div class="spinner"></div>
          <p>A carregar contas recorrentes...</p>
        </div>
        <div v-else-if="activeRecurring.length === 0" class="empty-state">
          <p>Nenhuma conta recorrente. Adiciona uma receita ou despesa mensal.</p>
          <button type="button" class="btn-add" @click="openRecurringCreateModal">
            + Nova transação recorrente
          </button>
        </div>
        <div v-else-if="filteredRecurring.length === 0" class="empty-state">
          <p>Nenhuma recorrente encontrada com os filtros selecionados.</p>
        </div>
        <div v-else class="table-container">
          <table class="transactions-table">
            <thead>
              <tr>
                <th>Conta</th>
                <th>Categoria</th>
                <th>Tipo</th>
                <th class="amount-col">Valor</th>
                <th>Frequência</th>
                <th>Início</th>
                <th class="actions-col"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in paginatedRecurring"
                :key="r.id"
                class="table-row"
              >
                <td>
                  {{ getAccountName(r.accountId) }}
                  <span v-if="r.type === TransactionType.Transfer" class="transfer-accounts-hint">
                    → {{ getAccountName(r.destinationAccountId ?? '') }}
                  </span>
                </td>
                <td>{{ TRANSACTION_CATEGORY_LABELS[r.category] }}</td>
                <td>
                  <span :class="['type-badge', r.type === TransactionType.Income ? 'type-income' : r.type === TransactionType.Transfer ? 'type-transfer' : 'type-expense']">
                    {{ TRANSACTION_TYPE_LABELS[r.type] }}
                  </span>
                </td>
                <td class="amount-col" :class="{ 'amount-income': r.type === TransactionType.Income, 'amount-expense': r.type === TransactionType.Expense, 'amount-transfer': r.type === TransactionType.Transfer }">
                  {{ formatAmount(r.amount, r.type) }}
                </td>
                <td>{{ RECURRING_FREQUENCY_LABELS[r.frequency as RecurringFrequency] }}</td>
                <td>{{ MONTH_NAMES[r.startMonth] }} {{ r.startYear }}</td>
                <td class="actions-col">
                  <button
                    type="button"
                    class="btn-icon"
                    :disabled="isRecurringAccountLocked(r)"
                    @click="openRecurringEditModal(r)"
                  >
                    Editar
                  </button>
                  <button type="button" class="btn-icon btn-delete" @click="openRecurringRemoveModal(r)">
                    Retirar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-if="recTotalPages > 1" class="pagination">
            <button type="button" class="pg-arrow" :disabled="!canPrevRecPage" @click="prevRecPage" aria-label="Anterior">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <template v-for="(p, i) in visibleRecPages" :key="i">
              <span v-if="p === '...'" class="pg-dots">...</span>
              <button v-else type="button" class="pg-num" :class="{ active: p === recPage }" @click="goToRecPage(p)">{{ p }}</button>
            </template>
            <button type="button" class="pg-arrow" :disabled="!canNextRecPage" @click="nextRecPage" aria-label="Seguinte">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <TransactionTypeSelectionModal
      :open="typeSelectionModalOpen"
      @close="typeSelectionModalOpen = false"
      @select="handleTypeSelection"
    />

    <TransactionTypeSelectionModal
      :open="recTypeSelectionModalOpen"
      @close="recTypeSelectionModalOpen = false"
      @select="handleRecTypeSelection"
    />

    <TransactionFormModal
      :open="createModalOpen"
      :accounts="accountsForCreateModal"
      :members="members"
      :is-couple="householdStore.isCouple"
      :current-user-id="authStore.user?.id ?? ''"
      :loading="actionLoading"
      :default-date-for-new="defaultDateForNewTransaction"
      :is-transfer="isTransferMode"
      @close="closeCreateModal"
      @submit="handleCreate"
    />

    <TransactionFormModal
      :open="editModalOpen"
      :transaction="transactionToEdit"
      :accounts="accountsForEditModal"
      :members="members"
      :is-couple="householdStore.isCouple"
      :current-user-id="authStore.user?.id ?? ''"
      :loading="actionLoading"
      :is-transfer="isTransferMode"
      @close="closeEditModal"
      @submit="handleEdit"
    />

    <ConfirmDeleteModal
      :open="deleteModalOpen"
      title="Eliminar transação"
      :message="transactionToDelete
        ? `Tem a certeza que deseja eliminar esta transação de ${formatAmount(transactionToDelete.amount, transactionToDelete.type)}?`
        : ''"
      :loading="actionLoading"
      @close="closeDeleteModal"
      @confirm="handleDelete"
    />

    <RecurringFormModal
      :open="recurringCreateModalOpen"
      :accounts="accountsForRecurringCreate"
      :loading="actionLoading"
      :is-transfer="isRecTransferMode"
      @close="closeRecurringCreateModal"
      @submit="handleRecurringCreate"
    />

    <RecurringFormModal
      :open="recurringEditModalOpen"
      :recurring="recurringToEdit"
      :accounts="accountsForRecurringEdit"
      :loading="actionLoading"
      :is-transfer="isRecTransferMode"
      @close="closeRecurringEditModal"
      @submit="handleRecurringEdit"
    />

    <RemoveRecurringModal
      :open="recurringRemoveModalOpen"
      :recurring="recurringToRemove"
      :loading="actionLoading"
      @close="closeRecurringRemoveModal"
      @remove-from-current-month="handleRecurringRemoveFromCurrentMonth"
      @remove-from-next-month="handleRecurringRemoveFromNextMonth"
    />

    <BaseModal
      v-if="limitModalOpen"
      :title="limitModalKind === 'primary' ? 'Conta principal' : 'Limite do plano Free'"
      @close="dismissLimitModal"
    >
      <div class="locked-modal-body">
        <p>{{ limitMessage }}</p>
        <div class="locked-modal-actions">
          <button type="button" class="btn-secondary" @click="dismissLimitModal">Agora não</button>
          <router-link
            v-if="limitModalKind === 'primary'"
            :to="{ name: 'contas' }"
            class="locked-modal-cta"
            @click="dismissLimitModal"
          >
            Ir para Contas
          </router-link>
          <router-link
            v-else
            :to="{ name: 'subscricao' }"
            class="locked-modal-cta"
            @click="dismissLimitModal"
          >
            Ver planos
          </router-link>
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<style scoped>
.transactions-view {
  max-width: min(960px, 100%);
  margin: 0 auto;
  padding: 0 0 2.5rem;
}

.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--color-text-muted);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border);
  border-top-color: #166534;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.summary-content-area {
  position: relative;
  min-height: 200px;
}

.summary-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--color-text-muted);
  padding-top: 4rem;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.error-state p {
  color: var(--color-error);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.link {
  color: var(--color-link-hover);
  border-bottom: 1px solid transparent;
}

.link:hover {
  border-bottom-color: var(--color-link-hover);
}

.tabs {
  display: inline-flex;
  gap: 0.25rem;
  margin-bottom: 1.5rem;
  padding: 0.25rem;
  background: var(--color-table-row-hover);
  border-radius: 10px;
  border: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

.tab {
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-muted);
  background: transparent;
  border: none;
  border-bottom: none;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 0;
  transition: background 0.15s, color 0.15s, box-shadow 0.15s;
}

.tab:hover {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.5);
}

html.dark .tab:hover {
  background: rgba(255, 255, 255, 0.05);
}

.tab.active {
  color: var(--app-brand-tab, #166534);
  background: var(--color-bg-card);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  border-bottom-color: transparent;
}

html.dark .tab.active {
  color: #4ade80;
  border-bottom-color: transparent;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.tab-content {
  margin-top: 0;
}

.recurring-hint {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0 0 1.25rem;
}

.global-error {
  padding: 0.75rem 1rem;
  background: #fef2f2;
  color: #dc2626;
  border-radius: 8px;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.primary-inline-hint {
  margin-bottom: 1rem;
  padding: 0.65rem 1rem;
  font-size: 0.875rem;
  line-height: 1.45;
  color: #78350f;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
}

.primary-inline-link {
  color: #1d4ed8;
  font-weight: 600;
  text-decoration: underline;
}

/* Custom dropdowns */
.custom-dropdown {
  position: relative;
}

.custom-dropdown-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4375rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 0.8125rem;
  font-family: inherit;
  font-weight: 500;
  background: var(--color-input-bg);
  color: var(--color-text);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  white-space: nowrap;
}

.custom-dropdown-btn:hover {
  border-color: var(--color-text-muted);
}

.custom-dropdown-btn.active {
  border-color: var(--color-text-muted);
  color: var(--color-text);
}

.custom-dropdown-chevron {
  flex-shrink: 0;
  color: var(--color-text-muted);
  transition: transform 0.2s ease;
}

.custom-dropdown-chevron.open {
  transform: rotate(180deg);
}

.custom-dropdown-panel {
  position: absolute;
  top: calc(100% + 0.375rem);
  left: 0;
  z-index: 50;
  min-width: 100%;
  max-height: 260px;
  overflow-y: auto;
  padding: 0.375rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg-card);
  box-shadow: 0 8px 24px -4px rgba(15, 23, 42, 0.12);
}

.custom-dropdown-item {
  display: block;
  width: 100%;
  padding: 0.4375rem 0.625rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  font-size: 0.8125rem;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s;
  white-space: nowrap;
}

.custom-dropdown-item:hover {
  background: var(--color-table-row-hover);
}

.custom-dropdown-item.selected {
  background: rgba(22, 101, 52, 0.1);
  color: #166534;
  font-weight: 600;
}

html.dark .custom-dropdown-item.selected {
  background: rgba(74, 222, 128, 0.12);
  color: #4ade80;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: -0.5rem;
  margin-bottom: 2rem;
}

.tx-filters-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 2.5rem;
  margin-bottom: 2rem;
}

.tx-totals {
}

.tx-totals-balance {
  display: block;
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.02em;
  line-height: 1;
}

.tx-totals-detail {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.tx-totals-income,
.tx-totals-expense {
  color: var(--color-text-muted);
}

.tx-totals-sep {
  color: var(--color-text-muted);
}

.type-toggle-bar {
  display: inline-flex;
  background: var(--color-table-row-hover);
  border-radius: 10px;
  padding: 3px;
  gap: 2px;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
}

.type-toggle-btn {
  padding: 0.375rem 1rem;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.type-toggle-btn.active {
  background: var(--color-bg-card);
  color: var(--color-text);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.type-toggle-btn.active.type-income {
  color: var(--color-type-income-text);
}

.type-toggle-btn.active.type-expense {
  color: var(--color-type-expense-text);
}

.type-toggle-btn.active.type-transfer {
  color: #2563eb;
}

html.dark .type-toggle-btn.active.type-transfer {
  color: #60a5fa;
}

.type-toggle-btn:not(.active):hover {
  color: var(--color-text);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem 1rem;
}

.filter-select,
.filter-input {
  padding: 0.4375rem 2rem 0.4375rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 0.8125rem;
  font-family: inherit;
  background: var(--color-input-bg);
  color: var(--color-text);
  transition: border-color 0.15s;
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.5rem center;
  cursor: pointer;
}

.filter-select:focus,
.filter-input:focus {
  border-color: #166534;
  outline: none;
}

.btn-add {
  padding: 0.5rem 1.125rem;
  background: linear-gradient(135deg, #166534 0%, #15803d 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 1px 3px rgba(22, 101, 52, 0.2);
}

.btn-add:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(22, 101, 52, 0.25);
}

.table-container {
  background: var(--color-bg-card);
  border-radius: 14px;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.transactions-table {
  width: 100%;
  border-collapse: collapse;
}

.transactions-table th {
  text-align: left;
  padding: 0.875rem 1.125rem;
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  background: var(--color-table-header-bg);
  border-bottom: 2px solid var(--color-border);
}

.transactions-table td {
  padding: 0.875rem 1.125rem;
  font-size: 0.875rem;
  color: var(--color-text);
  border-bottom: 1px solid var(--color-border);
}

.transactions-table tbody tr:last-child td {
  border-bottom: none;
}

.table-row {
  transition: background var(--transition-fast, 150ms);
}

.table-row:hover {
  background: var(--color-table-row-hover);
}

.amount-col {
  font-weight: 600;
  white-space: nowrap;
}

.amount-income {
  color: var(--color-income);
}

.amount-expense {
  color: var(--color-expense);
}

.actions-col {
  width: 1%;
  white-space: nowrap;
}

.type-badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.2rem 0.625rem;
  border-radius: 999px;
  letter-spacing: 0.02em;
}

.type-income {
  background: var(--color-type-income-bg);
  color: var(--color-type-income-text);
}

.type-expense {
  background: var(--color-type-expense-bg);
  color: var(--color-type-expense-text);
}

.type-transfer {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
}

html.dark .type-transfer {
  background: rgba(96, 165, 250, 0.15);
  color: #60a5fa;
}

.amount-transfer {
  color: #2563eb;
  font-weight: 600;
}


html.dark .amount-transfer {
  color: #60a5fa;
}

.transfer-accounts-hint {
  display: block;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-top: 0.125rem;
}

.btn-icon {
  padding: 0.3rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-muted);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  margin-right: 0.25rem;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.btn-icon:hover {
  background: var(--color-table-row-hover);
  color: var(--color-text);
}

.btn-icon:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-delete:hover {
  color: #dc2626;
  border-color: #fecaca;
  background: #fef2f2;
}

.locked-modal-body p {
  margin: 0;
  color: var(--color-text-muted);
  line-height: 1.45;
}

.locked-modal-actions {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.locked-modal-actions .btn-secondary,
.locked-modal-actions .locked-modal-cta {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.5rem 0.85rem;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.locked-modal-actions .btn-secondary {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text);
}

.locked-modal-actions .locked-modal-cta {
  background: #166534;
  color: #fff;
}

.locked-modal-actions .locked-modal-cta:hover {
  background: #15803d;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.875rem 1rem;
  border-top: 1px solid var(--color-border);
}

.pg-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s ease, color 0.15s ease;
}

.pg-arrow:hover:not(:disabled) {
  background: var(--color-table-row-hover);
  color: var(--color-text);
}

.pg-arrow:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.pg-num {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 0.375rem;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s ease, color 0.15s ease;
}

.pg-num:hover {
  background: var(--color-table-row-hover);
  color: var(--color-text);
}

.pg-num.active {
  background: #e5e7eb;
  color: #111827;
}

html.dark .pg-num.active {
  background: #374151;
  color: #f3f4f6;
}

.pg-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  user-select: none;
}

.page-info {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-muted);
}

/* ═══ SUMMARY TAB ═══ */
.summary-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.625rem;
  margin-bottom: 1.25rem;
}

.date-range-picker {
  position: relative;
}

.date-range-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.4375rem 0.75rem;
  font-family: inherit;
  font-size: 0.8125rem;
  color: var(--color-text);
  cursor: pointer;
  transition: border-color 0.15s ease;
  white-space: nowrap;
}

.date-range-btn:hover {
  border-color: #166534;
}

.date-range-btn svg:first-child {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.date-range-chevron {
  color: var(--color-text-muted);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.date-range-chevron.open {
  transform: rotate(180deg);
}

.date-range-panel {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  z-index: 60;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 12px 40px -8px rgba(15, 23, 42, 0.18);
  padding: 1rem;
}

.dr-presets {
  display: flex;
  gap: 0.375rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.dr-preset-btn {
  padding: 0.3rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: inherit;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
  white-space: nowrap;
}

.dr-preset-btn:hover {
  border-color: #166534;
  color: #166534;
}

.dr-preset-btn.active {
  border-color: #166534;
  background: rgba(22, 101, 52, 0.1);
  color: #166534;
}

html.dark .dr-preset-btn.active {
  border-color: #4ade80;
  background: rgba(74, 222, 128, 0.12);
  color: #4ade80;
}

html.dark .dr-preset-btn:hover {
  border-color: #4ade80;
  color: #4ade80;
}

.date-range-calendars {
  display: flex;
  gap: 1.25rem;
}

.dr-calendar {
  width: 240px;
}

.dr-cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.dr-cal-title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-text);
  text-align: center;
}

.dr-cal-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s ease, color 0.15s ease;
}

.dr-cal-nav:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--color-text);
}

html.dark .dr-cal-nav:hover {
  background: rgba(255, 255, 255, 0.08);
}

.dr-cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0;
  margin-bottom: 0.25rem;
}

.dr-cal-weekdays span {
  text-align: center;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  padding: 0.25rem 0;
}

.dr-cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
}

.dr-day {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text);
  cursor: pointer;
  border-radius: 0;
  transition: background 0.1s ease;
}

.dr-day.empty {
  cursor: default;
}

.dr-day:not(.empty):hover {
  background: rgba(22, 101, 52, 0.08);
}

.dr-day.in-range {
  background: rgba(22, 101, 52, 0.08);
}

.dr-day.is-start,
.dr-day.is-end {
  background: #166534;
  color: #fff;
  font-weight: 700;
}

.dr-day.is-start {
  border-radius: 6px 0 0 6px;
}

.dr-day.is-end {
  border-radius: 0 6px 6px 0;
}

.dr-day.is-start.is-end {
  border-radius: 6px;
}

html.dark .dr-day.in-range {
  background: rgba(74, 222, 128, 0.1);
}

html.dark .dr-day.is-start,
html.dark .dr-day.is-end {
  background: #4ade80;
  color: #0a0a0a;
}

.summary-select {
  padding: 0.4375rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-card);
  font-family: inherit;
  font-size: 0.8125rem;
  color: var(--color-text);
  cursor: pointer;
  outline: none;
}

.summary-search {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-card);
  padding: 0.375rem 0.625rem;
  color: var(--color-text-muted);
  flex: 1;
  min-width: 160px;
}

.summary-search-input {
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 0.8125rem;
  color: var(--color-text);
  outline: none;
  width: 100%;
}

.summary-search-input::placeholder {
  color: var(--color-text-muted);
}

/* Summary cards */
.summary-totals {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.summary-total-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.summary-total-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-muted);
}

.summary-total-value {
  font-size: 1.375rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.summary-total-value.positive { color: #059669; }
.summary-total-value.negative { color: #dc2626; }
html.dark .summary-total-value.positive { color: #4ade80; }
html.dark .summary-total-value.negative { color: #f87171; }

/* Category breakdown */
/* ═══ Sankey Diagram ═══ */
.sankey-section {
  margin-bottom: 1.5rem;
}

.sankey-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.5rem;
}

.sankey-container {
  display: flex;
  align-items: stretch;
  position: relative;
  gap: 0;
}

.sankey-col {
  position: relative;
  flex-shrink: 0;
}

.sankey-col-left,
.sankey-col-right {
  width: 100px;
}

.sankey-col-center {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  flex-shrink: 0;
}

.sankey-svg {
  flex: 1;
  height: 100%;
  min-width: 60px;
}

.sankey-node {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sankey-col-left .sankey-node {
  justify-content: flex-end;
}

.sankey-col-right .sankey-node {
  justify-content: flex-start;
}

.sankey-node-bar {
  width: 5px;
  height: 100%;
  border-radius: 3px;
  flex-shrink: 0;
}

.sankey-node-label {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  overflow: hidden;
  flex-shrink: 1;
  min-width: 0;
}

.sankey-node-label-left {
  text-align: right;
  align-items: flex-end;
  order: -1;
}

.sankey-node-label-right {
  text-align: left;
  align-items: flex-start;
}

.sankey-node-name {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.2;
}

.sankey-node-amount {
  font-size: 0.625rem;
  font-weight: 500;
  color: var(--color-text-muted);
  white-space: nowrap;
  line-height: 1.2;
}

.sankey-center-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.sankey-center-bar {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 5px;
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(180deg, #059669 0%, #10b981 100%);
}

.sankey-center-label {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--color-bg-card);
  padding: 0.375rem 0.5rem;
  border-radius: 6px;
}

.sankey-center-amount {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-text);
  white-space: nowrap;
}

.sankey-center-sub {
  font-size: 0.5625rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}

/* Table */
.summary-table-wrap {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
}

.summary-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.summary-table thead {
  background: var(--color-bg, #f8fafc);
}

html.dark .summary-table thead {
  background: rgba(255, 255, 255, 0.03);
}

.summary-table th {
  padding: 0.75rem 1rem;
  text-align: left;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
}

.summary-table td {
  padding: 0.625rem 1rem;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
}

.summary-table tr:last-child td {
  border-bottom: none;
}

.summary-table tr:hover td {
  background: var(--color-table-row-hover);
}

.summary-td-date {
  color: var(--color-text-muted);
  white-space: nowrap;
  width: 80px;
}

.summary-td-desc {
  font-weight: 500;
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-td-account {
  color: var(--color-text-muted);
  font-size: 0.75rem;
}

.summary-cat-badge {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  font-size: 0.6875rem;
  font-weight: 600;
  white-space: nowrap;
}

.text-right { text-align: right; }
.text-center { text-align: center; }

.summary-table th.text-center,
.summary-table td.text-center {
  text-align: center;
  width: 130px;
}

.val-income {
  color: #059669;
  font-weight: 600;
}

.val-expense {
  color: #dc2626;
  font-weight: 600;
}

html.dark .val-income { color: #4ade80; }
html.dark .val-expense { color: #f87171; }

.section-empty {
  text-align: center;
  padding: 3rem;
  color: var(--color-text-muted);
}

@media (max-width: 768px) {
  .summary-filters {
    flex-direction: column;
    align-items: stretch;
  }

  .summary-totals {
    grid-template-columns: 1fr;
  }

  .sankey-container {
    height: auto;
    flex-direction: column;
    gap: 1rem;
  }

  .sankey-col-left,
  .sankey-col-right {
    position: static;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .sankey-node {
    position: static;
    height: auto !important;
  }

  .sankey-svg {
    display: none;
  }

  .sankey-col-center {
    width: 100%;
  }

  .summary-table-wrap {
    overflow-x: auto;
  }
}
</style>
