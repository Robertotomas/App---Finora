<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useHouseholdStore } from '@/stores/household'
import { objectivesApi } from '@/api/objectives'
import type {
  CreateSavingsObjectiveRequest,
  SavingsObjectiveActive,
  SavingsObjectiveHistory,
  SavingsObjectivesOverview,
  UpdateSavingsObjectiveRequest,
} from '@/types/objective'

const householdStore = useHouseholdStore()

const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const activeTab = ref<'active' | 'history'>('active')

const overview = ref<SavingsObjectivesOverview>({
  totalSavings: 0,
  reservedByCompletedObjectives: 0,
  availableForActiveObjectives: 0,
  activeObjectives: [],
  historyObjectives: [],
})

const formOpen = ref(false)
const editingId = ref<string | null>(null)
const formName = ref('')
const formTarget = ref<number | null>(null)
const formTargetDate = ref('')

const activeObjectives = computed<SavingsObjectiveActive[]>(() => overview.value.activeObjectives)
const historyObjectives = computed<SavingsObjectiveHistory[]>(() => overview.value.historyObjectives)

function resetForm() {
  formOpen.value = false
  editingId.value = null
  formName.value = ''
  formTarget.value = null
  formTargetDate.value = ''
}

function openCreateForm() {
  resetForm()
  formOpen.value = true
}

function openEditForm(item: SavingsObjectiveActive) {
  editingId.value = item.id
  formName.value = item.name
  formTarget.value = item.targetAmount
  formTargetDate.value = toDateInputValue(item.targetDate)
  formOpen.value = true
}

function toDateInputValue(iso: string | null | undefined): string {
  if (iso == null || iso === '') return ''
  const s = String(iso).slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function parseTargetDateField(raw: unknown): string | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'string') {
    const s = raw.slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  }
  const o = raw as Record<string, unknown>
  if (
    typeof o.year === 'number' &&
    typeof o.month === 'number' &&
    typeof o.day === 'number'
  ) {
    const y = o.year
    const m = String(o.month).padStart(2, '0')
    const day = String(o.day).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return null
}

function normalizeOverview(payload: unknown): SavingsObjectivesOverview {
  const raw = (payload ?? {}) as Record<string, unknown>
  const pick = (key: string) => raw[key] ?? raw[key.charAt(0).toUpperCase() + key.slice(1)]
  const list = (key: string) => {
    const value = pick(key)
    return Array.isArray(value) ? value : []
  }

  return {
    totalSavings: Number(pick('totalSavings')) || 0,
    reservedByCompletedObjectives: Number(pick('reservedByCompletedObjectives')) || 0,
    availableForActiveObjectives: Number(pick('availableForActiveObjectives')) || 0,
    activeObjectives: list('activeObjectives').map((x) => {
      const item = x as Record<string, unknown>
      return {
        id: String(item.id ?? item.Id ?? ''),
        name: String(item.name ?? item.Name ?? ''),
        targetAmount: Number(item.targetAmount ?? item.TargetAmount) || 0,
        targetDate: parseTargetDateField(item.targetDate ?? item.TargetDate),
        sortOrder: Number(item.sortOrder ?? item.SortOrder) || 0,
        allocatedAmount: Number(item.allocatedAmount ?? item.AllocatedAmount) || 0,
        progressPercent: Number(item.progressPercent ?? item.ProgressPercent) || 0,
        canFinalize: Boolean(item.canFinalize ?? item.CanFinalize),
      }
    }),
    historyObjectives: list('historyObjectives').map((x) => {
      const item = x as Record<string, unknown>
      return {
        id: String(item.id ?? item.Id ?? ''),
        name: String(item.name ?? item.Name ?? ''),
        targetAmount: Number(item.targetAmount ?? item.TargetAmount) || 0,
        targetDate: parseTargetDateField(item.targetDate ?? item.TargetDate),
        sortOrder: Number(item.sortOrder ?? item.SortOrder) || 0,
        completedAt: String(item.completedAt ?? item.CompletedAt ?? ''),
      }
    }),
  }
}

async function loadOverview() {
  loading.value = true
  error.value = null
  try {
    const { data } = await objectivesApi.getOverview()
    overview.value = normalizeOverview(data)
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } }; message?: string }
    error.value = err.response?.data?.message || err.message || 'Erro ao carregar objetivos.'
  } finally {
    loading.value = false
  }
}

