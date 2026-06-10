<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHouseholdStore } from '@/stores/household'
import { objectivesApi } from '@/api/objectives'
import { useSubscriptionStore } from '@/stores/subscription'
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue'
import PlanUpsellCard from '@/components/PlanUpsellCard.vue'
import type {
  CreateSavingsObjectiveRequest,
  SavingsObjectiveActive,
  SavingsObjectiveHistory,
  SavingsObjectivesOverview,
  UpdateSavingsObjectiveRequest,
} from '@/types/objective'

const route = useRoute()
const router = useRouter()
const householdStore = useHouseholdStore()
const subscriptionStore = useSubscriptionStore()

const pageReady = ref(false)
const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)

type SectionFilter = 'all' | 'active' | 'history'
const sectionFilter = computed<SectionFilter>({
  get: () =>
    route.query.tab === 'history' ? 'history' : route.query.tab === 'active' ? 'active' : 'all',
  set: (val) => {
    const tab = val === 'all' ? undefined : val
    router.replace({ query: { ...route.query, tab } })
  },
})
const showActive = computed(() => sectionFilter.value !== 'history')
const showHistory = computed(() => sectionFilter.value !== 'active')

const overview = ref<SavingsObjectivesOverview>({
  totalSavings: 0,
  reservedByCompletedObjectives: 0,
  availableForActiveObjectives: 0,
  activeObjectives: [],
  historyObjectives: [],
})

// Textos dos tooltips dos cards. No plano Couple falamos no plural (2 membros);
// nos planos individuais (Free/Pro) no singular.
const isCouple = computed(() => subscriptionStore.plan === 'Couple')
const statTooltips = computed(() =>
  isCouple.value
    ? {
        savings:
          'Receitas − Despesas\nTotal que pouparam desde o início até ao último mês.\nPode ser negativo se as despesas forem superiores às receitas.',
        reserved:
          'Valor reservado para objetivos concluídos mas ainda não liquidados. Não está disponível para outros objetivos.',
        available:
          'Poupança disponível para distribuir pelos objetivos ativos, depois de descontado o valor reservado.',
      }
    : {
        savings:
          'Receitas − Despesas\nTotal que poupaste desde o início até ao último mês.\nPode ser negativo se as despesas forem superiores às receitas.',
        reserved:
          'Valor reservado para objetivos concluídos mas ainda não liquidados. Não está disponível para outros objetivos.',
        available:
          'Poupança disponível para distribuir pelos objetivos ativos, depois de descontado o valor reservado.',
      },
)

const formOpen = ref(false)
const editingId = ref<string | null>(null)
const formName = ref('')
const formTarget = ref<number | null>(null)
const formTargetDate = ref('')

const objectiveToDelete = ref<{ id: string; name: string } | null>(null)

const activeObjectives = computed<SavingsObjectiveActive[]>(() => overview.value.activeObjectives)
const historyObjectives = computed<SavingsObjectiveHistory[]>(() => overview.value.historyObjectives)

const objectivesLocked = computed(() => !subscriptionStore.canAccessObjectives)

function resetForm() {
  formOpen.value = false
  editingId.value = null
  formName.value = ''
  formTarget.value = null
  formTargetDate.value = ''
}

function openCreateForm() {
  if (objectivesLocked.value) return
  resetForm()
  // Garante que a secção Ativos (que contém o formulário) está visível.
  if (sectionFilter.value === 'history') sectionFilter.value = 'all'
  formOpen.value = true
}

function openEditForm(item: SavingsObjectiveActive) {
  if (objectivesLocked.value) return
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
        liquidatedAt: (() => {
          const v = item.liquidatedAt ?? item.LiquidatedAt
          return v ? String(v) : null
        })(),
      }
    }),
  }
}

