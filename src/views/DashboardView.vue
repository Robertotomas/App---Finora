<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { ExpenseByCategory, IncomeByCategory, MonthlyTrend } from '@/types/dashboard'
import { dashboardApi } from '@/api/dashboard'
import type { DailyBalancePoint } from '@/api/dashboard'
import type { SavingsObjectiveActive, SavingsObjectiveHistory } from '@/types/objective'
import { objectivesApi } from '@/api/objectives'
import { useHouseholdStore } from '@/stores/household'
import { useAccountsStore } from '@/stores/accounts'
import { useSubscriptionStore } from '@/stores/subscription'
import { useTransactionsStore } from '@/stores/transactions'
import { TransactionType, TRANSACTION_CATEGORY_LABELS } from '@/types/transaction'
import { useDashboard } from '@/composables/useDashboard'
import { useMonthlyBudget } from '@/composables/useMonthlyBudget'
import { ACCOUNT_TYPE_LABELS, AccountType } from '@/types/account'

function isCreditCard(type: number): boolean {
  return Number(type) === AccountType.CreditCard
}

function accountTypeLabel(type: number): string {
  return ACCOUNT_TYPE_LABELS[type as AccountType] ?? ''
}
import ExpensesPieChart from '@/components/charts/ExpensesPieChart.vue'
import IncomePieChart from '@/components/charts/IncomePieChart.vue'
import MonthlyLineChart from '@/components/charts/MonthlyLineChart.vue'
import NetWorthChart from '@/components/charts/NetWorthChart.vue'
import IncomeVsExpensesBarChart from '@/components/charts/IncomeVsExpensesBarChart.vue'

const router = useRouter()
const householdStore = useHouseholdStore()
const accountsStore = useAccountsStore()
const subscriptionStore = useSubscriptionStore()
const transactionsStore = useTransactionsStore()
const dashboard = useDashboard()
const budget = useMonthlyBudget()
const mounted = ref(false)
const loadError = ref<string | null>(null)
const isDev = import.meta.env.DEV
const periodChangeLoading = ref(false)
const dashboardContentRef = ref<HTMLElement | null>(null)

const objectivesLoading = ref(false)
const objectivesLoaded = ref(false)
const objectivesPreview = ref<SavingsObjectiveActive[]>([])
const objectivesActiveTotal = ref(0)
const objectivesMoreCount = computed(() => Math.max(0, objectivesActiveTotal.value - 3))
const objectivesReserved = ref(0)
const objectivesTotalSavings = ref(0)
const objectivesCompletedCount = ref(0)
const objectivesHistory = ref<SavingsObjectiveHistory[]>([])
const settleModalOpen = ref(false)
const settleConfirmId = ref<string | null>(null)
const settleLoading = ref(false)

function parseTargetDateOnly(raw: unknown): string | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'string') {
    const s = raw.slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  }
  return null
}