async function submitForm() {
  if (!formName.value.trim() || !formTarget.value || formTarget.value <= 0) {
    error.value = 'Preenche nome e valor alvo válido.'
    return
  }

  saving.value = true
  error.value = null
  try {
    const targetDateRaw = formTargetDate.value.trim()
    const targetDate = targetDateRaw === '' ? null : targetDateRaw

    if (editingId.value) {
      const payload: UpdateSavingsObjectiveRequest = {
        name: formName.value.trim(),
        targetAmount: Number(formTarget.value),
        targetDate,
      }
      const { data } = await objectivesApi.update(editingId.value, payload)
      overview.value = normalizeOverview(data)
    } else {
      const payload: CreateSavingsObjectiveRequest = {
        name: formName.value.trim(),
        targetAmount: Number(formTarget.value),
        targetDate,
      }
      const { data } = await objectivesApi.create(payload)
      overview.value = normalizeOverview(data)
    }
    resetForm()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } }; message?: string }
    error.value = err.response?.data?.message || err.message || 'Não foi possível guardar objetivo.'
  } finally {
    saving.value = false
  }
}

async function finalizeObjective(item: SavingsObjectiveActive) {
  saving.value = true
  error.value = null
  try {
    const { data } = await objectivesApi.finalize(item.id)
    overview.value = normalizeOverview(data)
    activeTab.value = 'active'
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } }; message?: string }
    error.value = err.response?.data?.message || err.message || 'Não foi possível finalizar objetivo.'
  } finally {
    saving.value = false
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

function formatDate(value: string): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('pt-PT')
}

onMounted(async () => {
  try {
    await householdStore.fetchHousehold()
  } catch {
    // handled below
  }
  if (householdStore.household) {
    await loadOverview()
  }
})
</script>