function distributeLocalSavings(ov: ReturnType<typeof normalizeOverview>) {
  // O pool disponível para objetivos ativos já vem calculado pelo backend
  // (poupança acumulada menos o que está reservado pelos objetivos finalizados).
  // Usamos esse valor — NÃO o totalSavings — para não voltar a contar o
  // dinheiro já reservado por finalizados.
  const available = Math.max(0, ov.availableForActiveObjectives)
  for (const goal of ov.activeObjectives) {
    const allocated = Math.min(available, goal.targetAmount)
    goal.allocatedAmount = allocated
    goal.progressPercent = goal.targetAmount > 0 ? (allocated / goal.targetAmount) * 100 : 0
    goal.canFinalize = allocated >= goal.targetAmount
  }
  return ov
}

async function loadOverview() {
  loading.value = true
  error.value = null
  try {
    const { data } = await objectivesApi.getOverview()
    overview.value = distributeLocalSavings(normalizeOverview(data))
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } }; message?: string }
    error.value = err.response?.data?.message || err.message || 'Erro ao carregar objetivos.'
  } finally {
    loading.value = false
  }
}

watch(
  () => subscriptionStore.limits.objectivesEnabled,
  async (enabled) => {
    if (!householdStore.household) return
    await loadOverview()
    if (!enabled) {
      error.value = null
      sectionFilter.value = 'all'
      resetForm()
    }
  }
)

async function submitForm() {
  if (objectivesLocked.value) return
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
      overview.value = distributeLocalSavings(normalizeOverview(data))
    } else {
      const payload: CreateSavingsObjectiveRequest = {
        name: formName.value.trim(),
        targetAmount: Number(formTarget.value),
        targetDate,
      }
      const { data } = await objectivesApi.create(payload)
      overview.value = distributeLocalSavings(normalizeOverview(data))
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
  if (objectivesLocked.value) return
  saving.value = true
  error.value = null
  try {
    const { data } = await objectivesApi.finalize(item.id)
    overview.value = distributeLocalSavings(normalizeOverview(data))
    sectionFilter.value = 'all'
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } }; message?: string }
    error.value = err.response?.data?.message || err.message || 'Não foi possível finalizar objetivo.'
  } finally {
    saving.value = false
  }
}

function openDeleteObjective(goal: { id: string; name: string }) {
  if (objectivesLocked.value) return
  objectiveToDelete.value = { id: goal.id, name: goal.name }
}

function closeDeleteObjective() {
  objectiveToDelete.value = null
}

async function confirmDeleteObjective() {
  if (!objectiveToDelete.value || objectivesLocked.value) return
  saving.value = true
  error.value = null
  const id = objectiveToDelete.value.id
  try {
    const { data } = await objectivesApi.delete(id)
    overview.value = distributeLocalSavings(normalizeOverview(data))
    if (editingId.value === id) resetForm()
    objectiveToDelete.value = null
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } }; message?: string }
    error.value = err.response?.data?.message || err.message || 'Não foi possível eliminar o objetivo.'
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
    await subscriptionStore.fetchSubscription()
  } catch {
    // handled below
  }
  pageReady.value = true
  if (householdStore.household && !objectivesLocked.value) {
    await loadOverview()
    if (route.query.action === 'new') {
      openCreateForm()
      router.replace({ query: { ...route.query, action: undefined } })
    }
  } else {
    loading.value = false
  }
})

watch(() => route.query.action, (action) => {
  if (action === 'new' && !objectivesLocked.value) {
    openCreateForm()
    router.replace({ query: { ...route.query, action: undefined } })
  }
})
</script>