function mapActiveObjectivesFromOverview(payload: unknown): SavingsObjectiveActive[] {
  const raw = (payload ?? {}) as Record<string, unknown>
  const pick = (key: string) => raw[key] ?? raw[key.charAt(0).toUpperCase() + key.slice(1)]
  const list = pick('activeObjectives')
  if (!Array.isArray(list)) return []
  return list
    .map((x) => {
      const item = x as Record<string, unknown>
      return {
        id: String(item.id ?? item.Id ?? ''),
        name: String(item.name ?? item.Name ?? ''),
        targetAmount: Number(item.targetAmount ?? item.TargetAmount) || 0,
        targetDate: parseTargetDateOnly(item.targetDate ?? item.TargetDate),
        sortOrder: Number(item.sortOrder ?? item.SortOrder) || 0,
        allocatedAmount: Number(item.allocatedAmount ?? item.AllocatedAmount) || 0,
        progressPercent: Number(item.progressPercent ?? item.ProgressPercent) || 0,
        canFinalize: Boolean(item.canFinalize ?? item.CanFinalize),
      } as SavingsObjectiveActive
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

async function loadObjectivesPreview() {
  objectivesLoading.value = true
  try {
    const { data } = await objectivesApi.getOverview()
    const raw = (data ?? {}) as unknown as Record<string, unknown>
    const pick = (key: string) => raw[key] ?? raw[key.charAt(0).toUpperCase() + key.slice(1)]

    const all = mapActiveObjectivesFromOverview(data)
    objectivesActiveTotal.value = all.length

    objectivesReserved.value = Number(pick('reservedByCompletedObjectives')) || 0
    objectivesTotalSavings.value = Number(pick('totalSavings')) || 0

    // totalSavings is already the remaining after completed objectives were "spent"
    // Distribute it across active objectives by sortOrder priority
    const available = Math.max(0, objectivesTotalSavings.value)
    if (available > 0 && all.length > 0) {
      for (const goal of all) {
        const allocated = Math.min(available, goal.targetAmount)
        goal.allocatedAmount = allocated
        goal.progressPercent = goal.targetAmount > 0 ? (allocated / goal.targetAmount) * 100 : 0
      }
    }

    objectivesPreview.value = all.slice(0, 3)

    const history = pick('historyObjectives')
    objectivesCompletedCount.value = Array.isArray(history) ? history.length : 0
    objectivesHistory.value = Array.isArray(history) ? history.map((h: Record<string, unknown>) => ({
      id: String(h.id ?? h.Id ?? ''),
      name: String(h.name ?? h.Name ?? ''),
      targetAmount: Number(h.targetAmount ?? h.TargetAmount ?? 0),
      targetDate: parseTargetDateOnly(h.targetDate ?? h.TargetDate),
      sortOrder: Number(h.sortOrder ?? h.SortOrder ?? 0),
      completedAt: String(h.completedAt ?? h.CompletedAt ?? ''),
    })) : []
  } catch {
    objectivesPreview.value = []
    objectivesActiveTotal.value = 0
    objectivesReserved.value = 0
    objectivesTotalSavings.value = 0
    objectivesCompletedCount.value = 0
    objectivesHistory.value = []
  } finally {
    objectivesLoading.value = false
    objectivesLoaded.value = true
  }
}

watch(
  () => subscriptionStore.limits.objectivesEnabled,
  async () => {
    if (!householdStore.household) return
    await loadObjectivesPreview()
  }
)

function formatObjectiveDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-PT')
}

const now = new Date()
const selectedYear = ref(now.getFullYear())
const selectedMonth = ref(now.getMonth() + 1)

async function onPeriodChange() {
  periodChangeLoading.value = true
  await nextTick()
  try {
    dashboard.setPeriod(selectedYear.value, selectedMonth.value)
    dashboard.invalidateCache()
    await dashboard.fetch(true)
  } finally {
    periodChangeLoading.value = false
  }
}

/* ── Dashboard Date Range Picker ── */
const dashDatePickerOpen = ref(false)
const dashDatePickerRef = ref<HTMLElement | null>(null)
const dashActivePreset = ref<string>('month')
const PICKER_MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const PICKER_WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const dashPickerLeftYear = ref(now.getFullYear())
const dashPickerLeftMonth = ref(now.getMonth())
const dashPickerRightYear = computed(() => dashPickerLeftMonth.value === 11 ? dashPickerLeftYear.value + 1 : dashPickerLeftYear.value)
const dashPickerRightMonth = computed(() => dashPickerLeftMonth.value === 11 ? 0 : dashPickerLeftMonth.value + 1)

const dashFilterFrom = ref('')
const dashFilterTo = ref('')
const dashPickerSelectStep = ref<'from' | 'to'>('from')

// Init to current month
;(() => {
  const y = now.getFullYear(), m = now.getMonth()
  dashFilterFrom.value = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const last = new Date(y, m + 1, 0)
  dashFilterTo.value = `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
})()

function calendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay()
  const startOffset = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells
}

function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const dashLeftDays = computed(() => calendarDays(dashPickerLeftYear.value, dashPickerLeftMonth.value))
const dashRightDays = computed(() => calendarDays(dashPickerRightYear.value, dashPickerRightMonth.value))

function dashIsInRange(y: number, m: number, d: number): boolean {
  if (!dashFilterFrom.value || !dashFilterTo.value) return false
  const ds = toDateStr(y, m, d)
  return ds >= dashFilterFrom.value && ds <= dashFilterTo.value
}
function dashIsStart(y: number, m: number, d: number): boolean { return toDateStr(y, m, d) === dashFilterFrom.value }
function dashIsEnd(y: number, m: number, d: number): boolean { return toDateStr(y, m, d) === dashFilterTo.value }

function dashPickerPrevMonth() {
  if (dashPickerLeftMonth.value === 0) { dashPickerLeftMonth.value = 11; dashPickerLeftYear.value-- }
  else dashPickerLeftMonth.value--
}
function dashPickerNextMonth() {
  if (dashPickerLeftMonth.value === 11) { dashPickerLeftMonth.value = 0; dashPickerLeftYear.value++ }
  else dashPickerLeftMonth.value++
}

function dashPickDay(y: number, m: number, d: number) {
  const ds = toDateStr(y, m, d)
  dashActivePreset.value = ''
  if (dashPickerSelectStep.value === 'from') {
    dashFilterFrom.value = ds
    dashFilterTo.value = ''
    dashPickerSelectStep.value = 'to'
  } else {
    if (ds < dashFilterFrom.value) {
      dashFilterFrom.value = ds
      dashFilterTo.value = ''
      dashPickerSelectStep.value = 'to'
    } else {
      dashFilterTo.value = ds
      dashPickerSelectStep.value = 'from'
      dashDatePickerOpen.value = false
      applyDashDateFilter()
    }
  }
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dashApplyPreset(preset: string) {
  const today = new Date()
  dashActivePreset.value = preset
  dashFilterTo.value = localDateStr(today)

  if (preset === 'month') {
    dashFilterFrom.value = localDateStr(new Date(today.getFullYear(), today.getMonth(), 1))
  } else if (preset === '30d') {
    const d = new Date(); d.setDate(d.getDate() - 30)
    dashFilterFrom.value = localDateStr(d)
  } else if (preset === '3m') {
    const d = new Date(); d.setMonth(d.getMonth() - 3)
    dashFilterFrom.value = localDateStr(d)
  } else if (preset === 'year') {
    dashFilterFrom.value = localDateStr(new Date(today.getFullYear(), 0, 1))
  } else if (preset === 'all') {
    dashFilterFrom.value = ''
    dashFilterTo.value = ''
  }

  dashDatePickerOpen.value = false
  applyDashDateFilter()
}

function applyDashDateFilter() {
  // Map the date range to dashboard setPeriod
  const preset = dashActivePreset.value
  if (preset === 'all') {
    selectedYear.value = 0
    selectedMonth.value = 0
  } else if (preset === 'month') {
    selectedYear.value = now.getFullYear()
    selectedMonth.value = now.getMonth() + 1
  } else if (preset === 'year') {
    selectedYear.value = now.getFullYear()
    selectedMonth.value = -1
  } else {
    // Custom range or 30d/3m: use year=0 (all) as the API doesn't support arbitrary ranges
    // But we can try to match a specific month if from/to span exactly one month
    if (dashFilterFrom.value && dashFilterTo.value) {
      const from = new Date(dashFilterFrom.value + 'T00:00:00')
      const to = new Date(dashFilterTo.value + 'T00:00:00')
      // Check if it's exactly one calendar month
      if (from.getDate() === 1) {
        const lastOfMonth = new Date(from.getFullYear(), from.getMonth() + 1, 0)
        if (to.getDate() === lastOfMonth.getDate() && to.getMonth() === from.getMonth() && to.getFullYear() === from.getFullYear()) {
          selectedYear.value = from.getFullYear()
          selectedMonth.value = from.getMonth() + 1
          onPeriodChange()
          return
        }
      }
      // Check if it spans a full year
      if (from.getMonth() === 0 && from.getDate() === 1 && to.getMonth() === 11 && to.getDate() === 31 && from.getFullYear() === to.getFullYear()) {
        selectedYear.value = from.getFullYear()
        selectedMonth.value = 0
        onPeriodChange()
        return
      }
    }
    // Fallback: use all-time
    selectedYear.value = 0
    selectedMonth.value = 0
  }
  onPeriodChange()
}

function toggleDashDatePicker() {
  dashDatePickerOpen.value = !dashDatePickerOpen.value
  if (dashDatePickerOpen.value) {
    if (dashFilterFrom.value) {
      const d = new Date(dashFilterFrom.value + 'T00:00:00')
      dashPickerLeftYear.value = d.getFullYear()
      dashPickerLeftMonth.value = d.getMonth()
    }
    dashPickerSelectStep.value = !dashFilterTo.value ? 'to' : 'from'
  }
}

const dashPresetLabels: Record<string, string> = { month: 'Este mês', '30d': '30 dias', '3m': '3 meses', year: 'Este ano', all: 'Desde sempre' }

const dashDatePickerLabel = computed(() => {
  if (dashActivePreset.value && dashPresetLabels[dashActivePreset.value]) return dashPresetLabels[dashActivePreset.value]
  if (!dashFilterFrom.value && !dashFilterTo.value) return 'Selecionar período'
  const fmt = (s: string) => {
    const d = new Date(s + 'T00:00:00')
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  if (dashFilterFrom.value && dashFilterTo.value) return `${fmt(dashFilterFrom.value)} – ${fmt(dashFilterTo.value)}`
  if (dashFilterFrom.value) return `${fmt(dashFilterFrom.value)} – ...`
  return 'Selecionar período'
})

function onDashDatePickerOutsideClick(e: MouseEvent) {
  if (!dashDatePickerOpen.value || !dashDatePickerRef.value) return
  if (!dashDatePickerRef.value.contains(e.target as Node)) dashDatePickerOpen.value = false
}

onMounted(() => document.addEventListener('click', onDashDatePickerOutsideClick, true))
onUnmounted(() => document.removeEventListener('click', onDashDatePickerOutsideClick, true))

onMounted(async () => {
  try {
    const timeout = (ms: number) =>
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), ms)
      )

    await Promise.race([
      (async () => {
        await householdStore.fetchHousehold()
        if (householdStore.household) {
          dashboard.setPeriod(selectedYear.value, selectedMonth.value)
          dashboard.invalidateCache()
          await Promise.all([
            dashboard.fetch(true).then(() => {
              const trend = dashboard.monthlyTrend.value
              if (trend.length > 0) {
                trendChartData.value = trend
              }
            }),
            accountsStore.fetchAccounts(),
            loadObjectivesPreview(),
            subscriptionStore.fetchSubscription(),
            transactionsStore.fetchTransactions({ limit: 5 }),
            fetchDailyBalance(),
          ])
        }
      })(),
      timeout(15000),
    ])
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro desconhecido'
    if (msg === 'Timeout') {
      loadError.value = 'O pedido demorou demasiado. Verifica se a API está a correr em http://localhost:5000'
    } else {
      const dashErr = dashboard.error.value
      const houseErr = householdStore.error && typeof householdStore.error === 'object' && 'value' in householdStore.error
        ? (householdStore.error as { value: string }).value
        : ''
      loadError.value = dashErr || houseErr || 'Erro ao carregar o dashboard.'
    }
  } finally {
    mounted.value = true
  }
})

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

const formattedIncome = computed(() => formatCurrency(dashboard.monthlyIncome.value, dashboard.currency.value))
const formattedExpenses = computed(() => formatCurrency(dashboard.monthlyExpenses.value, dashboard.currency.value))
const formattedSavings = computed(() => formatCurrency(dashboard.monthlySavings.value, dashboard.currency.value))

const recentTransactions = computed(() => transactionsStore.transactions.slice(0, 5))

const expensesForChart = computed<ExpenseByCategory[]>(() => dashboard.expensesForChart?.value ?? [])
const incomeForChart = computed<IncomeByCategory[]>(() => dashboard.incomeForChart?.value ?? [])
const periodLabel = computed(() => {
  if (dashActivePreset.value === 'all') return 'Desde sempre'
  if (dashActivePreset.value === 'month') return 'Este mês'
  if (dashActivePreset.value === '30d') return 'Últimos 30 dias'
  if (dashActivePreset.value === '3m') return 'Últimos 3 meses'
  if (dashActivePreset.value === 'year') return 'Este ano'
  if (dashFilterFrom.value && dashFilterTo.value) {
    const fmt = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
    return `${fmt(dashFilterFrom.value)} – ${fmt(dashFilterTo.value)}`
  }
  return ''
})

const isSingleMonth = computed(() => {
  if (selectedMonth.value >= 1 && selectedMonth.value <= 12) return true
  return false
})

/* Contas e património: sempre dados atuais (não afetados pelo filtro) */
const accountsToShow = computed(() =>
  [...accountsStore.accounts].sort((a, b) => b.balance - a.balance)
)

const currentTotalBalance = computed(() =>
  accountsStore.accounts.reduce((sum, a) => sum + a.balance, 0)
)

const hasChartData = computed(
  () => dashboard.monthlyIncome.value > 0 || dashboard.monthlyExpenses.value > 0
)
const hasExpensesForChart = computed(() => dashboard.monthlyExpenses.value > 0)
const hasIncomeForChart = computed(() => dashboard.monthlyIncome.value > 0)

const budgetForPeriod = computed(() => {
  budget.budgetStore.value // reactive dependency
  const hid = householdStore.household?.id
  if (!hid) return { expectedIncome: 0, expectedExpenses: 0 }
  if (selectedMonth.value === -1 && selectedYear.value > 0) {
    const n = new Date()
    const end = selectedYear.value < n.getFullYear() ? 12 : selectedYear.value > n.getFullYear() ? 0 : n.getMonth() + 1
    if (end === 0) return { expectedIncome: 0, expectedExpenses: 0 }
    let expectedIncome = 0
    let expectedExpenses = 0
    for (let m = 1; m <= end; m++) {
      const b = budget.getBudget(hid, selectedYear.value, m)
      expectedIncome += b.expectedIncome
      expectedExpenses += b.expectedExpenses
    }
    return { expectedIncome, expectedExpenses }
  }
  return budget.getBudget(hid, selectedYear.value, selectedMonth.value)
})

const hasBudgetForPeriod = computed(() => {
  budget.budgetStore.value
  const hid = householdStore.household?.id
  if (!hid) return false
  if (selectedMonth.value === -1 && selectedYear.value > 0) {
    const n = new Date()
    const end = selectedYear.value < n.getFullYear() ? 12 : selectedYear.value > n.getFullYear() ? 0 : n.getMonth() + 1
    if (end === 0) return false
    for (let m = 1; m <= end; m++) {
      if (budget.hasBudget(hid, selectedYear.value, m)) return true
    }
    return false
  }
  return budget.hasBudget(hid, selectedYear.value, selectedMonth.value)
})

const savingsRate = computed(() => {
  const inc = dashboard.monthlyIncome.value
  const sav = dashboard.monthlySavings.value
  return inc > 0 ? Math.round((sav / inc) * 100) : 0
})

function formatPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${value}%`
}

/* ── Média diária de gastos + projeção ── */
const dailyAverage = computed(() => {
  const expenses = dashboard.monthlyExpenses.value
  if (expenses <= 0) return null

  const now = new Date()
  const y = selectedYear.value || now.getFullYear()
  const m = selectedMonth.value

  // Only show for single month view
  if (m < 1 || m > 12) return null

  const today = now.getDate()
  const isCurrentMonth = y === now.getFullYear() && m === now.getMonth() + 1
  const daysInMonth = new Date(y, m, 0).getDate()
  const daysPassed = isCurrentMonth ? today : daysInMonth

  const avg = expenses / daysPassed
  const projected = isCurrentMonth ? avg * daysInMonth : expenses

  return {
    avg,
    projected,
    daysPassed,
    daysInMonth,
    isCurrentMonth,
  }
})

/* ── Património Total: account category groups ── */
const accountCategoryGroups = computed(() => {
  const accs = accountsToShow.value
  const total = accs.reduce((s, a) => s + Math.abs(a.balance), 0)

  const groups = [
    {
      label: 'Dinheiro e poupanças',
      types: [AccountType.Bank, AccountType.Cash, AccountType.Savings],
      sum: 0,
    },
    {
      label: 'Ações e fundos',
      types: [AccountType.Investment],
      sum: 0,
    },
    {
      label: 'Outros',
      types: [AccountType.CreditCard, AccountType.Other],
      sum: 0,
    },
  ]

  for (const acc of accs) {
    const g = groups.find((g) => g.types.includes(acc.type as AccountType))
    if (g) g.sum += acc.balance
    else groups[2].sum += acc.balance
  }

  return groups.map((g) => ({
    label: g.label,
    value: g.sum,
    percent: total > 0 ? (Math.abs(g.sum) / total) * 100 : 0,
  }))
})

const totalAllocatedToObjectives = computed(() => objectivesReserved.value)

function openSettleModal() { settleModalOpen.value = true; settleConfirmId.value = null }
function closeSettleModal() { settleModalOpen.value = false; settleConfirmId.value = null }

function onSettleLiquidar(id: string) {
  settleConfirmId.value = id
}

async function onSettleConfirmYes() {
  if (!settleConfirmId.value) return
  settleLoading.value = true
  try {
    await objectivesApi.delete(settleConfirmId.value)
    await loadObjectivesPreview()
    settleConfirmId.value = null
    if (objectivesHistory.value.length === 0) closeSettleModal()
  } catch {
    // handled
  } finally {
    settleLoading.value = false
  }
}

function onSettleConfirmNo() {
  closeSettleModal()
  router.push({ name: 'movimentos', query: { tab: 'movements' } })
}

function onSettleCancelConfirm() {
  settleConfirmId.value = null
}

// Card order (drag-and-drop via pointer events)
const CARD_ORDER_KEY = 'finora-dashboard-card-order'
const defaultCardOrder = ['accounts', 'objectives', 'movements']
const cardOrder = ref<string[]>([...defaultCardOrder])
const cardEditMode = ref(false)
const draggedCard = ref<string | null>(null)
const staticGridRef = ref<HTMLElement | null>(null)

let floatingEl: HTMLElement | null = null
const dragOffset = { x: 0, y: 0 }

function loadCardOrder() {
  try {
    const saved = localStorage.getItem(CARD_ORDER_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length === 3 && defaultCardOrder.every(c => parsed.includes(c))) {
        cardOrder.value = parsed
      }
    }
  } catch { /* ignore */ }
}

function saveCardOrder() {
  localStorage.setItem(CARD_ORDER_KEY, JSON.stringify(cardOrder.value))
}

let cardOrderBeforeEdit: string[] = []

function toggleCardEditMode() {
  if (!cardEditMode.value) {
    cardOrderBeforeEdit = [...cardOrder.value]
  }
  cardEditMode.value = !cardEditMode.value
  if (!cardEditMode.value) {
    cleanupDrag()
  }
}

function cancelCardEdit() {
  cardOrder.value = [...cardOrderBeforeEdit]
  saveCardOrder()
  cardEditMode.value = false
  cleanupDrag()
}

function onCardPointerDown(e: PointerEvent, cardId: string) {
  if (!cardEditMode.value || e.button !== 0) return
  e.preventDefault()

  const card = e.currentTarget as HTMLElement
  const rect = card.getBoundingClientRect()

  draggedCard.value = cardId
  dragOffset.x = e.clientX - rect.left
  dragOffset.y = e.clientY - rect.top

  // Create floating clone
  const clone = card.cloneNode(true) as HTMLElement
  clone.className = 'dashboard-section-card static-card card-floating'
  clone.style.width = rect.width + 'px'
  clone.style.left = (e.clientX - dragOffset.x) + 'px'
  clone.style.top = (e.clientY - dragOffset.y) + 'px'
  document.body.appendChild(clone)
  floatingEl = clone

  document.addEventListener('pointermove', onDocPointerMove)
  document.addEventListener('pointerup', onDocPointerUp)
}

function onDocPointerMove(e: PointerEvent) {
  if (!floatingEl || !draggedCard.value) return

  floatingEl.style.left = (e.clientX - dragOffset.x) + 'px'
  floatingEl.style.top = (e.clientY - dragOffset.y) + 'px'

  // Detect target column based on mouse position in the grid
  const grid = staticGridRef.value
  if (!grid) return
  const gridRect = grid.getBoundingClientRect()
  const relX = e.clientX - gridRect.left
  const colWidth = gridRect.width / cardOrder.value.length
  const targetIdx = Math.min(cardOrder.value.length - 1, Math.max(0, Math.floor(relX / colWidth)))

  const currentIdx = cardOrder.value.indexOf(draggedCard.value)
  if (targetIdx !== currentIdx) {
    const arr = [...cardOrder.value]
    arr.splice(currentIdx, 1)
    arr.splice(targetIdx, 0, draggedCard.value)
    cardOrder.value = arr
  }
}

function onDocPointerUp() {
  if (draggedCard.value) saveCardOrder()
  cleanupDrag()
}

function cleanupDrag() {
  draggedCard.value = null
  if (floatingEl) {
    floatingEl.remove()
    floatingEl = null
  }
  document.removeEventListener('pointermove', onDocPointerMove)
  document.removeEventListener('pointerup', onDocPointerUp)
}

loadCardOrder()

const hideValues = ref(false)


/* ── Net worth chart period filter ── */
type ChartPeriod = 'YTD' | '3M' | '6M' | '1A' | '5A'
const chartPeriod = ref<ChartPeriod>('6M')
const chartPeriods: ChartPeriod[] = ['YTD', '3M', '6M', '1A', '5A']

const dailyBalancePoints = ref<DailyBalancePoint[]>([])
const chartLoading = ref(false)

const chartDays = computed(() => {
  if (chartPeriod.value === 'YTD') {
    const now = new Date()
    const start = new Date(now.getFullYear(), 0, 1)
    return Math.ceil((now.getTime() - start.getTime()) / 86400000)
  }
  const map: Record<string, number> = { '3M': 90, '6M': 180, '1A': 365, '5A': 1825 }
  return map[chartPeriod.value] ?? 180
})

async function fetchDailyBalance() {
  chartLoading.value = true
  try {
    const response = await dashboardApi.getDailyBalance(chartDays.value)
    const res = (response.data ?? response) as unknown as Record<string, unknown>
    const get = (key: string) => res[key] ?? res[key.charAt(0).toUpperCase() + key.slice(1)]
    const pts = get('points')
    if (Array.isArray(pts)) {
      dailyBalancePoints.value = pts.map((x: Record<string, unknown>) => ({
        date: String(x.date ?? x.Date ?? ''),
        balance: Number(x.balance ?? x.Balance) || 0,
      }))
    }
  } catch {
    // keep existing data
  } finally {
    chartLoading.value = false
  }
}

watch(chartPeriod, () => fetchDailyBalance())

const chartHoverPoint = ref<{ date: string; balance: number } | null>(null)

function onChartHover(point: { date: string; balance: number } | null) {
  chartHoverPoint.value = point
}

const heroDisplayBalance = computed(() => {
  if (chartHoverPoint.value) return chartHoverPoint.value.balance
  return currentTotalBalance.value
})

const heroDisplayDate = computed(() => {
  if (chartHoverPoint.value) {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    if (chartHoverPoint.value.date === todayStr) return 'Hoje'
    const d = new Date(chartHoverPoint.value.date + 'T00:00:00')
    return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  return 'Hoje'
})

/* ── Seletor de período para gráficos de tendência (line + bar) ── */
type TrendChartPeriod = 'YTD' | '3M' | '6M' | '1A' | '5A'
const trendChartPeriod = ref<TrendChartPeriod>('6M')
const trendChartPeriods: TrendChartPeriod[] = ['YTD', '3M', '6M', '1A', '5A']
const trendChartData = ref<MonthlyTrend[]>([])
const trendChartLoading = ref(false)

const trendChartMonths = computed(() => {
  if (trendChartPeriod.value === 'YTD') return new Date().getMonth() + 1
  const map: Record<TrendChartPeriod, number> = { YTD: 0, '3M': 3, '6M': 6, '1A': 12, '5A': 60 }
  return map[trendChartPeriod.value]
})

async function fetchTrendChartData() {
  trendChartLoading.value = true
  try {
    const response = await import('@/api/dashboard').then((m) =>
      m.dashboardApi.get({ trendMonths: trendChartMonths.value })
    )
    const res = (((response as unknown as Record<string, unknown>).data) ?? response) as Record<string, unknown>
    const get = (key: string) => res[key] ?? res[key.charAt(0).toUpperCase() + key.slice(1)]
    const arr = get('monthlyTrend')
    if (Array.isArray(arr)) {
      trendChartData.value = arr.map((x: Record<string, unknown>) => ({
        year: Number(x.year ?? x.Year) || 0,
        month: Number(x.month ?? x.Month) || 0,
        label: String(x.label ?? x.Label ?? ''),
        income: Number(x.income ?? x.Income) || 0,
        expenses: Number(x.expenses ?? x.Expenses) || 0,
        savings: Number(x.savings ?? x.Savings) || 0,
      }))
    }
  } catch { /* keep existing */ }
  finally { trendChartLoading.value = false }
}

watch(trendChartPeriod, () => fetchTrendChartData())

const showContent = computed(() =>
  mounted.value &&
  !loadError.value &&
  !!householdStore.household &&
  !!dashboard.data?.value
)
</script>

<template>
  <div class="dashboard" :data-dev="isDev">
    <!-- Overlay loading -->
    <transition name="fade">
      <div v-if="!mounted || (householdStore.loading && !householdStore.household) || (dashboard.loading && !dashboard.data)" class="loading-overlay">
        <div class="spinner"></div>
        <p>A carregar...</p>
      </div>
    </transition>

    <div v-if="loadError" class="error-state">
      <p>{{ loadError }}</p>
      <p class="error-hint">Abre a consola do browser (F12) e o separador Network para verificar os pedidos à API.</p>
    </div>

    <div v-else-if="!householdStore.household && !householdStore.loading && mounted" class="empty-state">
      <p>Configura primeiro o teu household.</p>
      <router-link to="/household" class="link">Ir para Household</router-link>
    </div>

    <div v-else-if="dashboard.error" class="error-state">
      <p>{{ dashboard.error }}</p>
    </div>

    <div v-if="showContent" ref="dashboardContentRef" class="dashboard-content">

      <!-- ═══ PATRIMÔNIO TOTAL — Hero Section ═══ -->
      <div class="patrimonio-hero">
        <div class="patrimonio-top">
          <div class="patrimonio-info">
            <span class="patrimonio-label-row">
              <span class="patrimonio-label">PATRIMÔNIO TOTAL</span>
              <button class="patrimonio-eye-btn" @click="hideValues = !hideValues" :title="hideValues ? 'Mostrar valores' : 'Esconder valores'">
                <svg v-if="!hideValues" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>
              </button>
            </span>
            <p class="patrimonio-value">{{ hideValues ? '••••••' : formatCurrency(heroDisplayBalance, dashboard.currency.value) }}</p>
            <span class="patrimonio-date">{{ heroDisplayDate }}</span>
            <span v-if="totalAllocatedToObjectives > 0" class="patrimonio-reserved">
              {{ hideValues ? '•••••' : formatCurrency(totalAllocatedToObjectives, dashboard.currency.value) }} reservado para objetivos
              <button type="button" class="settle-btn" @click="openSettleModal" title="Liquidar objetivos concluídos">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
              </button>
            </span>
          </div>
          <div class="patrimonio-periods">
            <button
              v-for="p in chartPeriods"
              :key="p"
              class="patrimonio-period-btn"
              :class="{ active: chartPeriod === p }"
              @click="chartPeriod = p"
            >{{ p }}</button>
          </div>
        </div>

        <div class="patrimonio-body">
          <div class="patrimonio-categories">
            <div
              v-for="group in accountCategoryGroups"
              :key="group.label"
              class="patrimonio-cat-row"
            >
              <span class="patrimonio-cat-name">{{ group.label }}</span>
              <div class="patrimonio-cat-values">
                <span class="patrimonio-cat-amount">{{ hideValues ? '••••• €' : formatCurrency(group.value, dashboard.currency.value) }}</span>
                <span class="patrimonio-cat-percent">{{ group.percent.toFixed(2) }}% do total</span>
              </div>
            </div>
          </div>
          <div class="patrimonio-chart-area">
            <div v-if="chartLoading" class="patrimonio-chart-loading">
              <div class="spinner"></div>
            </div>
            <NetWorthChart
              v-else-if="dailyBalancePoints.length > 0"
              :points="dailyBalancePoints"
              :currency="dashboard.currency.value"
              :hide-values="hideValues"
              :period="chartPeriod"
              @hover="onChartHover"
            />
            <div v-else class="patrimonio-chart-empty">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="patrimonio-chart-empty-icon"><line x1="3" x2="3" y1="3" y2="21"/><line x1="3" x2="21" y1="21" y2="21"/><line x1="7" x2="7" y1="17" y2="13"/><line x1="12" x2="12" y1="17" y2="8"/><line x1="17" x2="17" y1="17" y2="11"/></svg>
              <p>Sem dados de evolução disponíveis para mostrar</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ STATIC GRID: Contas + Objetivos (dados atuais) ═══ -->
      <div class="static-grid-header">
        <template v-if="cardEditMode">
          <button type="button" class="card-cancel-btn" @click="cancelCardEdit">Cancelar</button>
          <button type="button" class="card-done-btn" @click="toggleCardEditMode">Concluído</button>
        </template>
        <button v-else type="button" class="card-edit-btn" @click="toggleCardEditMode" title="Reorganizar cards">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
          <span>Editar</span>
        </button>
      </div>
      <div ref="staticGridRef" class="static-grid" :class="{ editing: cardEditMode }">
        <template v-for="cardId in cardOrder" :key="cardId">

        <!-- Card: Contas -->
        <div
          v-if="cardId === 'accounts'"
          class="dashboard-section-card static-card"
          :class="{ 'card-editing': cardEditMode, 'card-drag-placeholder': draggedCard === 'accounts' }"
          @pointerdown="onCardPointerDown($event, 'accounts')"
        >
          <div class="static-card-header">
            <h2 class="section-title">Contas bancárias</h2>
            <div class="static-card-header-actions">
              <span v-if="cardEditMode" class="card-drag-handle" title="Arrastar para reordenar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg>
              </span>
              <router-link v-else :to="{ name: 'contas' }" class="static-card-link" title="Ver todas"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></router-link>
            </div>
          </div>
          <div v-if="accountsToShow.length > 0" class="accounts-list">
            <router-link
              v-for="account in accountsToShow.slice(0, 4)"
              :key="account.id"
              :to="{ name: 'contas' }"
              class="account-row"
            >
              <div class="account-row-info">
                <span v-if="isCreditCard(account.type)" class="account-row-icon" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
                  </svg>
                </span>
                <div>
                  <p class="account-row-name">{{ account.name }}</p>
                  <span class="account-row-type">{{ accountTypeLabel(account.type) }}</span>
                </div>
              </div>
              <span class="account-row-balance" :class="{ negative: !hideValues && account.balance < 0 }">
                {{ hideValues ? '••••• €' : formatCurrency(account.balance, account.currency) }}
              </span>
            </router-link>
          </div>
          <div v-else class="static-card-empty">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="static-card-empty-icon"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/><circle cx="17" cy="15" r="1.5"/></svg>
            <p>Vê o saldo das tuas contas num só lugar</p>
            <router-link to="/contas?action=new" class="static-card-action">Adicionar</router-link>
          </div>
        </div>

        <!-- Card: Objetivos -->
        <div
          v-else-if="cardId === 'objectives'"
          class="dashboard-section-card static-card"
          :class="{ 'card-editing': cardEditMode, 'card-drag-placeholder': draggedCard === 'objectives' }"
          @pointerdown="onCardPointerDown($event, 'objectives')"
        >
          <div class="static-card-header">
            <h2 class="section-title">Objetivos de poupança</h2>
            <div class="static-card-header-actions">
              <span v-if="cardEditMode" class="card-drag-handle" title="Arrastar para reordenar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg>
              </span>
              <router-link v-else :to="{ name: 'objetivos' }" class="static-card-link" title="Ver todos"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></router-link>
            </div>
          </div>
          <div
            class="dashboard-objectives-body-wrap"
            :class="{
              'dashboard-objectives-body-wrap--locked':
                !subscriptionStore.canAccessObjectives && objectivesPreview.length > 0,
            }"
          >
            <div class="dashboard-objectives-body-inner">
              <div v-if="objectivesLoading" class="objectives-preview-skeleton">
                <span class="objectives-preview-loading">A carregar objetivos…</span>
              </div>
              <div v-else-if="objectivesPreview.length > 0" class="objectives-preview-block">
                <div class="objectives-list">
                  <router-link
                    v-for="goal in objectivesPreview"
                    :key="goal.id"
                    :to="{ name: 'objetivos' }"
                    class="objective-row"
                  >
                    <div class="objective-row-top">
                      <span class="objective-row-name">{{ goal.name }}</span>
                      <span class="objective-row-amounts">
                        {{ hideValues ? '••••• / •••••' : `${formatCurrency(goal.allocatedAmount, dashboard.currency.value)} / ${formatCurrency(goal.targetAmount, dashboard.currency.value)}` }}
                      </span>
                    </div>
                    <div class="objective-preview-track" role="progressbar" :aria-valuenow="goal.progressPercent" aria-valuemin="0" aria-valuemax="100">
                      <div class="objective-preview-fill" :style="{ width: `${Math.min(100, goal.progressPercent)}%` }" />
                    </div>
                    <p class="objective-preview-meta">
                      <span>{{ goal.progressPercent.toFixed(0) }}%</span>
                      <span v-if="goal.targetDate" class="objective-preview-date"> · Meta {{ formatObjectiveDate(goal.targetDate) }}</span>
                    </p>
                  </router-link>
                </div>
                <div class="objectives-footer">
                  <p v-if="objectivesMoreCount > 0" class="objectives-more-count">
                    +{{ objectivesMoreCount }} {{ objectivesMoreCount === 1 ? 'objetivo ativo' : 'objetivos ativos' }}
                  </p>
                  <p v-if="objectivesCompletedCount > 0" class="objectives-completed-badge">
                    {{ objectivesCompletedCount }} {{ objectivesCompletedCount === 1 ? 'concluído' : 'concluídos' }}
                  </p>
                </div>
              </div>
              <div v-else-if="objectivesLoaded" class="static-card-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="static-card-empty-icon"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><line x1="22" x2="12" y1="2" y2="12"/></svg>
                <p>Define objetivos de poupança para acompanhar o teu progresso</p>
                <router-link
                  v-if="subscriptionStore.canAccessObjectives"
                  :to="{ name: 'objetivos', query: { action: 'new' } }"
                  class="static-card-action"
                >Criar objetivo</router-link>
                <router-link v-else :to="{ name: 'subscricao' }" class="static-card-action">Ver planos</router-link>
              </div>
            </div>
            <div v-if="!subscriptionStore.canAccessObjectives && objectivesPreview.length > 0" class="dashboard-objectives-lock-overlay">
              <div class="dashboard-objectives-lock-panel">
                <p class="dashboard-objectives-lock-text">Atualize o plano para visualização completa</p>
                <router-link :to="{ name: 'subscricao' }" class="btn-add-objective dashboard-objectives-lock-cta">Ver planos</router-link>
              </div>
            </div>
          </div>
        </div>

        <!-- Card: Últimos movimentos -->
        <div
          v-else-if="cardId === 'movements'"
          class="dashboard-section-card static-card"
          :class="{ 'card-editing': cardEditMode, 'card-drag-placeholder': draggedCard === 'movements' }"
          @pointerdown="onCardPointerDown($event, 'movements')"
        >
          <div class="static-card-header">
            <h2 class="section-title">Últimos movimentos</h2>
            <div class="static-card-header-actions">
              <span v-if="cardEditMode" class="card-drag-handle" title="Arrastar para reordenar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg>
              </span>
              <router-link v-else :to="{ name: 'movimentos' }" class="static-card-link" title="Ver todos"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></router-link>
            </div>
          </div>
          <div v-if="recentTransactions.length > 0" class="movements-list">
            <router-link
              v-for="tx in recentTransactions"
              :key="tx.id"
              :to="{ name: 'movimentos' }"
              class="movement-row"
            >
              <div class="movement-row-left">
                <span class="movement-row-icon" :class="tx.type === TransactionType.Income ? 'income' : 'expense'">
                  <svg v-if="tx.type === TransactionType.Income" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><line x1="12" x2="12" y1="6" y2="18"/></svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"/><line x1="12" x2="12" y1="18" y2="6"/></svg>
                </span>
                <div>
                  <p class="movement-row-desc">{{ tx.description || TRANSACTION_CATEGORY_LABELS[tx.category] || 'Transação' }}</p>
                  <span class="movement-row-date">{{ new Date(tx.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }) }}</span>
                </div>
              </div>
              <span class="movement-row-amount" :class="tx.type === TransactionType.Income ? 'income' : 'expense'">
                {{ hideValues ? '••••• €' : `${tx.type === TransactionType.Income ? '+' : '-'} ${formatCurrency(tx.amount, dashboard.currency.value)}` }}
              </span>
            </router-link>
          </div>
          <div v-else class="static-card-empty">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="static-card-empty-icon"><line x1="7" x2="7" y1="18" y2="6"/><polyline points="3 10 7 6 11 10"/><line x1="17" x2="17" y1="6" y2="18"/><polyline points="13 14 17 18 21 14"/></svg>
            <p>Nenhum movimento registado</p>
            <router-link to="/movimentos?tab=movements&action=new" class="static-card-action">Adicionar</router-link>
          </div>
        </div>
        </template>
      </div>

      <!-- ═══ TENDÊNCIAS — Card dedicado com seletor tipo patrimônio ═══ -->
      <div v-if="trendChartData.length > 0" class="dashboard-section-card">
        <div class="trend-card-top">
          <h2 class="section-title">Tendências</h2>
          <div class="patrimonio-periods">
            <button
              v-for="p in trendChartPeriods"
              :key="p"
              class="patrimonio-period-btn"
              :class="{ active: trendChartPeriod === p }"
              @click="trendChartPeriod = p"
            >{{ p }}</button>
          </div>
        </div>
        <div v-if="trendChartLoading" class="trend-loading"><div class="spinner"></div></div>
        <div v-else class="trend-card-charts">
          <div class="chart-card">
            <h3 class="chart-title">Evolução mensal</h3>
            <div class="trend-charts-scroll" :class="{ 'trend-charts-scroll--wide': trendChartData.length > 8 }">
              <div class="trend-charts-inner" :style="trendChartData.length > 8 ? { minWidth: (trendChartData.length * 80) + 'px' } : {}">
                <MonthlyLineChart :data="trendChartData" />
              </div>
            </div>
          </div>
          <div class="chart-card">
            <h3 class="chart-title">Receitas vs Despesas</h3>
            <div class="trend-charts-scroll" :class="{ 'trend-charts-scroll--wide': trendChartData.length > 8 }">
              <div class="trend-charts-inner" :style="trendChartData.length > 8 ? { minWidth: (trendChartData.length * 80) + 'px' } : {}">
                <IncomeVsExpensesBarChart :data="trendChartData" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ FILTERED SECTIONS (dados dinâmicos por período) ═══ -->
      <div class="dashboard-section-card">
        <div class="period-filter-bar">
          <div ref="dashDatePickerRef" class="date-range-picker">
            <button type="button" class="date-range-btn" @click.stop="toggleDashDatePicker">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
              <span>{{ dashDatePickerLabel }}</span>
              <svg class="date-range-chevron" :class="{ open: dashDatePickerOpen }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <Transition name="panel">
              <div v-show="dashDatePickerOpen" class="date-range-panel" @click.stop>
                <div class="dr-presets">
                  <button type="button" class="dr-preset-btn" :class="{ active: dashActivePreset === 'month' }" @click="dashApplyPreset('month')">Este mês</button>
                  <button type="button" class="dr-preset-btn" :class="{ active: dashActivePreset === '30d' }" @click="dashApplyPreset('30d')">30 dias</button>
                  <button type="button" class="dr-preset-btn" :class="{ active: dashActivePreset === '3m' }" @click="dashApplyPreset('3m')">3 meses</button>
                  <button type="button" class="dr-preset-btn" :class="{ active: dashActivePreset === 'year' }" @click="dashApplyPreset('year')">Este ano</button>
                  <button type="button" class="dr-preset-btn" :class="{ active: dashActivePreset === 'all' }" @click="dashApplyPreset('all')">Desde sempre</button>
                </div>
                <div class="date-range-calendars">
                  <div class="dr-calendar">
                    <div class="dr-cal-header">
                      <button type="button" class="dr-cal-nav" @click="dashPickerPrevMonth">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                      </button>
                      <span class="dr-cal-title">{{ PICKER_MONTH_NAMES[dashPickerLeftMonth] }} {{ dashPickerLeftYear }}</span>
                      <span style="width:28px"></span>
                    </div>
                    <div class="dr-cal-weekdays">
                      <span v-for="wd in PICKER_WEEKDAYS" :key="wd">{{ wd }}</span>
                    </div>
                    <div class="dr-cal-grid">
                      <button
                        v-for="(d, i) in dashLeftDays"
                        :key="'dl'+i"
                        type="button"
                        class="dr-day"
                        :class="{
                          empty: d === null,
                          'in-range': d !== null && dashIsInRange(dashPickerLeftYear, dashPickerLeftMonth, d),
                          'is-start': d !== null && dashIsStart(dashPickerLeftYear, dashPickerLeftMonth, d),
                          'is-end': d !== null && dashIsEnd(dashPickerLeftYear, dashPickerLeftMonth, d),
                        }"
                        :disabled="d === null"
                        @click="d !== null && dashPickDay(dashPickerLeftYear, dashPickerLeftMonth, d)"
                      >
                        {{ d ?? '' }}
                      </button>
                    </div>
                  </div>
                  <div class="dr-calendar">
                    <div class="dr-cal-header">
                      <span style="width:28px"></span>
                      <span class="dr-cal-title">{{ PICKER_MONTH_NAMES[dashPickerRightMonth] }} {{ dashPickerRightYear }}</span>
                      <button type="button" class="dr-cal-nav" @click="dashPickerNextMonth">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                      </button>
                    </div>
                    <div class="dr-cal-weekdays">
                      <span v-for="wd in PICKER_WEEKDAYS" :key="wd">{{ wd }}</span>
                    </div>
                    <div class="dr-cal-grid">
                      <button
                        v-for="(d, i) in dashRightDays"
                        :key="'dr'+i"
                        type="button"
                        class="dr-day"
                        :class="{
                          empty: d === null,
                          'in-range': d !== null && dashIsInRange(dashPickerRightYear, dashPickerRightMonth, d),
                          'is-start': d !== null && dashIsStart(dashPickerRightYear, dashPickerRightMonth, d),
                          'is-end': d !== null && dashIsEnd(dashPickerRightYear, dashPickerRightMonth, d),
                        }"
                        :disabled="d === null"
                        @click="d !== null && dashPickDay(dashPickerRightYear, dashPickerRightMonth, d)"
                      >
                        {{ d ?? '' }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
        <div v-if="periodChangeLoading" class="period-refresh-state">
          <div class="period-refresh-inner">
            <div class="spinner"></div>
            <p class="period-refresh-text">A atualizar dados do dashboard...</p>
          </div>
        </div>

        <template v-else>
        <div class="summary-cards summary-cards-fallback">
          <div class="card card-income">
            <p class="card-title card-title--with-arrow">Receitas <svg class="card-arrow card-arrow--income" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><line x1="12" x2="12" y1="6" y2="18"/></svg></p>
            <p class="card-value">{{ hideValues ? '••••• €' : formattedIncome }}</p>
            <p class="card-subtitle">{{ periodLabel }}</p>
          </div>
          <div class="card card-expense">
            <p class="card-title card-title--with-arrow">Despesas <svg class="card-arrow card-arrow--expense" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"/><line x1="12" x2="12" y1="18" y2="6"/></svg></p>
            <p class="card-value">{{ hideValues ? '••••• €' : formattedExpenses }}</p>
            <p class="card-subtitle">{{ periodLabel }}</p>
          </div>
          <div class="card card-savings">
            <p class="card-title card-title--with-arrow">Poupança <svg class="card-arrow card-arrow--savings" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2"/><path d="M2 9.1C1.7 11 2 12 2 12"/><circle cx="15.5" cy="9.5" r=".5" fill="currentColor"/></svg></p>
            <p class="card-value">{{ hideValues ? '••••• €' : formattedSavings }}</p>
            <p class="card-subtitle">{{ periodLabel }}</p>
          </div>
          <div class="card card-savings">
            <p class="card-title card-title--with-arrow">Taxa de poupança <svg class="card-arrow card-arrow--rate" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="15" y2="15"/></svg></p>
            <p class="card-value">{{ hideValues ? '•••' : formatPercent(savingsRate) }}</p>
            <p class="card-subtitle">% da receita real poupada</p>
          </div>
        </div>
        <div v-if="dailyAverage" class="daily-avg-banner">
          <div class="daily-avg-banner-left">
            <div class="daily-avg-banner-info">
              <span class="daily-avg-banner-title">
                <svg class="daily-avg-banner-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Média diária de gastos
              </span>
              <span class="daily-avg-banner-value-row">
                <span class="daily-avg-banner-value">{{ hideValues ? '••••• €' : formatCurrency(dailyAverage.avg, dashboard.currency.value) }}</span>
                <span v-if="dailyAverage.isCurrentMonth" class="daily-avg-banner-days">{{ dailyAverage.daysPassed }}/{{ dailyAverage.daysInMonth }} dias</span>
              </span>
            </div>
          </div>
          <div class="daily-avg-banner-right">
            <div v-if="dailyAverage.isCurrentMonth" class="daily-avg-banner-proj-block">
              <span class="daily-avg-banner-proj-label">Projeção fim do mês</span>
              <span class="daily-avg-banner-proj-value">{{ hideValues ? '•••••' : formatCurrency(dailyAverage.projected, dashboard.currency.value) }}</span>
            </div>
          </div>
          <div v-if="dailyAverage.isCurrentMonth" class="daily-avg-banner-progress">
            <div class="daily-avg-banner-progress-bar" :style="{ width: Math.round((dailyAverage.daysPassed / dailyAverage.daysInMonth) * 100) + '%' }"></div>
          </div>
        </div>
        <!-- Gráficos de movimentos (dentro do mesmo card) -->
        <div v-if="hasChartData" class="charts-section-inner">
          <div v-if="hasExpensesForChart" class="chart-card">
            <h3 class="chart-title">Despesas por categoria</h3>
            <ExpensesPieChart :data="expensesForChart" />
          </div>
          <div v-if="hasIncomeForChart" class="chart-card">
            <h3 class="chart-title">Receitas por categoria</h3>
            <IncomePieChart :data="incomeForChart" />
          </div>
        </div>
        <!-- Plano mensal (dentro do card filtrado) -->
        <div v-if="isSingleMonth" class="plan-section">
          <h2 class="section-title">Plano mensal</h2>
          <div v-if="hasChartData && hasBudgetForPeriod" class="comparison-grid">
            <div class="comparison-card">
              <h3 class="comparison-title comparison-title--with-icon">Receitas <svg class="comparison-icon comparison-icon--income" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><line x1="12" x2="12" y1="6" y2="18"/></svg></h3>
              <div class="comparison-row">
                <span class="comparison-label">Esperado</span>
                <span class="comparison-value expected">{{ hideValues ? '••••• €' : formatCurrency(budgetForPeriod.expectedIncome, dashboard.currency.value) }}</span>
              </div>
              <div class="comparison-row">
                <span class="comparison-label">Real</span>
                <span class="comparison-value">{{ hideValues ? '••••• €' : formattedIncome }}</span>
              </div>
              <div v-if="budgetForPeriod.expectedIncome > 0 && !hideValues" class="comparison-diff" :class="dashboard.monthlyIncome.value >= budgetForPeriod.expectedIncome ? 'comparison-diff--good' : 'comparison-diff--over'">
                {{ dashboard.monthlyIncome.value >= budgetForPeriod.expectedIncome ? '✓' : '' }}
                {{ formatCurrency(dashboard.monthlyIncome.value - budgetForPeriod.expectedIncome, dashboard.currency.value) }}
                {{ dashboard.monthlyIncome.value >= budgetForPeriod.expectedIncome ? 'acima' : 'abaixo' }}
              </div>
            </div>
            <div class="comparison-card">
              <h3 class="comparison-title comparison-title--with-icon">Despesas <svg class="comparison-icon comparison-icon--expense" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"/><line x1="12" x2="12" y1="18" y2="6"/></svg></h3>
              <div class="comparison-row">
                <span class="comparison-label">Esperado</span>
                <span class="comparison-value expected">{{ hideValues ? '••••• €' : formatCurrency(budgetForPeriod.expectedExpenses, dashboard.currency.value) }}</span>
              </div>
              <div class="comparison-row">
                <span class="comparison-label">Real</span>
                <span class="comparison-value">{{ hideValues ? '••••• €' : formattedExpenses }}</span>
              </div>
              <div v-if="budgetForPeriod.expectedExpenses > 0 && !hideValues" class="comparison-diff" :class="dashboard.monthlyExpenses.value <= budgetForPeriod.expectedExpenses ? 'comparison-diff--good' : 'comparison-diff--over'">
                {{ dashboard.monthlyExpenses.value <= budgetForPeriod.expectedExpenses ? '✓' : '' }}
                {{ formatCurrency(dashboard.monthlyExpenses.value - budgetForPeriod.expectedExpenses, dashboard.currency.value) }}
                {{ dashboard.monthlyExpenses.value <= budgetForPeriod.expectedExpenses ? 'abaixo do orçamento' : 'acima do orçamento' }}
              </div>
            </div>
            <div class="comparison-card">
              <h3 class="comparison-title comparison-title--with-icon">Poupança <svg class="comparison-icon comparison-icon--savings" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2"/><path d="M2 9.1C1.8 10 2 11 2 12"/><circle cx="12.5" cy="11.5" r=".5" fill="currentColor"/></svg></h3>
              <div class="comparison-row">
                <span class="comparison-label">Esperado</span>
                <span class="comparison-value expected">{{ hideValues ? '••••• €' : formatCurrency(budgetForPeriod.expectedIncome - budgetForPeriod.expectedExpenses, dashboard.currency.value) }}</span>
              </div>
              <div class="comparison-row">
                <span class="comparison-label">Real</span>
                <span class="comparison-value">{{ hideValues ? '••••• €' : formattedSavings }}</span>
              </div>
              <div v-if="(budgetForPeriod.expectedIncome - budgetForPeriod.expectedExpenses) > 0 && !hideValues" class="comparison-diff" :class="dashboard.monthlySavings.value >= (budgetForPeriod.expectedIncome - budgetForPeriod.expectedExpenses) ? 'comparison-diff--good' : 'comparison-diff--over'">
                {{ dashboard.monthlySavings.value >= (budgetForPeriod.expectedIncome - budgetForPeriod.expectedExpenses) ? '✓' : '' }}
                {{ formatCurrency(dashboard.monthlySavings.value - (budgetForPeriod.expectedIncome - budgetForPeriod.expectedExpenses), dashboard.currency.value) }}
                {{ dashboard.monthlySavings.value >= (budgetForPeriod.expectedIncome - budgetForPeriod.expectedExpenses) ? 'acima do esperado' : 'abaixo do esperado' }}
              </div>
            </div>
          </div>
          <div v-else class="section-empty">
            <p class="section-empty-text">Ainda não definiste o teu plano mensal</p>
            <router-link to="/plano-mensal" class="btn-section-add">Adicionar plano mensal</router-link>
          </div>
        </div>
        </template>
      </div>


    </div>
  </div>

  <!-- Modal: Liquidar objetivos concluídos -->
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="settleModalOpen" class="settle-overlay" @click.self="closeSettleModal">
        <div class="settle-modal">
          <div class="settle-header">
            <h3>Objetivos concluídos</h3>
            <button type="button" class="settle-close" @click="closeSettleModal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          <div v-if="settleConfirmId" class="settle-confirm">
            <p class="settle-confirm-text">Já registaste esta despesa nas transações?</p>
            <div class="settle-confirm-actions">
              <button type="button" class="settle-confirm-btn settle-confirm-yes" :disabled="settleLoading" @click="onSettleConfirmYes">
                {{ settleLoading ? 'A liquidar...' : 'Sim, liquidar' }}
              </button>
              <button type="button" class="settle-confirm-btn settle-confirm-no" :disabled="settleLoading" @click="onSettleConfirmNo">
                Não, registar despesa
              </button>
              <button type="button" class="settle-confirm-btn settle-confirm-cancel" @click="onSettleCancelConfirm">
                Cancelar
              </button>
            </div>
          </div>

          <div v-else class="settle-list">
            <div v-if="objectivesHistory.length === 0" class="settle-empty">
              <p>Nenhum objetivo concluído por liquidar</p>
            </div>
            <div v-for="h in objectivesHistory" :key="h.id" class="settle-item">
              <div class="settle-item-info">
                <span class="settle-item-name">{{ h.name }}</span>
                <span class="settle-item-amount">{{ formatCurrency(h.targetAmount, dashboard.currency.value) }}</span>
                <span class="settle-item-date">Concluído a {{ new Date(h.completedAt).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }) }}</span>
              </div>
              <button type="button" class="settle-item-btn" @click="onSettleLiquidar(h.id)">
                Liquidar
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dashboard {
  position: relative;
  max-width: 100%;
  margin: 0 auto;
  padding: 0;
  margin-top: -4rem;
  min-height: 400px;
  background: transparent;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--color-text-muted);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.error-state,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--color-text-muted);
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--color-border);
  border-top-color: #166534;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state p {
  color: var(--color-error);
}

