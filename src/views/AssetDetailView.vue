<script setup lang="ts">
import { PT_GROUPING } from '@/utils/numberFormat'
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAssetsStore } from '@/stores/assets'
import { useSubscriptionStore } from '@/stores/subscription'
import AssetFormModal from '@/components/AssetFormModal.vue'
import ValuationFormModal from '@/components/ValuationFormModal.vue'
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue'
import ValueHeroCard from '@/components/charts/ValueHeroCard.vue'
import HeroStat from '@/components/charts/HeroStat.vue'
import type { AssetChartPoint } from '@/components/charts/AssetsChart.vue'
import {
  ASSET_CATEGORY_LABELS,
  assetChangeVsCost,
  annualizedReturn,
  holdingPeriodLabel,
  valuationDeltas,
} from '@/types/asset'
import type { Asset, CreateAssetRequest, AddValuationRequest, AssetValuation } from '@/types/asset'
import { assetCategoryIcon, assetCategoryColor } from '@/types/assetMeta'
import PageSkeleton from '@/components/PageSkeleton.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiCard from '@/components/ui/UiCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ActionMenu from '@/components/ui/ActionMenu.vue'
import type { ActionMenuItem } from '@/components/ui/ActionMenu.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const route = useRoute()
const router = useRouter()
const assetsStore = useAssetsStore()
const subscriptionStore = useSubscriptionStore()

const assetId = computed(() => String(route.params.id))
const loading = ref(true)
const notFound = ref(false)
const actionLoading = ref(false)

const editModalOpen = ref(false)
const valuationModalOpen = ref(false)
const editingValuation = ref<AssetValuation | null>(null)
const deleteAssetModalOpen = ref(false)
const deleteValuationId = ref<string | null>(null)

const asset = computed<Asset | undefined>(() => assetsStore.assets.find((a) => a.id === assetId.value))

onMounted(async () => {
  try {
    // Reutiliza a lista já carregada (vinda da página de Bens) — o ativo, com as avaliações, já lá está.
    // Só vai à rede buscar o ativo individual se não estiver em memória (ex.: acesso direto por URL).
    await Promise.all([subscriptionStore.fetchSubscription(), assetsStore.ensureLoaded().catch(() => {})])
    if (!asset.value) await assetsStore.fetchAsset(assetId.value).catch(() => {})
    if (!asset.value) notFound.value = true
  } finally {
    loading.value = false
  }
})

const change = computed(() =>
  asset.value ? assetChangeVsCost(asset.value.currentValue, asset.value.acquisitionCost) : { abs: 0, pct: null },
)

const annualized = computed(() =>
  asset.value ? annualizedReturn(asset.value.acquisitionCost, asset.value.currentValue, asset.value.acquisitionDate) : null,
)

const holding = computed(() => (asset.value ? holdingPeriodLabel(asset.value.acquisitionDate) : '—'))

const rows = computed(() => (asset.value ? valuationDeltas(asset.value.valuations) : []))

const assetActions = computed<ActionMenuItem[]>(() => [
  { label: 'Editar ativo', onSelect: () => (editModalOpen.value = true) },
  { label: 'Eliminar ativo', danger: true, onSelect: () => (deleteAssetModalOpen.value = true) },
])

function valuationActions(row: AssetValuation): ActionMenuItem[] {
  const items: ActionMenuItem[] = [{ label: 'Editar', onSelect: () => openEditValuation(row) }]
  // Não se pode apagar a única avaliação restante.
  if (rows.value.length > 1) items.push({ label: 'Eliminar', danger: true, onSelect: () => (deleteValuationId.value = row.id) })
  return items
}

function goBack() {
  router.push({ name: 'bens-valores' })
}

/* ── Gráfico da evolução das avaliações deste ativo ── */
const DAY = 86_400_000
function dayStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const showChart = computed(() => !!asset.value && asset.value.valuations.length >= 2)

