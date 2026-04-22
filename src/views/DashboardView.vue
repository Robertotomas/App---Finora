<script setup lang="ts">
import { onMounted, computed, ref, nextTick, watch } from 'vue'
import type { ExpenseByCategory, IncomeByCategory, MonthlyTrend } from '@/types/dashboard'
import type { SavingsObjectiveActive } from '@/types/objective'
import { objectivesApi } from '@/api/objectives'
import { useHouseholdStore } from '@/stores/household'
import { useAccountsStore } from '@/stores/accounts'
import { useSubscriptionStore } from '@/stores/subscription'
import { useDashboard } from '@/composables/useDashboard'
import { useMonthlyBudget } from '@/composables/useMonthlyBudget'
import { ACCOUNT_TYPE_LABELS, AccountType } from '@/types/account'

function isCreditCard(type: number): boolean {
  return Number(type) === AccountType.CreditCard
}

function accountTypeLabel(type: number): string {
  return ACCOUNT_TYPE_LABELS[type as AccountType] ?? ''
}
import DashboardSkeleton from '@/components/DashboardSkeleton.vue'
import ExpensesPieChart from '@/components/charts/ExpensesPieChart.vue'
import IncomePieChart from '@/components/charts/IncomePieChart.vue'
import MonthlyLineChart from '@/components/charts/MonthlyLineChart.vue'
import BudgetProgressChart from '@/components/charts/BudgetProgressChart.vue'
import NetWorthChart from '@/components/charts/NetWorthChart.vue'
import MonthYearNavigator from '@/components/MonthYearNavigator.vue'

