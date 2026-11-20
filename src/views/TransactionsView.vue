<script setup lang="ts">
import PageSkeleton from '@/components/PageSkeleton.vue'
import { PT_GROUPING } from '@/utils/numberFormat'
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useTransactionsStore } from '@/stores/transactions'
import { useRecurringTransactionsStore } from '@/stores/recurringTransactions'
import { useAccountsStore } from '@/stores/accounts'
import { useHouseholdStore } from '@/stores/household'
import { useAuthStore } from '@/stores/auth'
import { useSubscriptionStore } from '@/stores/subscription'
import { useInvestmentsStore } from '@/stores/investments'
import { filterDeposits, depositsForPage, mergeRows } from '@/utils/depositRows'
import { householdApi } from '@/api/household'
import { transactionsApi } from '@/api/transactions'
import TransactionFormModal from '@/components/TransactionFormModal.vue'
import RecurringFormModal from '@/components/RecurringFormModal.vue'
import TransactionTypeSelectionModal from '@/components/TransactionTypeSelectionModal.vue'
import RemoveRecurringModal from '@/components/RemoveRecurringModal.vue'
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue'
import BaseModal from '@/components/BaseModal.vue'
import PlanUpsellCard from '@/components/PlanUpsellCard.vue'
import PlanUpsellModal from '@/components/PlanUpsellModal.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiCard from '@/components/ui/UiCard.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ActionMenu, { type ActionMenuItem } from '@/components/ui/ActionMenu.vue'
import RangePickerPanel from '@/components/transactions/RangePickerPanel.vue'
import FilterDropdown from '@/components/transactions/FilterDropdown.vue'
import TablePagination from '@/components/transactions/TablePagination.vue'
import PeriodSummary from '@/components/transactions/PeriodSummary.vue'
import CategoryCell from '@/components/transactions/CategoryCell.vue'
import TxAvatar from '@/components/transactions/TxAvatar.vue'
import { CHART_SERIES_DARK, CHART_SERIES_LIGHT } from '@/components/charts/chartTheme'
import { useToast } from '@/composables/useToast'
import { useThemeStore } from '@/stores/theme'
import type { Transaction, CreateTransactionRequest } from '@/types/transaction'
import type { RecurringTransaction, CreateRecurringTransactionRequest } from '@/types/recurringTransaction'
import { recurringAmountForMonth, recurringDayInMonth, recurringFrequencyDescription } from '@/types/recurringTransaction'
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_CATEGORY_LABELS,
  TransactionType,
  TransactionCategory
} from '@/types/transaction'
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '@/types/categoryMeta'
import type { HouseholdMember } from '@/types/household'

const transactionsStore = useTransactionsStore()
const recurringStore = useRecurringTransactionsStore()
const accountsStore = useAccountsStore()
const householdStore = useHouseholdStore()
const authStore = useAuthStore()
const subscriptionStore = useSubscriptionStore()
const investmentsStore = useInvestmentsStore()
const themeStore = useThemeStore()
const toast = useToast()
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
    if (activeTab.value === 'recurring') {
      if (!recurringLocked.value) openRecurringCreateModal()
    } else openCreateModal()
    router.replace({ query: { ...routeRef.query, action: undefined } })
  }
})

const PAGE_COPY = {
  dashboard: { title: 'Resumo' },
  movements: { title: 'Movimentos' },
  recurring: { title: 'Recorrentes' },
} as const
const pageCopy = computed(() => PAGE_COPY[activeTab.value])

type TypeFilter = '' | 'income' | 'expense' | 'transfer'
const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'income', label: 'Receitas' },
  { value: 'expense', label: 'Despesas' },
  { value: 'transfer', label: 'Transferências' },
]
const SUMMARY_TYPE_OPTIONS: { value: '' | 'income' | 'expense'; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'income', label: 'Receitas' },
  { value: 'expense', label: 'Despesas' },
]

/** Record categoria→rótulo (filtros) → opções do FilterDropdown. */
function categoryOptions(rec: Record<number, string>): { value: string; label: string }[] {
  return Object.entries(rec).map(([value, label]) => ({ value, label }))
}
const accountOptions = computed(() => accountsStore.accounts.map((a) => ({ value: a.id, label: a.name })))

function goToRecurringTab() {
  void router.push({ query: { ...routeRef.query, tab: 'recurring' } })
}
function goToDeposits() {
  void router.push({ name: 'investimentos', query: { tab: 'deposits' } })
}

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

const incomeCategories = INCOME_CATEGORIES
const expenseCategories = EXPENSE_CATEGORIES

