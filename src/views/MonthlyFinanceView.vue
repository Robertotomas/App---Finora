<script setup lang="ts">
import { PT_GROUPING } from '@/utils/numberFormat'
import { computed, ref, watch, onMounted } from 'vue'
import { useHouseholdStore } from '@/stores/household'
import { useMonthlyBudget } from '@/composables/useMonthlyBudget'
import { dashboardApi } from '@/api/dashboard'
import MonthYearNavigator from '@/components/MonthYearNavigator.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import UiButton from '@/components/ui/UiButton.vue'
import ActionMenu, { type ActionMenuItem } from '@/components/ui/ActionMenu.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue'
import ProgressMeter from '@/components/planning/ProgressMeter.vue'
import { useToast } from '@/composables/useToast'

const householdStore = useHouseholdStore()
const householdId = computed(() => householdStore.household?.id)
const toast = useToast()

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

/** Menu "⋯" do cabeçalho (igual às outras páginas): editar / eliminar o plano do mês. */
const planMenuItems = computed<ActionMenuItem[]>(() => [
  { label: 'Editar plano', onSelect: () => startEdit() },
  { label: 'Eliminar plano', danger: true, onSelect: () => confirmDelete() },
])

const remainingMonthsCount = computed(() => 12 - selectedMonth.value)

const saving = ref(false)

