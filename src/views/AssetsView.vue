<script setup lang="ts">
import PageSkeleton from '@/components/PageSkeleton.vue'
import { PT_GROUPING } from '@/utils/numberFormat'
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAssetsStore } from '@/stores/assets'
import { useHouseholdStore } from '@/stores/household'
import { useSubscriptionStore } from '@/stores/subscription'
import AssetFormModal from '@/components/AssetFormModal.vue'
import PlanUpsellCard from '@/components/PlanUpsellCard.vue'
import DateRangePicker from '@/components/DateRangePicker.vue'
import ValueHeroCard from '@/components/charts/ValueHeroCard.vue'
import HeroStat from '@/components/charts/HeroStat.vue'
import type { AssetChartPoint } from '@/components/charts/AssetsChart.vue'
import { ASSET_CATEGORY_LABELS } from '@/types/asset'
import type { Asset, CreateAssetRequest } from '@/types/asset'
import { assetCategoryIcon, assetCategoryColor } from '@/types/assetMeta'
import PageHeader from '@/components/ui/PageHeader.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiCard from '@/components/ui/UiCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const route = useRoute()
const router = useRouter()
const assetsStore = useAssetsStore()
const householdStore = useHouseholdStore()
const subscriptionStore = useSubscriptionStore()

const createModalOpen = ref(false)
const actionLoading = ref(false)
const sortDir = ref<'asc' | 'desc'>('desc')
const initialLoading = ref(true) // cobre desde o 1.º render até os dados chegarem (evita o card vazio a "piscar")

// Intervalo do gráfico (yyyy-MM-dd locais; vazios = sem limite → aquisição mais antiga / hoje).
const rangeFrom = ref('')
const rangeTo = ref('')
const rangePreset = ref('year')
function onRangeChange(r: { from: string; to: string; preset: string }) {
  rangeFrom.value = r.from
  rangeTo.value = r.to
  rangePreset.value = r.preset
}
// Texto do período na linha da variação do hero (presets do DateRangePicker).
const PRESET_TEXT: Record<string, string> = {
  month: 'este mês',
  '30d': 'em 30 dias',
  '3m': 'em 3 meses',
  year: 'este ano',
  all: 'desde o início',
}
const periodLabel = computed(() => PRESET_TEXT[rangePreset.value] ?? 'no período')

const canAccess = computed(() => subscriptionStore.canAccessAssets)

