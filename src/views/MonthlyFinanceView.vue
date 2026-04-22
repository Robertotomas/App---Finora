<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useHouseholdStore } from '@/stores/household'
import { useMonthlyBudget } from '@/composables/useMonthlyBudget'
import { dashboardApi } from '@/api/dashboard'
import BudgetProgressChart from '@/components/charts/BudgetProgressChart.vue'
import MonthYearNavigator from '@/components/MonthYearNavigator.vue'

const householdStore = useHouseholdStore()
const householdId = computed(() => householdStore.household?.id)

// Estado local para os dados de progresso (evita problemas com useDashboard partilhado)
const progressLoading = ref(false)
const progressError = ref<string | null>(null)
const progressData = ref<{ monthlyIncome: number; monthlyExpenses: number } | null>(null)

const budget = useMonthlyBudget()
const now = new Date()
const selectedMonth = ref(now.getMonth() + 1)
const selectedYear = ref(now.getFullYear())

const MONTH_NAMES = [
  '',
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const periodLabel = computed(() => `${MONTH_NAMES[selectedMonth.value]} ${selectedYear.value}`)

const yearOptions = computed(() => {
  const y = now.getFullYear()
  return [y, y - 1, y - 2, y - 3]
})

const currentBudget = computed(() =>
  budget.getBudget(householdId.value, selectedYear.value, selectedMonth.value)
)

const hasBudget = computed(() =>
  budget.hasBudget(householdId.value, selectedYear.value, selectedMonth.value)
)

const hasExpectedValues = computed(() =>
  currentBudget.value.expectedIncome > 0 || currentBudget.value.expectedExpenses > 0
)

const showProgressSection = computed(() =>
  hasBudget.value &&
  hasExpectedValues.value &&
  !!householdStore.household
)

const isEditing = ref(false)
const inputIncome = ref(0)
const inputExpenses = ref(0)

const showForm = computed(() => !hasBudget.value || isEditing.value)

function submit() {
  budget.setBudget(
    householdId.value,
    selectedYear.value,
    selectedMonth.value,
    Number(inputIncome.value) || 0,
    Number(inputExpenses.value) || 0
  )
  isEditing.value = false
}

function startEdit() {
  inputIncome.value = currentBudget.value.expectedIncome
  inputExpenses.value = currentBudget.value.expectedExpenses
  isEditing.value = true
}

function deleteBudget() {
  budget.clearBudget(householdId.value, selectedYear.value, selectedMonth.value)
  inputIncome.value = 0
  inputExpenses.value = 0
  isEditing.value = false
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

async function fetchProgressData() {
  if (!householdStore.household) return
  progressLoading.value = true
  progressError.value = null
  try {
    const { data } = await dashboardApi.get({
      year: selectedYear.value,
      month: selectedMonth.value,
      trendMonths: 1,
    })
    const res = data as unknown as Record<string, unknown>
    const get = (k: string) => res[k] ?? res[k.charAt(0).toUpperCase() + k.slice(1)]
    progressData.value = {
      monthlyIncome: Number(get('monthlyIncome')) || 0,
      monthlyExpenses: Number(get('monthlyExpenses')) || 0,
    }
  } catch (e: unknown) {
    const err = e as { response?: { status: number; data?: { message?: string } }; message?: string }
    if (err.response?.status === 404) {
      progressError.value = 'Household não encontrado.'
    } else if (err.response?.data?.message) {
      progressError.value = err.response.data.message
    } else if (err.message?.includes('timeout') || err.message?.includes('Network Error')) {
      progressError.value = 'A API não respondeu. Verifica se está a correr em http://localhost:5000'
    } else {
      progressError.value = 'Erro ao carregar dados. Verifica a consola (F12) para mais detalhes.'
    }
  } finally {
    progressLoading.value = false
  }
}

watch([selectedMonth, selectedYear], () => {
  isEditing.value = false
  if (hasBudget.value) {
    inputIncome.value = currentBudget.value.expectedIncome
    inputExpenses.value = currentBudget.value.expectedExpenses
  } else {
    inputIncome.value = 0
    inputExpenses.value = 0
  }
  if (showProgressSection.value) fetchProgressData()
})

watch(showProgressSection, (visible) => {
  if (visible) fetchProgressData()
}, { immediate: true })

onMounted(async () => {
  if (hasBudget.value) {
    inputIncome.value = currentBudget.value.expectedIncome
    inputExpenses.value = currentBudget.value.expectedExpenses
  }
  await householdStore.fetchHousehold()
  if (showProgressSection.value) fetchProgressData()
})
</script>

<template>
  <div class="monthly-finance">
    <div class="page-header">
      <h1>Plano Mensal</h1>
      <p class="subtitle">Define as expectativas de receita e despesa para cada mês</p>
    </div>

    <div v-if="!householdStore.household && !householdStore.loading" class="empty-state">
      <p>Configura primeiro o teu household.</p>
      <router-link to="/household" class="link">Ir para Household</router-link>
    </div>

    <div v-else-if="householdStore.loading && !householdStore.household" class="loading-state">
      <div class="spinner"></div>
      <p>A carregar...</p>
    </div>

    <div v-else class="content">
      <div class="controls">
        <div class="period-selector">
          <MonthYearNavigator
            v-model:month="selectedMonth"
            v-model:year="selectedYear"
            :years="yearOptions"
            :month-names="MONTH_NAMES"
          />
        </div>
      </div>

      <section v-if="showForm" class="expected-section">
        <h2 class="section-title">Expectativas do mês</h2>
        <div class="expected-grid">
          <div class="expected-card">
            <label class="expected-label">Receita esperada</label>
            <input
              v-model.number="inputIncome"
              type="number"
              min="0"
              step="0.01"
              class="expected-input"
              placeholder="0,00"
            />
          </div>
          <div class="expected-card">
            <label class="expected-label">Despesas esperadas</label>
            <input
              v-model.number="inputExpenses"
              type="number"
              min="0"
              step="0.01"
              class="expected-input"
              placeholder="0,00"
            />
          </div>
        </div>
        <button type="button" class="btn-submit" @click="submit">
          Submeter
        </button>
      </section>

      <section v-else class="submitted-section">
        <h2 class="section-title">Expectativas para {{ periodLabel }}</h2>
        <div class="submitted-values">
          <div class="submitted-row">
            <span class="submitted-label">Receita esperada</span>
            <span class="submitted-value">{{ formatCurrency(currentBudget.expectedIncome) }}</span>
          </div>
          <div class="submitted-row">
            <span class="submitted-label">Despesa esperada</span>
            <span class="submitted-value">{{ formatCurrency(currentBudget.expectedExpenses) }}</span>
          </div>
        </div>
        <div class="submitted-actions">
          <button type="button" class="btn-edit" @click="startEdit">Editar</button>
          <button type="button" class="btn-delete" @click="deleteBudget">Apagar</button>
        </div>
      </section>

      <section v-if="showProgressSection" class="progress-section">
        <h2 class="section-title">Progresso até ao esperado</h2>
        <div v-if="progressLoading" class="progress-loading">
          <div class="spinner"></div>
          <p>A carregar dados...</p>
        </div>
        <div v-else-if="progressError" class="progress-error">
          <p>{{ progressError }}</p>
          <button type="button" class="btn-retry" @click="fetchProgressData">Tentar novamente</button>
        </div>
        <BudgetProgressChart
          v-else-if="progressData"
          :real-income="progressData.monthlyIncome"
          :expected-income="currentBudget.expectedIncome"
          :real-expenses="progressData.monthlyExpenses"
          :expected-expenses="currentBudget.expectedExpenses"
          :format-currency="formatCurrency"
        />
        <p v-else class="progress-no-data">Sem dados reais para comparar. Adiciona transações para ver o progresso.</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.monthly-finance {
  max-width: min(960px, 100%);
  margin: 0 auto;
  padding: 0 0 2.5rem;
  min-height: 400px;
  background: transparent;
}

.loading-state,
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

.link {
  color: var(--color-link-hover);
  text-decoration: none;
  font-size: 0.875rem;
}

.link:hover {
  text-decoration: underline;
}

.controls {
  margin-bottom: 2rem;
}

.period-selector {
  display: flex;
  gap: 1.25rem;
  align-items: flex-end;
  flex-wrap: wrap;
}

.filter-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-input-border);
  border-radius: 8px;
  font-size: 0.875rem;
  background: var(--color-input-bg);
  color: var(--color-text);
  cursor: pointer;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-muted);
  margin: 0 0 1rem 0;
}

