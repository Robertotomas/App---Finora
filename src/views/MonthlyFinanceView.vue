<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useHouseholdStore } from '@/stores/household'
import { useMonthlyBudget } from '@/composables/useMonthlyBudget'
import { dashboardApi } from '@/api/dashboard'
import MonthYearNavigator from '@/components/MonthYearNavigator.vue'

const householdStore = useHouseholdStore()
const householdId = computed(() => householdStore.household?.id)

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
const applyToRemaining = ref(false)

const showForm = computed(() => !hasBudget.value || isEditing.value)

const remainingMonthsCount = computed(() => 12 - selectedMonth.value)

function submit() {
  const income = Number(inputIncome.value) || 0
  const expenses = Number(inputExpenses.value) || 0

  budget.setBudget(
    householdId.value,
    selectedYear.value,
    selectedMonth.value,
    income,
    expenses
  )

  if (applyToRemaining.value) {
    for (let m = selectedMonth.value + 1; m <= 12; m++) {
      budget.setBudget(householdId.value, selectedYear.value, m, income, expenses)
    }
    applyToRemaining.value = false
  }

  isEditing.value = false
}

function startEdit() {
  inputIncome.value = currentBudget.value.expectedIncome
  inputExpenses.value = currentBudget.value.expectedExpenses
  isEditing.value = true
}

const deleteModalOpen = ref(false)

function confirmDelete() {
  deleteModalOpen.value = true
}

function cancelDelete() {
  deleteModalOpen.value = false
}

