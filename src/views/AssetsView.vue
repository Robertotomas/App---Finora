<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAssetsStore } from '@/stores/assets'
import { useHouseholdStore } from '@/stores/household'
import { useSubscriptionStore } from '@/stores/subscription'
import AssetFormModal from '@/components/AssetFormModal.vue'
import PlanUpsellCard from '@/components/PlanUpsellCard.vue'
import DateRangePicker from '@/components/DateRangePicker.vue'
import AssetsChart from '@/components/charts/AssetsChart.vue'
import type { AssetChartPoint } from '@/components/charts/AssetsChart.vue'
import { ASSET_CATEGORY_LABELS } from '@/types/asset'
import type { Asset, CreateAssetRequest } from '@/types/asset'
import { assetCategoryIcon, assetCategoryColor } from '@/types/assetMeta'

const route = useRoute()
const router = useRouter()
const assetsStore = useAssetsStore()
const householdStore = useHouseholdStore()
const subscriptionStore = useSubscriptionStore()

const createModalOpen = ref(false)
const actionLoading = ref(false)
const sortDir = ref<'asc' | 'desc'>('desc')

// Intervalo do gráfico (yyyy-MM-dd locais; vazios = sem limite → aquisição mais antiga / hoje).
const rangeFrom = ref('')
const rangeTo = ref('')
function onRangeChange(r: { from: string; to: string; preset: string }) {
  rangeFrom.value = r.from
  rangeTo.value = r.to
}

const canAccess = computed(() => subscriptionStore.canAccessAssets)

onMounted(async () => {
  try {
    await Promise.all([
      householdStore.fetchHousehold().then(() => {
        if (householdStore.household && subscriptionStore.canAccessAssets) return assetsStore.fetchAssets()
      }),
      subscriptionStore.fetchSubscription(),
    ])
    if (householdStore.household && subscriptionStore.canAccessAssets && assetsStore.assets.length === 0) {
      await assetsStore.fetchAssets().catch(() => {})
    }
    if (route.query.action === 'new' && subscriptionStore.canAccessAssets) openCreateModal()
  } catch {
    // erros tratados nas stores
  }
})

/* ── Totais ── */
const totalCost = computed(() => assetsStore.assets.reduce((s, a) => s + a.acquisitionCost, 0))
const totalValue = computed(() => assetsStore.totalCurrentValue)

const DAY = 86_400_000

function dayStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/* ── Série temporal agregada (valor + custo à data), com granularidade adaptativa ──
   Comparação por string yyyy-MM-dd (evita o desvio de fuso — a avaliação de hoje conta hoje). */
const chartPoints = computed<AssetChartPoint[]>(() => {
  const assets = assetsStore.assets
  if (assets.length === 0) return []

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = dayStr(today)

  // Fim do intervalo (default hoje); início (default = aquisição mais antiga).
  const endStr = rangeTo.value || todayStr
  let earliest = todayStr
  for (const a of assets) {
    const s = a.acquisitionDate.slice(0, 10)
    if (s < earliest) earliest = s
  }
  let startStr = rangeFrom.value || earliest
  if (startStr > endStr) startStr = endStr

  const series = assets.map((a) => ({
    acqStr: a.acquisitionDate.slice(0, 10),
    cost: a.acquisitionCost,
    vals: [...a.valuations]
      .map((v) => ({ dateStr: v.date.slice(0, 10), value: v.value }))
      .sort((x, y) => (x.dateStr < y.dateStr ? -1 : x.dateStr > y.dateStr ? 1 : 0)),
  }))

  const startMs = new Date(startStr + 'T00:00:00').getTime()
  const endMs = new Date(endStr + 'T00:00:00').getTime()
  const totalDays = Math.max(1, Math.round((endMs - startMs) / DAY))
  // Máx. ~370 pontos (diário em janelas curtas, semanal/mensal em janelas longas).
  const stepDays = Math.max(1, Math.ceil(totalDays / 370))
  const stepMs = stepDays * DAY

  const at = (ds: string): AssetChartPoint => {
    let value = 0
    let cost = 0
    for (const s of series) {
      if (s.acqStr <= ds) cost += s.cost
      let cur: number | null = null
      for (const v of s.vals) {
        if (v.dateStr <= ds) cur = v.value
        else break
      }
      if (cur !== null) value += cur
    }
    return { date: ds, value, cost }
  }

  const points: AssetChartPoint[] = []
  for (let t = startMs; t <= endMs; t += stepMs) points.push(at(dayStr(new Date(t))))
  // Garante que o último ponto é exatamente o fim do intervalo.
  if (points.length === 0 || points[points.length - 1].date !== endStr) points.push(at(endStr))
  return points
})

const chartYearTicks = computed(() => {
  const pts = chartPoints.value
  if (pts.length < 2) return false
  const spanDays = (new Date(pts[pts.length - 1].date + 'T00:00:00').getTime() - new Date(pts[0].date + 'T00:00:00').getTime()) / DAY
  return spanDays > 760
})

/* ── Hero (segue o hover do gráfico) ── */
const hovered = ref<{ date: string; value: number; cost: number } | null>(null)
function onChartHover(p: { date: string; value: number; cost: number } | null) {
  hovered.value = p
}