const availableCategories = computed(() => {
  let cats: TransactionCategory[]
  if (filterType.value === 'income') cats = [...incomeCategories]
  else if (filterType.value === 'expense') cats = [...expenseCategories]
  else if (filterType.value === 'transfer') cats = [TransactionCategory.Transfer]
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

/**
 * Último mês (inclusivo) em que a recorrente ainda conta. O fim é **exclusivo**
 * (alinha com o backend: conta se `fim > mês`), por isso o último mês ativo é o anterior ao fim.
 * Sem fim definido → mês atual (recorrente em curso).
 */
function recurringActiveEnd(r: RecurringTransaction): { endY: number; endM: number } {
  if (r.endYear != null && r.endMonth != null) {
    let endY = r.endYear
    let endM = r.endMonth - 1
    if (endM < 1) { endM = 12; endY -= 1 }
    return { endY, endM }
  }
  return { endY: now.getFullYear(), endM: now.getMonth() + 1 }
}

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
const limitMessage = ref('Atualize o seu plano para continuar.')

/* Upsell de plano (limite mensal Free atingido) */
const planUpsellOpen = ref(false)
const planUpsellText = ref('')

const needsPrimarySelection = computed(
  () => subscriptionStore.limits.needsPrimaryAccountSelection === true
)

/** Recorrentes são exclusivas dos planos Pro/Couple (bloqueadas no Free). */
const recurringLocked = computed(() => !subscriptionStore.canAccessRecurring)

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

const sumCatDropOpen = ref(false)
const sumAccDropOpen = ref(false)
const sumCatDropRef = ref<HTMLElement | null>(null)
const sumAccDropRef = ref<HTMLElement | null>(null)

function toggleSumCatDrop() { sumCatDropOpen.value = !sumCatDropOpen.value; sumAccDropOpen.value = false }
function toggleSumAccDrop() { sumAccDropOpen.value = !sumAccDropOpen.value; sumCatDropOpen.value = false }

function pickSumCategory(val: string) { summaryFilterCategory.value = val; sumCatDropOpen.value = false }
function pickSumAccount(val: string) { summaryFilterAccount.value = val; sumAccDropOpen.value = false }

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

/**
 * Texto do período para o resumo ("1 de nov a 4 de nov"; com ano só quando difere do atual).
 * Sem datas → "Todo o período".
 */
function periodRangeText(from: string, to: string): string {
  if (!from && !to) return 'Todo o período'
  const thisYear = new Date().getFullYear()
  const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  // "1 de nov" (o Intl pt-PT abrevia para "1/11", por isso os meses são escritos à mão)
  const fmt = (iso: string) => {
    const d = new Date(iso + 'T00:00:00')
    const base = `${d.getDate()} de ${MONTHS[d.getMonth()]}`
    return d.getFullYear() !== thisYear ? `${base} de ${d.getFullYear()}` : base
  }
  if (from && to) return `${fmt(from)} a ${fmt(to)}`
  return from ? `Desde ${fmt(from)}` : `Até ${fmt(to)}`
}
const summaryPeriodText = computed(() => periodRangeText(summaryDateFrom.value, summaryDateTo.value))
const txPeriodText = computed(() => periodRangeText(filterFrom.value, filterTo.value))
const recPeriodText = computed(() => periodRangeText(recFilterFrom.value, recFilterTo.value))

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
      const { endY, endM } = recurringActiveEnd(r)
      while (y < endY || (y === endY && m <= endM)) {
        const ym = `${y}-${String(m).padStart(2, '0')}`
        const inRange = (!fromYM || ym >= fromYM) && (!toYM || ym <= toYM)
        if (inRange) {
          const amt = recurringAmountForMonth(r, m)
          if (amt !== 0) {
            virtual.push({
              id: `recurring-${r.id}-${y}-${m}`,
              accountId: r.accountId,
              householdId: r.householdId,
              type: r.type,
              category: r.category,
              amount: amt,
              description: r.description ?? '',
              date: `${y}-${String(m).padStart(2, '0')}-${String(recurringDayInMonth(r, y, m)).padStart(2, '0')}`,
              splits: r.responsibleUserId ? [{ userId: r.responsibleUserId, percentage: 100 }] : []
            })
          }
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
// Cartão "Investimentos": depósitos na corretora (com conta) no período — para onde foi a poupança.
// Fica fora dos totais e do Sankey (não é despesa). Escondido com filtro de tipo/categoria, onde o
// Saldo deixa de ser "o que sobrou" e a comparação não faz sentido.
const summaryInvested = computed(() => {
  if (!subscriptionStore.canAccessInvestments || summaryFilterType.value || summaryFilterCategory.value) return 0
  return filterDeposits(investmentsStore.deposits, {
    from: summaryDateFrom.value,
    to: summaryDateTo.value,
    accountId: summaryFilterAccount.value,
  }).reduce((s, d) => s + d.amount, 0)
})

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

interface SankeyNode { name: string; total: number; color: string; height: number; y: number; category: number; labelY: number }
interface SankeyLink { path: string; color: string; thickness: number }

// Dynamic height: grows with number of nodes to keep proportional differences visible
const sankeyHeight = computed(() => {
  const maxNodes = Math.max(summaryIncomeByCategory.value.length, summaryExpensesByCategory.value.length, 1)
  return Math.max(280, maxNodes * 40 + 40)
})

/**
 * Cores do Sankey (chartTheme): receitas na cor semântica de receita; despesas com a paleta
 * categórica por ordem (sem o 1.º tom, que é o verde da marca e se confundiria com receitas).
 * Lê `themeStore.isDark` para recalcular ao mudar de tema.
 */
function sankeyColorFor(kind: 'income' | 'expense', index: number): string {
  if (kind === 'income') return 'var(--color-income)'
  const palette = (themeStore.isDark ? CHART_SERIES_DARK : CHART_SERIES_LIGHT).slice(1)
  return palette[index % palette.length]
}

function buildSankeyNodes(kind: 'income' | 'expense', items: { category: number; name: string; total: number }[], scaleTotal: number, totalHeight: number): SankeyNode[] {
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
  const nodes: SankeyNode[] = items.map((item, i) => ({
    ...item,
    color: sankeyColorFor(kind, i),
    height: sankeyMinHeight + (itemsTotal > 0 ? (item.total / itemsTotal) * extra : 0),
    y: 0,
    labelY: 0,
  }))
  let yy = 0
  nodes.forEach(nd => { nd.y = yy; yy += nd.height + sankeyNodeGap })
  // Center vertically
  const totalUsed = yy - sankeyNodeGap
  const offset = (totalHeight - totalUsed) / 2
  nodes.forEach(nd => { nd.y += offset })
  layoutSankeyLabels(nodes, totalHeight)
  return nodes
}

/** Altura reservada a cada rótulo (nome + valor). */
const SANKEY_LABEL_H = 32

/**
 * Posiciona os rótulos centrados no nó, mas afastando-os quando se sobrepõem (nós pequenos
 * ficam colados uns aos outros): passagem descendente garante o espaço mínimo, a ascendente
 * puxa-os de volta para dentro da área quando ultrapassam o fundo.
 */
function layoutSankeyLabels(nodes: SankeyNode[], totalHeight: number) {
  const half = SANKEY_LABEL_H / 2
  let prev = -Infinity
  for (const nd of nodes) {
    const c = Math.max(nd.y + nd.height / 2, prev + SANKEY_LABEL_H, half)
    nd.labelY = c
    prev = c
  }
  let next = Infinity
  for (let i = nodes.length - 1; i >= 0; i--) {
    const c = Math.min(nodes[i].labelY, next - SANKEY_LABEL_H, totalHeight - half)
    nodes[i].labelY = c
    next = c
  }
}

// Income scales to income total; expenses scale to their own total (so differences are visible)
const sankeyIncomeNodes = computed(() => buildSankeyNodes('income', summaryIncomeByCategory.value, summaryTotalIncome.value, sankeyHeight.value))
const sankeyExpenseNodes = computed(() => buildSankeyNodes('expense', summaryExpensesByCategory.value, summaryTotalExpenses.value, sankeyHeight.value))

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
    const link = { path: makeSankeyPath(n.y, n.height, destY, dstH, sankeyWidth), color: n.color, thickness: n.height }
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
    const link = { path: makeSankeyPath(srcY, srcH, n.y, n.height, sankeyWidth), color: n.color, thickness: n.height }
    srcY += srcH
    return link
  })
})