async function submit() {
  const income = Number(inputIncome.value) || 0
  const expenses = Number(inputExpenses.value) || 0
  const wasEditing = isEditing.value
  const extraMonths = applyToRemaining.value ? remainingMonthsCount.value : 0

  saving.value = true
  try {
    await budget.setBudget(
      householdId.value,
      selectedYear.value,
      selectedMonth.value,
      income,
      expenses
    )

    if (applyToRemaining.value) {
      for (let m = selectedMonth.value + 1; m <= 12; m++) {
        await budget.setBudget(householdId.value, selectedYear.value, m, income, expenses)
      }
      applyToRemaining.value = false
    }

    isEditing.value = false
    toast.success(
      extraMonths > 0
        ? `Plano guardado para ${periodLabel.value} e os ${extraMonths} meses seguintes`
        : wasEditing
          ? 'Plano atualizado'
          : 'Plano definido'
    )
  } catch {
    toast.error('Não foi possível guardar o plano. Tente novamente.')
  } finally {
    saving.value = false
  }
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

async function deleteBudget() {
  saving.value = true
  try {
    await budget.clearBudget(householdId.value, selectedYear.value, selectedMonth.value)
    inputIncome.value = 0
    inputExpenses.value = 0
    isEditing.value = false
    deleteModalOpen.value = false
    toast.success('Plano eliminado')
  } catch {
    toast.error('Não foi possível eliminar o plano. Tente novamente.')
  } finally {
    saving.value = false
  }
}

/** Cor da barra das despesas: aviso a partir de 90%, vermelho acima do orçamento. */
const expensesTone = computed<'primary' | 'warning' | 'danger'>(() =>
  expensesOverBudget.value ? 'danger' : expensesProgress.value >= 90 ? 'warning' : 'primary'
)

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-PT', { ...PT_GROUPING,
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
      progressError.value = 'Não encontrámos o seu agregado.'
    } else if (err.response?.data?.message) {
      progressError.value = err.response.data.message
    } else if (err.message?.includes('timeout') || err.message?.includes('Network Error')) {
      progressError.value = 'Sem ligação ao servidor. Verifique a sua ligação e tente novamente.'
    } else {
      progressError.value = 'Não foi possível carregar os valores reais deste mês.'
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
    <PageHeader title="Plano mensal">
      <template v-if="householdStore.household" #actions>
        <MonthYearNavigator
          v-model:month="selectedMonth"
          v-model:year="selectedYear"
          :years="yearOptions"
          :month-names="MONTH_NAMES"
        />
        <ActionMenu v-if="!showForm" :items="planMenuItems" aria-label="Ações do plano" />
      </template>
    </PageHeader>

    <!-- Sem agregado -->
    <EmptyState
      v-if="!householdStore.household && !householdStore.loading"
      title="Ainda não tem um agregado"
      description="Configure primeiro o seu agregado para definir o plano mensal."
    >
      <template #icon>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
      </template>
      <router-link to="/household" class="link-btn">Configurar agregado</router-link>
    </EmptyState>

    <PageSkeleton v-else-if="householdStore.loading && !householdStore.household" variant="cards" :rows="2" />

    <div v-else class="plan-layout" :class="{ 'plan-layout--split': !showForm && showProgressSection }">
      <!-- ════ FORMULÁRIO: definir expectativas ════ -->
      <section v-if="showForm" class="card">
        <header class="card-head">
          <div>
            <h2 class="card-title">{{ isEditing ? 'Editar plano' : 'Definir plano' }}</h2>
            <p class="card-subtitle">{{ periodLabel }}</p>
          </div>
        </header>
        <div class="form-grid">
          <label class="field">
            <span class="field-label">Receita esperada</span>
            <span class="input-wrap">
              <input
                v-model.number="inputIncome"
                type="number"
                min="0"
                step="0.01"
                class="field-input"
                placeholder="0,00"
              />
              <span class="input-suffix">€</span>
            </span>
          </label>
          <label class="field">
            <span class="field-label">Despesas esperadas</span>
            <span class="input-wrap">
              <input
                v-model.number="inputExpenses"
                type="number"
                min="0"
                step="0.01"
                class="field-input"
                placeholder="0,00"
              />
              <span class="input-suffix">€</span>
            </span>
          </label>
          <div class="field">
            <span class="field-label">Saldo previsto</span>
            <span class="preview-value ui-amount" :class="{ 'ui-amount--neg': (Number(inputIncome) || 0) - (Number(inputExpenses) || 0) < 0 }">
              {{ formatCurrency((Number(inputIncome) || 0) - (Number(inputExpenses) || 0)) }}
            </span>
          </div>
        </div>
        <label v-if="remainingMonthsCount > 0" class="apply-remaining">
          <input v-model="applyToRemaining" type="checkbox" class="apply-remaining-check" />
          <span class="apply-remaining-text">
            Aplicar também aos restantes <strong>{{ remainingMonthsCount }}</strong> {{ remainingMonthsCount === 1 ? 'mês' : 'meses' }} do ano
          </span>
        </label>
        <div class="form-actions">
          <UiButton v-if="isEditing" variant="secondary" :disabled="saving" @click="isEditing = false">Cancelar</UiButton>
          <UiButton variant="primary" :loading="saving" @click="submit">
            {{ isEditing ? 'Guardar alterações' : 'Definir plano' }}
          </UiButton>
        </div>
      </section>

      <!-- ════ RESUMO: valores definidos ════ -->
      <section v-else class="card">
        <header class="card-head">
          <div>
            <h2 class="card-title">Plano definido</h2>
            <p class="card-subtitle">{{ periodLabel }}</p>
          </div>
        </header>
        <dl class="plan-dl">
          <div class="plan-row">
            <dt><span class="dot dot--income" aria-hidden="true" />Receita esperada</dt>
            <dd class="ui-amount">{{ formatCurrency(currentBudget.expectedIncome) }}</dd>
          </div>
          <div class="plan-row">
            <dt><span class="dot dot--expense" aria-hidden="true" />Despesas esperadas</dt>
            <dd class="ui-amount">{{ formatCurrency(currentBudget.expectedExpenses) }}</dd>
          </div>
        </dl>
        <!-- Caixa igual à do "Saldo real" (cartão ao lado), alinhada ao fundo -->
        <dl class="balance-dl balance-dl--bottom">
          <div>
            <dt>Saldo previsto</dt>
            <dd class="ui-amount" :class="{ 'ui-amount--neg': balanceExpected < 0 }">{{ formatCurrency(balanceExpected) }}</dd>
            <p v-if="currentBudget.expectedIncome > 0" class="balance-diff">
              Poupança prevista de {{ Math.round((balanceExpected / currentBudget.expectedIncome) * 100) }}% da receita
            </p>
          </div>
        </dl>
      </section>

      <!-- ════ PROGRESSO ════ -->
      <section v-if="showProgressSection" class="card">
        <header class="card-head">
          <div>
            <h2 class="card-title">Real vs. planeado</h2>
            <p class="card-subtitle">Movimentos registados em {{ periodLabel }}</p>
          </div>
        </header>

        <div v-if="progressLoading" class="progress-loading" role="status">
          <span class="spinner" aria-hidden="true" />
          A carregar valores reais…
        </div>

        <div v-else-if="progressError" class="progress-error">
          <p>{{ progressError }}</p>
          <UiButton variant="secondary" size="sm" @click="fetchProgressData">Tentar novamente</UiButton>
        </div>

        <div v-else-if="progressData" class="progress-content">
          <!-- Receitas -->
          <div v-if="currentBudget.expectedIncome > 0" class="progress-block">
            <div class="progress-row">
              <span class="progress-name"><span class="dot dot--income" aria-hidden="true" />Receitas</span>
              <span class="progress-values">
                <span class="ui-amount">{{ formatCurrency(progressData.monthlyIncome) }}</span>
                <span class="progress-target">de {{ formatCurrency(currentBudget.expectedIncome) }}</span>
              </span>
            </div>
            <ProgressMeter :value="incomeProgress" label="Receitas face ao plano" />
            <div class="progress-foot">
              <span class="progress-pct">{{ String(incomeProgress).replace('.', ',') }}%</span>
              <span v-if="incomeReached" class="ui-badge ui-badge--success">Objetivo atingido</span>
              <span v-else class="progress-note">Faltam {{ formatCurrency(Math.max(0, incomeDiff)) }}</span>
            </div>
          </div>

          <!-- Despesas -->
          <div v-if="currentBudget.expectedExpenses > 0" class="progress-block">
            <div class="progress-row">
              <span class="progress-name"><span class="dot dot--expense" aria-hidden="true" />Despesas</span>
              <span class="progress-values">
                <span class="ui-amount">{{ formatCurrency(progressData.monthlyExpenses) }}</span>
                <span class="progress-target">de {{ formatCurrency(currentBudget.expectedExpenses) }}</span>
              </span>
            </div>
            <ProgressMeter :value="expensesProgress" :tone="expensesTone" label="Despesas face ao plano" />
            <div class="progress-foot">
              <span class="progress-pct">{{ String(expensesProgress).replace('.', ',') }}%</span>
              <span v-if="expensesOverBudget" class="ui-badge ui-badge--danger">{{ formatCurrency(Math.abs(expensesDiff)) }} acima do plano</span>
              <span v-else class="progress-note">Margem de {{ formatCurrency(Math.max(0, expensesDiff)) }}</span>
            </div>
          </div>

          <!-- Saldo real (o previsto está no cartão "Plano definido") -->
          <dl class="balance-dl">
            <div>
              <dt>
                Saldo real
                <svg v-if="balanceReal < balanceExpected" class="balance-arrow balance-arrow--down" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-label="Abaixo do previsto"><polyline points="7 13 12 18 17 13"/><line x1="12" x2="12" y1="18" y2="6"/></svg>
                <svg v-else class="balance-arrow balance-arrow--up" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-label="Acima do previsto"><polyline points="17 11 12 6 7 11"/><line x1="12" x2="12" y1="6" y2="18"/></svg>
              </dt>
              <dd class="ui-amount" :class="{ 'ui-amount--neg': balanceReal < 0 }">{{ formatCurrency(balanceReal) }}</dd>
              <p class="balance-diff">
                <span :class="balanceReal - balanceExpected < 0 ? 'neg' : 'pos'">{{ balanceReal - balanceExpected >= 0 ? '+' : '−' }}{{ formatCurrency(Math.abs(balanceReal - balanceExpected)) }}</span>
                face ao previsto
              </p>
            </div>
          </dl>
        </div>

        <EmptyState
          v-else
          compact
          title="Ainda sem valores reais"
          description="Adicione movimentos neste mês para comparar com o plano."
        >
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
          </template>
        </EmptyState>
      </section>
    </div>

    <ConfirmDeleteModal
      :open="deleteModalOpen"
      title="Eliminar plano"
      :message="`Tem a certeza que quer eliminar o plano de ${periodLabel}? Esta ação não pode ser desfeita.`"
      :loading="saving"
      @close="cancelDelete"
      @confirm="deleteBudget"
    />
  </div>
</template>

<style scoped>
/* Mesma largura/alinhamento das outras páginas (título no mesmo sítio); o conteúdo, por ser
   formulário, fica com largura confortável e alinhado à esquerda. */
.monthly-finance {
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 0 0 var(--space-10);
}

/* Formulário: largura toda. Plano definido: "Plano definido" e "Real vs. planeado" lado a lado. */
.plan-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-5);
  align-items: start;
}
/* Plano definido (esq.) + Real (dir.) lado a lado, com a mesma altura */
.plan-layout--split {
  grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
  align-items: stretch;
}
.plan-layout--split > .card {
  height: 100%;
}
@media (max-width: 900px) {
  .plan-layout--split {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* ── Cartões ── */
.card {
  padding: var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}
.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}
.card-title {
  margin: 0;
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}
.card-subtitle {
  margin: 2px 0 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

/* ── Formulário ── */
.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.field-label {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text-secondary);
}
.input-wrap {
  position: relative;
  display: block;
}
.field-input {
  width: 100%;
  height: 40px;
  padding: 0 2.25rem 0 var(--space-3);
  font-family: inherit;
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  font-variant-numeric: tabular-nums;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  box-sizing: border-box;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  -moz-appearance: textfield;
  appearance: textfield;
}
.field-input::-webkit-outer-spin-button,
.field-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.field-input::placeholder { color: var(--color-text-subtle); }
.field-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--focus-ring);
}
.input-suffix {
  position: absolute;
  right: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  color: var(--color-text-muted);
  pointer-events: none;
}
.apply-remaining {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.apply-remaining:hover { background: var(--color-surface-muted); }
.apply-remaining-check {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--color-primary);
  cursor: pointer;
  flex-shrink: 0;
}
.apply-remaining-text {
  font-size: var(--text-sm);
  color: var(--color-text);
  line-height: 1.4;
}
.apply-remaining-text strong { font-weight: var(--weight-semibold); }
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-5);
}

