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
          <span class="progress-amounts">{{ formatCurrency(realIncome) }} <span class="progress-of">/ {{ formatCurrency(expectedIncome) }}</span></span>
          <span class="progress-pct">{{ incomeProgress }}%</span>
          <span v-if="incomeReached" class="ui-badge ui-badge--success"><svg class="badge-check" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>Atingido</span>
        </span>
      </div>
      <div class="progress-track">
        <div class="progress-fill progress-fill-income" :style="{ width: `${Math.min(100, incomeProgress)}%` }" />
      </div>
    </div>

    <div v-if="expectedExpenses > 0" class="progress-section">
      <div class="progress-header">
        <span class="progress-label">Despesas</span>
        <span class="progress-values">
          <span class="progress-amounts">{{ formatCurrency(realExpenses) }} <span class="progress-of">/ {{ formatCurrency(expectedExpenses) }}</span></span>
          <span class="progress-pct">{{ expensesProgress }}%</span>
          <span v-if="expensesOverBudget" class="ui-badge ui-badge--danger">Acima do orçamento</span>
          <span v-else-if="expensesAtBudget" class="ui-badge ui-badge--success"><svg class="badge-check" xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>No orçamento</span>
          <span v-else class="ui-badge ui-badge--success">Abaixo do orçamento</span>
        </span>
      </div>
      <div class="progress-track">
        <div
          class="progress-fill progress-fill-expenses"
          :class="{ 'over-budget': expensesOverBudget, 'near-budget': expensesAtBudget && !expensesOverBudget }"
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
  gap: var(--space-5);
}

.progress-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.progress-label {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.progress-values {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.progress-amounts {
  color: var(--color-text-strong);
  font-weight: var(--weight-semibold);
}

.progress-of {
  color: var(--color-text-muted);
  font-weight: var(--weight-regular);
}

.progress-pct {
  font-weight: var(--weight-medium);
}

.badge-check {
  flex-shrink: 0;
}

.progress-track {
  height: 8px;
  background: var(--color-surface-muted);
  border-radius: var(--radius-full);
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width var(--transition-slow);
}

.progress-fill-income {
  background: var(--color-income);
}

.progress-fill-expenses {
  background: var(--color-primary-text);
}

.progress-fill-expenses.near-budget {
  background: var(--color-warning);
}

.progress-fill-expenses.over-budget {
  background: var(--color-expense);
}

.progress-over-indicator {
  font-size: var(--text-xs);
  color: var(--color-danger);
  font-weight: var(--weight-medium);
}
</style>