<template>
  <div class="objectives-page">
    <!-- Loading until household + subscription resolved -->
    <div v-if="!pageReady" class="loading-state">
      <div class="spinner"></div>
      <p>A carregar...</p>
    </div>

    <!-- No household -->
    <div v-else-if="!householdStore.household" class="empty-state">
      <p>Configura primeiro o teu household.</p>
      <router-link to="/household" class="link">Ir para Household</router-link>
    </div>

    <!-- Main content -->
    <template v-else>
      <!-- Page header -->
      <div class="page-header">
        <div class="page-header-text">
          <h1 class="page-title">Objetivos</h1>
          <p class="page-subtitle">Define objetivos de poupança e acompanha o progresso</p>
        </div>
        <button
          v-if="!objectivesLocked"
          type="button"
          class="btn-add"
          @click="openCreateForm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
          Novo objetivo
        </button>
      </div>

      <PlanUpsellCard
        v-if="objectivesLocked"
        title="Defina e alcance os seus objetivos"
        description="Crie metas de poupança e acompanhe o progresso automaticamente, mês a mês."
        :features="[
          'Veja quanto já tem reservado para cada meta',
          'Saiba se está no bom caminho para a atingir',
          'Reserve poupança sem mexer no dinheiro real',
        ]"
      >
        <template #icon>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><line x1="22" x2="12" y1="2" y2="12"/></svg>
        </template>
      </PlanUpsellCard>

      <div v-else class="objectives-shell-wrap">
        <div class="objectives-shell objectives-shell-inner">

          <!-- Summary stats -->
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-header">
                <p class="stat-label">Poupança acumulada</p>
                <span class="stat-info" tabindex="0" role="button" aria-label="O que é a poupança acumulada?">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg>
                  <span class="stat-tooltip" role="tooltip">{{ statTooltips.savings }}</span>
                </span>
              </div>
              <p class="stat-value" :class="{ 'stat-value--negative': overview.totalSavings < 0 }">
                {{ formatCurrency(overview.totalSavings) }}
              </p>
            </div>
            <div class="stat-card">
              <div class="stat-header">
                <p class="stat-label">Reservado por finalizados</p>
                <span class="stat-info" tabindex="0" role="button" aria-label="O que é o reservado por finalizados?">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg>
                  <span class="stat-tooltip" role="tooltip">{{ statTooltips.reserved }}</span>
                </span>
              </div>
              <p class="stat-value">{{ formatCurrency(overview.reservedByCompletedObjectives) }}</p>
            </div>
            <div class="stat-card">
              <div class="stat-header">
                <p class="stat-label">Disponível para ativos</p>
                <span class="stat-info" tabindex="0" role="button" aria-label="O que é o disponível para ativos?">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg>
                  <span class="stat-tooltip" role="tooltip">{{ statTooltips.available }}</span>
                </span>
              </div>
              <p class="stat-value">{{ formatCurrency(overview.availableForActiveObjectives) }}</p>
            </div>
          </div>

          <!-- Filtro de secções -->
          <div class="filter-chips" role="tablist">
            <button type="button" class="filter-chip" :class="{ active: sectionFilter === 'all' }" role="tab" :aria-selected="sectionFilter === 'all'" @click="sectionFilter = 'all'">Todos</button>
            <button type="button" class="filter-chip" :class="{ active: sectionFilter === 'active' }" role="tab" :aria-selected="sectionFilter === 'active'" @click="sectionFilter = 'active'">Ativos</button>
            <button type="button" class="filter-chip" :class="{ active: sectionFilter === 'history' }" role="tab" :aria-selected="sectionFilter === 'history'" @click="sectionFilter = 'history'">Concluídos</button>
          </div>

          <!-- Error -->
          <div v-if="error" class="global-error">{{ error }}</div>

          <!-- ═══ ATIVOS ═══ -->
          <section v-if="showActive" id="sec-ativos" class="objectives-section">
            <!-- Create/Edit form -->
            <div v-if="formOpen" class="form-card">
              <h2 class="form-title">{{ editingId ? 'Editar objetivo' : 'Novo objetivo' }}</h2>
              <div class="form-grid">
                <label class="field">
                  <span class="field-label">Nome do objetivo</span>
                  <input v-model="formName" class="field-input" type="text" maxlength="200" placeholder="Ex.: Viagem, fundo de emergência..." />
                </label>
                <label class="field">
                  <span class="field-label">Valor necessário</span>
                  <div class="input-wrap">
                    <input v-model.number="formTarget" class="field-input field-input--suffixed" type="number" min="0.01" step="0.01" placeholder="0,00" />
                    <span class="input-suffix">&euro;</span>
                  </div>
                </label>
                <label class="field field-span-full">
                  <span class="field-label">Atingir até (opcional)</span>
                  <input v-model="formTargetDate" class="field-input" type="date" />
                </label>
              </div>
              <div class="form-actions">
                <button type="button" class="btn-cancel" :disabled="saving" @click="resetForm">Cancelar</button>
                <button type="button" class="btn-confirm" :disabled="saving" @click="submitForm">
                  {{ saving ? 'A guardar...' : 'Guardar' }}
                </button>
              </div>
            </div>

            <h2 class="section-heading">Ativos</h2>

            <!-- Loading -->
            <div v-if="loading && !objectivesLocked" class="loading-state">
              <div class="spinner"></div>
              <p>A carregar objetivos...</p>
            </div>

            <!-- Empty -->
            <div v-else-if="activeObjectives.length === 0 && !formOpen && !loading" class="empty-card">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="empty-icon"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><line x1="22" x2="12" y1="2" y2="12"/></svg>
              <p class="empty-text">Ainda não tens objetivos ativos</p>
              <p class="empty-hint">Cria um objetivo de poupança para começar a acompanhar o progresso.</p>
              <button
                type="button"
                class="btn-confirm"
                @click="openCreateForm()"
              >
                Criar primeiro objetivo
              </button>
            </div>

            <!-- Goals grid -->
            <div v-else-if="activeObjectives.length > 0" class="goals-grid">
              <article v-for="goal in activeObjectives" :key="goal.id" class="goal-card">
                <div class="goal-top">
                  <div class="goal-icon-wrap">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><line x1="22" x2="12" y1="2" y2="12"/></svg>
                  </div>
                  <div class="goal-info">
                    <div class="goal-name-row">
                      <h3 class="goal-name">{{ goal.name }}</h3>
                      <span class="goal-order">#{{ goal.sortOrder }}</span>
                    </div>
                    <p class="goal-amounts">
                      {{ formatCurrency(goal.allocatedAmount) }}
                      <span class="goal-amounts-separator">/</span>
                      {{ formatCurrency(goal.targetAmount) }}
                    </p>
                    <p v-if="goal.targetDate" class="goal-date">Meta: {{ formatDate(goal.targetDate) }}</p>
                  </div>
                </div>

                <!-- Progress -->
                <div class="progress-section">
                  <div class="progress-header">
                    <span class="progress-pct">{{ goal.progressPercent.toFixed(1) }}%</span>
                    <span v-if="goal.canFinalize" class="badge badge--ready">Pronto</span>
                  </div>
                  <div class="progress-track">
                    <div
                      class="progress-fill"
                      :class="{ 'progress-fill--complete': goal.canFinalize }"
                      :style="{ width: `${Math.min(100, goal.progressPercent)}%` }"
                    ></div>
                  </div>
                </div>

                <!-- Actions -->
                <div class="goal-actions">
                  <button
                    type="button"
                    class="action-btn"
                    title="Editar"
                    :disabled="saving || objectivesLocked"
                    @click="openEditForm(goal)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                  </button>
                  <button
                    type="button"
                    class="action-btn action-btn--finalize"
                    title="Finalizar"
                    :disabled="saving || !goal.canFinalize || objectivesLocked"
                    @click="finalizeObjective(goal)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  </button>
                  <button
                    type="button"
                    class="action-btn action-btn--danger"
                    title="Eliminar"
                    :disabled="saving || objectivesLocked"
                    @click="openDeleteObjective(goal)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              </article>
            </div>
          </section>

          <!-- ═══ CONCLUÍDOS ═══ -->
          <section v-if="!loading && showHistory" id="sec-concluidos" class="objectives-section" :class="{ 'objectives-section--history': sectionFilter === 'all' }">
            <h2 class="section-heading">Concluídos</h2>

            <div v-if="historyObjectives.length === 0" class="empty-card">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="empty-icon"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <p class="empty-text">Sem objetivos finalizados</p>
              <p class="empty-hint">Quando finalizares um objetivo ativo, ele aparece aqui.</p>
            </div>

            <div v-else class="goals-grid">
              <article v-for="item in historyObjectives" :key="item.id" class="goal-card goal-card--completed">
                <div class="goal-top">
                  <div class="goal-icon-wrap goal-icon-wrap--completed">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  </div>
                  <div class="goal-info">
                    <div class="goal-name-row">
                      <h3 class="goal-name">{{ item.name }}</h3>
                      <span v-if="item.liquidatedAt" class="badge badge--liquidated">Liquidado</span>
                      <span v-else class="badge badge--completed">Concluído</span>
                    </div>
                    <p class="goal-amounts">{{ formatCurrency(item.targetAmount) }}</p>
                    <div class="goal-meta">
                      <span v-if="item.targetDate" class="goal-meta-item">Meta: {{ formatDate(item.targetDate) }}</span>
                      <span class="goal-meta-item">Finalizado: {{ formatDate(item.completedAt) }}</span>
                      <span v-if="item.liquidatedAt" class="goal-meta-item">Liquidado: {{ formatDate(item.liquidatedAt) }}</span>
                    </div>
                  </div>
                </div>

                <div class="goal-actions">
                  <button
                    type="button"
                    class="action-btn action-btn--danger"
                    title="Eliminar"
                    :disabled="saving || objectivesLocked"
                    @click="openDeleteObjective(item)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  </button>
                </div>
              </article>
            </div>
          </section>
        </div>
      </div>
    </template>

    <ConfirmDeleteModal
      :open="!!objectiveToDelete"
      title="Eliminar objetivo"
      :message="
        objectiveToDelete
          ? `Tens a certeza que queres eliminar «${objectiveToDelete.name}»? Esta ação não pode ser desfeita.`
          : ''
      "
      :loading="saving"
      @close="closeDeleteObjective"
      @confirm="confirmDeleteObjective"
    />
  </div>