.error-hint {
  font-size: 0.875rem;
  color: var(--color-text-muted) !important;
  margin-top: 1rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.empty-state-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 3rem 2rem;
  margin-top: 1rem;
}

.empty-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.empty-icon {
  font-size: 3rem;
  opacity: 0.6;
}

.empty-hint {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0;
}

.empty-links {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
}

.link {
  color: var(--color-link-hover);
  text-decoration: none;
  font-size: 0.875rem;
}

.link:hover {
  text-decoration: underline;
}

.dashboard-content {
  display: flex !important;
  flex-direction: column;
  gap: 1.5rem;
  visibility: visible !important;
  opacity: 1 !important;
}

.period-refresh-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 240px;
}

.period-refresh-inner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.25rem 0;
}

.period-refresh-text {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.dashboard-section-card {
  background: var(--color-bg-card);
  border-radius: 14px;
  padding: 1.5rem;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
  border: 1px solid var(--color-border);
  transition: box-shadow 0.2s ease;
}

.section-empty {
  text-align: center;
  padding: 2rem 1rem;
}

.section-empty-text {
  font-size: 0.9375rem;
  color: var(--color-text-muted);
  margin: 0 0 1rem 0;
}

.section-empty-hint {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0;
}

.btn-section-add {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #166534 0%, #15803d 100%);
  border: none;
  border-radius: 10px;
  text-decoration: none;
  transition: transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 1px 3px rgba(22, 101, 52, 0.2);
}

.btn-section-add:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(22, 101, 52, 0.25);
}

