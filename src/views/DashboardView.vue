<script setup lang="ts">
import PageSkeleton from '@/components/PageSkeleton.vue'
import { PT_GROUPING } from '@/utils/numberFormat'
import { onMounted, onUnmounted, computed, ref, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { ExpenseByCategory, IncomeByCategory, MonthlyTrend } from '@/types/dashboard'
import { dashboardApi } from '@/api/dashboard'
import type { DailyBalancePoint } from '@/api/dashboard'
import type { SavingsObjectiveActive, SavingsObjectiveHistory } from '@/types/objective'
import { objectivesApi } from '@/api/objectives'
import { useHouseholdStore } from '@/stores/household'
import { useAccountsStore } from '@/stores/accounts'
import { useAssetsStore } from '@/stores/assets'
import { useInvestmentsStore } from '@/stores/investments'
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
import ValueHeroCard from '@/components/charts/ValueHeroCard.vue'
import HeroStat from '@/components/charts/HeroStat.vue'
import IncomeVsExpensesBarChart from '@/components/charts/IncomeVsExpensesBarChart.vue'
import type { AssetChartPoint } from '@/components/charts/AssetsChart.vue'
import PlanUpsellModal from '@/components/PlanUpsellModal.vue'
import BrandLogo from '@/components/BrandLogo.vue'
import InstrumentLogo from '@/components/InstrumentLogo.vue'
import { investmentsApi } from '@/api/investments'
import { filterDeposits, mergeRows } from '@/utils/depositRows'
import PageHeader from '@/components/ui/PageHeader.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiCard from '@/components/ui/UiCard.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { seriesColors } from '@/components/charts/chartTheme'

const router = useRouter()
const householdStore = useHouseholdStore()
const accountsStore = useAccountsStore()
const assetsStore = useAssetsStore()
const investmentsStore = useInvestmentsStore()
const subscriptionStore = useSubscriptionStore()
const transactionsStore = useTransactionsStore()
const authStore = useAuthStore()
const themeStore = useThemeStore()
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

    // Pool disponível = já vem calculado pelo backend (poupança menos o que está
    // reservado por objetivos concluídos ainda não liquidados). Distribuímos esse
    // valor pelos objetivos ativos por ordem de prioridade.
    const available = Math.max(0, Number(pick('availableForActiveObjectives')) || 0)
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
      liquidatedAt: (() => {
        const v = h.liquidatedAt ?? h.LiquidatedAt
        return v ? String(v) : null
      })(),
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

async function loadDashboard() {
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
              trendChartData.value = fillMissingMonths(trend, trendChartMonths.value)
            }),
            accountsStore.fetchAccounts(),
            assetsStore.ensureLoaded().catch(() => {}),
            investmentsStore.fetchHoldings().catch(() => {}),
            investmentsStore.fetchDeposits(), // dinheiro por investir → Património
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
    if (isDev) console.error('[Dashboard] falha ao carregar', msg, dashboard.error.value, householdStore.error)
    loadError.value = msg === 'Timeout'
      ? 'O servidor está a demorar mais do que o habitual a responder.'
      : 'Não foi possível carregar os seus dados neste momento.'
  } finally {
    mounted.value = true
  }
}

onMounted(loadDashboard)

const retrying = ref(false)
async function retryLoad() {
  retrying.value = true
  loadError.value = null
  mounted.value = false
  try {
    await loadDashboard()
  } finally {
    retrying.value = false
  }
}