</template>

<style scoped>
.objectives-page {
  max-width: min(860px, 100%);
  margin: 0 auto;
  padding: 0 0 3rem;
}

/* ── Page header ── */
.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.page-header-text {
  min-width: 0;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
  letter-spacing: -0.02em;
}

.page-subtitle {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0.25rem 0 0;
}

.btn-add {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #fff;
  background: #166534;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}

.btn-add:hover:not(:disabled) {
  background: #15803d;
  transform: translateY(-1px);
}

.btn-add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Stats grid ── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.875rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 1.125rem 1.25rem;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
}

.stat-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.stat-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  margin: 0;
}

/* ── Info tooltip (i) ── */
.stat-info {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  cursor: help;
  outline: none;
  flex-shrink: 0;
  transition: color 0.15s ease;
}

.stat-info:hover,
.stat-info:focus-visible {
  color: var(--color-success);
}

.stat-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  width: max-content;
  max-width: 240px;
  padding: 0.625rem 0.75rem;
  background: var(--color-bg-card);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.4;
  text-transform: none;
  letter-spacing: normal;
  white-space: pre-line;
  z-index: 30;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s;
}

/* Seta do tooltip */
.stat-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: var(--color-border);
}

.stat-info:hover .stat-tooltip,
.stat-info:focus-visible .stat-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0);
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0.25rem 0 0;
  letter-spacing: -0.02em;
}