.section-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.section-title {
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin: 0 0 1rem 0;
  line-height: 1.3;
  padding-bottom: 0.625rem;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-title::before {
  content: '';
  width: 3px;
  height: 1em;
  background: #166534;
  border-radius: 2px;
  flex-shrink: 0;
}

html.dark .section-title::before {
  background: #4ade80;
}

.period-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  margin-bottom: 0.25rem;
  padding: 0;
}

.period-selector {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.period-selector-center {
  justify-content: center;
  margin-bottom: 1rem;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.25rem;
  margin-top: 0.75rem;
  align-items: start;
}


.dashboard-objectives-body-wrap {
  position: relative;
}

.dashboard-objectives-body-wrap--locked .dashboard-objectives-body-inner {
  filter: blur(8px) grayscale(0.25);
  opacity: 0.52;
  pointer-events: none;
  user-select: none;
}

.dashboard-objectives-lock-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.06);
  pointer-events: none;
}

html.dark .dashboard-objectives-lock-overlay {
  background: rgba(0, 0, 0, 0.28);
}

.dashboard-objectives-lock-panel {
  pointer-events: auto;
  text-align: center;
  padding: 1rem 1.25rem;
  border-radius: 14px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.dashboard-objectives-lock-text {
  margin: 0 0 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text);
}