/* ── Cabeçalho: saudação (é o título da página) ── */
const greeting = computed(() => {
  const h = new Date().getHours()
  const hello = h < 6 ? 'Boa noite' : h < 13 ? 'Bom dia' : h < 20 ? 'Boa tarde' : 'Boa noite'
  const first = (authStore.user?.firstName ?? '').trim()
  return first ? `${hello}, ${first}` : hello
})

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('pt-PT', { ...PT_GROUPING,
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

const formattedIncome = computed(() => formatCurrency(dashboard.monthlyIncome.value, dashboard.currency.value))
const formattedExpenses = computed(() => formatCurrency(dashboard.monthlyExpenses.value, dashboard.currency.value))
const formattedSavings = computed(() => formatCurrency(dashboard.monthlySavings.value, dashboard.currency.value))

// Últimos movimentos + depósitos na corretora que debitaram uma conta (linha informativa
// "Depósito na corretora", tal como na lista de Movimentos — não é despesa).
const recentRows = computed(() => {
  const deps = subscriptionStore.canAccessInvestments ? filterDeposits(investmentsStore.deposits, {}) : []
  return mergeRows(transactionsStore.transactions.slice(0, 5), deps).slice(0, 5)
})

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
  + assetsStore.totalCurrentValue
  + investmentsStore.patrimonyValueEur
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

/* ── Património Total: repartição do rodapé do hero (Dinheiro e poupanças / Investimentos / Bens e valores) ── */
const heroGroups = computed(() => {
  let cash = 0
  let invested = investmentsStore.patrimonyValueEur
  for (const acc of accountsStore.accounts) {
    // Contas do tipo investimento ("Ações e fundos") juntam-se aos Investimentos; o resto é dinheiro.
    if (acc.type === AccountType.Investment) invested += acc.balance
    else cash += acc.balance
  }
  const assets = assetsStore.totalCurrentValue
  const rows = [
    { label: 'Dinheiro e poupanças', value: cash },
    { label: 'Investimentos', value: invested },
    { label: 'Bens e valores', value: assets },
  ]
  const total = rows.reduce((sum, r) => sum + Math.abs(r.value), 0)
  return rows.map((r) => ({ ...r, percent: total > 0 ? (Math.abs(r.value) / total) * 100 : 0 }))
})

/* Cores das categorias do património (paleta categórica dos gráficos, mesma ordem). */
const categoryColors = computed(() => {
  void themeStore.isDark // recalcula ao mudar de tema
  return seriesColors()
})
function categoryColor(i: number): string {
  const c = categoryColors.value
  return c[i % c.length]
}

function formatGroupPct(pct: number): string {
  return `${pct.toLocaleString('pt-PT', { ...PT_GROUPING, minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

const totalAllocatedToObjectives = computed(() => objectivesReserved.value)

// Apenas os objetivos concluídos que ainda não foram liquidados aparecem no
// modal "por liquidar". Os já liquidados ficam no histórico mas saem daqui.
const unliquidatedHistory = computed(() => objectivesHistory.value.filter((h) => !h.liquidatedAt))

function openSettleModal() { settleModalOpen.value = true; settleConfirmId.value = null }
function closeSettleModal() { settleModalOpen.value = false; settleConfirmId.value = null }

function onSettleLiquidar(id: string) {
  settleConfirmId.value = id
}

async function onSettleConfirmYes() {
  if (!settleConfirmId.value) return
  settleLoading.value = true
  try {
    await objectivesApi.liquidate(settleConfirmId.value)
    await loadObjectivesPreview()
    settleConfirmId.value = null
    if (unliquidatedHistory.value.length === 0) closeSettleModal()
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

// Início de cada período (rolling, alinhado ao mês):
//  YTD = 1 Jan deste ano; 3M = mês atual + 2 anteriores; 6M = mês atual + 5 anteriores;
//  1A = este mês há 1 ano; 5A = este mês há 5 anos (5 anos exatos).
function periodStart(p: string, now: Date): Date {
  if (p === '3M') return new Date(now.getFullYear(), now.getMonth() - 2, 1)
  if (p === '6M') return new Date(now.getFullYear(), now.getMonth() - 5, 1)
  if (p === '1A') return new Date(now.getFullYear() - 1, now.getMonth(), 1)
  if (p === '5A') return new Date(now.getFullYear() - 5, now.getMonth(), 1)
  return new Date(now.getFullYear(), 0, 1) // YTD
}

const chartDays = computed(() => {
  const now = new Date()
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()) // sem hora → nº de dias exato
  const start = periodStart(chartPeriod.value, now)
  return Math.round((today0.getTime() - start.getTime()) / 86400000)
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

/* ── Hero do Património: pontos no formato do ValueHeroCard (sem custo → variação simples do valor) ── */
function localTodayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const heroPoints = computed<AssetChartPoint[]>(() => {
  const pts = dailyBalancePoints.value.map((p) => ({ date: p.date, value: p.balance, cost: 0 }))
  // Último ponto (hoje) ancorado ao total atual → número grande == fim do gráfico.
  const last = pts[pts.length - 1]
  if (last && last.date === localTodayStr()) last.value = currentTotalBalance.value
  return pts
})

const HERO_PERIOD_TEXT: Record<ChartPeriod, string> = {
  YTD: 'este ano',
  '3M': 'em 3 meses',
  '6M': 'em 6 meses',
  '1A': 'em 1 ano',
  '5A': 'em 5 anos',
}
const heroPeriodLabel = computed(() => HERO_PERIOD_TEXT[chartPeriod.value])

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

const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function fillMissingMonths(data: MonthlyTrend[], totalMonths: number): MonthlyTrend[] {
  const now = new Date()
  const endYear = now.getFullYear()
  const endMonth = now.getMonth() + 1
  const allMonths: MonthlyTrend[] = []
  const dataMap = new Map<string, MonthlyTrend>()
  for (const d of data) {
    dataMap.set(`${d.year}-${d.month}`, d)
  }
  for (let i = totalMonths - 1; i >= 0; i--) {
    let y = endYear
    let m = endMonth - i
    while (m <= 0) { m += 12; y-- }
    while (m > 12) { m -= 12; y++ }
    const key = `${y}-${m}`
    const existing = dataMap.get(key)
    if (existing) {
      allMonths.push(existing)
    } else {
      allMonths.push({
        year: y,
        month: m,
        label: `${MONTH_SHORT[m - 1]} ${y}`,
        income: 0,
        expenses: 0,
        savings: 0,
      })
    }
  }
  return allMonths
}

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
      const parsed = arr.map((x: Record<string, unknown>) => ({
        year: Number(x.year ?? x.Year) || 0,
        month: Number(x.month ?? x.Month) || 0,
        label: String(x.label ?? x.Label ?? ''),
        income: Number(x.income ?? x.Income) || 0,
        expenses: Number(x.expenses ?? x.Expenses) || 0,
        savings: Number(x.savings ?? x.Savings) || 0,
      }))
      trendChartData.value = fillMissingMonths(parsed, trendChartMonths.value)
    }
  } catch { /* keep existing */ }
  finally { trendChartLoading.value = false }
}

watch(trendChartPeriod, () => fetchTrendChartData())

/* ── Períodos longos (1A/5A) são exclusivos dos planos Pro/Couple ── */
const periodUpsellOpen = ref(false)
function isPeriodLocked(p: string): boolean {
  return subscriptionStore.isFree && (p === '1A' || p === '5A')
}
const chartPeriodOptions = computed(() => chartPeriods.map((p) => ({ value: p, label: p, locked: isPeriodLocked(p) })))
const trendPeriodOptions = computed(() => trendChartPeriods.map((p) => ({ value: p, label: p, locked: isPeriodLocked(p) })))
function selectChartPeriod(p: ChartPeriod) {
  if (isPeriodLocked(p)) { periodUpsellOpen.value = true; return }
  chartPeriod.value = p
}
function selectTrendPeriod(p: TrendChartPeriod) {
  if (isPeriodLocked(p)) { periodUpsellOpen.value = true; return }
  trendChartPeriod.value = p
}

/* ── Card de Investimentos no dashboard (gráfico da carteira / ativo via dropdown) ── */
type InvPeriod = 'YTD' | '3M' | '6M' | '1A' | '5A' | 'Tudo'
const invPeriods: InvPeriod[] = ['YTD', '3M', '6M', '1A', '5A', 'Tudo']
const invPeriod = ref<InvPeriod>('6M')
const invSelectedId = ref<string | null>(null) // null = carteira inteira
const invDropdownOpen = ref(false)
const invDropdownRef = ref<HTMLElement | null>(null)
const invChartPoints = ref<AssetChartPoint[]>([])
const invChartLoading = ref(false)
let invSeq = 0

const showInvestmentsCard = computed(
  () => subscriptionStore.canAccessInvestments && investmentsStore.activeHoldings.length > 0,
)

const invSortedHoldings = computed(() =>
  [...investmentsStore.activeHoldings].sort(
    (a, b) => (b.currentValueEur ?? b.investedEur) - (a.currentValueEur ?? a.investedEur),
  ),
)

const invSelectedHolding = computed(() =>
  invSelectedId.value ? investmentsStore.holdings.find((h) => h.id === invSelectedId.value) ?? null : null,
)

function invRangeFor(p: InvPeriod): { from: string; to: string } {
  const now = new Date()
  // "Tudo" = desde a 1ª compra (from vazio → o backend usa a transação mais antiga).
  if (p === 'Tudo') return { from: '', to: localDateStr(now) }
  return { from: localDateStr(periodStart(p, now)), to: localDateStr(now) }
}

async function loadInvestmentsChart() {
  if (!showInvestmentsCard.value) return
  const seq = ++invSeq
  invChartLoading.value = true
  try {
    const range = invRangeFor(invPeriod.value)
    const { data } = invSelectedId.value
      ? await investmentsApi.holdingHistory(invSelectedId.value, range)
      : await investmentsApi.history(range)
    if (seq !== invSeq) return
    invChartPoints.value = data.points.map((p) => ({ date: p.date, value: p.value, cost: p.cost }))
  } catch {
    if (seq === invSeq) invChartPoints.value = []
  } finally {
    if (seq === invSeq) invChartLoading.value = false
  }
}

function onInvSelect(val: string | null) {
  invDropdownOpen.value = false
  const next = val === 'all' ? null : val
  if (next === invSelectedId.value) return
  invSelectedId.value = next
  loadInvestmentsChart()
}
const invPeriodOptions = invPeriods.map((p) => ({ value: p, label: p }))
function selectInvPeriod(p: InvPeriod) {
  if (invPeriod.value === p) return
  invPeriod.value = p
  loadInvestmentsChart()
}
function onInvDropdownOutsideClick(e: MouseEvent) {
  if (!invDropdownOpen.value || !invDropdownRef.value) return
  if (!invDropdownRef.value.contains(e.target as Node)) invDropdownOpen.value = false
}
onMounted(() => document.addEventListener('click', onInvDropdownOutsideClick, true))
onUnmounted(() => document.removeEventListener('click', onInvDropdownOutsideClick, true))
/** Texto do período na linha de variação do cartão ("+X € (+Y%) em 6 meses"). */
const INV_PERIOD_LABELS: Record<InvPeriod, string> = {
  YTD: 'este ano',
  '3M': 'em 3 meses',
  '6M': 'em 6 meses',
  '1A': 'em 1 ano',
  '5A': 'em 5 anos',
  Tudo: 'desde o início',
}
const invPeriodLabel = computed(() => INV_PERIOD_LABELS[invPeriod.value])

const invBaseValue = computed(() => {
  const h = invSelectedHolding.value
  if (h) return h.currentValueEur ?? h.investedEur
  return investmentsStore.totalCurrentValueEur
})
const invBaseInvested = computed(() => {
  const h = invSelectedHolding.value
  if (h) return h.investedEur
  return investmentsStore.totalInvestedEur
})
const invChartYearTicks = computed(() => {
  const pts = invChartPoints.value
  if (pts.length < 2) return false
  const span =
    (new Date(pts[pts.length - 1].date + 'T00:00:00').getTime() - new Date(pts[0].date + 'T00:00:00').getTime()) / 86400000
  // > ~18 meses: anos comprimidos + meses do ano atual (alinhado com a página de Investimentos).
  return span > 540
})

function invFmtEur(v: number): string {
  return formatCurrency(v, 'EUR')
}
function invFmtSignedEur(v: number): string {
  return `${v >= 0 ? '+' : '−'}${invFmtEur(Math.abs(v))}`
}
function invFmtPct(pct: number): string {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2).replace('.', ',')}%`
}

watch(showInvestmentsCard, (v) => {
  if (v && invChartPoints.value.length === 0) loadInvestmentsChart()
}, { immediate: true })

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
        <PageSkeleton variant="dashboard" />
      </div>
    </transition>

    <PageHeader :title="greeting">
      <template v-if="showContent" #actions>
        <template v-if="cardEditMode">
          <UiButton variant="ghost" size="sm" @click="cancelCardEdit">Cancelar</UiButton>
          <UiButton variant="primary" size="sm" @click="toggleCardEditMode">
            <template #icon><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></template>
            Concluído
          </UiButton>
        </template>
        <UiButton v-else variant="secondary" size="sm" title="Reorganizar cartões" @click="toggleCardEditMode">
          <template #icon><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></template>
          Editar
        </UiButton>
      </template>
    </PageHeader>

    <UiCard v-if="loadError || (dashboard.error.value && mounted && !showContent)" class="state-card">
      <EmptyState
        title="Não foi possível carregar a visão geral"
        :description="loadError || 'Ocorreu um problema ao obter os seus dados. Verifique a ligação e tente novamente.'"
      >
        <template #icon>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/><polyline points="21 3 21 9 15 9"/></svg>
        </template>
        <UiButton variant="primary" :loading="retrying" @click="retryLoad">Tentar novamente</UiButton>
      </EmptyState>
    </UiCard>

    <UiCard v-else-if="!householdStore.household && !householdStore.loading && mounted" class="state-card">
      <EmptyState
        title="Configure o seu agregado"
        description="Para começar a acompanhar as suas finanças, configure primeiro o seu agregado."
      >
        <template #icon>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        </template>
        <router-link v-slot="{ navigate }" to="/household" custom>
          <UiButton variant="primary" @click="navigate">Configurar agregado</UiButton>
        </router-link>
      </EmptyState>
    </UiCard>

    <div v-if="showContent" ref="dashboardContentRef" class="dashboard-content">

      <!-- ═══ PATRIMÓNIO TOTAL — Hero ═══ -->
      <ValueHeroCard
        title="Património total"
        :points="heroPoints"
        :current-value="currentTotalBalance"
        :current-cost="0"
        :period-label="heroPeriodLabel"
        :year-ticks="chartPeriod === '5A'"
        :loading="chartLoading"
        :currency="dashboard.currency.value"
        :hide-values="hideValues"
      >
        <template #title-extra>
          <span class="card-info card-info--inline card-info--right" tabindex="0" role="button" aria-label="O que inclui o património total?"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg><span class="card-tooltip" role="tooltip">Soma dos saldos de todas as contas, dos investimentos (incluindo os fundos livres na corretora) e dos bens e valores. O valor reservado para objetivos está incluído (não é descontado).</span></span>
          <button type="button" class="icon-btn" :title="hideValues ? 'Mostrar valores' : 'Esconder valores'" :aria-label="hideValues ? 'Mostrar valores' : 'Esconder valores'" @click="hideValues = !hideValues">
            <svg v-if="!hideValues" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>
          </button>
        </template>

        <template #actions>
          <SegmentedControl
            :model-value="chartPeriod"
            :options="chartPeriodOptions"
            size="sm"
            aria-label="Período do gráfico do património"
            @update:model-value="selectChartPeriod"
          />
        </template>

        <template #empty>
          <EmptyState
            compact
            title="Sem dados de evolução"
            description="A evolução do seu património aparece aqui assim que houver movimentos."
          >
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/></svg>
            </template>
          </EmptyState>
        </template>

        <template #footer>
          <div class="hero-alloc">
            <div class="alloc-bar" aria-hidden="true">
              <template v-for="(group, i) in heroGroups" :key="group.label">
                <span
                  v-if="group.percent > 0"
                  class="alloc-seg"
                  :style="{ width: `${group.percent}%`, background: categoryColor(i) }"
                />
              </template>
            </div>
            <div class="hero-alloc-stats">
              <HeroStat v-for="(group, i) in heroGroups" :key="group.label" :label="group.label">
                <span class="alloc-dot" :style="{ background: categoryColor(i) }" aria-hidden="true" />
                <span>{{ hideValues ? '••••• €' : formatCurrency(group.value, dashboard.currency.value) }}</span>
                <span class="alloc-pct">{{ formatGroupPct(group.percent) }}</span>
              </HeroStat>
              <HeroStat
                v-if="totalAllocatedToObjectives > 0"
                label="Reservado para objetivos"
                hint="Incluído no património total (não é descontado)."
              >
                <span>{{ hideValues ? '••••• €' : formatCurrency(totalAllocatedToObjectives, dashboard.currency.value) }}</span>
                <button type="button" class="icon-btn icon-btn--sm" title="Liquidar objetivos concluídos" aria-label="Liquidar objetivos concluídos" @click="openSettleModal">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
                </button>
              </HeroStat>
            </div>
          </div>
        </template>
      </ValueHeroCard>

      <!-- ═══ GRELHA ESTÁTICA: Contas + Objetivos + Movimentos (dados atuais) ═══ -->
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
            <h2 class="dash-card-title">Contas bancárias</h2>
            <div class="static-card-header-actions">
              <span v-if="cardEditMode" class="card-drag-handle" title="Arrastar para reordenar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg>
              </span>
              <router-link v-else :to="{ name: 'contas' }" class="see-all">
                Ver tudo
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </router-link>
            </div>
          </div>
          <div v-if="accountsToShow.length > 0" class="row-list">
            <router-link
              v-for="account in accountsToShow.slice(0, 4)"
              :key="account.id"
              :to="{ name: 'contas' }"
              class="row"
            >
              <BrandLogo :name="account.name" :domain="account.logoDomain" :size="36" class="row-logo">
                <template #fallback>
                  <span class="row-icon" aria-hidden="true">
                    <svg v-if="isCreditCard(account.type)" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>
                  </span>
                </template>
              </BrandLogo>
              <span class="row-text">
                <span class="row-name">{{ account.name }}</span>
                <span class="row-sub">{{ accountTypeLabel(account.type) }}</span>
              </span>
              <span class="row-amount ui-amount" :class="{ 'ui-amount--neg': !hideValues && account.balance < 0 }">
                {{ hideValues ? '••••• €' : formatCurrency(account.balance, account.currency) }}
              </span>
            </router-link>
          </div>
          <EmptyState v-else compact title="Sem contas" description="Veja o saldo das suas contas num só lugar.">
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/><circle cx="17" cy="15" r="1.5"/></svg>
            </template>
            <router-link v-slot="{ navigate }" to="/accounts?action=new" custom>
              <UiButton variant="secondary" size="sm" @click="navigate">Adicionar conta</UiButton>
            </router-link>
          </EmptyState>
        </div>

        <!-- Card: Objetivos -->
        <div
          v-else-if="cardId === 'objectives'"
          class="dashboard-section-card static-card"
          :class="{ 'card-editing': cardEditMode, 'card-drag-placeholder': draggedCard === 'objectives' }"
          @pointerdown="onCardPointerDown($event, 'objectives')"
        >
          <div class="static-card-header">
            <h2 class="dash-card-title">Objetivos de poupança</h2>
            <div class="static-card-header-actions">
              <span v-if="cardEditMode" class="card-drag-handle" title="Arrastar para reordenar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg>
              </span>
              <router-link v-else :to="{ name: 'objetivos' }" class="see-all">
                Ver tudo
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </router-link>
            </div>
          </div>
          <div
            class="objectives-wrap"
            :class="{ 'objectives-wrap--locked': !subscriptionStore.canAccessObjectives && objectivesPreview.length > 0 }"
          >
            <div class="objectives-inner">
              <div v-if="objectivesLoading" class="objectives-loading">
                <div v-for="i in 3" :key="i" class="objectives-loading-row">
                  <span class="sk-bar sk-bar--w60" />
                  <span class="sk-bar sk-bar--track" />
                </div>
              </div>
              <div v-else-if="objectivesPreview.length > 0" class="objectives-block">
                <div class="objectives-list">
                  <router-link
                    v-for="goal in objectivesPreview"
                    :key="goal.id"
                    :to="{ name: 'objetivos' }"
                    class="objective-row"
                  >
                    <div class="objective-row-top">
                      <span class="row-name">{{ goal.name }}</span>
                      <span class="objective-pct">{{ goal.progressPercent.toFixed(0) }}%</span>
                    </div>
                    <div class="objective-track" role="progressbar" :aria-valuenow="goal.progressPercent" aria-valuemin="0" aria-valuemax="100">
                      <div class="objective-fill" :style="{ width: `${Math.min(100, goal.progressPercent)}%` }" />
                    </div>
                    <p class="objective-meta">
                      <span class="objective-amounts">{{ hideValues ? '••••• / •••••' : `${formatCurrency(goal.allocatedAmount, dashboard.currency.value)} de ${formatCurrency(goal.targetAmount, dashboard.currency.value)}` }}</span>
                      <span v-if="goal.targetDate">Meta {{ formatObjectiveDate(goal.targetDate) }}</span>
                    </p>
                  </router-link>
                </div>
                <div v-if="objectivesMoreCount > 0 || objectivesCompletedCount > 0" class="objectives-footer">
                  <span v-if="objectivesMoreCount > 0" class="objectives-more">
                    +{{ objectivesMoreCount }} {{ objectivesMoreCount === 1 ? 'objetivo ativo' : 'objetivos ativos' }}
                  </span>
                  <span v-if="objectivesCompletedCount > 0" class="ui-badge ui-badge--brand">
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    {{ objectivesCompletedCount }} {{ objectivesCompletedCount === 1 ? 'concluído' : 'concluídos' }}
                  </span>
                </div>
              </div>
              <EmptyState
                v-else-if="objectivesLoaded"
                compact
                title="Sem objetivos ativos"
                description="Defina objetivos de poupança para acompanhar o seu progresso."
              >
                <template #icon>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                </template>
                <router-link
                  v-if="subscriptionStore.canAccessObjectives"
                  v-slot="{ navigate }"
                  :to="{ name: 'objetivos', query: { action: 'new' } }"
                  custom
                >
                  <UiButton variant="secondary" size="sm" @click="navigate">Criar objetivo</UiButton>
                </router-link>
                <router-link v-else v-slot="{ navigate }" :to="{ name: 'subscricao' }" custom>
                  <UiButton variant="secondary" size="sm" @click="navigate">Ver planos</UiButton>
                </router-link>
              </EmptyState>
            </div>
            <div v-if="!subscriptionStore.canAccessObjectives && objectivesPreview.length > 0" class="objectives-lock">
              <div class="objectives-lock-panel">
                <p class="objectives-lock-text">Atualize o plano para ver os seus objetivos</p>
                <router-link v-slot="{ navigate }" :to="{ name: 'subscricao' }" custom>
                  <UiButton variant="primary" size="sm" @click="navigate">Ver planos</UiButton>
                </router-link>
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
            <h2 class="dash-card-title">Últimos movimentos</h2>
            <div class="static-card-header-actions">
              <span v-if="cardEditMode" class="card-drag-handle" title="Arrastar para reordenar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg>
              </span>
              <router-link v-else :to="{ name: 'movimentos' }" class="see-all">
                Ver tudo
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </router-link>
            </div>
          </div>
          <div v-if="recentRows.length > 0" class="row-list">
            <template v-for="row in recentRows" :key="row.key">
            <router-link
              v-if="row.kind === 'deposit'"
              :to="{ name: 'investimentos', query: { tab: 'deposits' } }"
              class="row"
              title="Dinheiro enviado para a corretora. Não conta como despesa."
            >
              <span class="row-icon row-icon--invest" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
              </span>
              <span class="row-text">
                <span class="row-name">Depósito na corretora</span>
                <span class="row-sub">{{ new Date(row.dep.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }) }}</span>
              </span>
              <span class="row-amount ui-amount row-amount--invest">
                {{ hideValues ? '••••• €' : `→ ${formatCurrency(row.dep.amount, dashboard.currency.value)}` }}
              </span>
            </router-link>
            <router-link
              v-else
              :to="{ name: 'movimentos' }"
              class="row"
            >
              <BrandLogo :name="row.tx.entityName || row.tx.description" :size="36" class="row-logo">
                <template #fallback>
                  <span class="row-icon" :class="row.tx.type === TransactionType.Income ? 'row-icon--income' : 'row-icon--expense'" aria-hidden="true">
                    <svg v-if="row.tx.type === TransactionType.Income" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M17 7 7 17"/><path d="M17 17H7V7"/></svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>
                  </span>
                </template>
              </BrandLogo>
              <span class="row-text">
                <span class="row-name">{{ row.tx.description || TRANSACTION_CATEGORY_LABELS[row.tx.category] || 'Movimento' }}</span>
                <span class="row-sub">{{ new Date(row.tx.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }) }}</span>
              </span>
              <span class="row-amount ui-amount" :class="row.tx.type === TransactionType.Income ? 'ui-amount--pos' : 'row-amount--expense'">
                {{ hideValues ? '••••• €' : `${row.tx.type === TransactionType.Income ? '+' : '−'}${formatCurrency(row.tx.amount, dashboard.currency.value)}` }}
              </span>
            </router-link>
            </template>
          </div>
          <EmptyState v-else compact title="Sem movimentos" description="Ainda não registou nenhum movimento.">
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="7" x2="7" y1="18" y2="6"/><polyline points="3 10 7 6 11 10"/><line x1="17" x2="17" y1="6" y2="18"/><polyline points="13 14 17 18 21 14"/></svg>
            </template>
            <router-link v-slot="{ navigate }" to="/transactions?tab=movements&action=new" custom>
              <UiButton variant="secondary" size="sm" @click="navigate">Adicionar movimento</UiButton>
            </router-link>
          </EmptyState>
        </div>
        </template>
      </div>

      <!-- ═══ INVESTIMENTOS — mesmo cartão (ValueHeroCard) do Património e da página de Investimentos ═══ -->
      <ValueHeroCard
        v-if="showInvestmentsCard"
        title="Investimentos"
        :points="invChartPoints"
        :current-value="invBaseValue"
        :current-cost="invBaseInvested"
        cost-label="Investido"
        :period-label="invPeriodLabel"
        :year-ticks="invChartYearTicks"
        :loading="invChartLoading"
        currency="EUR"
        :hide-values="hideValues"
      >
        <template #actions>
          <div class="inv-actions">
            <SegmentedControl
              :model-value="invPeriod"
              :options="invPeriodOptions"
              size="sm"
              aria-label="Período do gráfico de investimentos"
              @update:model-value="selectInvPeriod"
            />
            <!-- Dropdown de ativos (logo + nome completo) -->
            <div ref="invDropdownRef" class="inv-select">
              <button type="button" class="inv-select-trigger" :class="{ open: invDropdownOpen }" @click.stop="invDropdownOpen = !invDropdownOpen">
                <InstrumentLogo
                  v-if="invSelectedHolding"
                  :symbol="invSelectedHolding.symbol"
                  :name="invSelectedHolding.name"
                  :type="invSelectedHolding.type"
                  :domain="invSelectedHolding.logoDomain"
                  :size="20"
                />
                <span v-else class="inv-select-all-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
                </span>
                <span class="inv-select-label">{{ invSelectedHolding ? invSelectedHolding.name : 'Todos os ativos' }}</span>
                <svg class="inv-select-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              <Transition name="panel">
                <div v-show="invDropdownOpen" class="inv-select-menu">
                  <button type="button" class="inv-select-opt" :class="{ active: !invSelectedId }" @click="onInvSelect('all')">
                    <span class="inv-select-all-icon inv-select-all-icon--lg">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
                    </span>
                    <span class="inv-select-opt-text"><span class="inv-select-opt-name">Todos os ativos</span></span>
                    <svg v-if="!invSelectedId" class="inv-select-check" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
                  <button
                    v-for="h in invSortedHoldings"
                    :key="h.id"
                    type="button"
                    class="inv-select-opt"
                    :class="{ active: invSelectedId === h.id }"
                    @click="onInvSelect(h.id)"
                  >
                    <InstrumentLogo :symbol="h.symbol" :name="h.name" :type="h.type" :domain="h.logoDomain" :size="28" />
                    <span class="inv-select-opt-text">
                      <span class="inv-select-opt-name">{{ h.name }}</span>
                      <span class="inv-select-opt-sub">{{ h.providerSymbol || h.symbol }}</span>
                    </span>
                    <svg v-if="invSelectedId === h.id" class="inv-select-check" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
                </div>
              </Transition>
            </div>
            <router-link :to="{ name: 'investimentos' }" class="see-all">
              Ver tudo
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </router-link>
          </div>
        </template>

        <template #empty>
          <div class="chart-state">
            <p class="chart-empty-text">Sem dados de evolução neste período</p>
          </div>
        </template>

        <template #footer>
          <HeroStat label="Investido">{{ hideValues ? '••••• €' : invFmtEur(invBaseInvested) }}</HeroStat>
          <HeroStat label="Retorno total">
            <span :class="invBaseValue - invBaseInvested < 0 ? 'ui-amount--neg' : 'ui-amount--pos'">
              {{ hideValues ? '••••• €' : invFmtSignedEur(invBaseValue - invBaseInvested) }}
            </span>
            <span v-if="!hideValues && invBaseInvested !== 0" class="alloc-pct">{{ invFmtPct(((invBaseValue - invBaseInvested) / Math.abs(invBaseInvested)) * 100) }}</span>
          </HeroStat>
        </template>
      </ValueHeroCard>

      <!-- ═══ TENDÊNCIAS ═══ -->
      <UiCard v-if="trendChartData.length > 0" title="Tendências" subtitle="Receitas, despesas e poupança ao longo do tempo">
        <template #actions>
          <SegmentedControl
            :model-value="trendChartPeriod"
            :options="trendPeriodOptions"
            size="sm"
            aria-label="Período das tendências"
            @update:model-value="selectTrendPeriod"
          />
        </template>
        <div v-if="trendChartLoading" class="chart-state chart-state--tall"><div class="spinner"></div></div>
        <div v-else class="tile-grid" :class="{ 'tile-grid--stacked': trendChartData.length > 8 }">
          <div class="chart-tile">
            <h3 class="tile-title">Evolução mensal</h3>
            <div class="trend-chart">
              <MonthlyLineChart :data="trendChartData" :period="trendChartPeriod" />
            </div>
          </div>
          <div class="chart-tile">
            <h3 class="tile-title">Receitas vs despesas</h3>
            <div class="trend-chart">
              <IncomeVsExpensesBarChart :data="trendChartData" :period="trendChartPeriod" />
            </div>
          </div>
        </div>
      </UiCard>

      <!-- ═══ SECÇÕES FILTRADAS (dados dinâmicos por período) ═══ -->
      <UiCard title="Resumo do período" :subtitle="periodLabel">
        <template #actions>
          <div ref="dashDatePickerRef" class="date-range-picker">
            <button type="button" class="date-range-btn" @click.stop="toggleDashDatePicker">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
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
                      <button type="button" class="dr-cal-nav" aria-label="Mês anterior" @click="dashPickerPrevMonth">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                      </button>
                      <span class="dr-cal-title">{{ PICKER_MONTH_NAMES[dashPickerLeftMonth] }} {{ dashPickerLeftYear }}</span>
                      <span class="dr-cal-spacer"></span>
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
                      <span class="dr-cal-spacer"></span>
                      <span class="dr-cal-title">{{ PICKER_MONTH_NAMES[dashPickerRightMonth] }} {{ dashPickerRightYear }}</span>
                      <button type="button" class="dr-cal-nav" aria-label="Mês seguinte" @click="dashPickerNextMonth">
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
        </template>

        <div v-if="periodChangeLoading" class="chart-state chart-state--tall">
          <div class="spinner"></div>
          <p class="chart-empty-text">A atualizar os dados…</p>
        </div>

        <div v-else class="period-body">
          <!-- KPIs -->
          <div class="kpi-grid">
            <div class="kpi">
              <span class="kpi-label">
                <span class="kpi-dot kpi-dot--income" />Receitas
                <span class="card-info" tabindex="0" role="button" aria-label="O que são as receitas?"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg><span class="card-tooltip" role="tooltip">Total de receitas do período selecionado.</span></span>
              </span>
              <span class="kpi-value ui-amount--pos">{{ hideValues ? '••••• €' : formattedIncome }}</span>
            </div>
            <div class="kpi">
              <span class="kpi-label">
                <span class="kpi-dot kpi-dot--expense" />Despesas
                <span class="card-info" tabindex="0" role="button" aria-label="O que são as despesas?"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg><span class="card-tooltip" role="tooltip">Total de despesas do período selecionado.</span></span>
              </span>
              <span class="kpi-value ui-amount--neg">{{ hideValues ? '••••• €' : formattedExpenses }}</span>
            </div>
            <div class="kpi">
              <span class="kpi-label">
                <span class="kpi-dot kpi-dot--brand" />Poupança
                <span class="card-info" tabindex="0" role="button" aria-label="O que é a poupança?"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg><span class="card-tooltip" role="tooltip">Receitas − Despesas do período selecionado.</span></span>
              </span>
              <span class="kpi-value">{{ hideValues ? '••••• €' : formattedSavings }}</span>
            </div>
            <div class="kpi">
              <span class="kpi-label">
                <span class="kpi-dot" />Taxa de poupança
                <span class="card-info" tabindex="0" role="button" aria-label="O que é a taxa de poupança?"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg><span class="card-tooltip" role="tooltip">Percentagem das receitas que foi poupada (Poupança ÷ Receitas).</span></span>
              </span>
              <span class="kpi-value">{{ hideValues ? '•••' : formatPercent(savingsRate) }}</span>
              <span class="kpi-sub">da receita poupada</span>
            </div>
          </div>

          <!-- Média diária -->
          <div v-if="dailyAverage" class="daily-avg">
            <div class="daily-avg-main">
              <span class="kpi-label">
                Média diária de gastos
                <span class="card-info card-info--inline" tabindex="0" role="button" aria-label="O que é a média diária de gastos?"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg><span class="card-tooltip" role="tooltip">Despesas do período ÷ número de dias. No mês atual, a projeção estima o total ao manter este ritmo até ao fim do mês.</span></span>
              </span>
              <span class="daily-avg-value-row">
                <span class="daily-avg-value">{{ hideValues ? '••••• €' : formatCurrency(dailyAverage.avg, dashboard.currency.value) }}</span>
                <span v-if="dailyAverage.isCurrentMonth" class="ui-badge">{{ dailyAverage.daysPassed }}/{{ dailyAverage.daysInMonth }} dias</span>
              </span>
            </div>
            <div v-if="dailyAverage.isCurrentMonth" class="daily-avg-proj">
              <span class="kpi-label">Projeção fim do mês</span>
              <span class="daily-avg-proj-value">{{ hideValues ? '•••••' : formatCurrency(dailyAverage.projected, dashboard.currency.value) }}</span>
            </div>
            <div v-if="dailyAverage.isCurrentMonth" class="daily-avg-progress">
              <div class="daily-avg-progress-bar" :style="{ width: Math.round((dailyAverage.daysPassed / dailyAverage.daysInMonth) * 100) + '%' }"></div>
            </div>
          </div>

          <!-- Gráficos por categoria -->
          <div v-if="hasChartData" class="tile-grid">
            <div class="chart-tile">
              <h3 class="tile-title">Despesas por categoria</h3>
              <ExpensesPieChart v-if="hasExpensesForChart" :data="expensesForChart" />
              <p v-else class="chart-empty-text chart-empty-text--pad">Sem despesas neste período</p>
            </div>
            <div class="chart-tile">
              <h3 class="tile-title">Receitas por categoria</h3>
              <IncomePieChart v-if="hasIncomeForChart" :data="incomeForChart" />
              <p v-else class="chart-empty-text chart-empty-text--pad">Sem receitas neste período</p>
            </div>
          </div>

          <!-- Plano mensal -->
          <div v-if="isSingleMonth" class="plan-section">
            <div class="plan-head">
              <h3 class="dash-card-title">Plano mensal</h3>
              <router-link v-if="hasChartData && hasBudgetForPeriod" to="/monthly-plan" class="see-all">
                Ver plano
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </router-link>
            </div>
            <div v-if="hasChartData && hasBudgetForPeriod" class="comparison-grid">
              <div class="comparison-tile">
                <span class="kpi-label"><span class="kpi-dot kpi-dot--income" />Receitas</span>
                <div class="comparison-row">
                  <span class="comparison-label">Esperado</span>
                  <span class="comparison-value comparison-value--muted">{{ hideValues ? '••••• €' : formatCurrency(budgetForPeriod.expectedIncome, dashboard.currency.value) }}</span>
                </div>
                <div class="comparison-row">
                  <span class="comparison-label">Real</span>
                  <span class="comparison-value">{{ hideValues ? '••••• €' : formattedIncome }}</span>
                </div>
                <span v-if="budgetForPeriod.expectedIncome > 0 && !hideValues" class="ui-badge comparison-diff" :class="dashboard.monthlyIncome.value >= budgetForPeriod.expectedIncome ? 'ui-badge--success' : 'ui-badge--danger'">
                  <svg v-if="dashboard.monthlyIncome.value >= budgetForPeriod.expectedIncome" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {{ formatCurrency(dashboard.monthlyIncome.value - budgetForPeriod.expectedIncome, dashboard.currency.value) }}
                  {{ dashboard.monthlyIncome.value >= budgetForPeriod.expectedIncome ? 'acima' : 'abaixo' }}
                </span>
              </div>
              <div class="comparison-tile">
                <span class="kpi-label"><span class="kpi-dot kpi-dot--expense" />Despesas</span>
                <div class="comparison-row">
                  <span class="comparison-label">Esperado</span>
                  <span class="comparison-value comparison-value--muted">{{ hideValues ? '••••• €' : formatCurrency(budgetForPeriod.expectedExpenses, dashboard.currency.value) }}</span>
                </div>
                <div class="comparison-row">
                  <span class="comparison-label">Real</span>
                  <span class="comparison-value">{{ hideValues ? '••••• €' : formattedExpenses }}</span>
                </div>
                <span v-if="budgetForPeriod.expectedExpenses > 0 && !hideValues" class="ui-badge comparison-diff" :class="dashboard.monthlyExpenses.value <= budgetForPeriod.expectedExpenses ? 'ui-badge--success' : 'ui-badge--danger'">
                  <svg v-if="dashboard.monthlyExpenses.value <= budgetForPeriod.expectedExpenses" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {{ formatCurrency(dashboard.monthlyExpenses.value - budgetForPeriod.expectedExpenses, dashboard.currency.value) }}
                  {{ dashboard.monthlyExpenses.value <= budgetForPeriod.expectedExpenses ? 'abaixo do orçamento' : 'acima do orçamento' }}
                </span>
              </div>
              <div class="comparison-tile">
                <span class="kpi-label"><span class="kpi-dot kpi-dot--brand" />Poupança</span>
                <div class="comparison-row">
                  <span class="comparison-label">Esperado</span>
                  <span class="comparison-value comparison-value--muted">{{ hideValues ? '••••• €' : formatCurrency(budgetForPeriod.expectedIncome - budgetForPeriod.expectedExpenses, dashboard.currency.value) }}</span>
                </div>
                <div class="comparison-row">
                  <span class="comparison-label">Real</span>
                  <span class="comparison-value">{{ hideValues ? '••••• €' : formattedSavings }}</span>
                </div>
                <span v-if="(budgetForPeriod.expectedIncome - budgetForPeriod.expectedExpenses) > 0 && !hideValues" class="ui-badge comparison-diff" :class="dashboard.monthlySavings.value >= (budgetForPeriod.expectedIncome - budgetForPeriod.expectedExpenses) ? 'ui-badge--success' : 'ui-badge--danger'">
                  <svg v-if="dashboard.monthlySavings.value >= (budgetForPeriod.expectedIncome - budgetForPeriod.expectedExpenses)" xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {{ formatCurrency(dashboard.monthlySavings.value - (budgetForPeriod.expectedIncome - budgetForPeriod.expectedExpenses), dashboard.currency.value) }}
                  {{ dashboard.monthlySavings.value >= (budgetForPeriod.expectedIncome - budgetForPeriod.expectedExpenses) ? 'acima do esperado' : 'abaixo do esperado' }}
                </span>
              </div>
            </div>
            <EmptyState
              v-else
              compact
              title="Sem plano mensal"
              description="Defina quanto espera receber e gastar para comparar com o real."
            >
              <template #icon>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
              </template>
              <router-link v-slot="{ navigate }" to="/monthly-plan" custom>
                <UiButton variant="secondary" size="sm" @click="navigate">Adicionar plano mensal</UiButton>
              </router-link>
            </EmptyState>
          </div>
        </div>
      </UiCard>

    </div>
  </div>

  <!-- Modal: Liquidar objetivos concluídos -->
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="settleModalOpen" class="settle-overlay" @click.self="closeSettleModal">
        <div class="settle-modal" role="dialog" aria-modal="true" aria-labelledby="settle-title">
          <div class="settle-header">
            <h3 id="settle-title">Objetivos concluídos</h3>
            <UiButton variant="ghost" size="sm" icon-only aria-label="Fechar" @click="closeSettleModal">
              <template #icon><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></template>
            </UiButton>
          </div>

          <div v-if="settleConfirmId" class="settle-confirm">
            <p class="settle-confirm-text">Já registou esta despesa nos movimentos?</p>
            <div class="settle-confirm-actions">
              <UiButton variant="primary" block :loading="settleLoading" @click="onSettleConfirmYes">
                {{ settleLoading ? 'A liquidar…' : 'Sim, liquidar' }}
              </UiButton>
              <UiButton variant="secondary" block :disabled="settleLoading" @click="onSettleConfirmNo">
                Não, registar despesa
              </UiButton>
              <UiButton variant="ghost" block @click="onSettleCancelConfirm">
                Cancelar
              </UiButton>
            </div>
          </div>

          <div v-else class="settle-list">
            <p v-if="unliquidatedHistory.length === 0" class="settle-empty">Não tem objetivos concluídos por liquidar.</p>
            <div v-for="h in unliquidatedHistory" :key="h.id" class="settle-item">
              <div class="settle-item-info">
                <span class="row-name">{{ h.name }}</span>
                <span class="settle-item-amount ui-amount">{{ formatCurrency(h.targetAmount, dashboard.currency.value) }}</span>
                <span class="row-sub">Concluído a {{ new Date(h.completedAt).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }) }}</span>
              </div>
              <UiButton variant="secondary" size="sm" @click="onSettleLiquidar(h.id)">Liquidar</UiButton>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <PlanUpsellModal
    :open="periodUpsellOpen"
    description="Atingiu o limite do plano Free. Faça upgrade para aceder ao histórico alargado do seu património."
    :features="[
      'Evolução do património até 5 anos',
      'Objetivos de poupança e relatórios mensais',
      'Transações recorrentes ilimitadas',
    ]"
    @close="periodUpsellOpen = false"
  />