const householdStore = useHouseholdStore()
const accountsStore = useAccountsStore()
const subscriptionStore = useSubscriptionStore()
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
    objectivesPreview.value = all.slice(0, 3)

    objectivesReserved.value = Number(pick('reservedByCompletedObjectives')) || 0
    objectivesTotalSavings.value = Number(pick('totalSavings')) || 0

    const history = pick('historyObjectives')
    objectivesCompletedCount.value = Array.isArray(history) ? history.length : 0
  } catch {
    objectivesPreview.value = []
    objectivesActiveTotal.value = 0
    objectivesReserved.value = 0
    objectivesTotalSavings.value = 0
    objectivesCompletedCount.value = 0
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

const MONTH_NAMES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const now = new Date()
const selectedYear = ref(now.getFullYear())
const selectedMonth = ref(now.getMonth() + 1)

const navYears = computed(() => {
  const y = now.getFullYear()
  return [y, y - 1, y - 2, y - 3, 0]
})

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
            dashboard.fetch(true),
            accountsStore.fetchAccounts(),
            loadObjectivesPreview(),
            subscriptionStore.fetchSubscription(),
            fetchChartTrend(),
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

const expensesForChart = computed<ExpenseByCategory[]>(() => dashboard.expensesForChart?.value ?? [])
const incomeForChart = computed<IncomeByCategory[]>(() => dashboard.incomeForChart?.value ?? [])
const trendForChart = computed<MonthlyTrend[]>(() => dashboard.trendForChart?.value ?? [])
const periodLabel = computed(() => {
  if (selectedYear.value === 0) return 'Resumo total'
  if (selectedMonth.value === -1) {
    const y = selectedYear.value
    const n = new Date()
    const endM = y < n.getFullYear() ? 12 : y > n.getFullYear() ? 0 : n.getMonth() + 1
    if (endM === 0) return `Início do ano até agora · ${y}`
    const from = `Janeiro ${y}`
    const to = `${MONTH_NAMES[endM]} ${y}`
    return `Início do ano até agora (${from} – ${to})`
  }
  if (selectedMonth.value === 0) return `Resumo total ${selectedYear.value}`
  return `${MONTH_NAMES[selectedMonth.value]} ${selectedYear.value}`
})

/* Contas e património: sempre dados atuais (não afetados pelo filtro) */
const accountsToShow = computed(() => accountsStore.accounts)

const currentTotalBalance = computed(() =>
  accountsStore.accounts.reduce((sum, a) => sum + a.balance, 0)
)
const formattedCurrentBalance = computed(() =>
  formatCurrency(currentTotalBalance.value, dashboard.currency.value)
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

const hasExpectedValuesForProgress = computed(() =>
  budgetForPeriod.value.expectedIncome > 0 || budgetForPeriod.value.expectedExpenses > 0
)

const savingsRate = computed(() => {
  const inc = dashboard.monthlyIncome.value
  const sav = dashboard.monthlySavings.value
  return inc > 0 ? Math.round((sav / inc) * 100) : 0
})

function formatPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${value}%`
}

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

const totalAllocatedToObjectives = computed(() =>
  objectivesReserved.value + objectivesPreview.value.reduce((s, g) => s + g.allocatedAmount, 0)
)

const hideValues = ref(false)

const todayLabel = computed(() => {
  const d = new Date()
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })
})

/* ── Net worth chart period filter ── */
type ChartPeriod = 'YTD' | '3M' | '6M' | '1A' | '5A'
const chartPeriod = ref<ChartPeriod>('6M')
const chartPeriods: ChartPeriod[] = ['YTD', '3M', '6M', '1A', '5A']

const chartTrendMonths = computed(() => {
  if (chartPeriod.value === 'YTD') {
    // January = month 1, so current month number = months since start of year (including current)
    return new Date().getMonth() + 1
  }
  const map: Record<ChartPeriod, number> = { YTD: 0, '3M': 3, '6M': 6, '1A': 12, '5A': 60 }
  return map[chartPeriod.value]
})

const chartTrendData = ref<MonthlyTrend[]>([])
const chartLoading = ref(false)

async function fetchChartTrend() {
  chartLoading.value = true
  try {
    const response = await import('@/api/dashboard').then((m) =>
      m.dashboardApi.get({ trendMonths: chartTrendMonths.value })
    )
    const res = (response.data ?? response) as unknown as Record<string, unknown>
    const get = (key: string) => res[key] ?? res[key.charAt(0).toUpperCase() + key.slice(1)]
    const arr = get('monthlyTrend')
    if (Array.isArray(arr)) {
      chartTrendData.value = arr.map((x: Record<string, unknown>) => ({
        year: Number(x.year ?? x.Year) || 0,
        month: Number(x.month ?? x.Month) || 0,
        label: String(x.label ?? x.Label ?? ''),
        income: Number(x.income ?? x.Income) || 0,
        expenses: Number(x.expenses ?? x.Expenses) || 0,
        savings: Number(x.savings ?? x.Savings) || 0,
      }))
    }
  } catch {
    // keep existing data
  } finally {
    chartLoading.value = false
  }
}

watch(chartPeriod, () => fetchChartTrend())

const showContent = computed(() =>
  mounted.value &&
  !loadError.value &&
  !!householdStore.household &&
  !!dashboard.data?.value
)
</script>

<template>
  <div class="dashboard" :data-dev="isDev">
    <div v-if="!mounted" class="loading-state">
      <div class="spinner"></div>
      <p>A carregar...</p>
    </div>

    <div v-else-if="loadError" class="error-state">
      <p>{{ loadError }}</p>
      <p class="error-hint">Abre a consola do browser (F12) e o separador Network para verificar os pedidos à API.</p>
    </div>

    <div v-else-if="!householdStore.household && !householdStore.loading" class="empty-state">
      <p>Configura primeiro o teu household.</p>
      <router-link to="/household" class="link">Ir para Household</router-link>
    </div>

    <div v-else-if="householdStore.loading && !householdStore.household" class="loading-state">
      <div class="spinner"></div>
      <p>A carregar...</p>
    </div>

    <div v-else-if="dashboard.error" class="error-state">
      <p>{{ dashboard.error }}</p>
    </div>

    <div v-else-if="dashboard.loading && !dashboard.data" class="dashboard-content">
      <DashboardSkeleton :cards="4" :show-charts="true" />
    </div>

    <div v-else-if="!dashboard.data && !dashboard.loading" class="loading-state">
      <div class="spinner"></div>
      <p>A carregar dashboard...</p>
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
            <p class="patrimonio-value">{{ hideValues ? '••••••' : formattedCurrentBalance }}</p>
            <span class="patrimonio-date">{{ todayLabel }}</span>
            <span v-if="totalAllocatedToObjectives > 0" class="patrimonio-reserved">
              {{ hideValues ? '•••••' : formatCurrency(totalAllocatedToObjectives, dashboard.currency.value) }} reservado para objetivos
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
              v-else-if="chartTrendData.length > 0"
              :trend-data="chartTrendData"
              :current-balance="currentTotalBalance"
              :currency="dashboard.currency.value"
            />
            <div v-else class="patrimonio-chart-empty">
              <p>Sem dados de evolução disponíveis.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ STATIC GRID: Contas + Objetivos (dados atuais) ═══ -->
      <div class="static-grid">
        <!-- Card: Contas -->
        <div class="dashboard-section-card static-card">
          <div class="static-card-header">
            <h2 class="section-title">Contas</h2>
            <router-link :to="{ name: 'accounts' }" class="static-card-link">Ver todas</router-link>
          </div>
          <div v-if="accountsToShow.length > 0" class="accounts-list">
            <router-link
              v-for="account in accountsToShow.slice(0, 4)"
              :key="account.id"
              :to="{ name: 'accounts' }"
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
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="static-card-empty-icon"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
            <p>Veja o saldo das suas contas num só lugar</p>
            <router-link to="/accounts" class="static-card-action">Adicionar</router-link>
          </div>
        </div>

        <!-- Card: Objetivos -->
        <div class="dashboard-section-card static-card">
          <div class="static-card-header">
            <h2 class="section-title">Objetivos de poupança</h2>
            <router-link :to="{ name: 'objectives' }" class="static-card-link">Ver todos</router-link>
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
                    :to="{ name: 'objectives' }"
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
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="static-card-empty-icon"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                <p>Defina objetivos de poupança para acompanhar o progresso</p>
                <router-link
                  v-if="subscriptionStore.canAccessObjectives"
                  :to="{ name: 'objectives' }"
                  class="static-card-action"
                >Criar objetivo</router-link>
                <router-link v-else :to="{ name: 'subscription' }" class="static-card-action">Ver planos</router-link>
              </div>
            </div>
            <div v-if="!subscriptionStore.canAccessObjectives && objectivesPreview.length > 0" class="dashboard-objectives-lock-overlay">
              <div class="dashboard-objectives-lock-panel">
                <p class="dashboard-objectives-lock-text">Atualize o plano para visualização completa</p>
                <router-link :to="{ name: 'subscription' }" class="btn-add-objective dashboard-objectives-lock-cta">Ver planos</router-link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ FILTERED SECTIONS (dados dinâmicos por período) ═══ -->
      <div class="dashboard-section-card">
        <div class="section-header-row">
          <h2 class="section-title">{{ periodLabel || 'Resumo' }}</h2>
          <div class="period-filter-bar">
            <MonthYearNavigator
              v-model:month="selectedMonth"
              v-model:year="selectedYear"
              :years="navYears"
              :month-names="MONTH_NAMES"
              allow-all-months
              allow-all-years
              allow-year-to-date
              @change="onPeriodChange"
            />
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
            <p class="card-title">Receitas</p>
            <p class="card-value">{{ hideValues ? '••••• €' : formattedIncome }}</p>
            <p class="card-subtitle">{{ periodLabel }}</p>
          </div>
          <div class="card card-expense">
            <p class="card-title">Despesas</p>
            <p class="card-value">{{ hideValues ? '••••• €' : formattedExpenses }}</p>
            <p class="card-subtitle">{{ periodLabel }}</p>
          </div>
          <div class="card card-savings">
            <p class="card-title">Poupança</p>
            <p class="card-value">{{ hideValues ? '••••• €' : formattedSavings }}</p>
            <p class="card-subtitle">{{ periodLabel }}</p>
          </div>
          <div class="card card-income">
            <p class="card-title">Taxa de poupança</p>
            <p class="card-value">{{ hideValues ? '•••' : formatPercent(savingsRate) }}</p>
            <p class="card-subtitle">% da receita real poupada</p>
          </div>
        </div>
        </template>
      </div>

      <div class="dashboard-section-card">
        <h2 class="section-title">Plano mensal</h2>
        <div v-if="hasChartData && hasBudgetForPeriod" class="comparison-grid">
          <div class="comparison-card">
            <h3 class="comparison-title">Receitas</h3>
            <div class="comparison-row">
              <span class="comparison-label">Esperado</span>
              <span class="comparison-value expected">{{ hideValues ? '••••• €' : formatCurrency(budgetForPeriod.expectedIncome, dashboard.currency.value) }}</span>
            </div>
            <div class="comparison-row">
              <span class="comparison-label">Real</span>
              <span class="comparison-value" :class="{ 'above': dashboard.monthlyIncome.value > budgetForPeriod.expectedIncome, 'below': dashboard.monthlyIncome.value < budgetForPeriod.expectedIncome }">
                {{ hideValues ? '••••• €' : formattedIncome }}
              </span>
            </div>
            <div v-if="budgetForPeriod.expectedIncome > 0 && !hideValues" class="comparison-diff">
              {{ dashboard.monthlyIncome.value >= budgetForPeriod.expectedIncome ? '✓' : '' }}
              {{ formatCurrency(dashboard.monthlyIncome.value - budgetForPeriod.expectedIncome, dashboard.currency.value) }}
              {{ dashboard.monthlyIncome.value >= budgetForPeriod.expectedIncome ? 'acima' : 'abaixo' }}
            </div>
          </div>
          <div class="comparison-card">
            <h3 class="comparison-title">Despesas</h3>
            <div class="comparison-row">
              <span class="comparison-label">Esperado</span>
              <span class="comparison-value expected">{{ hideValues ? '••••• €' : formatCurrency(budgetForPeriod.expectedExpenses, dashboard.currency.value) }}</span>
            </div>
            <div class="comparison-row">
              <span class="comparison-label">Real</span>
              <span class="comparison-value" :class="{ 'above': dashboard.monthlyExpenses.value < budgetForPeriod.expectedExpenses, 'below': dashboard.monthlyExpenses.value > budgetForPeriod.expectedExpenses }">
                {{ hideValues ? '••••• €' : formattedExpenses }}
              </span>
            </div>
            <div v-if="budgetForPeriod.expectedExpenses > 0 && !hideValues" class="comparison-diff">
              {{ dashboard.monthlyExpenses.value <= budgetForPeriod.expectedExpenses ? '✓' : '' }}
              {{ formatCurrency(dashboard.monthlyExpenses.value - budgetForPeriod.expectedExpenses, dashboard.currency.value) }}
              {{ dashboard.monthlyExpenses.value <= budgetForPeriod.expectedExpenses ? 'abaixo do orçamento' : 'acima do orçamento' }}
            </div>
          </div>
          <div class="comparison-card">
            <h3 class="comparison-title">Poupança</h3>
            <div class="comparison-row">
              <span class="comparison-label">Esperado</span>
              <span class="comparison-value" :class="(budgetForPeriod.expectedIncome - budgetForPeriod.expectedExpenses) >= 0 ? 'income' : 'expense'">
                {{ hideValues ? '••••• €' : formatCurrency(budgetForPeriod.expectedIncome - budgetForPeriod.expectedExpenses, dashboard.currency.value) }}
              </span>
            </div>
            <div class="comparison-row">
              <span class="comparison-label">Real</span>
              <span class="comparison-value" :class="dashboard.monthlySavings.value >= 0 ? 'income' : 'expense'">
                {{ hideValues ? '••••• €' : formattedSavings }}
              </span>
            </div>
          </div>
        </div>
        <div v-else class="section-empty">
          <p class="section-empty-text">Ainda não definiste o teu plano mensal.</p>
          <router-link to="/monthly" class="btn-section-add">Adicionar o seu plano mensal</router-link>
        </div>
      </div>

      <div class="dashboard-section-card">
        <h2 class="section-title">Transações e gráficos</h2>
        <div v-if="hasChartData" class="charts-section-inner">
          <div v-if="hasBudgetForPeriod && hasExpectedValuesForProgress" class="chart-card chart-card-full">
            <h3 class="chart-title">Progresso até ao esperado</h3>
            <BudgetProgressChart
              :real-income="dashboard.monthlyIncome.value"
              :expected-income="budgetForPeriod.expectedIncome"
              :real-expenses="dashboard.monthlyExpenses.value"
              :expected-expenses="budgetForPeriod.expectedExpenses"
              :format-currency="(v) => formatCurrency(v, dashboard.currency.value)"
            />
          </div>
          <div v-if="hasExpensesForChart" class="chart-card">
            <h3 class="chart-title">Despesas por categoria</h3>
            <ExpensesPieChart :data="expensesForChart" />
          </div>
          <div v-if="hasIncomeForChart" class="chart-card">
            <h3 class="chart-title">Receitas por categoria</h3>
            <IncomePieChart :data="incomeForChart" />
          </div>
          <div class="chart-card">
            <h3 class="chart-title">Evolução mensal</h3>
            <MonthlyLineChart :data="trendForChart" />
          </div>
        </div>
        <div v-else-if="dashboard.monthHasNoStats" class="section-empty">
          <p class="section-empty-text">Não há dados estatísticos para {{ periodLabel }}.</p>
          <p class="section-empty-hint">Seleciona outro mês para ver receitas, despesas e gráficos.</p>
        </div>
        <div v-else class="section-empty">
          <p class="section-empty-text">Os gráficos ficam disponíveis quando inserir dados.</p>
          <router-link to="/transactions" class="btn-section-add">Adicionar a sua primeira transação</router-link>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 100%;
  margin: 0 auto;
  padding: 0;
  margin-top: -3rem;
  min-height: 400px;
  background: transparent;
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
  font-size: 0.9375rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-text);
  margin: 0 0 1.125rem 0;
  line-height: 1.3;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid var(--color-border);
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
  padding: 0.5rem 0;
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
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
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
  border-radius: 12px;
  padding: 1.125rem 1.25rem 1.125rem 1.375rem;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-border);
  transition: box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.summary-cards-fallback .card:hover {
  box-shadow: var(--app-shadow-card-hover, 0 4px 12px rgba(0, 0, 0, 0.08));
  transform: translateY(-2px);
}

.summary-cards-fallback .card-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  margin: 0 0 0.625rem 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.summary-cards-fallback .card-value {
  font-size: 1.625rem;
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

.summary-cards-fallback .card-income { border-left-color: var(--color-income); }
.summary-cards-fallback .card-income .card-value { color: var(--color-income); }
.summary-cards-fallback .card-expense { border-left-color: var(--color-expense); }
.summary-cards-fallback .card-expense .card-value { color: var(--color-expense); }
.summary-cards-fallback .card-savings { border-left-color: #2563eb; }
.summary-cards-fallback .card-savings .card-value { color: var(--color-link-hover, #2563eb); }
.summary-cards-fallback .card-balance .card-value { color: var(--color-text); }



.comparison-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
}

.comparison-card {
  background: var(--color-bg);
  border-radius: 12px;
  padding: 1.25rem;
  border: 1px solid var(--color-border);
  transition: border-color 0.2s;
}

.comparison-card:hover {
  border-color: rgba(22, 101, 52, 0.3);
}

.comparison-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 1rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border);
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

.charts-section-inner {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.75rem;
}

.chart-card {
  background: var(--color-bg-card);
  border-radius: 12px;
  padding: 1.375rem;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
  border: 1px solid var(--color-border);
  transition: box-shadow 0.2s, transform 0.15s;
}

.chart-card:hover {
  box-shadow: var(--app-shadow-card-hover, 0 4px 12px rgba(0, 0, 0, 0.08));
  transform: translateY(-1px);
}

.chart-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 1rem 0;
}

.chart-card-full {
  grid-column: 1 / -1;
}

/* ═══ STATIC GRID (Contas + Objetivos) ═══ */
.static-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

.static-card {
  display: flex;
  flex-direction: column;
  padding: 0.875rem 1rem;
}

.static-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.625rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--color-border);
}

.static-card-header .section-title {
  margin: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.static-card-link {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #166534;
  text-decoration: none;
  flex-shrink: 0;
}

.static-card-link:hover {
  text-decoration: underline;
}

html.dark .static-card-link {
  color: #4ade80;
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
  padding: 0.375rem 0.125rem;
  text-decoration: none;
  color: inherit;
  border-bottom: 1px solid var(--color-border);
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
  padding: 1.5rem 2rem 1.25rem;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
  border: 1px solid var(--color-border);
  margin-top: 0;
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
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
}

.patrimonio-period-btn {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  border-right: 1px solid var(--color-border);
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
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

/* section-header-row: title + period filter inline */
.section-header-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1.125rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid var(--color-border);
}

.section-header-row .section-title {
  margin: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.section-header-row .period-filter-bar {
  margin: 0;
  padding: 0;
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

  .section-header-row {
    flex-direction: column;
    align-items: flex-start;
  }
}

</style>