.objectives-preview-block {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.objectives-footer {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.objectives-more-count {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.objectives-completed-badge {
  margin: 0;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #166534;
  background: rgba(22, 101, 52, 0.08);
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  line-height: 1.4;
}

html.dark .objectives-completed-badge {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.12);
}


.objective-preview-track {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: var(--color-border);
  overflow: hidden;
}

.objective-preview-fill {
  height: 100%;
  background: linear-gradient(90deg, #166534 0%, #16a34a 100%);
  border-radius: 999px;
  transition: width 0.2s ease;
}

.objective-preview-meta {
  margin: 0.4rem 0 0;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.objective-preview-date {
  color: var(--color-text-muted);
}

.objectives-preview-skeleton {
  min-height: 2.5rem;
  display: flex;
  align-items: center;
}

.objectives-preview-loading {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.objectives-preview-empty {
  text-align: center;
  padding: 0.5rem 0 0.25rem;
}

.objectives-preview-empty-text {
  margin: 0 0 0.65rem;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.btn-add-objective {
  display: inline-flex;
  align-items: center;
  padding: 0.45rem 0.9rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #166534 0%, #15803d 100%);
  border-radius: 8px;
  text-decoration: none;
  transition: transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 1px 2px rgba(22, 101, 52, 0.15);
}

.btn-add-objective:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(22, 101, 52, 0.2);
}

.summary-cards-fallback .card {
  background: var(--color-bg-card);
  border-radius: 14px;
  padding: 1.125rem 1.25rem;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
  border: 1px solid var(--color-border);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.summary-cards-fallback .card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.summary-cards-fallback .card-title--with-arrow {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.summary-cards-fallback .card-arrow {
  flex-shrink: 0;
}

.summary-cards-fallback .card-arrow--income {
  color: var(--color-income);
}

.summary-cards-fallback .card-arrow--expense {
  color: var(--color-expense);
}

.summary-cards-fallback .card-arrow--savings {
  color: #ca8a04;
}

html.dark .summary-cards-fallback .card-arrow--savings {
  color: #facc15;
}

.summary-cards-fallback .card-arrow--rate {
  color: #16a34a;
}

html.dark .summary-cards-fallback .card-arrow--rate {
  color: #4ade80;
}

.summary-cards-fallback .card-title {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-text-muted);
  margin: 0 0 0.5rem 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.summary-cards-fallback .card-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.summary-cards-fallback .card-subtitle {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  margin: 0.375rem 0 0 0;
  font-weight: 500;
}


.summary-cards-fallback .card-income .card-value,
.summary-cards-fallback .card-expense .card-value,
.summary-cards-fallback .card-savings .card-value,
.summary-cards-fallback .card-balance .card-value { color: var(--color-text); }



.plan-section {
  margin-top: 1.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-border);
}

.comparison-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
}

.comparison-card {
  background: var(--color-bg);
  border-radius: 14px;
  padding: 1.25rem;
  border: 1px solid var(--color-border);
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
}

.comparison-card:hover {
  border-color: rgba(22, 101, 52, 0.3);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.comparison-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 1rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border);
}

.comparison-title--with-icon {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.comparison-icon {
  flex-shrink: 0;
}

.comparison-icon--income {
  color: #16a34a;
}

.comparison-icon--expense {
  color: #dc2626;
}

.comparison-icon--savings {
  color: #ca8a04;
}

html.dark .comparison-icon--income {
  color: #4ade80;
}

html.dark .comparison-icon--expense {
  color: #f87171;
}

html.dark .comparison-icon--savings {
  color: #facc15;
}

.comparison-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.comparison-label {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.comparison-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.comparison-value.expected {
  color: var(--color-text-muted);
}

.comparison-value.income { color: var(--color-income); }
.comparison-value.expense { color: var(--color-expense); }
.comparison-value.above { color: var(--color-income); }
.comparison-value.below { color: var(--color-expense); }

.comparison-diff {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--color-border);
}

.comparison-diff--good {
  color: #16a34a;
}

html.dark .comparison-diff--good {
  color: #4ade80;
}

.comparison-diff--over {
  color: #dc2626;
}

html.dark .comparison-diff--over {
  color: #f87171;
}

/* ═══ MÉDIA DIÁRIA BANNER ═══ */
.daily-avg-banner {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 1rem 1.25rem;
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  position: relative;
  transition: box-shadow 0.2s, transform 0.15s;
}

.daily-avg-banner:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.daily-avg-banner-left {
  display: flex;
  align-items: center;
}

.daily-avg-banner-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.daily-avg-banner-icon {
  color: #6366f1;
  flex-shrink: 0;
  vertical-align: -2px;
  margin-right: 0.375rem;
}

html.dark .daily-avg-banner-icon {
  color: #a5b4fc;
}

.daily-avg-banner-title {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.daily-avg-banner-value-row {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.daily-avg-banner-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text);
}

.daily-avg-banner-days {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  font-weight: 500;
}

.daily-avg-banner-right {
  display: flex;
  align-items: flex-start;
}

.daily-avg-banner-proj-block {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  text-align: right;
}

.daily-avg-banner-proj-label {
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.daily-avg-banner-proj-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
}

.daily-avg-banner-progress {
  width: 100%;
  height: 3px;
  background: var(--color-border);
  border-radius: 2px;
  overflow: hidden;
}

.daily-avg-banner-progress-bar {
  height: 100%;
  background: #6366f1;
  border-radius: 2px;
  transition: width 0.4s ease;
}

html.dark .daily-avg-banner-progress-bar {
  background: #a5b4fc;
}

@media (max-width: 600px) {
  .daily-avg-banner {
    flex-direction: column;
    align-items: flex-start;
  }
}

.charts-section-inner {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.25rem;
  margin-top: 1.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-border);
}

.chart-card {
  background: var(--color-bg-card);
  border-radius: 14px;
  padding: 1.375rem;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
  border: 1px solid var(--color-border);
  transition: box-shadow 0.2s, transform 0.15s;
}

.chart-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.chart-title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0 0 1rem 0;
}

.trend-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
}

.trend-card-top .section-title {
  margin: 0;
  border: none;
  padding: 0;
}

.trend-card-charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.25rem;
}

.trend-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 280px;
}