</template>

<style scoped>
/* ═══ Página ═══ */
.dashboard {
  position: relative;
  max-width: var(--page-max);
  margin: 0 auto;
  min-height: 400px;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--transition-slow);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.state-card {
  margin-top: var(--space-2);
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary-text);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

.chart-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  height: 100%;
  min-height: 200px;
}
.chart-state--tall {
  min-height: 280px;
}
.chart-empty-text {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  text-align: center;
}
.chart-empty-text--pad {
  padding: var(--space-8) 0;
}

/* ═══ Cartões (mesmo visual do UiCard; os da grelha arrastável são markup próprio) ═══ */
.dash-card,
.dashboard-section-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xs);
  padding: var(--space-5);
  min-width: 0;
}

.dash-card-head,
.static-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.dash-card-title {
  margin: 0;
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
  letter-spacing: -0.01em;
  min-width: 0;
}

.dash-card-actions,
.static-card-header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--space-2);
}

/* Link "Ver tudo" — estilo do UiButton ghost sm */
.see-all {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: var(--control-h-sm);
  padding: 0 var(--space-2) 0 var(--space-3);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-secondary);
  text-decoration: none;
  white-space: nowrap;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.see-all:hover {
  background: var(--color-surface-muted);
  color: var(--color-text-strong);
}
.see-all:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