function formatCurrencySummary(value: number): string {
  return new Intl.NumberFormat('pt-PT', { ...PT_GROUPING, style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(value)
}

function accountName(accountId: string): string {
  return accountsStore.accounts.find(a => a.id === accountId)?.name ?? ''
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

// Depósitos na corretora que debitaram uma conta: linhas informativas "→ Investimentos" intercaladas
// com os movimentos (não contam para totais). Ver utils/depositRows.ts para a regra de paginação.
// Última data de cada página já vista (para o limite superior da página seguinte, sem buracos).
const pageLastDates = ref<Record<number, string>>({})
const depositsInFilter = computed(() =>
  subscriptionStore.canAccessInvestments
    ? filterDeposits(investmentsStore.deposits, {
        from: filterFrom.value,
        to: filterTo.value,
        accountId: filterAccountId.value,
        type: filterType.value,
        category: filterCategory.value,
      })
    : [],
)
const pageDeposits = computed(() => {
  const txs = transactionsStore.transactions
  return depositsForPage(depositsInFilter.value, {
    page: page.value,
    totalPages: Math.max(1, totalPages.value),
    firstDate: txs.length ? txs[0].date.slice(0, 10) : null,
    lastDate: txs.length ? txs[txs.length - 1].date.slice(0, 10) : null,
    prevPageLastDate: pageLastDates.value[page.value - 1] ?? null,
  })
})
const movementRows = computed(() => mergeRows(paginatedTransactions.value, pageDeposits.value))

const recurringInRange = computed(() => {
  const fromYM = filterFrom.value ? filterFrom.value.slice(0, 7) : null
  const toYM = filterTo.value ? filterTo.value.slice(0, 7) : null
  const entries: { type: number; amount: number }[] = []
  for (const r of recurringStore.recurring) {
    let y = r.startYear
    let m = r.startMonth
    const { endY, endM } = recurringActiveEnd(r)
    while (y < endY || (y === endY && m <= endM)) {
      const ym = `${y}-${String(m).padStart(2, '0')}`
      const inRange = (!fromYM || ym >= fromYM) && (!toYM || ym <= toYM)
      if (inRange) {
        const amt = recurringAmountForMonth(r, m)
        if (amt !== 0) entries.push({ type: r.type, amount: amt })
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
      // Fim exclusivo: a recorrente só está ativa enquanto fim > mês.
      const endYM = `${r.endYear}-${String(r.endMonth).padStart(2, '0')}`
      if (fromYM && endYM <= fromYM) return false
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
    const { endY, endM } = recurringActiveEnd(r)
    while (y < endY || (y === endY && m <= endM)) {
      const ym = `${y}-${String(m).padStart(2, '0')}`
      const inRange = (!fromYM || ym >= fromYM) && (!toYM || ym <= toYM)
      if (inRange) {
        const amt = recurringAmountForMonth(r, m)
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
      if (subscriptionStore.canAccessInvestments) investmentsStore.fetchDeposits()
      if (activeTab.value === 'dashboard') await fetchSummaryTransactions()
    } else {
      await subscriptionStore.fetchSubscription()
    }
  } catch {
    // Handled in stores
  }
  if (routeRef.query.action === 'new') {
    if (activeTab.value === 'recurring') {
      if (!recurringLocked.value) openRecurringCreateModal()
    } else openCreateModal()
    router.replace({ query: { ...routeRef.query, action: undefined } })
  }
})

async function fetchWithFilters(resetPage = true) {
  if (resetPage) {
    page.value = 1
    pageLastDates.value = {}
  }
  const params: { accountId?: string; from?: string; to?: string; page?: number; pageSize?: number } = {
    page: page.value,
    pageSize,
  }
  if (filterAccountId.value) params.accountId = filterAccountId.value
  if (filterFrom.value) params.from = filterFrom.value
  if (filterTo.value) params.to = filterTo.value

  try {
    await transactionsStore.fetchTransactionsPaged(params)
    const txs = transactionsStore.transactions
    if (txs.length) pageLastDates.value = { ...pageLastDates.value, [page.value]: txs[txs.length - 1].date.slice(0, 10) }
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
      'Tem mais do que uma conta no plano Free. Vá a Contas e escolha qual fica ativa para movimentos antes de continuar.'
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
      'Tem mais do que uma conta no plano Free. Vá a Contas e escolha a conta principal antes de editar movimentos.'
    limitModalOpen.value = true
    return
  }
  const acc = accountsStore.accounts.find((a) => a.id === tx.accountId)
  if (acc && acc.isActiveForPlan === false) {
    limitModalKind.value = 'primary'
    limitMessage.value =
      'Esta transação está numa conta que não é a principal no plano Free. Só pode editar movimentos na conta principal, ou altere a conta principal em Contas.'
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
    toast.success(payload.type === TransactionType.Transfer ? 'Transferência registada' : 'Movimento adicionado')
  } catch (e: unknown) {
    const err = e as { response?: { status?: number; data?: { code?: string; message?: string } } }
    const code = err.response?.data?.code
    if (err.response?.status === 403 && code === 'PLAN_LIMIT') {
      closeCreateModal()
      planUpsellText.value = payload.type === TransactionType.Income
        ? 'Atingiu o limite de receitas do plano Free: só pode registar 1 receita por mês.'
        : 'Atingiu o limite de despesas do plano Free: só pode registar 5 despesas por mês.'
      planUpsellOpen.value = true
    } else if (err.response?.status === 403 && code === 'FREE_PRIMARY_REQUIRED') {
      closeCreateModal()
      limitModalKind.value = 'primary'
      limitMessage.value =
        err.response?.data?.message ??
        'Tem mais do que uma conta no plano Free. Escolha a conta principal em Contas antes de adicionar movimentos.'
      limitModalOpen.value = true
    } else if (err.response?.status === 403 && code === 'FREE_ACCOUNT_LOCKED') {
      closeCreateModal()
      limitModalKind.value = 'primary'
      limitMessage.value =
        err.response?.data?.message ??
        'No plano Free só pode usar a conta principal para movimentos. Altere a conta principal em Contas.'
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
    toast.success('Movimento atualizado')
  } catch (e: unknown) {
    const err = e as { response?: { status?: number; data?: { code?: string; message?: string } } }
    const code = err.response?.data?.code
    if (err.response?.status === 403 && code === 'FREE_PRIMARY_REQUIRED') {
      closeEditModal()
      limitModalKind.value = 'primary'
      limitMessage.value =
        err.response?.data?.message ??
        'Escolha a conta principal em Contas antes de editar movimentos.'
      limitModalOpen.value = true
    } else if (err.response?.status === 403 && code === 'FREE_ACCOUNT_LOCKED') {
      closeEditModal()
      limitModalKind.value = 'primary'
      limitMessage.value =
        err.response?.data?.message ??
        'No plano Free só pode alterar movimentos na conta principal.'
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
    toast.success('Movimento eliminado')
  } catch {
    // Error shown in store
  } finally {
    actionLoading.value = false
  }
}

function formatAmount(amount: number, type: TransactionType): string {
  const formatted = new Intl.NumberFormat('pt-PT', { ...PT_GROUPING,
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
    return m ? `${m.firstName} ${m.lastName}` : '-'
  }
  return tx.splits
    .map((s) => {
      const m = map.get(s.userId)
      const name = m ? m.firstName : '?'
      return `${name} ${s.percentage}%`
    })
    .join(', ')
}

function getRecurringResponsibleDisplay(r: RecurringTransaction): string {
  if (!r.responsibleUserId) return '-'
  const m = membersMap.value.get(r.responsibleUserId)
  return m ? `${m.firstName} ${m.lastName}` : '-'
}

function openRecurringCreateModal() {
  if (recurringLocked.value) return
  if (needsPrimarySelection.value) {
    limitModalKind.value = 'primary'
    limitMessage.value =
      'Tem mais do que uma conta no plano Free. Vá a Contas e escolha a conta principal antes de criar recorrentes.'
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
  if (recurringLocked.value) return
  if (needsPrimarySelection.value) {
    limitModalKind.value = 'primary'
    limitMessage.value =
      'Tem mais do que uma conta no plano Free. Vá a Contas e escolha a conta principal antes de editar recorrentes.'
    limitModalOpen.value = true
    return
  }
  const acc = accountsStore.accounts.find((a) => a.id === r.accountId)
  if (acc && acc.isActiveForPlan === false) {
    limitModalKind.value = 'primary'
    limitMessage.value =
      'Esta recorrente está numa conta que não é a principal no plano Free. Só pode editar na conta principal, ou altere a conta principal em Contas.'
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
  recurringStore.clearError()
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
    toast.success('Recorrente adicionada')
  } catch (e: unknown) {
    const err = e as { response?: { status?: number; data?: { code?: string; message?: string } } }
    const code = err.response?.data?.code
    if (err.response?.status === 403 && (code === 'PLAN_LIMIT' || code === 'RECURRING_LOCKED')) {
      closeRecurringCreateModal()
      planUpsellText.value = code === 'RECURRING_LOCKED'
        ? 'As transações recorrentes estão disponíveis nos planos Pro e Couple.'
        : payload.type === TransactionType.Income
          ? 'Atingiu o limite de receitas do plano Free: só pode registar 1 receita por mês.'
          : 'Atingiu o limite de despesas do plano Free: só pode registar 5 despesas por mês.'
      planUpsellOpen.value = true
      return
    }
    if (err.response?.status === 403 && code === 'FREE_PRIMARY_REQUIRED') {
      closeRecurringCreateModal()
      limitModalKind.value = 'primary'
      limitMessage.value =
        err.response?.data?.message ??
        'Escolha a conta principal em Contas antes de adicionar recorrentes.'
      limitModalOpen.value = true
      return
    }
    if (err.response?.status === 403 && code === 'FREE_ACCOUNT_LOCKED') {
      closeRecurringCreateModal()
      limitModalKind.value = 'primary'
      limitMessage.value =
        err.response?.data?.message ??
        'No plano Free só pode usar recorrentes na conta principal.'
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
    toast.success('Recorrente atualizada')
  } catch (e: unknown) {
    const err = e as { response?: { status?: number; data?: { code?: string; message?: string } } }
    const code = err.response?.data?.code
    if (err.response?.status === 403 && code === 'FREE_PRIMARY_REQUIRED') {
      closeRecurringEditModal()
      limitModalKind.value = 'primary'
      limitMessage.value =
        err.response?.data?.message ??
        'Escolha a conta principal em Contas antes de editar recorrentes.'
      limitModalOpen.value = true
    } else if (err.response?.status === 403 && code === 'FREE_ACCOUNT_LOCKED') {
      closeRecurringEditModal()
      limitModalKind.value = 'primary'
      limitMessage.value =
        err.response?.data?.message ??
        'No plano Free só pode editar recorrentes na conta principal.'
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
    toast.success('Recorrente retirada a partir deste mês')
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
    toast.success('Recorrente retirada a partir do próximo mês')
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

function txMenuItems(tx: Transaction): ActionMenuItem[] {
  return [
    { label: 'Editar', disabled: isTxAccountLocked(tx), onSelect: () => openEditModal(tx) },
    { label: 'Eliminar', danger: true, onSelect: () => openDeleteModal(tx) },
  ]
}

function recurringMenuItems(r: RecurringTransaction): ActionMenuItem[] {
  return [
    { label: 'Editar', disabled: isRecurringAccountLocked(r), onSelect: () => openRecurringEditModal(r) },
    { label: 'Retirar…', danger: true, onSelect: () => openRecurringRemoveModal(r) },
  ]
}

/** Badge do tipo (classes partilhadas de ui.css). */
function typeBadgeClass(type: TransactionType): string {
  if (type === TransactionType.Income) return 'ui-badge--success'
  if (type === TransactionType.Transfer) return 'ui-badge--info'
  return 'ui-badge--danger'
}

/** Cor do montante: receita verde, despesa vermelha, transferência neutra-azul. */
function amountClass(type: TransactionType): string {
  if (type === TransactionType.Income) return 'ui-amount--pos'
  if (type === TransactionType.Expense) return 'ui-amount--neg'
  return 'amount-transfer'
}
</script>

<template>
  <div class="transactions-view">
    <PageHeader :title="pageCopy.title">
      <template v-if="householdStore.household && (activeTab === 'movements' || (activeTab === 'recurring' && !recurringLocked))" #actions>
        <UiButton variant="primary" @click="activeTab === 'recurring' ? openRecurringCreateModal() : openCreateModal()">
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
          </template>
          Adicionar
        </UiButton>
      </template>
    </PageHeader>

    <UiCard v-if="!householdStore.household && !householdStore.loading">
      <EmptyState title="Configure primeiro o seu agregado" description="Precisa de um agregado para registar movimentos.">
        <UiButton variant="secondary" @click="router.push('/overview')">Ir para o painel</UiButton>
      </EmptyState>
    </UiCard>

    <div v-else-if="householdStore.loading && !householdStore.household" class="skeleton-state"><PageSkeleton variant="table" /></div>

    <UiCard v-else-if="householdStore.error && !householdStore.household">
      <EmptyState title="Não foi possível carregar os dados" description="Tente novamente dentro de momentos." />
    </UiCard>

    <div v-else class="content">
      <div v-if="activeTab === 'movements' && transactionsStore.error" class="notice notice--danger" role="alert">
        {{ transactionsStore.error }}
      </div>
      <div v-if="activeTab === 'recurring' && recurringStore.error" class="notice notice--danger" role="alert">
        {{ recurringStore.error }}
      </div>

      <!-- ═══ RESUMO ═══ -->
      <div v-show="activeTab === 'dashboard'" class="tab-content">
        <div class="ui-toolbar">
          <div class="ui-toolbar-group">
            <div ref="datePickerRef">
              <RangePickerPanel
                :label="datePickerLabel"
                :open="datePickerOpen"
                :active-preset="activePreset"
                :left-year="pickerLeftYear"
                :left-month="pickerLeftMonth"
                :right-year="pickerRightYear"
                :right-month="pickerRightMonth"
                :left-days="leftDays"
                :right-days="rightDays"
                :is-in-range="isInRange"
                :is-start="isStart"
                :is-end="isEnd"
                @toggle="toggleDatePicker"
                @preset="applyPreset"
                @prev="pickerPrevMonth"
                @next="pickerNextMonth"
                @pick="pickDay"
              />
            </div>
            <div ref="sumCatDropRef">
              <FilterDropdown
                :label="sumCategoryLabel"
                :open="sumCatDropOpen"
                :active="summaryFilterCategory !== ''"
                all-label="Todas as categorias"
                :options="categoryOptions(sumAvailableCategories)"
                :selected="summaryFilterCategory"
                @toggle="toggleSumCatDrop"
                @pick="pickSumCategory"
              />
            </div>
            <div ref="sumAccDropRef">
              <FilterDropdown
                :label="sumAccountLabel"
                :open="sumAccDropOpen"
                :active="summaryFilterAccount !== ''"
                all-label="Todas as contas"
                :options="accountOptions"
                :selected="summaryFilterAccount"
                @toggle="toggleSumAccDrop"
                @pick="pickSumAccount"
              />
            </div>
            <label class="search-field">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>
              <input v-model="summarySearch" type="text" placeholder="Pesquisar movimentos" aria-label="Pesquisar movimentos" />
            </label>
          </div>
          <SegmentedControl v-model="summaryFilterType" :options="SUMMARY_TYPE_OPTIONS" aria-label="Tipo" />
        </div>

        <div class="summary-area">
          <Transition name="fade">
            <div v-if="summaryLoading" class="summary-loading" role="status">
              <div class="spinner"></div>
              <p>A carregar…</p>
            </div>
          </Transition>

          <PeriodSummary
            v-show="!summaryLoading"
            :period="summaryPeriodText"
            :balance="formatCurrencySummary(summaryBalance)"
            :income="formatCurrencySummary(summaryTotalIncome)"
            :expenses="formatCurrencySummary(summaryTotalExpenses)"
            :extra="summaryInvested > 0 ? { label: 'Investimentos', value: formatCurrencySummary(summaryInvested), title: 'Depósitos na corretora neste período. Não contam como despesa.' } : null"
            @extra-click="goToDeposits"
          />

          <!-- Fluxo por categoria (Sankey) -->
          <UiCard
            v-if="!summaryLoading && summaryFiltered.length > 0 && (summaryIncomeByCategory.length > 0 || summaryExpensesByCategory.length > 0)"
            title="Fluxo por categoria"
            subtitle="De onde veio e para onde foi o dinheiro neste período."
            class="section"
          >
            <div class="sankey" :style="{ height: sankeyHeight + 'px' }">
              <div class="sankey-col sankey-col-left">
                <div
                  v-for="(node, i) in sankeyIncomeNodes"
                  :key="'il' + i"
                  class="sankey-node"
                  :style="{ height: node.height + 'px', top: node.y + 'px' }"
                >
                  <span class="sankey-label sankey-label-left" :style="{ top: node.labelY - node.y + 'px' }">
                    <span class="sankey-name">{{ node.name }}</span>
                    <span class="sankey-amount">{{ formatCurrencySummary(node.total) }}</span>
                  </span>
                  <div class="sankey-bar" :style="{ background: node.color }"></div>
                </div>
              </div>

              <svg class="sankey-svg" :viewBox="`0 0 ${sankeyWidth} ${sankeyHeight}`" preserveAspectRatio="none" aria-hidden="true">
                <path v-for="(link, i) in sankeyIncomeLinks" :key="'li' + i" :d="link.path" :style="{ fill: link.color }" :fill-opacity="themeStore.isDark ? 0.22 : 0.12" />
              </svg>

              <div class="sankey-col sankey-col-center">
                <div class="sankey-center" :style="{ height: sankeyCenterHeight + 'px' }">
                  <div class="sankey-center-bar"></div>
                  <span class="sankey-center-label">
                    <span class="sankey-center-amount">{{ formatCurrencySummary(summaryTotalIncome) }}</span>
                    <span class="sankey-center-sub">Total receitas</span>
                  </span>
                </div>
              </div>

              <svg class="sankey-svg" :viewBox="`0 0 ${sankeyWidth} ${sankeyHeight}`" preserveAspectRatio="none" aria-hidden="true">
                <path v-for="(link, i) in sankeyExpenseLinksRight" :key="'re' + i" :d="link.path" :style="{ fill: link.color }" :fill-opacity="themeStore.isDark ? 0.22 : 0.12" />
              </svg>

              <div class="sankey-col sankey-col-right">
                <div
                  v-for="(node, i) in sankeyExpenseNodes"
                  :key="'er' + i"
                  class="sankey-node"
                  :style="{ height: node.height + 'px', top: node.y + 'px' }"
                >
                  <div class="sankey-bar" :style="{ background: node.color }"></div>
                  <span class="sankey-label sankey-label-right" :style="{ top: node.labelY - node.y + 'px' }">
                    <span class="sankey-name">{{ node.name }}</span>
                    <span class="sankey-amount">{{ formatCurrencySummary(node.total) }}</span>
                  </span>
                </div>
              </div>
            </div>
          </UiCard>

          <!-- Movimentos do período -->
          <UiCard v-if="!summaryLoading && summaryFiltered.length > 0" flush class="section">
            <div class="ui-table-wrap">
              <table class="ui-table tx-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Nome</th>
                    <th>Categoria</th>
                    <th>Conta</th>
                    <th v-if="householdStore.isCouple">Responsável</th>
                    <th class="num">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="tx in summaryPaginated" :key="tx.id">
                    <td class="td-date">{{ new Date(tx.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }) }}</td>
                    <td>
                      <span class="name-cell">
                        <TxAvatar :name="tx.entityName || tx.description" :category="tx.category" />
                        <span class="name-text">{{ tx.description || TRANSACTION_CATEGORY_LABELS[tx.category] || '—' }}</span>
                        <span v-if="tx.id.startsWith('recurring-')" class="ui-badge" title="Recorrente contada neste mês">Recorrente</span>
                      </span>
                    </td>
                    <td><CategoryCell :category="tx.category" iconless /></td>
                    <td class="td-muted">{{ accountName(tx.accountId) }}</td>
                    <td v-if="householdStore.isCouple" class="td-muted">{{ getResponsibleDisplay(tx) }}</td>
                    <td class="num">
                      <span class="ui-amount" :class="tx.type === TransactionType.Income ? 'ui-amount--pos' : 'ui-amount--neg'">
                        {{ tx.type === TransactionType.Income ? '+' : '-' }}{{ formatCurrencySummary(tx.amount) }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <TablePagination
              v-if="summaryTotalPages > 1"
              :page="summaryPage"
              :pages="visibleSummaryPages"
              :can-prev="canPrevSummaryPage"
              :can-next="canNextSummaryPage"
              @prev="prevSummaryPage"
              @next="nextSummaryPage"
              @go="goToSummaryPage"
            />
          </UiCard>
          <UiCard v-else-if="!summaryLoading" class="section">
            <EmptyState title="Sem movimentos neste período" description="Escolha outro período ou ajuste os filtros." />
          </UiCard>
        </div>
      </div>

      <!-- ═══ MOVIMENTOS ═══ -->
      <div v-show="activeTab === 'movements'" class="tab-content">
        <div v-if="needsPrimarySelection" class="notice notice--warning">
          <router-link :to="{ name: 'contas' }" class="notice-link">Escolha a conta principal em Contas</router-link>
          <span> para poder adicionar ou editar movimentos no plano Free com várias contas.</span>
        </div>

        <div class="ui-toolbar">
          <div class="ui-toolbar-group">
            <div ref="txDatePickerRef">
              <RangePickerPanel
                :label="txDatePickerLabel"
                :open="txDatePickerOpen"
                :active-preset="txActivePreset"
                :left-year="txPickerLeftYear"
                :left-month="txPickerLeftMonth"
                :right-year="txPickerRightYear"
                :right-month="txPickerRightMonth"
                :left-days="txLeftDays"
                :right-days="txRightDays"
                :is-in-range="txIsInRange"
                :is-start="txIsStart"
                :is-end="txIsEnd"
                @toggle="toggleTxDatePicker"
                @preset="txApplyPreset"
                @prev="txPickerPrevMonth"
                @next="txPickerNextMonth"
                @pick="txPickDay"
              />
            </div>
            <div ref="catDropRef">
              <FilterDropdown
                :label="categoryLabel"
                :open="catDropOpen"
                :active="filterCategory !== ''"
                all-label="Todas as categorias"
                :options="categoryOptions(availableCategories)"
                :selected="filterCategory"
                @toggle="toggleCatDrop"
                @pick="pickCategory"
              />
            </div>
            <div ref="accDropRef">
              <FilterDropdown
                :label="accountLabel"
                :open="accDropOpen"
                :active="filterAccountId !== ''"
                all-label="Todas as contas"
                :options="accountOptions"
                :selected="filterAccountId"
                @toggle="toggleAccDrop"
                @pick="pickAccount"
              />
            </div>
          </div>
          <SegmentedControl :model-value="filterType" :options="TYPE_OPTIONS" aria-label="Tipo de movimento" @update:model-value="pickType" />
        </div>

        <PeriodSummary
          :period="txPeriodText"
          :balance="formatCurrencySummary(txBalance)"
          :income="formatCurrencySummary(txTotalIncome)"
          :expenses="formatCurrencySummary(txTotalExpenses)"
        />

        <div v-if="transactionsStore.loading && transactionsStore.transactions.length === 0" class="skeleton-state"><PageSkeleton variant="table" /></div>

        <UiCard v-else-if="transactionsStore.transactions.length === 0 && movementRows.length === 0">
          <!-- A lista só mostra movimentos reais do período; os totais acima também somam as recorrentes ativas. -->
          <EmptyState
            title="Sem movimentos neste período"
            :description="recurringInRange.length
              ? 'Os totais acima incluem as recorrentes ativas neste período, que não aparecem nesta lista.'
              : 'Adicione um movimento ou escolha outro período.'"
          >
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v16"/><path d="m3 8 4-4 4 4"/><path d="M17 20V4"/><path d="m21 16-4 4-4-4"/></svg>
            </template>
            <div class="empty-actions">
              <UiButton variant="secondary" @click="openCreateModal">Adicionar movimento</UiButton>
              <UiButton v-if="recurringInRange.length" variant="secondary" @click="goToRecurringTab">Ver recorrentes</UiButton>
            </div>
          </EmptyState>
        </UiCard>

        <UiCard v-else-if="movementRows.length === 0">
          <EmptyState title="Nenhum movimento corresponde aos filtros" description="Experimente outro tipo, categoria ou conta." />
        </UiCard>

        <UiCard v-else flush>
          <div class="ui-table-wrap">
            <table class="ui-table tx-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Nome</th>
                  <th>Categoria</th>
                  <th>Tipo</th>
                  <th v-if="householdStore.isCouple">Responsável</th>
                  <th class="num">Valor</th>
                  <th class="col-actions"><span class="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                <template v-for="row in movementRows" :key="row.key">
                  <tr v-if="row.kind === 'deposit'" class="deposit-row" title="Dinheiro enviado para a corretora. Não conta como despesa.">
                    <td class="td-date">{{ formatDate(row.dep.date) }}</td>
                    <td>
                      <span class="name-cell">
                        <span class="deposit-icon" aria-hidden="true">
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                        </span>
                        <span class="name-text">Depósito na corretora</span>
                      </span>
                    </td>
                    <td>
                      <span class="cell-stack">
                        <span>Investimentos</span>
                        <span class="cell-hint">{{ getAccountName(row.dep.accountId ?? '') }} → Investimentos</span>
                      </span>
                    </td>
                    <td><span class="ui-badge ui-badge--warning">Investimento</span></td>
                    <td v-if="householdStore.isCouple" class="td-muted">-</td>
                    <td class="num"><span class="ui-amount">{{ formatAmount(row.dep.amount, TransactionType.Transfer) }}</span></td>
                    <td class="col-actions">
                      <UiButton variant="ghost" size="sm" @click="goToDeposits">Ver</UiButton>
                    </td>
                  </tr>
                  <tr v-else>
                    <td class="td-date">{{ formatDate(row.tx.date) }}</td>
                    <td>
                      <span class="name-cell">
                        <TxAvatar :name="row.tx.entityName || row.tx.description" :category="row.tx.category" />
                        <span class="name-text">{{ row.tx.description || '—' }}</span>
                      </span>
                    </td>
                    <td>
                      <CategoryCell
                        :category="row.tx.category"
                        iconless
                        :hint="row.tx.type === TransactionType.Transfer
                          ? `${getAccountName(row.tx.accountId)} → ${getAccountName(row.tx.destinationAccountId ?? '')}`
                          : undefined"
                      />
                    </td>
                    <td><span class="ui-badge" :class="typeBadgeClass(row.tx.type)">{{ TRANSACTION_TYPE_LABELS[row.tx.type] }}</span></td>
                    <td v-if="householdStore.isCouple" class="td-muted">{{ getResponsibleDisplay(row.tx) }}</td>
                    <td class="num">
                      <span class="ui-amount" :class="amountClass(row.tx.type)">{{ formatAmount(row.tx.amount, row.tx.type) }}</span>
                    </td>
                    <td class="col-actions">
                      <ActionMenu :items="txMenuItems(row.tx)" aria-label="Ações do movimento" />
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
          <TablePagination
            v-if="totalPages > 1"
            :page="page"
            :pages="visiblePages"
            :can-prev="canPrevPage"
            :can-next="canNextPage"
            @prev="prevPage"
            @next="nextPage"
            @go="goToPage"
          />
        </UiCard>
      </div>

      <!-- ═══ RECORRENTES ═══ -->
      <div v-show="activeTab === 'recurring'" class="tab-content">
        <PlanUpsellCard
          v-if="recurringLocked"
          title="Controle as suas despesas recorrentes"
          description="Saiba exatamente quanto gasta em subscrições e pagamentos fixos todos os meses."
          :features="[
            'Agrupe despesas por categoria e frequência',
            'Preveja o total de gastos fixos do próximo mês',
            'Identifique subscrições esquecidas ou duplicadas',
          ]"
        >
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
          </template>
        </PlanUpsellCard>
        <template v-else>
          <div v-if="needsPrimarySelection" class="notice notice--warning">
            <router-link :to="{ name: 'contas' }" class="notice-link">Escolha a conta principal em Contas</router-link>
            <span> para gerir recorrentes no plano Free com várias contas.</span>
          </div>

          <div class="ui-toolbar">
            <div class="ui-toolbar-group">
              <div ref="recDatePickerRef">
                <RangePickerPanel
                  :label="recDatePickerLabel"
                  :open="recDatePickerOpen"
                  :active-preset="recActivePreset"
                  :left-year="recPickerLeftYear"
                  :left-month="recPickerLeftMonth"
                  :right-year="recPickerRightYear"
                  :right-month="recPickerRightMonth"
                  :left-days="recLeftDays"
                  :right-days="recRightDays"
                  :is-in-range="recIsInRange"
                  :is-start="recIsStart"
                  :is-end="recIsEnd"
                  @toggle="toggleRecDatePicker"
                  @preset="recApplyPreset"
                  @prev="recPickerPrevMonth"
                  @next="recPickerNextMonth"
                  @pick="recPickDay"
                />
              </div>
              <div ref="recCatDropRef">
                <FilterDropdown
                  :label="recCategoryLabel"
                  :open="recCatDropOpen"
                  :active="recFilterCategory !== ''"
                  all-label="Todas as categorias"
                  :options="categoryOptions(recAvailableCategories)"
                  :selected="recFilterCategory"
                  @toggle="toggleRecCatDrop"
                  @pick="pickRecCategory"
                />
              </div>
              <div ref="recAccDropRef">
                <FilterDropdown
                  :label="recAccountLabel"
                  :open="recAccDropOpen"
                  :active="recFilterAccount !== ''"
                  all-label="Todas as contas"
                  :options="accountOptions"
                  :selected="recFilterAccount"
                  @toggle="toggleRecAccDrop"
                  @pick="pickRecAccount"
                />
              </div>
            </div>
            <SegmentedControl :model-value="recFilterType" :options="TYPE_OPTIONS" aria-label="Tipo de recorrente" @update:model-value="pickRecTypeToggle" />
          </div>

          <PeriodSummary
            :period="recPeriodText"
            :balance="formatCurrencySummary(recBalance)"
            :income="formatCurrencySummary(recTotalIncome)"
            :expenses="formatCurrencySummary(recTotalExpenses)"
          />

          <div v-if="recurringStore.loading && activeRecurring.length === 0" class="skeleton-state"><PageSkeleton variant="table" /></div>
          <UiCard v-else-if="activeRecurring.length === 0">
            <EmptyState
              title="Sem recorrentes neste período"
              description="Adicione receitas ou despesas que se repetem, como o salário, a renda ou subscrições."
            >
              <template #icon>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>
              </template>
              <UiButton variant="secondary" @click="openRecurringCreateModal">Adicionar recorrente</UiButton>
            </EmptyState>
          </UiCard>
          <UiCard v-else-if="filteredRecurring.length === 0">
            <EmptyState title="Nenhuma recorrente corresponde aos filtros" description="Experimente outro tipo, categoria ou conta." />
          </UiCard>
          <UiCard v-else flush>
            <div class="ui-table-wrap">
              <table class="ui-table tx-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Conta</th>
                    <th>Categoria</th>
                    <th>Tipo</th>
                    <th>Frequência</th>
                    <th>Início</th>
                    <th v-if="householdStore.isCouple">Responsável</th>
                    <th class="num">Valor</th>
                    <th class="col-actions"><span class="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in paginatedRecurring" :key="r.id">
                    <td>
                      <span class="name-cell">
                        <TxAvatar :name="r.entityName || r.description" :category="r.category" />
                        <span class="name-text">{{ r.description || '—' }}</span>
                      </span>
                    </td>
                    <td>
                      <span class="cell-stack">
                        <span>{{ getAccountName(r.accountId) }}</span>
                        <span v-if="r.type === TransactionType.Transfer" class="cell-hint">→ {{ getAccountName(r.destinationAccountId ?? '') }}</span>
                      </span>
                    </td>
                    <td><CategoryCell :category="r.category" iconless /></td>
                    <td><span class="ui-badge" :class="typeBadgeClass(r.type)">{{ TRANSACTION_TYPE_LABELS[r.type] }}</span></td>
                    <td class="td-muted">{{ recurringFrequencyDescription(r) }}</td>
                    <td class="td-muted td-nowrap">{{ MONTH_NAMES[r.startMonth] }} {{ r.startYear }}</td>
                    <td v-if="householdStore.isCouple" class="td-muted">{{ getRecurringResponsibleDisplay(r) }}</td>
                    <td class="num">
                      <span class="ui-amount" :class="amountClass(r.type)">{{ formatAmount(r.amount, r.type) }}</span>
                    </td>
                    <td class="col-actions">
                      <ActionMenu :items="recurringMenuItems(r)" aria-label="Ações da recorrente" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <TablePagination
              v-if="recTotalPages > 1"
              :page="recPage"
              :pages="visibleRecPages"
              :can-prev="canPrevRecPage"
              :can-next="canNextRecPage"
              @prev="prevRecPage"
              @next="nextRecPage"
              @go="goToRecPage"
            />
          </UiCard>
        </template>
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
      title="Eliminar movimento"
      :message="transactionToDelete
        ? `Tem a certeza que deseja eliminar este movimento de ${formatAmount(transactionToDelete.amount, transactionToDelete.type)}?`
        : ''"
      :loading="actionLoading"
      @close="closeDeleteModal"
      @confirm="handleDelete"
    />

    <RecurringFormModal
      :open="recurringCreateModalOpen"
      :accounts="accountsForRecurringCreate"
      :members="members"
      :is-couple="householdStore.isCouple"
      :current-user-id="authStore.user?.id ?? ''"
      :loading="actionLoading"
      :is-transfer="isRecTransferMode"
      @close="closeRecurringCreateModal"
      @submit="handleRecurringCreate"
    />

    <RecurringFormModal
      :open="recurringEditModalOpen"
      :recurring="recurringToEdit"
      :accounts="accountsForRecurringEdit"
      :members="members"
      :is-couple="householdStore.isCouple"
      :current-user-id="authStore.user?.id ?? ''"
      :loading="actionLoading"
      :is-transfer="isRecTransferMode"
      @close="closeRecurringEditModal"
      @submit="handleRecurringEdit"
    />

    <RemoveRecurringModal
      :open="recurringRemoveModalOpen"
      :recurring="recurringToRemove"
      :loading="actionLoading"
      :error="recurringStore.error"
      @close="closeRecurringRemoveModal"
      @remove-from-current-month="handleRecurringRemoveFromCurrentMonth"
      @remove-from-next-month="handleRecurringRemoveFromNextMonth"
    />

    <BaseModal
      v-if="limitModalOpen"
      :title="limitModalKind === 'primary' ? 'Conta principal' : 'Limite do plano Free'"
      @close="dismissLimitModal"
    >
      <div class="limit-body">
        <p>{{ limitMessage }}</p>
        <div class="limit-actions">
          <UiButton variant="secondary" @click="dismissLimitModal">Agora não</UiButton>
          <router-link
            v-if="limitModalKind === 'primary'"
            :to="{ name: 'contas' }"
            class="limit-cta"
            @click="dismissLimitModal"
          >
            Ir para Contas
          </router-link>
          <router-link
            v-else
            :to="{ name: 'subscricao' }"
            class="limit-cta"
            @click="dismissLimitModal"
          >
            Ver planos
          </router-link>
        </div>
      </div>
    </BaseModal>

    <PlanUpsellModal
      :open="planUpsellOpen"
      title="Fazer upgrade do plano"
      :description="planUpsellText"
      :features="[
        'Movimentos ilimitados todos os meses',
        'Receitas e despesas recorrentes',
        'Objetivos de poupança e relatórios mensais',
      ]"
      @close="planUpsellOpen = false"
    />
  </div>
</template>

<style scoped>
.transactions-view {
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 0 0 var(--space-10);
}

.section {
  margin-top: var(--space-6);
}

/* ── Avisos ─────────────────────────────────────────────── */
.notice {
  margin-bottom: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-size: var(--text-base);
  line-height: 1.45;
}

.notice--danger {
  background: var(--color-danger-soft);
  border-color: var(--color-danger-border);
  color: var(--color-danger);
}

.notice--warning {
  background: var(--color-warning-soft);
  border-color: var(--color-warning-border);
  color: var(--color-text);
}

.notice-link {
  color: var(--color-text-strong);
  font-weight: var(--weight-semibold);
  text-decoration: underline;
  text-underline-offset: 2px;
}

/* ── Barra de filtros ───────────────────────────────────── */
/* Filtros numa só linha: o grupo da esquerda ocupa o espaço livre, a pesquisa encolhe primeiro */
.ui-toolbar > .ui-toolbar-group {
  flex: 1 1 auto;
  min-width: 0;
}

.search-field {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1 1 160px;
  min-width: 150px;
  max-width: 260px;
  height: var(--control-h);
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: text;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.search-field:focus-within {
  border-color: var(--color-primary);
  box-shadow: var(--focus-ring);
}

.search-field input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  color: var(--color-text);
  font-family: inherit;
  font-size: var(--text-sm);
}

.search-field input:focus,
.search-field input:focus-visible {
  outline: none;
  box-shadow: none;
}

.search-field input::placeholder {
  color: var(--color-text-subtle);
}

















/* ── Resumo: carregamento ───────────────────────────────── */
.summary-area {
  position: relative;
  min-height: 200px;
}

.summary-loading {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: var(--space-12);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.spinner {
  width: 32px;
  height: 32px;
  margin-bottom: var(--space-3);
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-slow);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ── Sankey ─────────────────────────────────────────────── */
.sankey {
  position: relative;
  display: flex;
  align-items: stretch;
}

.sankey-col {
  position: relative;
  flex-shrink: 0;
}

.sankey-col-left,
.sankey-col-right {
  width: 130px;
}

.sankey-col-center {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96px;
}

.sankey-svg {
  flex: 1;
  min-width: 60px;
  height: 100%;
}

.sankey-node {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.sankey-col-left .sankey-node {
  justify-content: flex-end;
}

.sankey-bar {
  flex-shrink: 0;
  width: 6px;
  height: 100%;
  border-radius: 3px;
}

.sankey-label {
  position: absolute;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
  min-width: 0;
  max-width: calc(100% - 14px);
  height: 32px; /* = SANKEY_LABEL_H */
  overflow: hidden;
  transform: translateY(-50%);
}

.sankey-label-left {
  right: 14px; /* barra 6px + 8px de folga */
  align-items: flex-end;
  text-align: right;
}

.sankey-label-right {
  left: 14px;
  align-items: flex-start;
  text-align: left;
}

.sankey-name {
  overflow: hidden;
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  line-height: 1.25;
  color: var(--color-text);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.sankey-amount {
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  font-variant-numeric: tabular-nums;
  line-height: 1.25;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.sankey-center {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.sankey-center-bar {
  position: absolute;
  left: 50%;
  width: 6px;
  height: 100%;
  border-radius: 3px;
  background: var(--color-income);
  transform: translateX(-50%);
}

.sankey-center-label {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-1) var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.sankey-center-amount {
  font-size: var(--text-sm);
  font-weight: var(--weight-bold);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-strong);
  white-space: nowrap;
}

.sankey-center-sub {
  font-size: var(--text-2xs);
  color: var(--color-text-muted);
  white-space: nowrap;
}

/* ── Tabelas ────────────────────────────────────────────── */
.tx-table th.num {
  text-align: right;
}

.td-date,
.td-nowrap {
  white-space: nowrap;
}

.td-date {
  color: var(--color-text-secondary);
}

.td-muted {
  color: var(--color-text-secondary);
}

.name-cell {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  max-width: 320px;
}

.name-text {
  overflow: hidden;
  font-weight: var(--weight-medium);
  color: var(--color-text-strong);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.cell-stack {
  display: flex;
  flex-direction: column;
}

.cell-hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
}

.amount-transfer {
  color: var(--color-transfer);
}

.col-actions {
  width: 1%;
  text-align: right;
  white-space: nowrap;
}

.deposit-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.empty-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-2);
}

/* ── Modal de limite ────────────────────────────────────── */
.limit-body p {
  margin: 0;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.limit-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-4);
}

.limit-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: var(--control-h);
  padding: 0 var(--space-4);
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  text-decoration: none;
  transition: background var(--transition-fast);
}

.limit-cta:hover {
  background: var(--color-primary-hover);
}

/* ── Responsivo ─────────────────────────────────────────── */


@media (max-width: 768px) {
  .sankey {
    flex-direction: column;
    gap: var(--space-4);
    height: auto !important;
  }

  .sankey-col-left,
  .sankey-col-right {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: 100%;
  }

  .sankey-col-left .sankey-node {
    justify-content: flex-start;
  }

  .sankey-col-left .sankey-label-left {
    order: 1;
    align-items: flex-start;
    text-align: left;
  }

  .sankey-node {
    position: static;
    height: 28px !important;
  }

  .sankey-svg {
    display: none;
  }

  .sankey-col-center {
    width: 100%;
  }

  .sankey-center {
    height: auto !important;
  }

  .sankey-center-bar {
    display: none;
  }
}

@media (max-width: 560px) {
  .ui-toolbar,
  .ui-toolbar-group {
    align-items: stretch;
  }

  .ui-toolbar > :deep(.seg) {
    width: 100%;
    overflow-x: auto;
  }

  

  .name-cell {
    max-width: 200px;
  }
}
</style>
