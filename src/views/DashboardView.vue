<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import type { ExpenseByCategory, IncomeByCategory, MonthlyTrend } from '@/types/dashboard'
import { useAuthStore } from '@/stores/auth'
import { useHouseholdStore } from '@/stores/household'
import { useDashboard } from '@/composables/useDashboard'
import { useMonthlyBudget } from '@/composables/useMonthlyBudget'
import DashboardSkeleton from '@/components/DashboardSkeleton.vue'
import ExpensesPieChart from '@/components/charts/ExpensesPieChart.vue'
import IncomePieChart from '@/components/charts/IncomePieChart.vue'
import MonthlyLineChart from '@/components/charts/MonthlyLineChart.vue'
import BudgetProgressChart from '@/components/charts/BudgetProgressChart.vue'

const authStore = useAuthStore()
const householdStore = useHouseholdStore()
const dashboard = useDashboard()
const budget = useMonthlyBudget()
const mounted = ref(false)
const loadError = ref<string | null>(null)
const isDev = import.meta.env.DEV

const MONTH_NAMES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const now = new Date()
const selectedYear = ref(now.getFullYear())
const selectedMonth = ref(now.getMonth() + 1)

const yearOptions = computed(() => {
  const y = now.getFullYear()
  return [y, y - 1, y - 2, y - 3]
})

