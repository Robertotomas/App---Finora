<script setup lang="ts">
import PageSkeleton from '@/components/PageSkeleton.vue'
import { PT_GROUPING } from '@/utils/numberFormat'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useHouseholdStore } from '@/stores/household'
import { objectivesApi } from '@/api/objectives'
import { useSubscriptionStore } from '@/stores/subscription'
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue'
import PlanUpsellCard from '@/components/PlanUpsellCard.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import UiButton from '@/components/ui/UiButton.vue'
import FilterChips from '@/components/ui/FilterChips.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ActionMenu, { type ActionMenuItem } from '@/components/ui/ActionMenu.vue'
import ObjectiveKpi from '@/components/goals/ObjectiveKpi.vue'
import ProgressMeter from '@/components/planning/ProgressMeter.vue'
import { useToast } from '@/composables/useToast'
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
const toast = useToast()

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
  investedFromSavings: 0,
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
        invested:
          'Depósitos na corretora debitados de uma conta. É poupança que já foi investida, por isso não está disponível para objetivos.',
        available:
          'Poupança disponível para distribuir pelos objetivos ativos, depois de descontado o valor reservado e o enviado para investimentos.',
      }
    : {
        savings:
          'Receitas − Despesas\nTotal que poupou desde o início até ao último mês.\nPode ser negativo se as despesas forem superiores às receitas.',
        reserved:
          'Valor reservado para objetivos concluídos mas ainda não liquidados. Não está disponível para outros objetivos.',
        invested:
          'Depósitos na corretora debitados de uma conta. É poupança que já foi investida, por isso não está disponível para objetivos.',
        available:
          'Poupança disponível para distribuir pelos objetivos ativos, depois de descontado o valor reservado e o enviado para investimentos.',
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
    investedFromSavings: Number(pick('investedFromSavings')) || 0,
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
    error.value = err.response?.data?.message || err.message || 'Não foi possível carregar os objetivos.'
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
    error.value = 'Indique um nome e um valor alvo superior a zero.'
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
      toast.success('Objetivo atualizado')
    } else {
      const payload: CreateSavingsObjectiveRequest = {
        name: formName.value.trim(),
        targetAmount: Number(formTarget.value),
        targetDate,
      }
      const { data } = await objectivesApi.create(payload)
      overview.value = distributeLocalSavings(normalizeOverview(data))
      toast.success('Objetivo criado')
    }
    resetForm()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } }; message?: string }
    error.value = err.response?.data?.message || err.message || 'Não foi possível guardar o objetivo.'
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
    toast.success(`«${item.name}» marcado como concluído`)
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } }; message?: string }
    error.value = err.response?.data?.message || err.message || 'Não foi possível concluir o objetivo.'
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
    toast.success('Objetivo eliminado')
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } }; message?: string }
    error.value = err.response?.data?.message || err.message || 'Não foi possível eliminar o objetivo.'
  } finally {
    saving.value = false
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-PT', { ...PT_GROUPING,
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

const filterOptions = computed(() => [
  { value: 'all' as SectionFilter, label: 'Todos', count: activeObjectives.value.length + historyObjectives.value.length },
  { value: 'active' as SectionFilter, label: 'Ativos', count: activeObjectives.value.length },
  { value: 'history' as SectionFilter, label: 'Concluídos', count: historyObjectives.value.length },
])

function activeActions(goal: SavingsObjectiveActive): ActionMenuItem[] {
  return [
    { label: 'Editar', disabled: saving.value, onSelect: () => openEditForm(goal) },
    {
      label: 'Marcar como concluído',
      disabled: saving.value || !goal.canFinalize,
      onSelect: () => finalizeObjective(goal),
    },
    { label: 'Eliminar', danger: true, disabled: saving.value, onSelect: () => openDeleteObjective(goal) },
  ]
}

function historyActions(item: SavingsObjectiveHistory): ActionMenuItem[] {
  return [
    { label: 'Eliminar', danger: true, disabled: saving.value, onSelect: () => openDeleteObjective(item) },
  ]
}

function formatPercent(value: number): string {
  return `${value.toFixed(1).replace('.', ',')}%`
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
    <!-- A carregar agregado + subscrição -->
    <PageSkeleton v-if="!pageReady" variant="cards" :rows="3" />

    <!-- Sem agregado -->
    <EmptyState
      v-else-if="!householdStore.household"
      title="Ainda não tem um agregado"
      description="Configure primeiro o seu agregado para começar a definir objetivos."
    >
      <router-link to="/household" class="link-btn">Configurar agregado</router-link>
    </EmptyState>

    <template v-else>
      <PageHeader title="Objetivos">
        <template v-if="!objectivesLocked" #actions>
          <UiButton variant="primary" @click="openCreateForm">
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
            </template>
            Novo objetivo
          </UiButton>
        </template>
      </PageHeader>

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

      <div v-else class="ui-stack">
        <!-- Resumo da poupança -->
        <div class="kpi-row" :class="{ 'kpi-row--4': overview.investedFromSavings > 0 }">
          <ObjectiveKpi
            label="Poupança total"
            :value="formatCurrency(overview.totalSavings)"
            :hint="statTooltips.savings"
            :negative="overview.totalSavings < 0"
            :note="overview.totalSavings < 0 ? 'Défice acumulado: as despesas superaram as receitas.' : undefined"
          />
          <ObjectiveKpi
            label="Reservado"
            :value="formatCurrency(overview.reservedByCompletedObjectives)"
            :hint="statTooltips.reserved"
          />
          <ObjectiveKpi
            v-if="overview.investedFromSavings > 0"
            label="Enviado para investimentos"
            :value="formatCurrency(overview.investedFromSavings)"
            :hint="statTooltips.invested"
          />
          <ObjectiveKpi
            label="Disponível para objetivos"
            :value="formatCurrency(overview.availableForActiveObjectives)"
            :hint="statTooltips.available"
            highlight
          />
        </div>

        <FilterChips v-model="sectionFilter" :options="filterOptions" aria-label="Filtrar objetivos" />

        <div v-if="error" class="inline-error" role="alert">{{ error }}</div>

        <!-- Formulário criar/editar -->
        <section v-if="formOpen && showActive" class="form-card">
          <h2 class="card-title">{{ editingId ? 'Editar objetivo' : 'Novo objetivo' }}</h2>
          <div class="form-grid">
            <label class="field">
              <span class="field-label">Nome do objetivo</span>
              <input v-model="formName" class="field-input" type="text" maxlength="200" placeholder="Ex.: Viagem, fundo de emergência…" />
            </label>
            <label class="field">
              <span class="field-label">Valor alvo</span>
              <span class="input-wrap">
                <input v-model.number="formTarget" class="field-input field-input--suffixed" type="number" min="0.01" step="0.01" placeholder="0,00" />
                <span class="input-suffix">€</span>
              </span>
            </label>
            <label class="field">
              <span class="field-label">Atingir até <span class="field-optional">(opcional)</span></span>
              <input v-model="formTargetDate" class="field-input" type="date" />
            </label>
          </div>
          <div class="form-actions">
            <UiButton variant="secondary" :disabled="saving" @click="resetForm">Cancelar</UiButton>
            <UiButton variant="primary" :loading="saving" @click="submitForm">
              {{ editingId ? 'Guardar alterações' : 'Criar objetivo' }}
            </UiButton>
          </div>
        </section>

        <!-- ═══ ATIVOS ═══ -->
        <section v-if="showActive" id="sec-ativos" class="section">
          <h2 class="section-title">
            Ativos
            <span v-if="!loading" class="section-count">{{ activeObjectives.length }}</span>
          </h2>

          <PageSkeleton v-if="loading" variant="cards" :rows="3" />

          <EmptyState
            v-else-if="activeObjectives.length === 0 && !formOpen"
            class="empty-card"
            title="Ainda não tem objetivos ativos"
            description="Crie um objetivo de poupança para começar a acompanhar o progresso."
          >
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
            </template>
            <UiButton variant="secondary" @click="openCreateForm()">Criar primeiro objetivo</UiButton>
          </EmptyState>

          <div v-else-if="activeObjectives.length > 0" class="goals-grid">
            <article v-for="goal in activeObjectives" :key="goal.id" class="goal-card">
              <header class="goal-head">
                <span class="goal-icon" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
                </span>
                <div class="goal-title">
                  <h3 class="goal-name" :title="goal.name">{{ goal.name }}</h3>
                  <p class="goal-sub">Prioridade {{ goal.sortOrder }}</p>
                </div>
                <span v-if="goal.canFinalize" class="ui-badge ui-badge--success">Atingido</span>
                <ActionMenu :items="activeActions(goal)" :aria-label="`Ações de ${goal.name}`" />
              </header>

              <div class="goal-amounts">
                <span class="ui-amount goal-amount-main">{{ formatCurrency(goal.allocatedAmount) }}</span>
                <span class="goal-amount-target">de {{ formatCurrency(goal.targetAmount) }}</span>
              </div>

              <div class="goal-progress">
                <ProgressMeter :value="goal.progressPercent" :label="`Progresso de ${goal.name}`" />
                <span class="goal-pct">{{ formatPercent(goal.progressPercent) }}</span>
              </div>

              <dl class="goal-meta">
                <div>
                  <dt>Em falta</dt>
                  <dd class="ui-amount">{{ formatCurrency(Math.max(0, goal.targetAmount - goal.allocatedAmount)) }}</dd>
                </div>
                <div>
                  <dt>Prazo</dt>
                  <dd>{{ goal.targetDate ? formatDate(goal.targetDate) : 'Sem prazo' }}</dd>
                </div>
              </dl>

              <UiButton
                v-if="goal.canFinalize"
                variant="secondary"
                size="sm"
                block
                :disabled="saving"
                @click="finalizeObjective(goal)"
              >
                Marcar como concluído
              </UiButton>
            </article>
          </div>
        </section>

        <!-- ═══ CONCLUÍDOS ═══ -->
        <section v-if="!loading && showHistory" id="sec-concluidos" class="section">
          <h2 class="section-title">
            Concluídos
            <span class="section-count">{{ historyObjectives.length }}</span>
          </h2>

          <EmptyState
            v-if="historyObjectives.length === 0"
            class="empty-card"
            title="Sem objetivos concluídos"
            description="Quando concluir um objetivo ativo, ele aparece aqui."
            compact
          >
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </template>
          </EmptyState>

          <div v-else class="goals-grid">
            <article v-for="item in historyObjectives" :key="item.id" class="goal-card">
              <header class="goal-head">
                <span class="goal-icon goal-icon--done" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
                <div class="goal-title">
                  <h3 class="goal-name" :title="item.name">{{ item.name }}</h3>
                  <p class="goal-sub">Concluído a {{ formatDate(item.completedAt) }}</p>
                </div>
                <span v-if="item.liquidatedAt" class="ui-badge">Liquidado</span>
                <span v-else class="ui-badge ui-badge--success">Concluído</span>
                <ActionMenu :items="historyActions(item)" :aria-label="`Ações de ${item.name}`" />
              </header>

              <div class="goal-amounts">
                <span class="ui-amount goal-amount-main">{{ formatCurrency(item.targetAmount) }}</span>
                <span class="goal-amount-target">{{ item.liquidatedAt ? 'já gasto' : 'reservado' }}</span>
              </div>

              <dl class="goal-meta">
                <div>
                  <dt>Prazo</dt>
                  <dd>{{ item.targetDate ? formatDate(item.targetDate) : 'Sem prazo' }}</dd>
                </div>
                <div v-if="item.liquidatedAt">
                  <dt>Liquidado a</dt>
                  <dd>{{ formatDate(item.liquidatedAt) }}</dd>
                </div>
              </dl>
            </article>
          </div>
        </section>
      </div>
    </template>

    <ConfirmDeleteModal
      :open="!!objectiveToDelete"
      title="Eliminar objetivo"
      :message="
        objectiveToDelete
          ? `Tem a certeza que quer eliminar «${objectiveToDelete.name}»? Esta ação não pode ser desfeita.`
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
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 0 0 var(--space-12);
}

/* ── Resumo ── */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
}
.kpi-row--4 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.inline-error {
  padding: 10px var(--space-4);
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

/* ── Formulário ── */
.form-card {
  padding: var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}
.card-title {
  margin: 0 0 var(--space-4);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}
.form-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: var(--space-4);
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
.field-optional {
  color: var(--color-text-subtle);
  font-weight: var(--weight-regular);
}
.field-input {
  width: 100%;
  height: 40px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: var(--text-base);
  background: var(--color-surface);
  color: var(--color-text);
  box-sizing: border-box;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.field-input::placeholder { color: var(--color-text-subtle); }
.field-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--focus-ring);
}
.field-input--suffixed { padding-right: 2.25rem; }
.field-input[type='number'] { -moz-appearance: textfield; appearance: textfield; }
.field-input[type='number']::-webkit-outer-spin-button,
.field-input[type='number']::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.input-wrap { position: relative; display: block; }
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
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-5);
}

