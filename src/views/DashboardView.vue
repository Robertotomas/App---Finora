<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import type { ExpenseByCategory, MonthlyTrend } from '@/types/dashboard'
import { useAuthStore } from '@/stores/auth'
import { useHouseholdStore } from '@/stores/household'
import { useDashboard } from '@/composables/useDashboard'
import DashboardSkeleton from '@/components/DashboardSkeleton.vue'
import ExpensesPieChart from '@/components/charts/ExpensesPieChart.vue'
import MonthlyLineChart from '@/components/charts/MonthlyLineChart.vue'

const authStore = useAuthStore()
const householdStore = useHouseholdStore()
const dashboard = useDashboard()
const mounted = ref(false)
const loadError = ref<string | null>(null)
const isDev = import.meta.env.DEV

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

const expensesForChart = computed<ExpenseByCategory[]>(() => dashboard.expensesByCategory.value)
const trendForChart = computed<MonthlyTrend[]>(() => dashboard.monthlyTrend.value)
const periodLabel = computed(() => dashboard.periodLabel.value)

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
      <div class="empty-icon">📊</div>
      <p class="empty-title">Nenhum dado ainda.</p>
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
      </div>

      <div class="charts-section">
        <div v-if="dashboard.hasExpenses" class="chart-card">
          <h3 class="chart-title">Despesas por categoria</h3>
          <ExpensesPieChart :data="expensesForChart" />
        </div>
        <div v-if="dashboard.hasTrend" class="chart-card">
          <h3 class="chart-title">Evolução mensal</h3>
          <MonthlyLineChart :data="trendForChart" />
        </div>
      </div>

      <div
        v-if="!dashboard.hasExpenses && !dashboard.hasTrend && dashboard.data"
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
  background: #fff;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 0.25rem 0;
}

.greeting {
  font-size: 1rem;
  color: #334155;
  margin: 0 0 0.25rem 0;
}

.email {
  color: #64748b;
  font-size: 0.875rem;
  margin: 0;
}

.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: #64748b;
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
  color: #dc2626;
}

.error-hint {
  font-size: 0.875rem;
  color: #64748b !important;
  margin-top: 1rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.empty-state-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 3rem 2rem;
  margin-top: 1rem;
}

.empty-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #334155;
  margin: 0;
}

.empty-icon {
  font-size: 3rem;
  opacity: 0.6;
}

.empty-hint {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0;
}

.empty-links {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
}

.link {
  color: #2563eb;
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

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: #475569;
  margin: 0 0 1rem 0;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.summary-cards-fallback .card {
  background: white;
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border: 1px solid #f1f5f9;
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

.charts-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1.5rem;
}

.chart-card {
  background: white;
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border: 1px solid #f1f5f9;
}

.chart-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #334155;
  margin: 0 0 1rem 0;
}

.charts-empty {
  text-align: center;
  padding: 2rem;
  background: #f8fafc;
  border-radius: 12px;
  color: #64748b;
}

.charts-empty p {
  margin: 0 0 0.5rem 0;
}
</style>