function deleteBudget() {
  budget.clearBudget(householdId.value, selectedYear.value, selectedMonth.value)
  inputIncome.value = 0
  inputExpenses.value = 0
  isEditing.value = false
  deleteModalOpen.value = false
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

// Progress computations
const incomeProgress = computed(() => {
  if (!progressData.value || currentBudget.value.expectedIncome <= 0) return 0
  return Math.min(100, Math.round((progressData.value.monthlyIncome / currentBudget.value.expectedIncome) * 1000) / 10)
})

const expensesProgress = computed(() => {
  if (!progressData.value || currentBudget.value.expectedExpenses <= 0) return 0
  return Math.round((progressData.value.monthlyExpenses / currentBudget.value.expectedExpenses) * 1000) / 10
})

const incomeReached = computed(() =>
  progressData.value != null &&
  progressData.value.monthlyIncome >= currentBudget.value.expectedIncome &&
  currentBudget.value.expectedIncome > 0
)

const expensesOverBudget = computed(() =>
  progressData.value != null &&
  progressData.value.monthlyExpenses > currentBudget.value.expectedExpenses &&
  currentBudget.value.expectedExpenses > 0
)

const incomeDiff = computed(() => {
  if (!progressData.value) return 0
  return currentBudget.value.expectedIncome - progressData.value.monthlyIncome
})

const expensesDiff = computed(() => {
  if (!progressData.value) return 0
  return currentBudget.value.expectedExpenses - progressData.value.monthlyExpenses
})

const balanceExpected = computed(() =>
  currentBudget.value.expectedIncome - currentBudget.value.expectedExpenses
)

const balanceReal = computed(() => {
  if (!progressData.value) return 0
  return progressData.value.monthlyIncome - progressData.value.monthlyExpenses
})

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
    <!-- Header -->
    <div class="page-header">
      <div class="page-header-text">
        <h1 class="page-title">Plano Mensal</h1>
        <p class="page-subtitle">Define as expectativas de receita e despesa para cada mês</p>
      </div>
    </div>

    <!-- Empty / Loading -->
    <div v-if="!householdStore.household && !householdStore.loading" class="empty-state-card">
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="empty-icon"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
      <p>Configura primeiro o teu household.</p>
      <router-link to="/household" class="empty-action">Ir para Household</router-link>
    </div>

    <div v-else-if="householdStore.loading && !householdStore.household" class="loading-state">
      <div class="spinner"></div>
      <p>A carregar...</p>
    </div>

    <div v-else class="content">
      <!-- Navigator -->
      <div class="navigator-bar">
        <MonthYearNavigator
          v-model:month="selectedMonth"
          v-model:year="selectedYear"
          :years="yearOptions"
          :month-names="MONTH_NAMES"
        />
        <div v-if="!showForm" class="actions-row">
          <button type="button" class="btn-secondary" @click="startEdit">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
            Editar plano
          </button>
          <button type="button" class="btn-danger-ghost" @click="confirmDelete">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            Apagar
          </button>
        </div>
      </div>

      <!-- ════ FORM: definir expectativas ════ -->
      <section v-if="showForm" class="card">
        <div class="card-header">
          <h2 class="card-title">Expectativas do mês</h2>
          <span class="card-badge">{{ periodLabel }}</span>
        </div>
        <div class="form-grid">
          <div class="form-field">
            <label class="form-label">Receita esperada</label>
            <div class="input-wrap">
              <input
                v-model.number="inputIncome"
                type="number"
                min="0"
                step="0.01"
                class="form-input"
                placeholder="0,00"
              />
              <span class="input-suffix">€</span>
            </div>
          </div>
          <div class="form-field">
            <label class="form-label">Despesas esperadas</label>
            <div class="input-wrap">
              <input
                v-model.number="inputExpenses"
                type="number"
                min="0"
                step="0.01"
                class="form-input"
                placeholder="0,00"
              />
              <span class="input-suffix">€</span>
            </div>
          </div>
        </div>
        <label v-if="remainingMonthsCount > 0" class="apply-remaining">
          <input type="checkbox" v-model="applyToRemaining" class="apply-remaining-check" />
          <span class="apply-remaining-text">
            Aplicar também aos restantes <strong>{{ remainingMonthsCount }}</strong> {{ remainingMonthsCount === 1 ? 'mês' : 'meses' }} do ano
          </span>
        </label>
        <div class="form-actions">
          <button v-if="isEditing" type="button" class="btn-secondary" @click="isEditing = false">Cancelar</button>
          <button type="button" class="btn-primary" @click="submit">
            {{ isEditing ? 'Guardar alterações' : 'Definir plano' }}
          </button>
        </div>
      </section>

      <!-- ════ RESUMO: valores definidos ════ -->
      <section v-else class="overview-grid">
        <div class="stat-card">
          <svg class="stat-arrow stat-arrow--income" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><line x1="12" x2="12" y1="6" y2="18"/></svg>
          <p class="stat-label">Receita esperada</p>
          <p class="stat-value">{{ formatCurrency(currentBudget.expectedIncome) }}</p>
        </div>
        <div class="stat-card">
          <svg class="stat-arrow stat-arrow--expense" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"/><line x1="12" x2="12" y1="18" y2="6"/></svg>
          <p class="stat-label">Despesas esperadas</p>
          <p class="stat-value">{{ formatCurrency(currentBudget.expectedExpenses) }}</p>
        </div>
        <div class="stat-card">
          <p class="stat-label">Saldo previsto</p>
          <p class="stat-value">{{ formatCurrency(balanceExpected) }}</p>
        </div>
      </section>

      <!-- ════ PROGRESSO ════ -->
      <section v-if="showProgressSection" class="card">
        <div class="card-header">
          <h2 class="card-title">Progresso — {{ periodLabel }}</h2>
        </div>

        <!-- Loading -->
        <div v-if="progressLoading" class="progress-loading">
          <div class="spinner"></div>
          <p>A carregar dados reais...</p>
        </div>

        <!-- Error -->
        <div v-else-if="progressError" class="progress-error">
          <p>{{ progressError }}</p>
          <button type="button" class="btn-secondary" @click="fetchProgressData">Tentar novamente</button>
        </div>

        <!-- Progress bars -->
        <div v-else-if="progressData" class="progress-content">
          <!-- Receitas -->
          <div v-if="currentBudget.expectedIncome > 0" class="progress-block">
            <div class="progress-row-header">
              <div class="progress-row-label">
                <span class="progress-dot"></span>
                <span class="progress-name">Receitas</span>
              </div>
              <div class="progress-row-values">
                <span class="progress-current">{{ formatCurrency(progressData.monthlyIncome) }}</span>
                <span class="progress-separator">/</span>
                <span class="progress-target">{{ formatCurrency(currentBudget.expectedIncome) }}</span>
              </div>
            </div>
            <div class="progress-track">
              <div class="progress-fill progress-fill--income" :style="{ width: `${Math.min(100, incomeProgress)}%` }"></div>
            </div>
            <div class="progress-footer">
              <span class="progress-pct">{{ incomeProgress }}%</span>
              <span v-if="incomeReached" class="progress-badge progress-badge--ok">Atingido</span>
              <span v-else class="progress-remaining">Faltam {{ formatCurrency(Math.max(0, incomeDiff)) }}</span>
            </div>
          </div>

          <!-- Despesas -->
          <div v-if="currentBudget.expectedExpenses > 0" class="progress-block">
            <div class="progress-row-header">
              <div class="progress-row-label">
                <span class="progress-dot progress-dot--expense"></span>
                <span class="progress-name">Despesas</span>
              </div>
              <div class="progress-row-values">
                <span class="progress-current">{{ formatCurrency(progressData.monthlyExpenses) }}</span>
                <span class="progress-separator">/</span>
                <span class="progress-target">{{ formatCurrency(currentBudget.expectedExpenses) }}</span>
              </div>
            </div>
            <div class="progress-track">
              <div
                class="progress-fill"
                :class="expensesOverBudget ? 'progress-fill--over' : 'progress-fill--expense'"
                :style="{ width: `${Math.min(100, expensesProgress)}%` }"
              ></div>
            </div>
            <div class="progress-footer">
              <span class="progress-pct">{{ expensesProgress }}%</span>
              <span v-if="expensesOverBudget" class="progress-badge progress-badge--over">+{{ formatCurrency(Math.abs(expensesDiff)) }} acima</span>
              <span v-else class="progress-remaining">Margem de {{ formatCurrency(Math.max(0, expensesDiff)) }}</span>
            </div>
          </div>

          <!-- Saldo real vs previsto -->
          <div class="balance-comparison">
            <div class="balance-item">
              <span class="balance-label">Saldo previsto</span>
              <span class="balance-value">{{ formatCurrency(balanceExpected) }}</span>
            </div>
            <div class="balance-divider"></div>
            <div class="balance-item">
              <span class="balance-label">
                Saldo real
                <svg v-if="balanceReal < balanceExpected" class="balance-arrow balance-arrow--down" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"/><line x1="12" x2="12" y1="18" y2="6"/></svg>
                <svg v-else class="balance-arrow balance-arrow--up" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><line x1="12" x2="12" y1="6" y2="18"/></svg>
              </span>
              <span class="balance-value">{{ formatCurrency(balanceReal) }}</span>
            </div>
          </div>
        </div>

        <!-- No data -->
        <div v-else class="progress-empty">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="empty-icon"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
          <p>Sem dados reais para comparar. Adiciona transações para ver o progresso.</p>
        </div>
      </section>
    </div>
  </div>

  <!-- Modal confirmar apagar -->
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="deleteModalOpen" class="modal-overlay" @click.self="cancelDelete">
        <div class="modal-box">
          <h3 class="modal-title">Apagar plano</h3>
          <p class="modal-text">Tens a certeza que queres apagar o plano de <strong>{{ periodLabel }}</strong>? Esta ação não pode ser revertida.</p>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" @click="cancelDelete">Cancelar</button>
            <button type="button" class="btn-danger" @click="deleteBudget">Apagar</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.monthly-finance {
  max-width: min(960px, 100%);
  margin: 0 auto;
  padding: 0 0 2.5rem;
  min-height: 400px;
}

/* ── Header ── */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 0.25rem;
}