/* ── Secções ── */
.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}
.section-count {
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}
.empty-card {
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
}

/* ── Cartões de objetivo ── */
.goals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-4);
}
.goal-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
  padding: var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  transition: border-color var(--transition-base);
}
.goal-card:hover {
  border-color: var(--color-border-strong);
}
.goal-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.goal-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  background: var(--color-primary-soft);
  color: var(--color-primary-text);
}
.goal-icon--done {
  background: var(--color-success-soft);
  color: var(--color-success);
}
.goal-title {
  flex: 1;
  min-width: 0;
}
.goal-name {
  margin: 0;
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.goal-sub {
  margin: 2px 0 0;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
.goal-amounts {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px;
}
.goal-amount-main {
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  letter-spacing: var(--tracking-tight);
}
.goal-amount-target {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}
.goal-progress {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.goal-pct {
  flex-shrink: 0;
  min-width: 3.25rem;
  text-align: right;
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}
.goal-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  margin: 0;
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border-subtle);
}
.goal-meta dt {
  margin: 0 0 2px;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
.goal-meta dd {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text);
  font-variant-numeric: tabular-nums;
}

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
@media (max-width: 1024px) {
  .kpi-row--4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 720px) {
  .kpi-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .form-grid { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 480px) {
  .kpi-row,
  .kpi-row--4 { grid-template-columns: minmax(0, 1fr); gap: var(--space-3); }
  .goals-grid { grid-template-columns: minmax(0, 1fr); }
  .goal-card { padding: var(--space-4); }
  .form-actions { flex-direction: column-reverse; }
}
</style>