.trend-charts-scroll {
  position: relative;
}

.trend-charts-scroll--wide {
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
}

.trend-charts-scroll--wide::-webkit-scrollbar {
  height: 6px;
}

.trend-charts-scroll--wide::-webkit-scrollbar-track {
  background: transparent;
}

.trend-charts-scroll--wide::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}

.trend-charts-inner {
  position: relative;
  height: 280px;
}


/* ═══ STATIC GRID (Contas + Objetivos + Movimentos) ═══ */
.static-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 1.25rem;
}

.static-card {
  display: flex;
  flex-direction: column;
  padding: 1rem 1.125rem;
}

.static-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.625rem;
  border-bottom: 1px solid var(--color-border);
}

.static-card-header .section-title {
  margin: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.static-card-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text-muted);
  text-decoration: none;
  flex-shrink: 0;
  transition: all 0.15s;
}

.static-card-link:hover {
  background: var(--color-table-row-hover);
  color: #166534;
  border-color: #bbf7d0;
}

html.dark .static-card-link {
  color: #94a3b8;
}

html.dark .static-card-link:hover {
  background: rgba(74, 222, 128, 0.1);
  color: #4ade80;
  border-color: rgba(74, 222, 128, 0.3);
}

/* Account rows inside static card */
.accounts-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.account-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.25rem;
  text-decoration: none;
  color: inherit;
  border-bottom: 1px solid var(--color-border);
  border-radius: 8px;
  transition: background 0.15s;
}