/* Botão de ícone discreto (olho, liquidar) */
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.icon-btn:hover {
  background: var(--color-surface-muted);
  color: var(--color-text-strong);
}
.icon-btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.icon-btn--sm {
  width: 24px;
  height: 24px;
}

/* ═══ Tooltips de informação ═══ */
.card-info {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-subtle);
  cursor: help;
  outline: none;
  flex-shrink: 0;
  z-index: 2;
  transition: color var(--transition-fast);
}
.card-info:hover,
.card-info:focus-visible {
  color: var(--color-primary-text);
}

.card-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  right: -0.25rem;
  transform: translateY(4px);
  width: max-content;
  max-width: 240px;
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  line-height: 1.45;
  text-transform: none;
  letter-spacing: normal;
  text-align: left;
  z-index: 30;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity var(--transition-fast), transform var(--transition-fast), visibility var(--transition-fast);
}
.card-info:hover .card-tooltip,
.card-info:focus-visible .card-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.card-info--inline {
  position: relative;
  top: auto;
  right: auto;
}
.card-info--inline .card-tooltip {
  right: auto;
  left: 50%;
  transform: translateX(-50%) translateY(4px);
}
.card-info--inline:hover .card-tooltip,
.card-info--inline:focus-visible .card-tooltip {
  transform: translateX(-50%) translateY(0);
}