/* ── Lista de definições (plano) ── */
.plan-dl {
  margin: 0;
}
.plan-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border-subtle);
}
.plan-row:first-child { padding-top: 0; }
.plan-row dt {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-base);
  color: var(--color-text-secondary);
}
.plan-row dd {
  margin: 0;
  font-size: var(--text-base);
}
.plan-row--total {
  border-bottom: none;
  padding-bottom: 0;
}
.plan-row--total dt {
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}
.plan-row--total dd {
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}
.dot--income { background: var(--color-income); }
.dot--expense { background: var(--color-expense); }

/* ── Progresso ── */
.progress-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-8) 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.progress-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-6) 0;
  text-align: center;
}
.progress-error p {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}
.progress-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
.progress-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.progress-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.progress-name {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}
.progress-values {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-size: var(--text-sm);
}
.progress-target {
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}
.progress-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  font-size: var(--text-sm);
}
.progress-pct {
  font-weight: var(--weight-semibold);
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}
.progress-note {
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.balance-dl {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  margin: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.balance-dl > div {
  padding: var(--space-4);
}
.balance-dl > div + div {
  border-left: 1px solid var(--color-border);
}
.balance-dl dt {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-bottom: var(--space-1);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.balance-dl dd {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
}
.balance-arrow--down { color: var(--color-expense); }
.balance-arrow--up { color: var(--color-income); }

.link-btn {
  display: inline-flex;
  align-items: center;
  height: var(--control-h);
  padding: 0 var(--space-4);
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  text-decoration: none;
}
.link-btn:hover { background: var(--color-primary-hover); }

/* ── Responsivo ── */
@media (max-width: 640px) {
  .form-grid { grid-template-columns: minmax(0, 1fr); }
  .card { padding: var(--space-4); }
  .balance-dl { grid-template-columns: minmax(0, 1fr); }
  .balance-dl > div + div {
    border-left: none;
    border-top: 1px solid var(--color-border);
  }
  .form-actions { flex-direction: column-reverse; }
}

/* Saldo previsto (pré-visualização ao vivo no formulário) — alinhado com a altura dos inputs */
.preview-value {
  display: flex;
  align-items: center;
  height: 40px;
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  color: var(--color-text-strong);
}
.preview-value.ui-amount--neg {
  color: var(--color-expense);
}
@media (max-width: 720px) {
  .form-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.balance-diff {
  margin: 2px 0 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.balance-diff .pos { color: var(--color-income); font-weight: var(--weight-semibold); }
.balance-diff .neg { color: var(--color-expense); font-weight: var(--weight-semibold); }

/* Cartões em coluna: a caixa do saldo fica sempre no fundo (os dois cartões alinham) */
.plan-layout--split > .card {
  display: flex;
  flex-direction: column;
}
.plan-layout--split .progress-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.balance-dl--bottom,
.plan-layout--split .progress-content > .balance-dl {
  margin-top: auto;
}
.balance-dl--bottom {
  margin-top: var(--space-4);
}
.plan-layout--split .balance-dl--bottom {
  margin-top: auto;
}
</style>