const heroValue = computed(() => hovered.value?.value ?? totalValue.value)
const heroCost = computed(() => hovered.value?.cost ?? totalCost.value)
const heroReturn = computed(() => heroValue.value - heroCost.value)
const heroReturnPct = computed(() => (heroCost.value !== 0 ? (heroReturn.value / Math.abs(heroCost.value)) * 100 : null))

const heroDateLabel = computed(() => {
  if (!hovered.value) return 'Hoje'
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  if (hovered.value.date === todayStr) return 'Hoje'
  const d = new Date(hovered.value.date + 'T00:00:00')
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })
})

/* ── Tabela ── */
const sortedAssets = computed(() => {
  const list = [...assetsStore.assets]
  list.sort((a, b) => (sortDir.value === 'desc' ? b.currentValue - a.currentValue : a.currentValue - b.currentValue))
  return list
})

function toggleSort() {
  sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
}

function assetReturn(asset: Asset) {
  const abs = asset.currentValue - asset.acquisitionCost
  const pct = asset.acquisitionCost !== 0 ? (abs / Math.abs(asset.acquisitionCost)) * 100 : null
  return { abs, pct }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value)
}

function formatSigned(value: number): string {
  return `${value >= 0 ? '+' : '−'}${formatCurrency(Math.abs(value))}`
}