.account-row:last-child {
  border-bottom: none;
}

.account-row:hover {
  background: var(--color-table-row-hover);
}

.account-row-info {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-width: 0;
}

.account-row-icon {
  display: inline-flex;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--color-text-muted);
}

.account-row-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.account-row-type {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
}

.account-row-balance {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-text);
  white-space: nowrap;
  flex-shrink: 0;
}

.account-row-balance.negative {
  color: var(--color-expense);
}

/* Objectives rows inside static card */
.objectives-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.objective-row {
  display: block;
  padding: 0.375rem 0.5rem;
  border-radius: 8px;
  border: 1px solid var(--color-border);
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s, transform 0.15s;
}

.objective-row:hover {
  border-color: rgba(22, 101, 52, 0.35);
  transform: translateY(-1px);
}

.objective-row-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.objective-row-name {
  font-size: 0.8125rem;
  font-weight: 650;
  color: var(--color-text);
}

.objective-row-amounts {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  white-space: nowrap;
}

/* Empty state for static cards */
.static-card-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 1rem 0.75rem;
  gap: 0.375rem;
}

.static-card-empty-icon {
  color: var(--color-text-muted);
  opacity: 0.4;
}

.static-card-empty p {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0;
  max-width: 22rem;
  line-height: 1.5;
}

.static-card-action {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #166534;
  text-decoration: none;
  margin-top: 0.25rem;
}

.static-card-action:hover {
  text-decoration: underline;
}

html.dark .static-card-action {
  color: #4ade80;
}

/* Movement rows inside static card */
.movements-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.movement-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.25rem;
  text-decoration: none;
  color: inherit;
  border-bottom: 1px solid var(--color-border);
  border-radius: 8px;
  transition: background 0.15s;
}

.movement-row:last-child {
  border-bottom: none;
}

.movement-row:hover {
  background: var(--color-table-row-hover);
}

.movement-row-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.movement-row-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  flex-shrink: 0;
}

.movement-row-icon.income {
  background: rgba(5, 150, 105, 0.12);
  color: #059669;
}