.stat-value--negative {
  color: var(--color-expense);
}

/* ── Filtro de secções ── */
.filter-chips {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}

.filter-chip {
  padding: 0.4rem 0.875rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.filter-chip:hover {
  color: var(--color-text);
  border-color: var(--color-text-muted);
}

.filter-chip.active {
  background: #166534;
  border-color: #166534;
  color: #ffffff;
}

html.dark .filter-chip.active {
  background: #15803d;
  border-color: #15803d;
}

/* ── Secções (Ativos / Concluídos) ── */
.section-heading {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 0.875rem;
  letter-spacing: -0.01em;
}

.objectives-section--history {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-border);
}

/* ── Goals grid ── */
.goals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 0.875rem;
}

.goal-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  transition: box-shadow 0.2s, transform 0.2s;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
}

.goal-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.goal-card--completed {
  opacity: 0.85;
}

/* ── Goal top row ── */
.goal-top {
  display: flex;
  gap: 0.875rem;
  align-items: flex-start;
}

.goal-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 10px;
  background: #ecfdf5;
  color: #166534;
}

html.dark .goal-icon-wrap {
  background: rgba(22, 101, 52, 0.2);
  color: #4ade80;
}

.goal-icon-wrap--completed {
  background: #f0fdf4;
  color: #059669;
}

