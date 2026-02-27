<script setup lang="ts">
import { onMounted, computed, ref, watch, unref } from 'vue'
import { useHouseholdStore } from '@/stores/household'
import { useMonthlyFinance } from '@/composables/useMonthlyFinance'

const householdStore = useHouseholdStore()
const householdId = computed(() => householdStore.household?.id)

const monthly = useMonthlyFinance(() => householdId.value)
const mounted = ref(false)
const loadError = ref<string | null>(null)

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

function formatPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${value}%`
}

function prevMonth() {
  if (monthly.month.value <= 1) {
    monthly.month.value = 12
    monthly.year.value--
  } else {
    monthly.month.value--
  }
}

function nextMonth() {
  if (monthly.month.value >= 12) {
    monthly.month.value = 1
    monthly.year.value++
  } else {
    monthly.month.value++
  }
}

const canGoNext = computed(() => {
  const now = new Date()
  return monthly.year.value < now.getFullYear() ||
    (monthly.year.value === now.getFullYear() && monthly.month.value < now.getMonth() + 1)
})

function saveExpectedIncome() {
  monthly.setExpectedIncome(Number(unref(monthly.expectedIncome)) || 0)
}

function saveExpectedExpenses() {
  monthly.setExpectedExpenses(Number(unref(monthly.expectedExpenses)) || 0)
}

async function load() {
  if (!householdId.value) return
  try {
    loadError.value = null
    await monthly.fetch()
  } catch {
    loadError.value = monthly.error.value || 'Erro ao carregar.'
  }
}

watch([householdId, monthly.year, monthly.month], () => {
  if (householdId.value) load()
}, { immediate: false })

onMounted(async () => {
  try {
    await householdStore.fetchHousehold()
    if (householdStore.household) {
      await load()
    }
  } catch (e) {
    loadError.value = 'Erro ao carregar household.'
  } finally {
    mounted.value = true
  }
})

const m = computed(() => monthly.monthlyData?.value ?? null)
</script>

<template>
  <div class="monthly-finance">
    <div class="page-header">
      <h1>Plano Mensal</h1>
      <p class="subtitle">Define expectativas e compara com o real</p>
    </div>

    <div v-if="!mounted" class="loading-state">
      <div class="spinner"></div>
      <p>A carregar...</p>
    </div>

    <div v-else-if="loadError" class="error-state">
      <p>{{ loadError }}</p>
    </div>

    <div v-else-if="!householdStore.household && !householdStore.loading" class="empty-state">
      <p>Configura primeiro o teu household.</p>
      <router-link to="/household" class="link">Ir para Household</router-link>
    </div>

    <template v-else-if="householdStore.household">
      <div class="controls">
        <div class="month-selector">
          <button
            type="button"
            class="btn-nav"
            aria-label="Mês anterior"
            @click="prevMonth"
          >
            ‹
          </button>
          <span class="period">{{ monthly.periodLabel }}</span>
          <button
            type="button"
            class="btn-nav"
            aria-label="Próximo mês"
            :disabled="!canGoNext"
            @click="nextMonth"
          >
            ›
          </button>
        </div>
      </div>

      <div v-if="monthly.loading && !monthly.data" class="loading-state compact">
        <div class="spinner"></div>
        <p>A carregar dados...</p>
      </div>

      <div v-else class="content">
        <section class="expected-section">
          <h2 class="section-title">Expectativas do mês</h2>
          <div class="expected-grid">
            <div class="expected-card">
              <label class="expected-label">Receita esperada</label>
              <input
                v-model.number="monthly.expectedIncome"
                type="number"
                min="0"
                step="0.01"
                class="expected-input"
                placeholder="0,00"
                @blur="saveExpectedIncome"
              />
            </div>
            <div class="expected-card">
              <label class="expected-label">Despesas esperadas</label>
              <input
                v-model.number="monthly.expectedExpenses"
                type="number"
                min="0"
                step="0.01"
                class="expected-input"
                placeholder="0,00"
                @blur="saveExpectedExpenses"
              />
            </div>
          </div>
        </section>

        <section v-if="m" class="summary-section">
          <h2 class="section-title">Resumo</h2>
          <div class="summary-cards">
            <div class="card card-balance">
              <p class="card-title">Saldo final</p>
              <p class="card-value">{{ formatCurrency(m.finalBalance, m.currency) }}</p>
              <p class="card-subtitle">Receitas − Despesas reais</p>
            </div>
            <div class="card card-income">
              <p class="card-title">Taxa de poupança</p>
              <p class="card-value">{{ formatPercent(m.savingsRate) }}</p>
              <p class="card-subtitle">% da receita real poupada</p>
            </div>
          </div>
        </section>

        <section v-if="m" class="comparison-section">
          <h2 class="section-title">Esperado vs Real</h2>
          <div class="comparison-grid">
            <div class="comparison-card">
              <h3 class="comparison-title">Receitas</h3>
              <div class="comparison-row">
                <span class="comparison-label">Esperado</span>
                <span class="comparison-value expected">{{ formatCurrency(m.expectedIncome, m.currency) }}</span>
              </div>
              <div class="comparison-row">
                <span class="comparison-label">Real</span>
                <span class="comparison-value" :class="{ 'above': m.realIncome > m.expectedIncome, 'below': m.realIncome < m.expectedIncome }">
                  {{ formatCurrency(m.realIncome, m.currency) }}
                </span>
              </div>
              <div v-if="m.expectedIncome > 0" class="comparison-diff">
                {{ m.realIncome >= m.expectedIncome ? '✓' : '' }}
                {{ formatCurrency(m.realIncome - m.expectedIncome, m.currency) }}
                {{ m.realIncome >= m.expectedIncome ? 'acima' : 'abaixo' }}
              </div>
            </div>

            <div class="comparison-card">
              <h3 class="comparison-title">Despesas</h3>
              <div class="comparison-row">
                <span class="comparison-label">Esperado</span>
                <span class="comparison-value expected">{{ formatCurrency(m.expectedExpenses, m.currency) }}</span>
              </div>
              <div class="comparison-row">
                <span class="comparison-label">Real</span>
                <span class="comparison-value" :class="{ 'above': m.realExpenses < m.expectedExpenses, 'below': m.realExpenses > m.expectedExpenses }">
                  {{ formatCurrency(m.realExpenses, m.currency) }}
                </span>
              </div>
              <div v-if="m.expectedExpenses > 0" class="comparison-diff">
                {{ m.realExpenses <= m.expectedExpenses ? '✓' : '' }}
                {{ formatCurrency(m.realExpenses - m.expectedExpenses, m.currency) }}
                {{ m.realExpenses <= m.expectedExpenses ? 'abaixo do orçamento' : 'acima do orçamento' }}
              </div>
            </div>

            <div class="comparison-card">
              <h3 class="comparison-title">Poupança</h3>
              <div class="comparison-row">
                <span class="comparison-label">Esperado</span>
                <span class="comparison-value" :class="m.expectedSavings >= 0 ? 'income' : 'expense'">
                  {{ formatCurrency(m.expectedSavings, m.currency) }}
                </span>
              </div>
              <div class="comparison-row">
                <span class="comparison-label">Real</span>
                <span class="comparison-value" :class="m.realSavings >= 0 ? 'income' : 'expense'">
                  {{ formatCurrency(m.realSavings, m.currency) }}
                </span>
              </div>
            </div>
          </div>
        </section>

        <div v-else-if="!monthly.loading" class="empty-hint">
          <p>Sem dados para {{ monthly.periodLabel }}.</p>
          <p class="hint">Define as expectativas acima e adiciona transações para ver a comparação.</p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.monthly-finance {
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

.subtitle {
  font-size: 0.9375rem;
  color: #64748b;
  margin: 0;
}

.loading-state,
.error-state,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: #64748b;
}

.loading-state.compact {
  padding: 2rem;
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

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.link {
  color: #2563eb;
  text-decoration: none;
  font-size: 0.875rem;
}

.link:hover {
  text-decoration: underline;
}

.controls {
  margin-bottom: 2rem;
}

.month-selector {
  display: inline-flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0;
}

.btn-nav {
  width: 40px;
  height: 40px;
  font-size: 1.5rem;
  color: #334155;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.btn-nav:hover:not(:disabled) {
  background: #f1f5f9;
  color: #0f172a;
}

.btn-nav:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.period {
  font-size: 1.25rem;
  font-weight: 600;
  color: #0f172a;
  min-width: 120px;
  text-align: center;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: #475569;
  margin: 0 0 1rem 0;
}

.expected-section {
  padding: 1.5rem;
  background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
  border-radius: 12px;
  border: 1px solid #bae6fd;
}

.expected-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
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

.expected-input {
  padding: 0.75rem 1rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: #0f172a;
  background: white;
  border: 1px solid #7dd3fc;
  border-radius: 8px;
}

.expected-input:focus {
  outline: none;
  border-color: #0284c7;
  box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.2);
}

.summary-section {
  margin-top: 0.5rem;
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}

.summary-cards .card {
  background: white;
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border: 1px solid #f1f5f9;
}

.card-title {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #64748b;
  margin: 0 0 0.5rem 0;
}

.card-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.card-subtitle {
  font-size: 0.75rem;
  color: #94a3b8;
  margin: 0.25rem 0 0 0;
}

.card-balance .card-value { color: #0f172a; }
.card-income .card-value { color: #059669; }
.card-expense .card-value { color: #dc2626; }

.comparison-section {
  margin-top: 0.5rem;
}

.comparison-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.25rem;
}

.comparison-card {
  background: white;
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border: 1px solid #f1f5f9;
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

.empty-hint {
  text-align: center;
  padding: 2rem;
  background: #f8fafc;
  border-radius: 12px;
  color: #64748b;
}

.empty-hint p {
  margin: 0 0 0.5rem 0;
}

.hint {
  font-size: 0.875rem;
}

@media (max-width: 640px) {
  .monthly-finance {
    padding: 1.5rem 1rem;
  }

  .period {
    font-size: 1.125rem;
    min-width: 100px;
  }

  .expected-grid {
    grid-template-columns: 1fr;
  }

  .summary-cards,
  .comparison-grid {
    grid-template-columns: 1fr;
  }
}
</style>