function formatPct(pct: number): string {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2).replace('.', ',')}%`
}

/* ── Ações ── */
function openCreateModal() {
  assetsStore.clearError()
  createModalOpen.value = true
}

async function handleCreate(payload: CreateAssetRequest) {
  actionLoading.value = true
  try {
    await assetsStore.createAsset(payload)
    createModalOpen.value = false
  } catch {
    // erro na store
  } finally {
    actionLoading.value = false
  }
}

function openAsset(asset: Asset) {
  router.push({ name: 'bem-detalhe', params: { id: asset.id } })
}
</script>

<template>
  <div class="assets-page">
    <div v-if="!householdStore.household && householdStore.loading" class="loading-state">
      <div class="spinner"></div>
      <p>A carregar...</p>
    </div>

    <template v-else>
      <div class="page-header">
        <div class="page-header-text">
          <h1 class="page-title">Bens e valores</h1>
          <p class="page-subtitle">Acompanhe o valor dos seus ativos ao longo do tempo</p>
        </div>
        <button
          v-if="canAccess && assetsStore.assets.length > 0"
          type="button"
          class="btn-add"
          @click="openCreateModal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
          Adicionar
        </button>
      </div>

      <!-- Gating -->
      <PlanUpsellCard
        v-if="!canAccess"
        title="Bens e valores nos planos Pro e Couple"
        description="Registe imóveis, arte, veículos e outros bens, e veja como valorizam ao longo do tempo no seu património."
        :features="[
          'Adicione ativos com custo e data de aquisição',
          'Registe avaliações quando quiser e acompanhe a performance',
          'O valor atual entra no seu Património Total',
        ]"
      >
        <template #icon>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M2 9h20"/><path d="m10 3 2 6"/><path d="m14 3-2 6"/></svg>
        </template>
      </PlanUpsellCard>

      <template v-else>
        <div v-if="assetsStore.error" class="global-error">{{ assetsStore.error }}</div>

        <div v-if="assetsStore.loading && assetsStore.assets.length === 0" class="loading-state">
          <div class="spinner"></div>
          <p>A carregar bens...</p>
        </div>

        <!-- Empty -->
        <div v-else-if="assetsStore.assets.length === 0" class="empty-card">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" class="empty-icon"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M2 9h20"/><path d="m10 3 2 6"/><path d="m14 3-2 6"/></svg>
          <p class="empty-text">Ainda não tem bens registados</p>
          <p class="empty-hint">Adicione o seu primeiro ativo para começar a acompanhar o seu valor.</p>
          <button type="button" class="btn-confirm" @click="openCreateModal">Adicionar ativo</button>
        </div>

        <template v-else>
          <!-- Hero + gráfico -->
          <div class="hero-card">
            <div class="hero-head">
              <div class="hero-info">
                <div class="hero-summary">
                  <span class="hero-value">{{ formatCurrency(heroValue) }}</span>
                  <span class="hero-return" :class="{ negative: heroReturn < 0 }">{{ formatSigned(heroReturn) }}</span>
                  <span v-if="heroReturnPct !== null" class="hero-pct" :class="{ negative: heroReturn < 0 }">
                    {{ formatPct(heroReturnPct) }}
                  </span>
                </div>
                <p class="hero-sub">
                  Custo de aquisição: {{ formatCurrency(heroCost) }}
                  <span class="hero-date">{{ heroDateLabel }}</span>
                </p>
              </div>
              <DateRangePicker initial-preset="year" align="right" @change="onRangeChange" />
            </div>

            <div class="hero-chart">
              <AssetsChart :points="chartPoints" currency="EUR" :year-ticks="chartYearTicks" @hover="onChartHover" />
            </div>
          </div>

          <!-- Tabela -->
          <div class="table-card">
            <table class="assets-table">
              <thead>
                <tr>
                  <th>Ativo</th>
                  <th class="num">Custo de aquisição</th>
                  <th class="num sortable" @click="toggleSort">
                    Valor atual
                    <span class="sort-arrow">{{ sortDir === 'desc' ? '↓' : '↑' }}</span>
                  </th>
                  <th class="num">Retorno</th>
                  <th class="num">% Retorno</th>
                  <th class="chev"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="asset in sortedAssets" :key="asset.id" class="asset-row" @click="openAsset(asset)">
                  <td>
                    <div class="asset-cell">
                      <span
                        class="asset-icon"
                        :style="{ background: assetCategoryColor(asset.category) + '1f', color: assetCategoryColor(asset.category) }"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" v-html="assetCategoryIcon(asset.category)"></svg>
                      </span>
                      <div class="asset-text">
                        <span class="asset-name">{{ asset.name }}</span>
                        <span class="asset-cat">{{ ASSET_CATEGORY_LABELS[asset.category] }}</span>
                      </div>
                    </div>
                  </td>
                  <td class="num">{{ formatCurrency(asset.acquisitionCost) }}</td>
                  <td class="num strong">{{ formatCurrency(asset.currentValue) }}</td>
                  <td class="num" :class="assetReturn(asset).abs >= 0 ? 'pos' : 'neg'">
                    {{ formatSigned(assetReturn(asset).abs) }}
                  </td>
                  <td class="num">
                    <span
                      v-if="assetReturn(asset).pct !== null"
                      class="pct-badge"
                      :class="{ negative: (assetReturn(asset).pct ?? 0) < 0 }"
                    >
                      {{ formatPct(assetReturn(asset).pct as number) }}
                    </span>
                    <span v-else class="muted">—</span>
                  </td>
                  <td class="chev">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </template>
    </template>

    <AssetFormModal
      :open="createModalOpen"
      :loading="actionLoading"
      @close="createModalOpen = false"
      @submit="handleCreate"
    />
  </div>
</template>

<style scoped>
.assets-page {
  max-width: min(1000px, 100%);
  margin: 0 auto;
  padding: 0 0 3rem;
}

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

.btn-add:hover {
  background: #15803d;
  transform: translateY(-1px);
}

.global-error {
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
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

/* ── Hero ── */
.hero-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 1rem;
}

.hero-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.hero-info {
  min-width: 0;
}

.hero-summary {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.625rem;
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

.hero-return {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #166534;
}

html.dark .hero-return {
  color: #4ade80;
}

.hero-return.negative,
.hero-pct.negative {
  color: #dc2626;
}

html.dark .hero-return.negative,
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

.hero-sub {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0.5rem 0 0;
}

.hero-date {
  margin-left: 0.5rem;
  color: var(--color-text-muted);
}

.hero-chart {
  margin-top: 1rem;
}

/* ── Tabela ── */
.table-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  overflow: hidden;
}

.assets-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.assets-table th {
  text-align: left;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.assets-table th.num {
  text-align: right;
}

.assets-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.assets-table th.sortable:hover {
  color: var(--color-text);
}

.sort-arrow {
  margin-left: 0.25rem;
}

.assets-table th.chev {
  width: 36px;
}

.asset-row {
  cursor: pointer;
  transition: background 0.12s;
}

.asset-row:hover {
  background: var(--color-table-row-hover);
}

.assets-table td {
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  white-space: nowrap;
}

.assets-table tbody tr:last-child td {
  border-bottom: none;
}

.assets-table .num {
  text-align: right;
}

.assets-table .strong {
  font-weight: 700;
}

.assets-table .pos {
  color: #166534;
  font-weight: 600;
}

html.dark .assets-table .pos {
  color: #4ade80;
}

.assets-table .neg {
  color: #dc2626;
  font-weight: 600;
}

html.dark .assets-table .neg {
  color: #f87171;
}

.assets-table .muted {
  color: var(--color-text-muted);
}

.asset-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.asset-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 10px;
}

.asset-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.asset-name {
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
}

.asset-cat {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.pct-badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 700;
  color: #166534;
  background: rgba(22, 101, 52, 0.1);
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
}

html.dark .pct-badge {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.12);
}

.pct-badge.negative {
  color: #dc2626;
  background: rgba(220, 38, 38, 0.1);
}

html.dark .pct-badge.negative {
  color: #f87171;
}

.assets-table .chev {
  color: var(--color-text-muted);
  text-align: right;
}

/* ── Estados ── */
.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 3rem 1.5rem;
  background: var(--color-bg-card);
  border: 1px dashed var(--color-border);
  border-radius: 14px;
  text-align: center;
}

.empty-icon {
  color: var(--color-text-muted);
  margin-bottom: 0.5rem;
}

.empty-text {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.empty-hint {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0 0 0.5rem;
  max-width: 36ch;
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
}

.btn-confirm:hover {
  background: #15803d;
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

@media (max-width: 640px) {
  .assets-table th.num:nth-child(2),
  .assets-table td.num:nth-child(2) {
    display: none;
  }
}
</style>