.page-subtitle {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0;
}

/* ── Navigator ── */
.navigator-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

/* ── Loading / Empty ── */
.loading-state {
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

.empty-state-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 3rem 2rem;
  text-align: center;
  color: var(--color-text-muted);
}

.empty-state-card .empty-icon {
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state-card p {
  margin: 0 0 1rem;
  font-size: 0.875rem;
}

.empty-action {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1.25rem;
  background: var(--color-success);
  color: #fff;
  text-decoration: none;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  transition: opacity 0.15s ease;
}

.empty-action:hover {
  opacity: 0.9;
}

/* ── Content ── */
.content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* ── Card base ── */
.card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 1.25rem 1.5rem;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  padding-bottom: 0.875rem;
  border-bottom: 1px solid var(--color-border);
}

.card-title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.card-badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.75rem;
  border-radius: 2rem;
  background: var(--color-table-row-hover);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

/* ── Form ── */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.input-wrap {
  position: relative;
}

.form-input {
  width: 100%;
  padding: 0.75rem 2.25rem 0.75rem 1rem;
  font-size: 1.125rem;
  font-weight: 600;
  font-family: inherit;
  color: var(--color-text);
  background: var(--color-input-bg);
  border: 1px solid var(--color-input-border);
  border-radius: 10px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: #166534;
  box-shadow: 0 0 0 3px rgba(22, 101, 52, 0.12);
}

.input-suffix {
  position: absolute;
  right: 0.875rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-muted);
  pointer-events: none;
}

.apply-remaining {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  background: var(--color-table-row-hover);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  cursor: pointer;
  margin-bottom: 0.25rem;
  transition: border-color 0.15s ease;
}

.apply-remaining:hover {
  border-color: var(--color-text-muted);
}

.apply-remaining-check {
  width: 18px;
  height: 18px;
  accent-color: #166534;
  cursor: pointer;
  flex-shrink: 0;
}

.apply-remaining-text {
  font-size: 0.8125rem;
  color: var(--color-text);
  line-height: 1.4;
}

.apply-remaining-text strong {
  color: var(--color-text);
  font-weight: 700;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.625rem;
}

/* ── Stat cards (overview) ── */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.stat-card {
  position: relative;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
}

.stat-arrow {
  position: absolute;
  top: 1rem;
  right: 1rem;
  opacity: 0.7;
}

.stat-arrow--income {
  color: var(--color-success);
}

.stat-arrow--expense {
  color: var(--color-expense);
}

.stat-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  margin: 0;
}

.stat-value {
  font-size: 1.375rem;
  font-weight: 700;
  margin: 0;
  color: var(--color-text);
}