.expected-section {
  padding: 1.5rem;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border-radius: 12px;
  border: 1px solid #bbf7d0;
}

html.dark .expected-section {
  background: linear-gradient(135deg, #052e16 0%, #0f172a 100%) !important;
  border-color: #166534 !important;
}

.expected-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.expected-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.expected-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #166534;
}

html.dark .expected-label {
  color: var(--color-text-muted);
}

.expected-input {
  padding: 0.75rem 1rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
  background: var(--color-input-bg);
  border: 1px solid #86efac;
  border-radius: 8px;
}

html.dark .expected-input {
  border-color: var(--color-input-border);
}

.expected-input:focus {
  outline: none;
  border-color: #15803d;
  box-shadow: 0 0 0 3px rgba(22, 101, 52, 0.2);
}

.btn-submit {
  padding: 0.625rem 1.5rem;
  background: linear-gradient(135deg, #166534 0%, #15803d 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
}

.btn-submit:hover {
  opacity: 0.95;
}

.submitted-section {
  padding: 1.5rem;
  background: var(--color-bg-card);
  border-radius: 12px;
  border: 1px solid var(--color-border);
}

.submitted-values {
  margin-bottom: 1rem;
}

.submitted-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-border);
}

.submitted-row:last-child {
  border-bottom: none;
}

.submitted-label {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.submitted-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.submitted-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.btn-edit {
  padding: 0.5rem 1rem;
  background: var(--color-btn-secondary-hover);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
}

.btn-edit:hover {
  background: var(--color-border);
}

.btn-delete {
  padding: 0.5rem 1rem;
  background: transparent;
  color: var(--color-expense);
  border: 1px solid var(--color-expense);
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
}

.btn-delete:hover {
  background: rgba(248, 113, 113, 0.15);
}

.progress-section {
  padding: 1.5rem;
  background: var(--color-bg-card);
  border-radius: 12px;
  border: 1px solid var(--color-border);
}

.progress-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem;
  color: var(--color-text-muted);
}

.progress-loading .spinner {
  margin: 0;
}

.progress-no-data {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0;
  text-align: center;
  padding: 1rem;
}

.progress-error {
  text-align: center;
  padding: 1.5rem;
}

.progress-error p {
  color: var(--color-error, #dc2626);
  margin: 0 0 1rem 0;
  font-size: 0.875rem;
}

.btn-retry {
  padding: 0.5rem 1rem;
  background: var(--color-link-hover, #2563eb);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  cursor: pointer;
}

.btn-retry:hover {
  opacity: 0.9;
}

@media (max-width: 640px) {
  .expected-grid {
    grid-template-columns: 1fr;
  }
}
</style>