onMounted(async () => {
  try {
    // household + subscrição em paralelo; depois (uma vez) garante os ativos via ensureLoaded
    // (não repete o GET se já estiverem em memória de uma visita anterior).
    await Promise.all([householdStore.fetchHousehold(), subscriptionStore.fetchSubscription()])
    if (householdStore.household && subscriptionStore.canAccessAssets) {
      await assetsStore.ensureLoaded().catch(() => {})
      if (route.query.action === 'new') openCreateModal()
    }
  } catch {
    // erros tratados nas stores
  } finally {
    initialLoading.value = false
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
  // > ~18 meses: anos comprimidos + meses do ano atual (mesmo critério dos gráficos de Investimentos).
  return spanDays > 540
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
  return new Intl.NumberFormat('pt-PT', { ...PT_GROUPING, style: 'currency', currency: 'EUR' }).format(value)
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
    toast.success('Ativo adicionado')
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
    <PageSkeleton v-if="!householdStore.household && householdStore.loading" variant="hero" />

    <template v-else>
      <PageHeader title="Bens e valores">
        <template v-if="canAccess && assetsStore.assets.length > 0" #actions>
          <UiButton variant="primary" @click="openCreateModal">
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
            </template>
            Adicionar
          </UiButton>
        </template>
      </PageHeader>

      <PageSkeleton v-if="initialLoading" variant="hero" />

      <!-- Gating -->
      <PlanUpsellCard
        v-else-if="!canAccess"
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
        <div v-if="assetsStore.error" class="notice notice--danger">{{ assetsStore.error }}</div>

        <!-- Empty -->
        <UiCard v-if="assetsStore.assets.length === 0">
          <EmptyState
            title="Ainda não tem bens registados"
            description="Adicione o seu primeiro ativo para começar a acompanhar o seu valor."
          >
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M2 9h20"/><path d="m10 3 2 6"/><path d="m14 3-2 6"/></svg>
            </template>
            <UiButton variant="secondary" @click="openCreateModal">Adicionar ativo</UiButton>
          </EmptyState>
        </UiCard>

        <template v-else>
          <!-- Hero + gráfico -->
          <ValueHeroCard
            :points="chartPoints"
            :current-value="totalValue"
            :current-cost="totalCost"
            cost-label="Custo"
            :period-label="periodLabel"
            :year-ticks="chartYearTicks"
          >
            <template #actions>
              <DateRangePicker initial-preset="year" align="right" @change="onRangeChange" />
            </template>
            <template #footer>
              <HeroStat label="Custo de aquisição" :value="formatCurrency(totalCost)" />
            </template>
          </ValueHeroCard>

          <!-- Tabela -->
          <UiCard flush>
            <template #header>
              <div class="table-head">
                <h2 class="table-title">Ativos</h2>
                <span class="ui-badge">{{ assetsStore.assets.length }}</span>
              </div>
            </template>
            <div class="ui-table-wrap">
              <table class="ui-table assets-table">
                <thead>
                  <tr>
                    <th>Ativo</th>
                    <th class="col-cat">Categoria</th>
                    <th class="num col-cost">Custo</th>
                    <th class="num">
                      <button type="button" class="sort-btn" @click="toggleSort">
                        Valor atual
                        <svg
                          xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
                          :class="{ 'sort-up': sortDir === 'asc' }"
                        ><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                    </th>
                    <th class="num">Variação</th>
                    <th class="col-chev" aria-hidden="true"></th>
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
                        <span class="asset-text">
                          <span class="asset-name">{{ asset.name }}</span>
                          <span class="asset-cat-inline">{{ ASSET_CATEGORY_LABELS[asset.category] }}</span>
                        </span>
                      </div>
                    </td>
                    <td class="col-cat">
                      <span class="ui-badge">{{ ASSET_CATEGORY_LABELS[asset.category] }}</span>
                    </td>
                    <td class="num col-cost muted">{{ formatCurrency(asset.acquisitionCost) }}</td>
                    <td class="num"><span class="ui-amount">{{ formatCurrency(asset.currentValue) }}</span></td>
                    <td class="num">
                      <div class="change-cell">
                        <span class="change-abs" :class="assetReturn(asset).abs >= 0 ? 'ui-amount--pos' : 'ui-amount--neg'">
                          {{ formatSigned(assetReturn(asset).abs) }}
                        </span>
                        <span
                          v-if="assetReturn(asset).pct !== null"
                          class="ui-badge"
                          :class="(assetReturn(asset).pct ?? 0) < 0 ? 'ui-badge--danger' : 'ui-badge--success'"
                        >
                          {{ formatPct(assetReturn(asset).pct as number) }}
                        </span>
                      </div>
                    </td>
                    <td class="col-chev">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UiCard>
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
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 0 0 var(--space-12);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
.assets-page > .page-head {
  margin-bottom: 0;
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

/* ── Tabela ── */
.table-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.table-title {
  margin: 0;
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}
.asset-row {
  cursor: pointer;
}
.asset-cell {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}
.asset-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.asset-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.asset-name {
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 280px;
}
.asset-cat-inline {
  display: none;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
.muted {
  color: var(--color-text-muted);
}
.change-cell {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  justify-content: flex-end;
}
.change-abs {
  font-weight: var(--weight-medium);
  white-space: nowrap;
}
.sort-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  color: inherit;
  cursor: pointer;
}
.sort-btn:hover {
  color: var(--color-text);
}
.sort-btn svg {
  transition: transform var(--transition-fast);
}
.sort-btn .sort-up {
  transform: rotate(180deg);
}
.col-chev {
  width: 36px;
  color: var(--color-text-subtle);
  text-align: right;
}
.col-chev svg {
  display: block;
  margin-left: auto;
}
.asset-row:hover .col-chev {
  color: var(--color-text-muted);
}

@media (max-width: 860px) {
  .col-cat {
    display: none;
  }
  .asset-cat-inline {
    display: block;
  }
}
@media (max-width: 600px) {
  .col-cost,
  .col-chev {
    display: none;
  }
  .change-abs {
    display: none;
  }
  .asset-name {
    max-width: 150px;
  }
}
</style>
