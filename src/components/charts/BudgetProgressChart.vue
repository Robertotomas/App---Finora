<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  realIncome: number
  expectedIncome: number
  realExpenses: number
  expectedExpenses: number
  formatCurrency: (value: number) => string
}>()

const incomeProgress = computed(() => {
  if (props.expectedIncome <= 0) return 0
  const pct = Math.min(100, (props.realIncome / props.expectedIncome) * 100)
  return Math.round(pct * 10) / 10
})

const incomeReached = computed(() => props.realIncome >= props.expectedIncome && props.expectedIncome > 0)

const expensesProgress = computed(() => {
  if (props.expectedExpenses <= 0) return 0
  return Math.round((props.realExpenses / props.expectedExpenses) * 1000) / 10
})

const expensesOverBudget = computed(() => props.realExpenses > props.expectedExpenses && props.expectedExpenses > 0)

const expensesAtBudget = computed(() =>
  props.expectedExpenses > 0 &&
  props.realExpenses >= props.expectedExpenses * 0.95 &&
  props.realExpenses <= props.expectedExpenses * 1.05
)
</script>

<template>
  <div class="progress-chart">
    <div v-if="expectedIncome > 0" class="progress-section">
      <div class="progress-header">
        <span class="progress-label">Receitas</span>
        <span class="progress-values">
          {{ formatCurrency(realIncome) }} / {{ formatCurrency(expectedIncome) }}
          <span v-if="expectedIncome > 0" class="progress-pct">
            ({{ incomeProgress }}%)
            <span v-if="incomeReached" class="badge-ok">✓ Atingido</span>
          </span>
        </span>
      </div>
      <div class="progress-track progress-track-income">
        <div
          class="progress-fill progress-fill-income"
          :style="{ width: `${Math.min(100, incomeProgress)}%` }"
        />
      </div>
    </div>

    <div v-if="expectedExpenses > 0" class="progress-section">
      <div class="progress-header">
        <span class="progress-label">Despesas</span>
        <span class="progress-values">
          {{ formatCurrency(realExpenses) }} / {{ formatCurrency(expectedExpenses) }}
          <span v-if="expectedExpenses > 0" class="progress-pct">
            ({{ expensesProgress }}%)
            <span v-if="expensesOverBudget" class="badge-over">Acima do orçamento</span>
            <span v-else-if="expensesAtBudget" class="badge-ok">✓ No orçamento</span>
            <span v-else class="badge-ok">Abaixo do orçamento</span>
          </span>
        </span>
      </div>
      <div class="progress-track progress-track-expenses">
        <div
          class="progress-fill progress-fill-expenses"
          :class="{ 'over-budget': expensesOverBudget }"
          :style="{ width: `${Math.min(100, expensesProgress)}%` }"
        />
      </div>
      <div v-if="expensesOverBudget" class="progress-over-indicator">
        +{{ formatCurrency(realExpenses - expectedExpenses) }} acima do esperado
      </div>
    </div>
  </div>
</template>

<style scoped>
.progress-chart {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.progress-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.progress-label {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
}

.progress-values {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  text-align: right;
}

.progress-pct {
  display: inline-block;
  margin-left: 0.25rem;
  font-weight: 500;
}

.badge-ok {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #059669;
  background: rgba(5, 150, 105, 0.15);
  border-radius: 6px;
}

.badge-over {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #dc2626;
  background: rgba(220, 38, 38, 0.15);
  border-radius: 6px;
}

.progress-track {
  height: 12px;
  background: var(--color-border);
  border-radius: 6px;
  overflow: hidden;
  position: relative;
}

.progress-track-income {
  background: rgba(5, 150, 105, 0.2);
}

.progress-track-expenses {
  background: rgba(234, 179, 8, 0.2);
}

.progress-fill {
  height: 100%;
  border-radius: 6px;
  transition: width 0.4s ease-out;
}

.progress-fill-income {
  background: linear-gradient(90deg, #059669, #10b981);
}

.progress-fill-expenses {
  background: linear-gradient(90deg, #65a30d, #84cc16);
}

.progress-fill-expenses.over-budget {
  background: linear-gradient(90deg, #d97706, #ea580c);
}

.progress-over-indicator {
  font-size: 0.8125rem;
  color: #dc2626;
  font-weight: 500;
}
</style>