/* Abre para a direita (evita o corte no topo da página). Usar com --inline. */
.card-info--right .card-tooltip {
  bottom: auto;
  top: 50%;
  left: calc(100% + 8px);
  transform: translateY(-50%) translateX(-4px);
}
.card-info--right:hover .card-tooltip,
.card-info--right:focus-visible .card-tooltip {
  transform: translateY(-50%) translateX(0);
}

/* ═══ HERO: Património total (ValueHeroCard) — rodapé com a repartição ═══ */


.hero-alloc {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
  min-width: 0;
}

.hero-alloc-stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4) var(--space-8);
}

.alloc-bar {
  display: flex;
  gap: 2px;
  height: 6px;
  border-radius: var(--radius-full);
  overflow: hidden;
  background: var(--color-surface-muted);
}
.alloc-seg {
  display: block;
  height: 100%;
  min-width: 3px;
}

.alloc-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.alloc-pct {
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-text-muted);
}

/* ═══ Grelha estática (Contas + Objetivos + Movimentos) ═══ */
.static-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-5);
}

.static-card {
  display: flex;
  flex-direction: column;
  min-height: 300px;
}

.static-card > :deep(.empty) {
  flex: 1;
  justify-content: center;
}

/* Linhas (contas / movimentos) */
.row-list {
  display: flex;
  flex-direction: column;
  margin: 0 calc(-1 * var(--space-2));
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 10px var(--space-2);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: inherit;
  transition: background var(--transition-fast);
}
.row:hover {
  background: var(--color-surface-hover);
}