const chartPoints = computed<AssetChartPoint[]>(() => {
  const a = asset.value
  if (!a) return []
  const vals = a.valuations
    .map((v) => ({ dateStr: v.date.slice(0, 10), value: v.value }))
    .sort((x, y) => (x.dateStr < y.dateStr ? -1 : x.dateStr > y.dateStr ? 1 : 0))
  if (vals.length === 0) return []

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = dayStr(today)
  const startStr = vals[0].dateStr
  let endStr = todayStr
  const lastVal = vals[vals.length - 1].dateStr
  if (lastVal > endStr) endStr = lastVal

  const startMs = new Date(startStr + 'T00:00:00').getTime()
  const endMs = new Date(endStr + 'T00:00:00').getTime()
  const totalDays = Math.max(1, Math.round((endMs - startMs) / DAY))
  const stepDays = Math.max(1, Math.ceil(totalDays / 370))
  const stepMs = stepDays * DAY

  const at = (ds: string): AssetChartPoint => {
    let cur: number | null = null
    for (const v of vals) {
      if (v.dateStr <= ds) cur = v.value
      else break
    }
    return { date: ds, value: cur ?? vals[0].value, cost: a.acquisitionCost }
  }

  const points: AssetChartPoint[] = []
  for (let t = startMs; t <= endMs; t += stepMs) points.push(at(dayStr(new Date(t))))
  if (points.length === 0 || points[points.length - 1].date !== endStr) points.push(at(endStr))
  return points
})

const chartYearTicks = computed(() => {
  const pts = chartPoints.value
  if (pts.length < 2) return false
  const span = (new Date(pts[pts.length - 1].date + 'T00:00:00').getTime() - new Date(pts[0].date + 'T00:00:00').getTime()) / DAY
  // > ~18 meses: anos comprimidos + meses do ano atual (mesmo critério dos gráficos de Investimentos).
  return span > 540
})

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-PT', { ...PT_GROUPING, style: 'currency', currency: 'EUR' }).format(value)
}

function formatSignedCurrency(value: number): string {
  return `${value >= 0 ? '+' : '−'}${formatCurrency(Math.abs(value))}`
}