async function onPeriodChange() {
  dashboard.setPeriod(selectedYear.value, selectedMonth.value)
  dashboard.invalidateCache()
  await dashboard.fetch(true)
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
          await dashboard.fetch(true)
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
const periodLabel = computed(() => dashboard.periodLabel.value)

const hasChartData = computed(
  () => dashboard.monthlyIncome.value > 0 || dashboard.monthlyExpenses.value > 0
)
const hasExpensesForChart = computed(() => dashboard.monthlyExpenses.value > 0)
const hasIncomeForChart = computed(() => dashboard.monthlyIncome.value > 0)

const budgetForPeriod = computed(() => {
  budget.budgetStore.value // reactive dependency
  return budget.getBudget(householdStore.household?.id, selectedYear.value, selectedMonth.value)
})

const hasBudgetForPeriod = computed(() => {
  budget.budgetStore.value
  return budget.hasBudget(householdStore.household?.id, selectedYear.value, selectedMonth.value)
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
  !!dashboard.data?.value &&
  !dashboard.isEmpty?.value
)
</script>

<template>
  <div class="dashboard" :data-dev="isDev">
    <div class="page-header">
      <h1>Dashboard</h1>
      <p v-if="authStore.user" class="greeting">
        Olá, {{ authStore.user.firstName }} {{ authStore.user.lastName }}!
      </p>
      <p v-if="authStore.user?.email" class="email">{{ authStore.user.email }}</p>
    </div>

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

    <div v-else-if="dashboard.data && dashboard.isEmpty" class="empty-state empty-state-card">
      <div class="period-selector period-selector-center">
        <select v-model.number="selectedMonth" @change="onPeriodChange" class="period-select" title="Mês">
          <option v-for="m in 12" :key="m" :value="m">{{ MONTH_NAMES[m] }}</option>
        </select>
        <select v-model.number="selectedYear" @change="onPeriodChange" class="period-select" title="Ano">
          <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
        </select>
      </div>
      <div class="empty-icon">📊</div>
      <p class="empty-title">Nenhum dado para {{ periodLabel || 'este mês' }}.</p>
      <p class="empty-hint">Cria contas e transações para veres o teu dashboard.</p>
      <div class="empty-links">
        <router-link to="/accounts" class="link">Contas</router-link>
        <router-link to="/transactions" class="link">Transações</router-link>
      </div>
    </div>

    <div v-else-if="!dashboard.data && !dashboard.loading" class="loading-state">
      <div class="spinner"></div>
      <p>A carregar dashboard...</p>
    </div>

    <div v-if="showContent" class="dashboard-content">
      <div class="summary-section">
        <div class="section-header">
          <h2 class="section-title">{{ periodLabel || 'Resumo' }}</h2>
          <div class="period-selector">
            <select v-model.number="selectedMonth" @change="onPeriodChange" class="period-select" title="Mês">
              <option v-for="m in 12" :key="m" :value="m">{{ MONTH_NAMES[m] }}</option>
            </select>
            <select v-model.number="selectedYear" @change="onPeriodChange" class="period-select" title="Ano">
              <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
            </select>
          </div>
        </div>
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
      </div>

      <div v-if="hasChartData && hasBudgetForPeriod" class="comparison-section">
        <h2 class="section-title">Esperado vs Real</h2>
        <div class="comparison-grid">
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
      </div>

      <div v-if="hasChartData" class="charts-section">
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

      <div v-if="hasChartData" class="resumo-section">
        <h2 class="section-title">Resumo</h2>
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

      <div
        v-else-if="dashboard.monthHasNoStats"
        class="no-stats-message"
      >
        <p>Não há dados estatísticos para {{ periodLabel }}.</p>
        <p class="no-stats-hint">Seleciona outro mês para ver receitas, despesas e gráficos.</p>
      </div>

      <div
        v-else
        class="charts-empty"
      >
        <p>Adiciona transações para veres gráficos.</p>
        <router-link to="/transactions" class="link">Ir para Transações</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem 1rem;
  min-height: 400px;
  background: var(--color-bg);
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 0.25rem 0;
}

.greeting {
  font-size: 1rem;
  color: var(--color-text);
  margin: 0 0 0.25rem 0;
}

.email {
  color: var(--color-text-muted);
  font-size: 0.875rem;
  margin: 0;
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
  border: 3px solid #e2e8f0;
  border-top-color: #2563eb;
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

.summary-section {
  margin-bottom: 0.5rem;
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
  font-size: 1rem;
  font-weight: 600;
  color: #475569;
  margin: 0;
}

.period-selector {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.period-select {
  padding: 0.4rem 0.75rem;
  font-size: 0.875rem;
  border: 1px solid var(--color-input-border);
  border-radius: 8px;
  background: var(--color-input-bg);
  color: var(--color-text);
  cursor: pointer;
}

.period-select:hover {
  border-color: #2563eb;
}

.period-select:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
}

.period-selector-center {
  justify-content: center;
  margin-bottom: 1rem;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.summary-cards-fallback .card {
  background: var(--color-bg-card);
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--color-border);
}

.summary-cards-fallback .card-title {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #64748b;
  margin: 0 0 0.5rem 0;
}

.summary-cards-fallback .card-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.summary-cards-fallback .card-subtitle {
  font-size: 0.75rem;
  color: #94a3b8;
  margin: 0.25rem 0 0 0;
}

.summary-cards-fallback .card-income .card-value { color: #059669; }
.summary-cards-fallback .card-expense .card-value { color: #dc2626; }
.summary-cards-fallback .card-savings .card-value { color: #2563eb; }
.summary-cards-fallback .card-balance .card-value { color: #0f172a; }

.resumo-section {
  margin-top: 0.5rem;
}

.comparison-section {
  margin-top: 0.5rem;
}

.comparison-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.25rem;
}

.comparison-card {
  background: var(--color-bg-card);
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--color-border);
}

.comparison-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #334155;
  margin: 0 0 1rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #e2e8f0;
}

.comparison-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.comparison-label {
  font-size: 0.8125rem;
  color: #64748b;
}

.comparison-value {
  font-size: 1rem;
  font-weight: 600;
  color: #0f172a;
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
  color: #64748b;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed #e2e8f0;
}

.no-stats-message {
  text-align: center;
  padding: 2rem;
  background: var(--color-bg-card);
  border-radius: 12px;
  border: 1px dashed var(--color-border);
  color: var(--color-text-muted);
}

.no-stats-message p {
  margin: 0 0 0.25rem 0;
}

.no-stats-message p:first-child {
  font-weight: 600;
  color: #475569;
}

.no-stats-hint {
  font-size: 0.875rem;
  color: #94a3b8 !important;
}

.charts-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.5rem;
}

.chart-card {
  background: var(--color-bg-card);
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--color-border);
}

.chart-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #334155;
  margin: 0 0 1rem 0;
}

.chart-card-full {
  grid-column: 1 / -1;
}

.charts-empty {
  text-align: center;
  padding: 2rem;
  background: var(--color-bg-card);
  border-radius: 12px;
  color: var(--color-text-muted);
}

.charts-empty p {
  margin: 0 0 0.5rem 0;
}
</style>