.row-logo {
  flex-shrink: 0;
}

.row-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
}
.row-icon--income {
  background: var(--color-success-soft);
  color: var(--color-income);
}
.row-icon--expense {
  background: var(--color-danger-soft);
  color: var(--color-expense);
}
.row-icon--invest {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.row-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.row-name {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.row-sub {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.row-amount {
  flex-shrink: 0;
  font-size: var(--text-sm);
}
.row-amount--expense {
  color: var(--color-text-strong);
}
.row-amount--invest {
  color: var(--color-warning);
}

/* Objetivos */
.objectives-wrap {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.objectives-inner {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.objectives-inner > :deep(.empty) {
  flex: 1;
  justify-content: center;
}
.objectives-wrap--locked .objectives-inner {
  filter: blur(6px) grayscale(0.25);
  opacity: 0.5;
  pointer-events: none;
  user-select: none;
}

.objectives-lock {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-3);
  pointer-events: none;
}
.objectives-lock-panel {
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  text-align: center;
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-md);
}
.objectives-lock-text {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.objectives-loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding-top: var(--space-2);
}
.objectives-loading-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.sk-bar {
  display: block;
  height: 10px;
  border-radius: var(--radius-full);
  background: linear-gradient(90deg, var(--color-surface-muted) 0%, var(--color-surface-2) 50%, var(--color-surface-muted) 100%);
  background-size: 200% 100%;
  animation: sk-shimmer 1.4s ease-in-out infinite;
}
.sk-bar--w60 { width: 60%; }
.sk-bar--track { height: 6px; }
@keyframes sk-shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

.objectives-block {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.objectives-list {
  display: flex;
  flex-direction: column;
  margin: 0 calc(-1 * var(--space-2));
}

.objective-row {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-2);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: inherit;
  transition: background var(--transition-fast);
}
.objective-row:hover {
  background: var(--color-surface-hover);
}

.objective-row-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.objective-pct {
  flex-shrink: 0;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
  font-variant-numeric: tabular-nums;
}

.objective-track {
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--color-surface-muted);
  overflow: hidden;
}
.objective-fill {
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--color-primary-text);
  transition: width var(--transition-slow);
}

.objective-meta {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  margin: 0;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
.objective-amounts {
  font-variant-numeric: tabular-nums;
}

.objectives-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: auto;
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border-subtle);
}
.objectives-more {
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-text-muted);
}