function formatPct(pct: number): string {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2).replace('.', ',')}%`
}

function formatLongDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatShortDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

async function handleEdit(payload: CreateAssetRequest) {
  if (!asset.value) return
  actionLoading.value = true
  try {
    await assetsStore.updateAsset(asset.value.id, payload)
    editModalOpen.value = false
    toast.success('Ativo atualizado')
  } catch {
    // erro na store
  } finally {
    actionLoading.value = false
  }
}

function openAddValuation() {
  editingValuation.value = null
  assetsStore.clearError()
  valuationModalOpen.value = true
}

function openEditValuation(v: AssetValuation) {
  editingValuation.value = v
  assetsStore.clearError()
  valuationModalOpen.value = true
}

async function handleSubmitValuation(payload: AddValuationRequest) {
  if (!asset.value) return
  actionLoading.value = true
  try {
    const editing = !!editingValuation.value
    if (editingValuation.value) {
      await assetsStore.updateValuation(asset.value.id, editingValuation.value.id, payload)
    } else {
      await assetsStore.addValuation(asset.value.id, payload)
    }
    valuationModalOpen.value = false
    toast.success(editing ? 'Avaliação atualizada' : 'Avaliação adicionada')
    editingValuation.value = null
  } catch {
    // erro na store
  } finally {
    actionLoading.value = false
  }
}

async function handleDeleteAsset() {
  if (!asset.value) return
  actionLoading.value = true
  try {
    await assetsStore.deleteAsset(asset.value.id)
    toast.success('Ativo eliminado')
    router.push({ name: 'bens-valores' })
  } catch {
    // erro na store
  } finally {
    actionLoading.value = false
  }
}

async function handleDeleteValuation() {
  if (!asset.value || !deleteValuationId.value) return
  actionLoading.value = true
  try {
    await assetsStore.deleteValuation(asset.value.id, deleteValuationId.value)
    deleteValuationId.value = null
    toast.success('Avaliação eliminada')
  } catch {
    // erro na store (ex.: não pode apagar a única avaliação)
  } finally {
    actionLoading.value = false
  }
}
</script>

<template>
  <div class="asset-detail-page">
    <template v-if="loading || !asset">
      <div class="back-row">
        <UiButton variant="ghost" size="sm" @click="goBack">
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </template>
          Voltar
        </UiButton>
      </div>

      <PageSkeleton v-if="loading" variant="hero" />

      <UiCard v-else>
        <EmptyState
          title="Ativo não encontrado"
          description="Este ativo pode ter sido eliminado ou já não está disponível."
        >
          <UiButton variant="secondary" @click="goBack">Ver bens e valores</UiButton>
        </EmptyState>
      </UiCard>
    </template>

    <template v-else>
      <PageHeader :title="asset.name">
        <template #back>
          <UiButton variant="ghost" size="sm" class="back-btn" @click="goBack">
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </template>
            Voltar
          </UiButton>
        </template>
        <template #meta>
          <div class="head-meta">
            <span
              class="cat-icon"
              :style="{ background: assetCategoryColor(asset.category) + '1f', color: assetCategoryColor(asset.category) }"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="assetCategoryIcon(asset.category)"></svg>
            </span>
            <span class="ui-badge">{{ ASSET_CATEGORY_LABELS[asset.category] }}</span>
            <span class="head-meta-text">Adquirido em {{ formatLongDate(asset.acquisitionDate) }}</span>
          </div>
        </template>
        <template #actions>
          <UiButton variant="primary" @click="openAddValuation">
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
            </template>
            Adicionar avaliação
          </UiButton>
          <ActionMenu :items="assetActions" aria-label="Ações do ativo" />
        </template>
      </PageHeader>

      <div v-if="assetsStore.error" class="notice notice--danger">{{ assetsStore.error }}</div>

      <div class="detail-grid">
        <!-- Hero + gráfico -->
        <ValueHeroCard
          :points="showChart ? chartPoints : []"
          :current-value="asset.currentValue"
          :current-cost="asset.acquisitionCost"
          cost-label="Custo"
          period-label="desde a aquisição"
          :year-ticks="chartYearTicks"
        >
          <template #empty>
            <div class="chart-placeholder">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
              <p>O gráfico aparece quando tiver mais do que uma avaliação.</p>
            </div>
          </template>
          <template #footer>
            <HeroStat label="Custo de aquisição" :value="formatCurrency(asset.acquisitionCost)" />
            <HeroStat label="Última avaliação" :value="formatLongDate(asset.lastValuationDate)" />
          </template>
        </ValueHeroCard>

        <!-- Cartões laterais -->
        <div class="side-col">
          <UiCard title="Performance">
            <dl class="def-list">
              <div class="def-row">
                <dt>Custo de aquisição</dt>
                <dd>{{ formatCurrency(asset.acquisitionCost) }}</dd>
              </div>
              <div class="def-row">
                <dt>Variação</dt>
                <dd :class="change.abs < 0 ? 'ui-amount--neg' : 'ui-amount--pos'">{{ formatSignedCurrency(change.abs) }}</dd>
              </div>
              <div class="def-row">
                <dt>Retorno anualizado</dt>
                <dd :class="annualized !== null ? (annualized >= 0 ? 'ui-amount--pos' : 'ui-amount--neg') : ''">
                  {{ annualized !== null ? formatPct(annualized) : '—' }}
                </dd>
              </div>
              <div class="def-row">
                <dt>Período de detenção</dt>
                <dd>{{ holding }}</dd>
              </div>
            </dl>
          </UiCard>

          <UiCard title="Detalhes">
            <dl class="def-list">
              <div class="def-row">
                <dt>Categoria</dt>
                <dd>{{ ASSET_CATEGORY_LABELS[asset.category] }}</dd>
              </div>
              <div class="def-row">
                <dt>Data de aquisição</dt>
                <dd>{{ formatShortDate(asset.acquisitionDate) }}</dd>
              </div>
              <div class="def-row">
                <dt>Última avaliação</dt>
                <dd>{{ formatShortDate(asset.lastValuationDate) }}</dd>
              </div>
              <div class="def-row">
                <dt>Moeda</dt>
                <dd>EUR</dd>
              </div>
            </dl>
          </UiCard>
        </div>
      </div>

      <!-- Avaliações -->
      <UiCard
        flush
        title="Avaliações"
        :subtitle="`${rows.length} ${rows.length === 1 ? 'avaliação' : 'avaliações'}`"
      >
        <div class="ui-table-wrap">
          <table class="ui-table valuations-table">
            <thead>
              <tr>
                <th>Data</th>
                <th class="num">Valor</th>
                <th class="num">Variação</th>
                <th class="num col-pct">Variação %</th>
                <th class="col-act" aria-hidden="true"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.id">
                <td>{{ formatLongDate(row.date) }}</td>
                <td class="num"><span class="ui-amount">{{ formatCurrency(row.value) }}</span></td>
                <td class="num" :class="row.deltaAbs === null ? 'muted' : row.deltaAbs >= 0 ? 'ui-amount--pos' : 'ui-amount--neg'">
                  {{ row.deltaAbs === null ? '—' : formatSignedCurrency(row.deltaAbs) }}
                </td>
                <td class="num col-pct">
                  <span
                    v-if="row.deltaPct !== null"
                    class="ui-badge"
                    :class="row.deltaPct < 0 ? 'ui-badge--danger' : 'ui-badge--success'"
                  >{{ formatPct(row.deltaPct) }}</span>
                  <span v-else class="muted">—</span>
                </td>
                <td class="col-act">
                  <ActionMenu :items="valuationActions(row)" aria-label="Ações da avaliação" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UiCard>
    </template>

    <AssetFormModal
      :open="editModalOpen"
      :asset="asset"
      :loading="actionLoading"
      @close="editModalOpen = false"
      @submit="handleEdit"
    />

    <ValuationFormModal
      :open="valuationModalOpen"
      :valuation="editingValuation"
      :loading="actionLoading"
      @close="valuationModalOpen = false"
      @submit="handleSubmitValuation"
    />

    <ConfirmDeleteModal
      :open="deleteAssetModalOpen"
      title="Eliminar ativo"
      :message="asset ? `Tem a certeza que deseja eliminar ${asset.name}? As avaliações associadas também serão removidas.` : ''"
      :loading="actionLoading"
      @close="deleteAssetModalOpen = false"
      @confirm="handleDeleteAsset"
    />

    <ConfirmDeleteModal
      :open="deleteValuationId !== null"
      title="Eliminar avaliação"
      message="Tem a certeza que deseja eliminar esta avaliação?"
      :loading="actionLoading"
      @close="deleteValuationId = null"
      @confirm="handleDeleteValuation"
    />
  </div>
</template>

<style scoped>
.asset-detail-page {
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 0 0 var(--space-12);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
.asset-detail-page > .page-head {
  margin-bottom: 0;
}
.back-row {
  margin-bottom: calc(-1 * var(--space-4));
}
.back-btn {
  margin-left: calc(-1 * var(--space-2));
}

/* ── Cabeçalho ── */
.head-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.cat-icon {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.head-meta-text {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.notice {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}
.notice--danger {
  background: var(--color-danger-soft);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
}

/* ── Grelha ── */
.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(0, 1fr);
  gap: var(--space-5);
  align-items: start;
}
.side-col {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  min-width: 0;
}

/* ── Hero ── */
.chart-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 220px;
  padding: var(--space-6);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-subtle);
  text-align: center;
}
.chart-placeholder p {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

/* ── Lista de definições ── */
.def-list {
  margin: 0;
  display: flex;
  flex-direction: column;
}
.def-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 10px 0;
}
.def-row:first-child {
  padding-top: 0;
}
.def-row:last-child {
  padding-bottom: 0;
}
.def-row + .def-row {
  border-top: 1px solid var(--color-border-subtle);
}
.def-row dt {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.def-row dd {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.def-row dd.ui-amount--pos {
  color: var(--color-income);
}
.def-row dd.ui-amount--neg {
  color: var(--color-expense);
}

/* ── Tabela de avaliações ── */
.valuations-table td {
  white-space: nowrap;
}
.muted {
  color: var(--color-text-muted);
}
.col-act {
  width: 48px;
  text-align: right;
}

@media (max-width: 900px) {
  .detail-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 600px) {
  .col-pct {
    display: none;
  }
}
</style>
