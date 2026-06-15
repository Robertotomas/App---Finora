<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAssetsStore } from '@/stores/assets'
import { useSubscriptionStore } from '@/stores/subscription'
import AssetFormModal from '@/components/AssetFormModal.vue'
import ValuationFormModal from '@/components/ValuationFormModal.vue'
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue'
import AssetsChart from '@/components/charts/AssetsChart.vue'
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
    await subscriptionStore.fetchSubscription()
    await assetsStore.fetchAsset(assetId.value)
  } catch {
    notFound.value = true
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
  return span > 760
})

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value)
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
    if (editingValuation.value) {
      await assetsStore.updateValuation(asset.value.id, editingValuation.value.id, payload)
    } else {
      await assetsStore.addValuation(asset.value.id, payload)
    }
    valuationModalOpen.value = false
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
  } catch {
    // erro na store (ex.: não pode apagar a única avaliação)
  } finally {
    actionLoading.value = false
  }
}
</script>

<template>
  <div class="asset-detail-page">
    <router-link :to="{ name: 'bens-valores' }" class="back-link">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      Bens e valores
    </router-link>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>A carregar...</p>
    </div>

    <div v-else-if="!asset" class="empty-card">
      <p class="empty-text">Ativo não encontrado</p>
      <router-link :to="{ name: 'bens-valores' }" class="btn-confirm">Voltar</router-link>
    </div>

    <template v-else>
      <div class="detail-grid">
        <!-- Hero -->
        <div class="hero-card">
          <div class="hero-top">
            <span
              class="hero-icon"
              :style="{ background: assetCategoryColor(asset.category) + '1f', color: assetCategoryColor(asset.category) }"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" v-html="assetCategoryIcon(asset.category)"></svg>
            </span>
            <div class="hero-head">
              <h1 class="hero-name">{{ asset.name }}</h1>
              <span class="hero-cat">{{ ASSET_CATEGORY_LABELS[asset.category] }}</span>
            </div>
            <div class="hero-actions">
              <button type="button" class="action-btn" title="Editar" @click="editModalOpen = true">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
              </button>
              <button type="button" class="action-btn action-btn--danger" title="Eliminar" @click="deleteAssetModalOpen = true">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </div>

          <div class="hero-value-row">
            <span class="hero-value">{{ formatCurrency(asset.currentValue) }}</span>
            <span class="hero-change" :class="{ negative: change.abs < 0 }">{{ formatSignedCurrency(change.abs) }}</span>
            <span v-if="change.pct !== null" class="hero-pct" :class="{ negative: (change.pct ?? 0) < 0 }">
              {{ formatPct(change.pct) }}
            </span>
          </div>
          <p class="hero-date">Última avaliação: {{ formatLongDate(asset.lastValuationDate) }}</p>

          <div class="hero-chart">
            <AssetsChart v-if="showChart" :points="chartPoints" currency="EUR" :year-ticks="chartYearTicks" />
            <div v-else class="chart-placeholder">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
              <p>O gráfico aparece quando tiver mais do que uma avaliação</p>
            </div>
          </div>
        </div>

        <!-- Side cards -->
        <div class="side-col">
          <div class="info-card">
            <h2 class="info-title">Performance</h2>
            <div class="info-row">
              <span class="info-label">Custo de aquisição</span>
              <span class="info-value">{{ formatCurrency(asset.acquisitionCost) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Período de detenção</span>
              <span class="info-value">{{ holding }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Retorno anualizado</span>
              <span
                class="info-value"
                :class="annualized !== null ? (annualized >= 0 ? 'pos' : 'neg') : ''"
              >
                {{ annualized !== null ? formatPct(annualized) : '—' }}
              </span>
            </div>
          </div>

          <div class="info-card">
            <h2 class="info-title">Detalhes</h2>
            <div class="info-row">
              <span class="info-label">Data de aquisição</span>
              <span class="info-value">{{ formatShortDate(asset.acquisitionDate) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Última avaliação</span>
              <span class="info-value">{{ formatShortDate(asset.lastValuationDate) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Avaliações -->
      <div class="valuations-section">
        <div class="valuations-header">
          <h2 class="section-title">Avaliações</h2>
          <button type="button" class="btn-add" @click="openAddValuation">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
            Adicionar avaliação
          </button>
        </div>

        <div v-if="assetsStore.error" class="global-error">{{ assetsStore.error }}</div>

        <div class="table-wrap">
          <table class="valuations-table">
            <thead>
              <tr>
                <th>Data</th>
                <th class="num">Valor</th>
                <th class="num">Δ vs anterior</th>
                <th class="num">Δ %</th>
                <th class="act"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.id">
                <td>{{ formatLongDate(row.date) }}</td>
                <td class="num strong">{{ formatCurrency(row.value) }}</td>
                <td class="num" :class="row.deltaAbs === null ? 'muted' : row.deltaAbs >= 0 ? 'pos' : 'neg'">
                  {{ row.deltaAbs === null ? '—' : formatSignedCurrency(row.deltaAbs) }}
                </td>
                <td class="num" :class="row.deltaPct === null ? 'muted' : row.deltaPct >= 0 ? 'pos' : 'neg'">
                  {{ row.deltaPct === null ? '—' : formatPct(row.deltaPct) }}
                </td>
                <td class="act">
                  <div class="row-actions">
                    <button
                      type="button"
                      class="row-btn"
                      title="Editar avaliação"
                      @click="openEditValuation(row)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    </button>
                    <button
                      v-if="rows.length > 1"
                      type="button"
                      class="row-btn row-btn--del"
                      title="Eliminar avaliação"
                      @click="deleteValuationId = row.id"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="valuations-count">{{ rows.length }} {{ rows.length === 1 ? 'avaliação' : 'avaliações' }}</p>
      </div>
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
  max-width: min(1000px, 100%);
  margin: 0 auto;
  padding: 0 0 3rem;
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-decoration: none;
  margin-bottom: 1.25rem;
  transition: color 0.15s;
}

.back-link:hover {
  color: var(--color-text);
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

@media (max-width: 760px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}

/* Hero */
.hero-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 1.5rem;
}

.hero-top {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
}

.hero-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 12px;
}

.hero-head {
  flex: 1;
  min-width: 0;
}

.hero-name {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 0.375rem;
  letter-spacing: -0.02em;
}

.hero-cat {
  display: inline-block;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--color-text-muted);
  background: var(--color-table-row-hover);
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
}

.hero-actions {
  display: flex;
  gap: 0.375rem;
  flex-shrink: 0;
}

.hero-value-row {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.625rem;
  margin-top: 1.25rem;
}

.hero-value {
  font-size: 2rem;
  font-weight: 800;
  color: #166534;
  letter-spacing: -0.03em;
}

html.dark .hero-value {
  color: #4ade80;
}

.hero-change {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #166534;
}

html.dark .hero-change {
  color: #4ade80;
}

.hero-change.negative,
.hero-pct.negative {
  color: #dc2626;
}

html.dark .hero-change.negative,
html.dark .hero-pct.negative {
  color: #f87171;
}

.hero-pct {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #166534;
  background: rgba(22, 101, 52, 0.1);
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
}

html.dark .hero-pct {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.12);
}

.hero-pct.negative {
  background: rgba(220, 38, 38, 0.1);
}

.hero-date {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0.5rem 0 0;
}

.hero-chart {
  margin-top: 1.25rem;
}

.chart-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  padding: 2.5rem 1rem;
  border: 1px dashed var(--color-border);
  border-radius: 12px;
  color: var(--color-text-muted);
  text-align: center;
}

.chart-placeholder p {
  margin: 0;
  font-size: 0.8125rem;
  max-width: 28ch;
}

/* Side cards */
.side-col {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.info-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 1.25rem;
}

.info-title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 0.875rem;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 0;
}

.info-row + .info-row {
  border-top: 1px solid var(--color-border);
}

.info-label {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.info-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
}

.info-value.pos {
  color: #166534;
}

html.dark .info-value.pos {
  color: #4ade80;
}

.info-value.neg {
  color: #dc2626;
}

html.dark .info-value.neg {
  color: #f87171;
}

/* Valuations */
.valuations-section {
  margin-top: 1.5rem;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 1.25rem 1.5rem 1.5rem;
}

.valuations-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.btn-add {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.45rem 0.875rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.btn-add:hover {
  background: var(--color-table-row-hover);
  border-color: var(--color-text-muted);
}

.global-error {
  margin-bottom: 0.875rem;
  padding: 0.625rem 0.875rem;
  border-radius: 10px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  font-size: 0.8125rem;
}

html.dark .global-error {
  background: rgba(248, 113, 113, 0.1);
  border-color: rgba(248, 113, 113, 0.3);
  color: #f87171;
}

.table-wrap {
  overflow-x: auto;
}

.valuations-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.valuations-table th {
  text-align: left;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.valuations-table td {
  padding: 0.75rem;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
}

.valuations-table tbody tr:last-child td {
  border-bottom: none;
}

.valuations-table .num {
  text-align: right;
}

.valuations-table .act {
  width: 72px;
  text-align: right;
}

.row-actions {
  display: flex;
  gap: 0.25rem;
  justify-content: flex-end;
}

.valuations-table .strong {
  font-weight: 700;
}

.valuations-table .pos {
  color: #166534;
  font-weight: 600;
}

html.dark .valuations-table .pos {
  color: #4ade80;
}

.valuations-table .neg {
  color: #dc2626;
  font-weight: 600;
}

html.dark .valuations-table .neg {
  color: #f87171;
}

.valuations-table .muted {
  color: var(--color-text-muted);
}

.row-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.row-btn:hover {
  color: var(--color-text);
  border-color: var(--color-border);
  background: var(--color-table-row-hover);
}

.row-btn--del:hover {
  color: #dc2626;
  border-color: #fecaca;
  background: #fef2f2;
}

html.dark .row-btn--del:hover {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.3);
  background: rgba(248, 113, 113, 0.1);
}

.valuations-count {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0.875rem 0 0;
}

/* Shared */
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

.action-btn:hover {
  background: var(--color-table-row-hover);
  color: var(--color-text);
  border-color: var(--color-text-muted);
}

.action-btn--danger:hover {
  color: #dc2626;
  border-color: #fecaca;
  background: #fef2f2;
}

html.dark .action-btn--danger:hover {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.3);
  background: rgba(248, 113, 113, 0.1);
}

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
}

.btn-confirm:hover {
  background: #15803d;
}

.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem 1.5rem;
  background: var(--color-bg-card);
  border: 1px dashed var(--color-border);
  border-radius: 14px;
  text-align: center;
}

.empty-text {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 4rem 1rem;
  color: var(--color-text-muted);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: #166534;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