/* ═══ Modo de edição (reordenar cartões) ═══ */
.card-editing {
  outline: 2px dashed var(--color-primary-text);
  outline-offset: -2px;
  cursor: grab;
  user-select: none;
  transition: outline-color var(--transition-base);
}
.card-editing:active {
  cursor: grabbing;
}

.card-drag-placeholder {
  outline: 2px dashed var(--color-primary-text);
  outline-offset: -2px;
  background: rgba(var(--color-primary-rgb), 0.06);
  box-shadow: none;
}
.card-drag-placeholder > * {
  visibility: hidden;
}

/* Clone que segue o ponteiro (anexado ao body; mantém as classes do cartão) */
.card-floating {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  box-shadow: var(--shadow-lg);
  transform: rotate(-1deg);
  transition: none;
}

.card-drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--control-h-sm);
  height: var(--control-h-sm);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  cursor: grab;
  transition: color var(--transition-fast), background var(--transition-fast);
}
.card-drag-handle:hover {
  color: var(--color-selected-text);
  background: var(--color-selected);
}
.card-drag-handle:active {
  cursor: grabbing;
}










.inv-select {
  position: relative;
}

.inv-select-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 220px;
  max-width: 52vw;
  height: var(--control-h-sm);
  padding: 0 var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-xs);
  font-family: inherit;
  color: var(--color-text);
  cursor: pointer;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.inv-select-trigger:hover {
  border-color: var(--color-text-subtle);
}
.inv-select-trigger.open {
  border-color: var(--color-primary-text);
  box-shadow: var(--focus-ring);
}

