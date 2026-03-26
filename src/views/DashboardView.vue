<script setup lang="ts">
import { onMounted, computed, ref, nextTick } from 'vue'
import type { ExpenseByCategory, IncomeByCategory, MonthlyTrend } from '@/types/dashboard'
import type { SavingsObjectiveActive } from '@/types/objective'
import { objectivesApi } from '@/api/objectives'
import { useHouseholdStore } from '@/stores/household'
import { useAccountsStore } from '@/stores/accounts'
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
import MonthYearNavigator from '@/components/MonthYearNavigator.vue'

const householdStore = useHouseholdStore()
const accountsStore = useAccountsStore()
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
const objectivesMoreCount = computed(() => Math.max(0, objectivesActiveTotal.value - 4))

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
    const all = mapActiveObjectivesFromOverview(data)
    objectivesActiveTotal.value = all.length
    objectivesPreview.value = all.slice(0, 4)
  } catch {
    objectivesPreview.value = []
    objectivesActiveTotal.value = 0
  } finally {
    objectivesLoading.value = false
    objectivesLoaded.value = true
  }
}

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
  dashboardContentRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

const formattedBalance = computed(() => formatCurrency(dashboard.totalBalance.value, dashboard.currency.value))
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

const accountsToShow = computed(() => {
  const fromDashboard = dashboard.accountBalancesAtPeriod.value
  if (fromDashboard.length > 0) {
    return fromDashboard.map(a => ({
      id: a.accountId,
      name: a.name,
      type: a.type,
      balance: a.balance,
      currency: a.currency
    }))
  }
  return accountsStore.accounts
})

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

const finalBalance = computed(() => dashboard.monthlyIncome.value - dashboard.monthlyExpenses.value)
const savingsRate = computed(() => {
  const inc = dashboard.monthlyIncome.value
  const sav = dashboard.monthlySavings.value
  return inc > 0 ? Math.round((sav / inc) * 100) : 0
})

function formatPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${value}%`
}

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
      <div class="page-header">
        <h1>Dashboard</h1>
        <p class="subtitle">
          Acompanha as tuas despesas e receitas com toda a informação necessária para gerires o orçamento e
          poupares de forma mais consciente.
        </p>
      </div>

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

      <div v-if="periodChangeLoading" class="period-refresh-state">
        <div class="period-refresh-inner">
          <div class="spinner"></div>
          <p class="period-refresh-text">A atualizar dados do dashboard...</p>
        </div>
      </div>

      <template v-else>
      <div class="dashboard-section-card">
        <h2 class="section-title">{{ periodLabel || 'Resumo' }}</h2>
        <div class="summary-cards summary-cards-fallback">
          <div class="card">
            <p class="card-title">Saldo total</p>
            <p class="card-value">{{ formattedBalance }}</p>
            <p class="card-subtitle">Todas as contas</p>
          </div>
          <div class="card card-income">
            <p class="card-title">Receitas</p>
            <p class="card-value">{{ formattedIncome }}</p>
            <p class="card-subtitle">{{ periodLabel }}</p>
          </div>
          <div class="card card-expense">
            <p class="card-title">Despesas</p>
            <p class="card-value">{{ formattedExpenses }}</p>
            <p class="card-subtitle">{{ periodLabel }}</p>
          </div>
          <div class="card card-savings">
            <p class="card-title">Poupança</p>
            <p class="card-value">{{ formattedSavings }}</p>
            <p class="card-subtitle">{{ periodLabel }}</p>
          </div>
        </div>

        <div class="dashboard-objectives">
          <div class="dashboard-objectives-header">
            <h3 class="dashboard-objectives-title">Objetivos de poupança</h3>
            <router-link :to="{ name: 'objectives' }" class="dashboard-objectives-link">Ver todos</router-link>
          </div>
          <div v-if="objectivesLoading" class="objectives-preview-skeleton">
            <span class="objectives-preview-loading">A carregar objetivos…</span>
          </div>
          <div v-else-if="objectivesPreview.length > 0" class="objectives-preview-block">
            <div class="objectives-preview-grid">
              <router-link
                v-for="goal in objectivesPreview"
                :key="goal.id"
                :to="{ name: 'objectives' }"
                class="objective-preview-card"
              >
                <p class="objective-preview-name">{{ goal.name }}</p>
                <p class="objective-preview-amounts">
                  {{ formatCurrency(goal.allocatedAmount, dashboard.currency.value) }} /
                  {{ formatCurrency(goal.targetAmount, dashboard.currency.value) }}
                </p>
                <div class="objective-preview-track" role="progressbar" :aria-valuenow="goal.progressPercent" aria-valuemin="0" aria-valuemax="100">
                  <div class="objective-preview-fill" :style="{ width: `${Math.min(100, goal.progressPercent)}%` }" />
                </div>
                <p class="objective-preview-meta">
                  <span>{{ goal.progressPercent.toFixed(0) }}%</span>
                  <span v-if="goal.targetDate" class="objective-preview-date"> · Meta {{ formatObjectiveDate(goal.targetDate) }}</span>
                </p>
              </router-link>
            </div>
            <p v-if="objectivesMoreCount > 0" class="objectives-more-count">
              +{{ objectivesMoreCount }}
              {{ objectivesMoreCount === 1 ? 'objetivo ativo' : 'objetivos ativos' }}
            </p>
          </div>
          <div v-else-if="objectivesLoaded" class="objectives-preview-empty">
            <p class="objectives-preview-empty-text">Ainda não tens objetivos ativos.</p>
            <router-link :to="{ name: 'objectives' }" class="btn-add-objective">+ Criar objetivo</router-link>
          </div>
        </div>
      </div>

      <div class="dashboard-section-card">
        <h2 class="section-title">Contas</h2>
        <div v-if="accountsToShow.length > 0" class="accounts-grid">
          <router-link
            v-for="account in accountsToShow"
            :key="account.id"
            :to="{ name: 'accounts' }"
            class="account-card-link"
          >
            <div class="account-card">
              <div class="account-card-header">
                <span v-if="isCreditCard(account.type)" class="account-card-icon" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="20" height="14" x="2" y="5" rx="2"/>
                    <line x1="2" x2="22" y1="10" y2="10"/>
                  </svg>
                </span>
                <p class="account-card-name">{{ account.name }}</p>
              </div>
              <p class="account-card-balance" :class="{ negative: account.balance < 0 }">
                {{ formatCurrency(account.balance, account.currency) }}
              </p>
              <span class="account-card-type">{{ accountTypeLabel(account.type) }}</span>
            </div>
          </router-link>
        </div>
        <div v-else class="section-empty">
          <p class="section-empty-text">Ainda não tens contas.</p>
          <router-link to="/accounts" class="btn-section-add">Adicionar a sua primeira conta</router-link>
        </div>
      </div>

      <div class="dashboard-section-card">
        <h2 class="section-title">Plano mensal</h2>
        <div v-if="hasChartData && hasBudgetForPeriod" class="comparison-grid">
          <div class="comparison-card">
            <h3 class="comparison-title">Receitas</h3>
            <div class="comparison-row">
              <span class="comparison-label">Esperado</span>
              <span class="comparison-value expected">{{ formatCurrency(budgetForPeriod.expectedIncome, dashboard.currency.value) }}</span>
            </div>
            <div class="comparison-row">
              <span class="comparison-label">Real</span>
              <span class="comparison-value" :class="{ 'above': dashboard.monthlyIncome.value > budgetForPeriod.expectedIncome, 'below': dashboard.monthlyIncome.value < budgetForPeriod.expectedIncome }">
                {{ formattedIncome }}
              </span>
            </div>
            <div v-if="budgetForPeriod.expectedIncome > 0" class="comparison-diff">
              {{ dashboard.monthlyIncome.value >= budgetForPeriod.expectedIncome ? '✓' : '' }}
              {{ formatCurrency(dashboard.monthlyIncome.value - budgetForPeriod.expectedIncome, dashboard.currency.value) }}
              {{ dashboard.monthlyIncome.value >= budgetForPeriod.expectedIncome ? 'acima' : 'abaixo' }}
            </div>
          </div>
          <div class="comparison-card">
            <h3 class="comparison-title">Despesas</h3>
            <div class="comparison-row">
              <span class="comparison-label">Esperado</span>
              <span class="comparison-value expected">{{ formatCurrency(budgetForPeriod.expectedExpenses, dashboard.currency.value) }}</span>
            </div>
            <div class="comparison-row">
              <span class="comparison-label">Real</span>
              <span class="comparison-value" :class="{ 'above': dashboard.monthlyExpenses.value < budgetForPeriod.expectedExpenses, 'below': dashboard.monthlyExpenses.value > budgetForPeriod.expectedExpenses }">
                {{ formattedExpenses }}
              </span>
            </div>
            <div v-if="budgetForPeriod.expectedExpenses > 0" class="comparison-diff">
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
                {{ formatCurrency(budgetForPeriod.expectedIncome - budgetForPeriod.expectedExpenses, dashboard.currency.value) }}
              </span>
            </div>
            <div class="comparison-row">
              <span class="comparison-label">Real</span>
              <span class="comparison-value" :class="dashboard.monthlySavings.value >= 0 ? 'income' : 'expense'">
                {{ formattedSavings }}
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

      <div class="dashboard-section-card resumo-section">
        <h2 class="section-title">Resumo final</h2>
        <div class="summary-cards summary-cards-fallback">
          <div class="card card-balance">
            <p class="card-title">Saldo final</p>
            <p class="card-value">{{ formatCurrency(finalBalance, dashboard.currency.value) }}</p>
            <p class="card-subtitle">Receitas − Despesas reais</p>
          </div>
          <div class="card card-income">
            <p class="card-title">Taxa de poupança</p>
            <p class="card-value">{{ formatPercent(savingsRate) }}</p>
            <p class="card-subtitle">% da receita real poupada</p>
          </div>
        </div>
      </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 100%;
  margin: 0 auto;
  padding: 0;
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
  border-radius: var(--app-radius-md, 12px);
  padding: 1.375rem 1.5rem;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
  border: 1px solid var(--color-border);
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
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
  display: inline-block;
  padding: 0.625rem 1.25rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: #fff;
  background: #166534;
  border: none;
  border-radius: 8px;
  text-decoration: none;
  transition: background 0.2s;
}

.btn-section-add:hover {
  background: #15803d;
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
  font-size: 1.0625rem;
  font-weight: 650;
  letter-spacing: -0.025em;
  color: var(--color-text);
  margin: 0 0 1rem 0;
  line-height: 1.3;
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

.dashboard-objectives {
  margin-top: 1.35rem;
  padding-top: 1.25rem;
  border-top: 1px solid var(--color-border);
}

.dashboard-objectives-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.875rem;
}

.dashboard-objectives-title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 650;
  color: var(--color-text);
  letter-spacing: -0.02em;
}

.dashboard-objectives-link {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #166534;
  text-decoration: none;
}

.dashboard-objectives-link:hover {
  text-decoration: underline;
}

html.dark .dashboard-objectives-link {
  color: #4ade80;
}

.objectives-preview-block {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.objectives-more-count {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.objectives-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 0.75rem;
}

.objective-preview-card {
  display: block;
  padding: 0.875rem 1rem;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.objective-preview-card:hover {
  border-color: #166534;
  box-shadow: 0 2px 8px rgba(22, 101, 52, 0.12);
}

.objective-preview-name {
  margin: 0 0 0.35rem;
  font-size: 0.875rem;
  font-weight: 650;
  color: var(--color-text);
  line-height: 1.3;
}

.objective-preview-amounts {
  margin: 0 0 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.objective-preview-track {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: var(--color-table-row-hover);
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
  display: inline-block;
  padding: 0.45rem 0.9rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #fff;
  background: #166534;
  border-radius: 8px;
  text-decoration: none;
}

.btn-add-objective:hover {
  background: #15803d;
}

.summary-cards-fallback .card {
  background: var(--color-bg-card);
  border-radius: var(--app-radius-md, 12px);
  padding: 1.125rem 1.25rem;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
  border: 1px solid var(--color-border);
  transition: box-shadow 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.summary-cards-fallback .card:hover {
  box-shadow: var(--app-shadow-card-hover, 0 4px 12px rgba(0, 0, 0, 0.08));
  border-color: var(--color-border);
}

.summary-cards-fallback .card-title {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-muted);
  margin: 0 0 0.5rem 0;
}

.summary-cards-fallback .card-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.summary-cards-fallback .card-subtitle {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0.25rem 0 0 0;
}

.summary-cards-fallback .card-income .card-value { color: #059669; }
.summary-cards-fallback .card-expense .card-value { color: #dc2626; }
.summary-cards-fallback .card-savings .card-value { color: #2563eb; }
.summary-cards-fallback .card-balance .card-value {
  color: var(--color-text);
}


.accounts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1.25rem;
}

.account-card-link {
  text-decoration: none;
  color: inherit;
}

.account-card {
  background: var(--color-bg-card);
  border-radius: var(--app-radius-md, 12px);
  padding: 1.125rem 1.25rem;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
  border: 1px solid var(--color-border);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.account-card-link:hover .account-card {
  border-color: rgba(22, 101, 52, 0.45);
  box-shadow: var(--app-shadow-card-hover, 0 4px 16px rgba(0, 0, 0, 0.1));
}

.account-card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.account-card-icon {
  display: inline-flex;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  color: var(--color-text);
}

.account-card-icon svg {
  width: 100%;
  height: 100%;
}

.account-card-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.account-card-balance {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.account-card-balance.negative {
  color: var(--color-expense);
}

.account-card-type {
  display: inline-block;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-top: 0.5rem;
}

.comparison-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
}

.comparison-card {
  background: var(--color-bg-card);
  border-radius: var(--app-radius-md, 12px);
  padding: 1.25rem;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
  border: 1px solid var(--color-border);
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
  color: #64748b;
}

.comparison-value.income { color: #059669; }
.comparison-value.expense { color: #dc2626; }
.comparison-value.above { color: #059669; }
.comparison-value.below { color: #dc2626; }

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
  border-radius: var(--app-radius-md, 12px);
  padding: 1.25rem;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
  border: 1px solid var(--color-border);
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

</style>