.movement-row-icon.expense {
  background: rgba(220, 38, 38, 0.10);
  color: #dc2626;
}

html.dark .movement-row-icon.income {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
}

html.dark .movement-row-icon.expense {
  background: rgba(248, 113, 113, 0.15);
  color: #f87171;
}

.movement-row-desc {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}

.movement-row-date {
  font-size: 0.6875rem;
  color: var(--color-text-secondary, #94a3b8);
}

.movement-row-amount {
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

.movement-row-amount.income {
  color: #059669;
}

.movement-row-amount.expense {
  color: #dc2626;
}

html.dark .movement-row-amount.income {
  color: #4ade80;
}

html.dark .movement-row-amount.expense {
  color: #f87171;
}

@media (max-width: 768px) {
  .static-grid {
    grid-template-columns: 1fr;
  }

  .static-card {
    min-height: auto;
  }
}

/* ═══ PATRIMONIO HERO ═══ */
.patrimonio-hero {
  background: var(--color-bg-card);
  border-radius: 14px;
  padding: 1.75rem 2rem 1.5rem;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
  border: 1px solid var(--color-border);
  margin-top: 0;
  transition: box-shadow 0.2s;
}

.patrimonio-hero:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.patrimonio-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.patrimonio-info {
  display: flex;
  flex-direction: column;
}

.patrimonio-label-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
}

.patrimonio-label {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #166534;
}

html.dark .patrimonio-label {
  color: #4ade80;
}

.patrimonio-eye-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.2rem;
  border-radius: 6px;
  color: var(--color-text-muted);
  transition: color 0.15s, background 0.15s;
}

.patrimonio-eye-btn:hover {
  color: var(--color-text);
  background: var(--color-table-row-hover, rgba(0, 0, 0, 0.04));
}

.patrimonio-value {
  font-size: clamp(1.75rem, 3.5vw, 2.25rem);
  font-weight: 800;
  color: var(--color-text);
  margin: 0;
  letter-spacing: -0.03em;
  line-height: 1.15;
}

.patrimonio-date {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin-top: 0.25rem;
}

.patrimonio-reserved {
  display: inline-flex;
  align-items: center;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-muted);
  margin-top: 0.375rem;
  padding: 0.25rem 0.625rem;
  background: rgba(22, 101, 52, 0.06);
  border-radius: 999px;
  width: fit-content;
}

html.dark .patrimonio-reserved {
  background: rgba(74, 222, 128, 0.1);
}

.patrimonio-periods {
  display: flex;
  gap: 0;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  overflow: hidden;
  flex-shrink: 0;
}

.patrimonio-period-btn {
  padding: 0.4rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  border-right: 1px solid var(--color-border);
  font-family: inherit;
}

.patrimonio-period-btn:last-child {
  border-right: none;
}

.patrimonio-period-btn:hover {
  background: var(--color-table-row-hover, rgba(0, 0, 0, 0.03));
  color: var(--color-text);
}

.patrimonio-period-btn.active {
  background: var(--color-text);
  color: var(--color-bg-card);
  font-weight: 700;
}

html.dark .patrimonio-period-btn.active {
  background: #e2e8f0;
  color: #0f172a;
}

.patrimonio-body {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 1.25rem;
  align-items: center;
}

.patrimonio-categories {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.patrimonio-cat-row {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.patrimonio-cat-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text);
}

.patrimonio-cat-values {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.patrimonio-cat-amount {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-text);
}

.patrimonio-cat-percent {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.patrimonio-chart-area {
  min-height: 200px;
}

.patrimonio-chart-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.patrimonio-chart-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 200px;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.patrimonio-chart-empty-icon {
  opacity: 0.4;
}


@media (max-width: 768px) {
  .patrimonio-hero {
    padding: 1.25rem 1rem;
    margin-top: 0;
  }

  .patrimonio-top {
    flex-direction: column;
    gap: 1rem;
  }

  .patrimonio-body {
    grid-template-columns: 1fr;
    gap: 1.25rem;
  }

  .patrimonio-categories {
    order: 2;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .patrimonio-cat-row {
    flex: 1;
    min-width: 140px;
  }

  .patrimonio-chart-area {
    order: 1;
  }

}

/* ═══ Date Range Picker ═══ */
.date-range-picker {
  position: relative;
}

.date-range-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 0.5rem 0.875rem;
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text);
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  white-space: nowrap;
}

.date-range-btn:hover {
  border-color: #166534;
  box-shadow: 0 2px 8px rgba(22, 101, 52, 0.08);
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
  border-radius: 14px;
  box-shadow: 0 12px 40px -8px rgba(15, 23, 42, 0.18);
  padding: 1.125rem;
}

.dr-presets {
  display: flex;
  gap: 0.375rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.dr-preset-btn {
  padding: 0.35rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: inherit;
  border: 1px solid var(--color-border);
  border-radius: 8px;
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

.dr-day.empty { cursor: default; }

.dr-day:not(.empty):hover { background: rgba(22, 101, 52, 0.08); }

.dr-day.in-range { background: rgba(22, 101, 52, 0.08); }

.dr-day.is-start,
.dr-day.is-end {
  background: #166534;
  color: #fff;
  font-weight: 700;
}

.dr-day.is-start { border-radius: 6px 0 0 6px; }
.dr-day.is-end { border-radius: 0 6px 6px 0; }
.dr-day.is-start.is-end { border-radius: 6px; }

html.dark .dr-day.in-range { background: rgba(74, 222, 128, 0.1); }
html.dark .dr-day.is-start,
html.dark .dr-day.is-end { background: #4ade80; color: #0a0a0a; }

.panel-enter-active,
.panel-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* Settle button */
.settle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: #166534;
  cursor: pointer;
  padding: 0.125rem;
  margin-left: 0.25rem;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}

.settle-btn:hover {
  background: rgba(22, 101, 52, 0.12);
}

html.dark .settle-btn {
  color: #4ade80;
}

html.dark .settle-btn:hover {
  background: rgba(74, 222, 128, 0.15);
}

/* Settle modal */
.settle-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}

.settle-modal {
  background: var(--color-bg-card);
  border-radius: 14px;
  box-shadow: 0 16px 48px -12px rgba(0, 0, 0, 0.2);
  width: 100%;
  max-width: 440px;
  max-height: 80vh;
  overflow-y: auto;
}

.settle-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.settle-header h3 {
  font-size: 1rem;
  font-weight: 700;
  margin: 0;
  color: var(--color-text);
}

.settle-close {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 6px;
  transition: background 0.15s;
}

.settle-close:hover {
  background: var(--color-table-row-hover);
}

.settle-list {
  padding: 0.75rem 1.5rem 1.25rem;
}

.settle-empty {
  text-align: center;
  padding: 1.5rem 0;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.settle-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--color-border);
}

.settle-item:last-child {
  border-bottom: none;
}

.settle-item-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.settle-item-name {
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--color-text);
}

.settle-item-amount {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #166534;
}

html.dark .settle-item-amount {
  color: #4ade80;
}

.settle-item-date {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.settle-item-btn {
  padding: 0.375rem 0.875rem;
  border: 1px solid #166534;
  border-radius: 8px;
  background: transparent;
  color: #166534;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}

.settle-item-btn:hover {
  background: #166534;
  color: white;
}

html.dark .settle-item-btn {
  border-color: #4ade80;
  color: #4ade80;
}

html.dark .settle-item-btn:hover {
  background: #4ade80;
  color: #0a0a0a;
}

/* Settle confirm */
.settle-confirm {
  padding: 1.5rem;
  text-align: center;
}

.settle-confirm-text {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 1.25rem;
}

.settle-confirm-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.settle-confirm-btn {
  width: 100%;
  padding: 0.625rem;
  border-radius: 10px;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.15s;
  border: none;
}

.settle-confirm-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.settle-confirm-yes {
  background: linear-gradient(135deg, #166534 0%, #15803d 100%);
  color: white;
}

.settle-confirm-no {
  background: var(--color-table-row-hover);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.settle-confirm-cancel {
  background: transparent;
  color: var(--color-text-muted);
}

.settle-confirm-cancel:hover {
  color: var(--color-text);
}

/* ── Card reorder ── */
.static-grid-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.card-edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-card);
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s ease;
}
.card-edit-btn:hover {
  border-color: #166534;
  color: #166534;
}
html.dark .card-edit-btn {
  background: var(--color-bg-card);
}
html.dark .card-edit-btn:hover {
  border-color: #4ade80;
  color: #4ade80;
}

.card-cancel-btn {
  padding: 0.375rem 0.75rem;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 0.8125rem;
  cursor: pointer;
  transition: color 0.15s ease;
}
.card-cancel-btn:hover {
  color: var(--color-text);
}

.card-done-btn {
  padding: 0.5rem 1.25rem;
  border: none;
  border-radius: 10px;
  background: #166534;
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s;
}
.card-done-btn:hover {
  background: #15803d;
  transform: translateY(-1px);
}
html.dark .card-done-btn:hover {
  background: #15803d;
}

.card-editing {
  outline: 2px dashed var(--color-primary);
  outline-offset: -2px;
  border-radius: 1rem;
  cursor: grab;
  transition: outline-color 0.2s ease;
}
.card-editing:active {
  cursor: grabbing;
}

.card-drag-placeholder {
  outline: 2px dashed var(--color-primary);
  outline-offset: -2px;
  border-radius: 1rem;
  background: rgba(var(--color-primary-rgb, 99, 102, 241), 0.06) !important;
}
.card-drag-placeholder > * {
  visibility: hidden;
}
html.dark .card-drag-placeholder {
  background: rgba(var(--color-primary-rgb, 99, 102, 241), 0.1) !important;
}

.card-floating {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  border-radius: 1rem;
  background: var(--color-bg-card, #fff);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  padding: 0.875rem 1rem;
  transition: none;
}
html.dark .card-floating {
  background: var(--color-bg-card, #1e1e2e);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
}

.static-card-header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.card-drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  cursor: grab;
  padding: 0.25rem;
  border-radius: 0.25rem;
  transition: color 0.15s ease;
}
.card-drag-handle:hover {
  color: var(--color-primary);
}
.card-drag-handle:active {
  cursor: grabbing;
}
</style>