.inv-select-label {
  flex: 1;
  min-width: 0;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inv-select-chevron {
  flex-shrink: 0;
  color: var(--color-text-muted);
  transition: transform var(--transition-base);
}
.inv-select-trigger.open .inv-select-chevron {
  transform: rotate(180deg);
}

.inv-select-all-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  border-radius: 6px;
  color: var(--color-text-muted);
  background: var(--color-surface-muted);
}
.inv-select-all-icon--lg {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
}

.inv-select-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 60;
  width: 320px;
  max-width: calc(100vw - 32px);
  max-height: 320px;
  overflow-y: auto;
  padding: var(--space-1);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}

.inv-select-opt {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-2);
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--transition-fast);
}
.inv-select-opt:hover {
  background: var(--color-surface-hover);
}
.inv-select-opt.active {
  background: var(--color-selected);
}

.inv-select-opt-text {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.inv-select-opt-name {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.inv-select-opt-sub {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
.inv-select-check {
  flex-shrink: 0;
  color: var(--color-primary-text);
}

/* ═══ Tiles internos (gráficos, KPIs, comparação) ═══ */
.tile-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-5);
}
.tile-grid--stacked {
  grid-template-columns: minmax(0, 1fr);
}

.chart-tile {
  min-width: 0;
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.tile-title {
  margin: 0 0 var(--space-4);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.trend-chart {
  position: relative;
  height: 280px;
}

/* Resumo do período */
.period-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-4);
}

.kpi {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.kpi-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-text-muted);
}

.kpi-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--color-text-subtle);
}
.kpi-dot--income { background: var(--color-income); }
.kpi-dot--expense { background: var(--color-expense); }
.kpi-dot--brand { background: var(--color-primary-text); }

.kpi-value {
  font-size: var(--text-xl);
  font-weight: var(--weight-bold);
  line-height: 1.2;
  letter-spacing: var(--tracking-tight);
  color: var(--color-text-strong);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kpi-sub {
  margin-top: -4px;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

/* Média diária */
.daily-avg {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3) var(--space-6);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.daily-avg-main,
.daily-avg-proj {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.daily-avg-proj {
  align-items: flex-end;
  text-align: right;
}

.daily-avg-value-row {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
.daily-avg-value {
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  color: var(--color-text-strong);
  font-variant-numeric: tabular-nums;
  letter-spacing: var(--tracking-tight);
}
.daily-avg-proj-value {
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
  font-variant-numeric: tabular-nums;
}

.daily-avg-progress {
  flex-basis: 100%;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--color-surface-muted);
  overflow: hidden;
}
.daily-avg-progress-bar {
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--color-primary-text);
  transition: width var(--transition-slow);
}

/* Plano mensal */
.plan-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-top: var(--space-5);
  border-top: 1px solid var(--color-border-subtle);
}

.plan-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.comparison-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
}

.comparison-tile {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-2);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  min-width: 0;
}

.comparison-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}
.comparison-label {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.comparison-value {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.comparison-value--muted {
  font-weight: var(--weight-medium);
  color: var(--color-text-secondary);
}

.comparison-diff {
  align-self: flex-start;
  margin-top: var(--space-1);
  font-variant-numeric: tabular-nums;
}

/* ═══ Seletor de datas ═══ */
.date-range-picker {
  position: relative;
}

.date-range-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  height: var(--control-h-sm);
  padding: 0 var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-xs);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}
.date-range-btn:hover {
  background: var(--color-surface-muted);
}
.date-range-btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.date-range-btn svg:first-child {
  color: var(--color-text-muted);
}

.date-range-chevron {
  color: var(--color-text-muted);
  transition: transform var(--transition-base);
}
.date-range-chevron.open {
  transform: rotate(180deg);
}

.date-range-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 60;
  max-width: calc(100vw - 32px);
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}

.dr-presets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border-subtle);
}

.dr-preset-btn {
  height: 28px;
  padding: 0 var(--space-3);
  font-family: inherit;
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: border-color var(--transition-fast), color var(--transition-fast), background var(--transition-fast);
}
.dr-preset-btn:hover {
  color: var(--color-text-strong);
  background: var(--color-surface-muted);
}
.dr-preset-btn.active {
  border-color: var(--color-border-strong);
  background: var(--color-selected);
  color: var(--color-selected-text);
}

.date-range-calendars {
  display: flex;
  gap: var(--space-5);
}

.dr-calendar {
  width: 240px;
}

.dr-cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.dr-cal-spacer {
  width: 28px;
}

.dr-cal-title {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
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
  transition: background var(--transition-fast), color var(--transition-fast);
}
.dr-cal-nav:hover {
  background: var(--color-surface-muted);
  color: var(--color-text-strong);
}

.dr-cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: var(--space-1);
}
.dr-cal-weekdays span {
  text-align: center;
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-caps);
  color: var(--color-text-subtle);
  padding: var(--space-1) 0;
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
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-text);
  cursor: pointer;
  border-radius: 0;
  font-variant-numeric: tabular-nums;
  transition: background var(--transition-fast);
}
.dr-day.empty {
  cursor: default;
}
.dr-day:not(.empty):hover,
.dr-day.in-range {
  background: var(--color-selected);
}
.dr-day.is-start,
.dr-day.is-end {
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-weight: var(--weight-bold);
}
.dr-day.is-start { border-radius: 6px 0 0 6px; }
.dr-day.is-end { border-radius: 0 6px 6px 0; }
.dr-day.is-start.is-end { border-radius: 6px; }

.panel-enter-active,
.panel-leave-active {
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}
.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* ═══ Modal: liquidar objetivos ═══ */
.settle-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: var(--color-modal-overlay);
  backdrop-filter: blur(4px);
}

.settle-modal {
  width: 100%;
  max-width: 440px;
  max-height: 80vh;
  overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.settle-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-border-subtle);
}
.settle-header h3 {
  margin: 0;
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.settle-list {
  padding: var(--space-2) var(--space-5) var(--space-4);
}

.settle-empty {
  margin: 0;
  padding: var(--space-6) 0;
  text-align: center;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.settle-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border-subtle);
}
.settle-item:last-child {
  border-bottom: none;
}

.settle-item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.settle-item-amount {
  font-size: var(--text-sm);
}

.settle-confirm {
  padding: var(--space-5);
}
.settle-confirm-text {
  margin: 0 0 var(--space-4);
  font-size: var(--text-base);
  color: var(--color-text);
  text-align: center;
}
.settle-confirm-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* ═══ Responsivo ═══ */
@media (max-width: 1024px) {
  .kpi-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .static-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .static-card {
    min-height: 0;
  }
  .comparison-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 720px) {
  .tile-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .date-range-calendars {
    flex-direction: column;
    gap: var(--space-3);
  }
  .dr-calendar {
    width: min(260px, calc(100vw - 72px));
  }
  .date-range-panel {
    max-height: 70vh;
    overflow-y: auto;
  }
}

@media (max-width: 640px) {
  .dash-card,
  .dashboard-section-card {
    padding: var(--space-4);
  }
  .hero-alloc-stats {
    gap: var(--space-3) var(--space-6);
  }
  .dash-card-head {
    flex-direction: column;
    align-items: flex-start;
  }
  .dash-card-actions {
    justify-content: flex-start;
  }
  .inv-select-trigger {
    width: 180px;
  }
  .kpi {
    padding: var(--space-3);
  }
  .kpi-value {
    font-size: var(--text-lg);
  }
  .daily-avg-proj {
    align-items: flex-start;
    text-align: left;
  }
}

@media (max-width: 420px) {
  .kpi-grid {
    gap: var(--space-3);
  }
}

/* Ações do cartão de Investimentos: período + seletor de ativo + "Ver tudo" */
.inv-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
