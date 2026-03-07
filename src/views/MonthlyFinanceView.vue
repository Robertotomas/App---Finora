<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useHouseholdStore } from '@/stores/household'
import { useMonthlyBudget } from '@/composables/useMonthlyBudget'

const householdStore = useHouseholdStore()
const householdId = computed(() => householdStore.household?.id)

const budget = useMonthlyBudget()
const now = new Date()
const selectedMonth = ref(now.getMonth() + 1)
const selectedYear = ref(now.getFullYear())

const MONTH_NAMES = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

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

watch([selectedMonth, selectedYear], () => {
  isEditing.value = false
  if (hasBudget.value) {
    inputIncome.value = currentBudget.value.expectedIncome
    inputExpenses.value = currentBudget.value.expectedExpenses
  } else {
    inputIncome.value = 0
    inputExpenses.value = 0
  }
})

onMounted(() => {
  if (hasBudget.value) {
    inputIncome.value = currentBudget.value.expectedIncome
    inputExpenses.value = currentBudget.value.expectedExpenses
  }
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
          <select v-model.number="selectedMonth" class="filter-select">
            <option v-for="m in 12" :key="m" :value="m">{{ MONTH_NAMES[m] }}</option>
          </select>
          <select v-model.number="selectedYear" class="filter-select">
            <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
          </select>
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
    </div>
  </div>
</template>

<style scoped>
.monthly-finance {
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

.subtitle {
  font-size: 0.9375rem;
  color: var(--color-text-muted);
  margin: 0;
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
  border: 3px solid #e2e8f0;
  border-top-color: #2563eb;
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
  gap: 0.5rem;
  align-items: center;
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
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border-radius: 12px;
  border: 1px solid #bae6fd;
}

html.dark .expected-section {
  background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%) !important;
  border-color: var(--color-border) !important;
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
  color: #0c4a6e;
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
  border: 1px solid #7dd3fc;
  border-radius: 8px;
}

html.dark .expected-input {
  border-color: var(--color-input-border);
}

.expected-input:focus {
  outline: none;
  border-color: #0284c7;
  box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.2);
}

.btn-submit {
  padding: 0.625rem 1.5rem;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
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

@media (max-width: 640px) {
  .expected-grid {
    grid-template-columns: 1fr;
  }
}
</style>