<template>
  <div class="objectives-view">
    <div class="page-header">
      <h1>Objetivos</h1>
      <p class="subtitle">Define objetivos de poupança e acompanha o progresso de cada um.</p>
    </div>

    <div v-if="!householdStore.household && !householdStore.loading" class="empty-state">
      <p>Configura primeiro o teu household.</p>
      <router-link to="/household" class="link">Ir para Household</router-link>
    </div>

    <div v-else-if="householdStore.loading" class="loading-state">
      <div class="spinner"></div>
      <p>A carregar...</p>
    </div>

    <template v-else>
      <div class="summary-strip">
        <div class="summary-item">
          <span class="summary-label">Poupança acumulada</span>
          <span class="summary-value">{{ formatCurrency(overview.totalSavings) }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Reservado por finalizados</span>
          <span class="summary-value">{{ formatCurrency(overview.reservedByCompletedObjectives) }}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Disponível para objetivos ativos</span>
          <span class="summary-value">{{ formatCurrency(overview.availableForActiveObjectives) }}</span>
        </div>
      </div>

      <div class="tabs">
        <button type="button" class="tab" :class="{ active: activeTab === 'active' }" @click="activeTab = 'active'">
          Objetivos ativos
        </button>
        <button type="button" class="tab" :class="{ active: activeTab === 'history' }" @click="activeTab = 'history'">
          Histórico
        </button>
      </div>

      <div v-if="error" class="global-error">{{ error }}</div>

      <section v-if="activeTab === 'active'" class="content-section">
        <div class="toolbar">
          <button type="button" class="btn-add" @click="openCreateForm">+ Novo objetivo</button>
        </div>

        <div v-if="formOpen" class="goal-form-card">
          <h2 class="section-title">{{ editingId ? 'Editar objetivo' : 'Novo objetivo' }}</h2>
          <div class="goal-form-grid">
            <label class="field">
              <span class="field-label">Nome do objetivo</span>
              <input v-model="formName" class="field-input" type="text" maxlength="200" placeholder="Ex.: Viagem, fundo de emergência..." />
            </label>
            <label class="field">
              <span class="field-label">Valor necessário</span>
              <input v-model.number="formTarget" class="field-input" type="number" min="0.01" step="0.01" placeholder="0,00" />
            </label>
            <label class="field field-span-2">
              <span class="field-label">Quer atingir até (opcional)</span>
              <input v-model="formTargetDate" class="field-input" type="date" />
            </label>
          </div>
          <div class="form-actions">
            <button type="button" class="btn-secondary" :disabled="saving" @click="resetForm">Cancelar</button>
            <button type="button" class="btn-add" :disabled="saving" @click="submitForm">
              {{ saving ? 'A guardar...' : 'Guardar' }}
            </button>
          </div>
        </div>

        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <p>A carregar objetivos...</p>
        </div>

        <div v-else-if="activeObjectives.length === 0" class="empty-state">
          <p>Ainda não tens objetivos ativos.</p>
          <button type="button" class="btn-add" @click="openCreateForm">Criar primeiro objetivo</button>
        </div>

        <div v-else class="goals-grid">
          <article v-for="goal in activeObjectives" :key="goal.id" class="goal-card">
            <header class="goal-card-header">
              <h3 class="goal-name">{{ goal.name }}</h3>
              <span class="goal-order">#{{ goal.sortOrder }}</span>
            </header>

            <p class="goal-amounts">
              {{ formatCurrency(goal.allocatedAmount) }} / {{ formatCurrency(goal.targetAmount) }}
            </p>
            <p v-if="goal.targetDate" class="goal-target-date">Meta: {{ formatDate(goal.targetDate) }}</p>

            <div class="progress-track" role="progressbar" :aria-valuenow="goal.progressPercent" aria-valuemin="0" aria-valuemax="100">
              <div class="progress-fill" :style="{ width: `${Math.min(100, goal.progressPercent)}%` }"></div>
            </div>
            <p class="progress-text">{{ goal.progressPercent.toFixed(2) }}%</p>

            <div class="goal-actions">
              <button type="button" class="btn-secondary" :disabled="saving" @click="openEditForm(goal)">Editar</button>
              <button
                type="button"
                class="btn-finish"
                :disabled="saving || !goal.canFinalize"
                @click="finalizeObjective(goal)"
              >
                Finalizar
              </button>
            </div>
          </article>
        </div>
      </section>

      <section v-else class="content-section">
        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <p>A carregar histórico...</p>
        </div>

        <div v-else-if="historyObjectives.length === 0" class="empty-state">
          <p>Sem objetivos finalizados ainda.</p>
        </div>

        <div v-else class="table-container">
          <table class="history-table">
            <thead>
              <tr>
                <th>Objetivo</th>
                <th>Valor</th>
                <th>Meta até</th>
                <th>Ordem</th>
                <th>Finalizado em</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in historyObjectives" :key="item.id">
                <td>{{ item.name }}</td>
                <td>{{ formatCurrency(item.targetAmount) }}</td>
                <td>{{ item.targetDate ? formatDate(item.targetDate) : '—' }}</td>
                <td>#{{ item.sortOrder }}</td>
                <td>{{ formatDate(item.completedAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.objectives-view {
  max-width: min(960px, 100%);
  margin: 0 auto;
  padding: 0 0 2.5rem;
}

.summary-strip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.summary-item {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 0.75rem 0.875rem;
}

.summary-label {
  display: block;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-bottom: 0.25rem;
}

.summary-value {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--color-text);
}

.toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.goal-form-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.goal-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.field-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-input-border);
  border-radius: 8px;
  font-size: 0.875rem;
  background: var(--color-input-bg);
  color: var(--color-text);
}

.form-actions {
  margin-top: 0.875rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.goals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.goal-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1rem;
}

.goal-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.goal-name {
  font-size: 1rem;
  color: var(--color-text);
  margin: 0;
}

.goal-order {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  font-weight: 600;
}

.goal-amounts {
  margin: 0 0 0.625rem;
  color: var(--color-text);
  font-weight: 600;
}

.goal-target-date {
  margin: -0.25rem 0 0.5rem;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.field-span-2 {
  grid-column: 1 / -1;
}

.progress-track {
  width: 100%;
  height: 10px;
  border-radius: 999px;
  background: var(--color-table-row-hover);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #166534 0%, #16a34a 100%);
  transition: width 0.2s ease;
}

.progress-text {
  margin: 0.4rem 0 0.8rem;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.goal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.btn-add,
.btn-secondary,
.btn-finish {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.5rem 0.85rem;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-add {
  background: #166534;
  color: #fff;
}

.btn-add:hover {
  background: #15803d;
}

.btn-secondary {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text);
}

.btn-finish {
  background: #0f766e;
  color: #fff;
}

.btn-finish:disabled,
.btn-add:disabled,
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.content-section {
  margin-top: 0.75rem;
}

.global-error {
  margin-top: 0.75rem;
  margin-bottom: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
  font-size: 0.875rem;
}

.loading-state,
.empty-state {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--color-text-muted);
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--color-border);
  border-top-color: #166534;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 0.8rem;
}

.table-container {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
}

.history-table th,
.history-table td {
  text-align: left;
  padding: 0.75rem 0.85rem;
  border-bottom: 1px solid var(--color-border);
}

.history-table th {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.history-table td {
  color: var(--color-text);
  font-size: 0.875rem;
}

.link {
  color: var(--color-link-hover);
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