html.dark .goal-icon-wrap--completed {
  background: rgba(5, 150, 105, 0.15);
  color: #34d399;
}

.goal-info {
  flex: 1;
  min-width: 0;
}

.goal-name-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.125rem;
}

.goal-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.goal-order {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.goal-amounts {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
  letter-spacing: -0.01em;
}

.goal-amounts-separator {
  color: var(--color-text-muted);
  font-weight: 400;
  margin: 0 0.125rem;
}

.goal-date {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0.25rem 0 0;
}

.goal-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  margin-top: 0.25rem;
}

.goal-meta-item {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

/* ── Progress ── */
.progress-section {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.progress-pct {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.progress-track {
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: var(--color-table-row-hover);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #166534 0%, #16a34a 100%);
  transition: width 0.3s ease;
}

.progress-fill--complete {
  background: linear-gradient(90deg, #059669 0%, #34d399 100%);
}

/* ── Badges ── */
.badge {
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.15rem 0.4rem;
  border-radius: 999px;
  flex-shrink: 0;
}

.badge--ready {
  color: #fff;
  background: #059669;
}

.badge--completed {
  color: #fff;
  background: #64748b;
}

.badge--liquidated {
  color: #fff;
  background: #166534;
}

/* ── Goal actions ── */
.goal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.375rem;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover:not(:disabled) {
  background: var(--color-table-row-hover);
  color: var(--color-text);
  border-color: var(--color-text-muted);
}

.action-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.action-btn--finalize:hover:not(:disabled) {
  color: #059669;
  border-color: #a7f3d0;
  background: #ecfdf5;
}

html.dark .action-btn--finalize:hover:not(:disabled) {
  color: #34d399;
  border-color: rgba(52, 211, 153, 0.3);
  background: rgba(52, 211, 153, 0.1);
}

.action-btn--danger:hover:not(:disabled) {
  color: #dc2626;
  border-color: #fecaca;
  background: #fef2f2;
}

html.dark .action-btn--danger:hover:not(:disabled) {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.3);
  background: rgba(248, 113, 113, 0.1);
}

/* ── Form card ── */
.form-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 1.25rem;
  margin-bottom: 1rem;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
}

.form-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 1rem;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.875rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field-span-full {
  grid-column: 1 / -1;
}

.field-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text-muted);
}

.field-input {
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--color-input-border);
  border-radius: 10px;
  font-size: 0.875rem;
  background: var(--color-input-bg);
  color: var(--color-text);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.field-input:focus {
  outline: none;
  border-color: #166534;
  box-shadow: 0 0 0 3px rgba(22, 101, 52, 0.12);
}

.field-input--suffixed {
  padding-right: 2.25rem;
}

.input-wrap {
  position: relative;
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

.form-actions {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

/* ── Buttons ── */
.btn-confirm {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #fff;
  background: #166534;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s;
}

.btn-confirm:hover:not(:disabled) {
  background: #15803d;
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-cancel {
  padding: 0.5rem 0.85rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-cancel:hover {
  background: var(--color-table-row-hover);
}

/* ── Empty state ── */
.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem 1.5rem;
  background: var(--color-bg-card);
  border: 1px dashed var(--color-border);
  border-radius: 14px;
  text-align: center;
}

.empty-icon {
  color: var(--color-text-muted);
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-text {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 0.25rem;
}

.empty-hint {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0 0 1.25rem;
}

/* ── Loading / Error ── */
.loading-state,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--color-text-muted);
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--color-border);
  border-top-color: #166534;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.global-error {
  padding: 0.625rem 1rem;
  background: #fef2f2;
  color: #dc2626;
  border-radius: 10px;
  font-size: 0.8125rem;
  margin-bottom: 1rem;
  border: 1px solid #fecaca;
}

html.dark .global-error {
  background: rgba(220, 38, 38, 0.1);
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.3);
}

.link {
  color: var(--color-link-hover);
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}

/* ── Responsive ── */
@media (max-width: 600px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .goals-grid {
    grid-template-columns: 1fr;
  }

  .stat-value {
    font-size: 1.125rem;
  }
}
</style>