/* ── Actions row ── */
.actions-row {
  display: flex;
  gap: 0.625rem;
}

/* ── Buttons ── */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.625rem 1.5rem;
  background: var(--color-success);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.btn-primary:hover { opacity: 0.9; }

.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  background: var(--color-bg-card);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  font-size: 0.8125rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.btn-secondary:hover {
  border-color: var(--color-text-muted);
  background: var(--color-table-row-hover);
}

.btn-danger-ghost {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  background: transparent;
  color: var(--color-expense);
  border: 1px solid var(--color-expense);
  border-radius: 10px;
  font-size: 0.8125rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-danger-ghost:hover {
  background: rgba(220, 38, 38, 0.08);
}

html.dark .btn-danger-ghost:hover {
  background: rgba(248, 113, 113, 0.12);
}

/* ── Progress section ── */
.progress-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem;
  color: var(--color-text-muted);
}

.progress-loading .spinner { margin: 0; }

.progress-error {
  text-align: center;
  padding: 1.5rem;
}

.progress-error p {
  color: var(--color-error);
  margin: 0 0 1rem;
  font-size: 0.875rem;
}

.progress-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.progress-block {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.progress-row-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.progress-row-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.progress-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #166534;
}

.progress-dot--expense {
  background: var(--color-expense) !important;
}

html.dark .progress-dot {
  background: #4ade80;
}

.progress-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
}

.progress-row-values {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  font-size: 0.8125rem;
}

.progress-current {
  font-weight: 700;
  color: var(--color-text);
}

.progress-separator {
  color: var(--color-text-muted);
}

.progress-target {
  color: var(--color-text-muted);
}

.progress-track {
  height: 10px;
  background: var(--color-border);
  border-radius: 5px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 5px;
  transition: width 0.5s ease-out;
}

.progress-fill--income {
  background: #166534;
}

html.dark .progress-fill--income {
  background: #4ade80;
}

.progress-fill--expense {
  background: #475569;
}

html.dark .progress-fill--expense {
  background: #94a3b8;
}

.progress-fill--over {
  background: var(--color-expense);
}

.progress-footer {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.8125rem;
}

.progress-pct {
  font-weight: 700;
  color: var(--color-text);
}

.progress-remaining {
  color: var(--color-text-muted);
  font-weight: 500;
}

.progress-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.625rem;
  border-radius: 2rem;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.progress-badge--ok {
  background: rgba(5, 150, 105, 0.1);
  color: #059669;
  border: 1px solid rgba(5, 150, 105, 0.2);
}

html.dark .progress-badge--ok {
  background: rgba(52, 211, 153, 0.12);
  color: #34d399;
  border-color: rgba(52, 211, 153, 0.2);
}

.progress-badge--over {
  background: rgba(220, 38, 38, 0.08);
  color: var(--color-expense);
  border: 1px solid rgba(220, 38, 38, 0.2);
}

html.dark .progress-badge--over {
  background: rgba(248, 113, 113, 0.1);
  border-color: rgba(248, 113, 113, 0.2);
}

/* ── Balance comparison ── */
.balance-comparison {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1rem 1.25rem;
  background: var(--color-table-row-hover);
  border-radius: 12px;
  border: 1px solid var(--color-border);
}

.balance-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.balance-label {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
}

.balance-arrow {
  display: inline-block;
  vertical-align: middle;
  margin-left: 0.25rem;
}

.balance-arrow--down {
  color: var(--color-expense);
}

.balance-arrow--up {
  color: var(--color-success);
}

.balance-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text);
}

.balance-divider {
  width: 1px;
  height: 2.5rem;
  background: var(--color-border);
  flex-shrink: 0;
}

/* ── Progress empty ── */
.progress-empty {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--color-text-muted);
}

.progress-empty .empty-icon {
  margin-bottom: 0.75rem;
  opacity: 0.4;
}

.progress-empty p {
  margin: 0;
  font-size: 0.875rem;
}

/* ── Responsive ── */
@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .overview-grid {
    grid-template-columns: 1fr;
  }

  .balance-comparison {
    flex-direction: column;
    gap: 0.75rem;
    align-items: stretch;
  }

  .balance-divider {
    width: 100%;
    height: 1px;
  }
}

/* ── Modal ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-modal-overlay, rgba(0, 0, 0, 0.5));
}

.modal-box {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 1.5rem 1.75rem;
  max-width: 400px;
  width: calc(100% - 2rem);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.modal-title {
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 0.625rem;
}

.modal-text {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin: 0 0 1.25rem;
  line-height: 1.5;
}

.modal-text strong {
  color: var(--color-text);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.625rem;
}

.btn-danger {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1.25rem;
  background: var(--color-expense);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.btn-danger:hover { opacity: 0.9; }

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
