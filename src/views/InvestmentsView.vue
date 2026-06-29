<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useInvestmentsStore } from '@/stores/investments'
import { useHouseholdStore } from '@/stores/household'
import { useSubscriptionStore } from '@/stores/subscription'
import InvestmentFormModal from '@/components/InvestmentFormModal.vue'
import ImportStatementModal from '@/components/ImportStatementModal.vue'
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue'
import InstrumentLogo from '@/components/InstrumentLogo.vue'
import PlanUpsellCard from '@/components/PlanUpsellCard.vue'
import AssetsChart from '@/components/charts/AssetsChart.vue'
import type { AssetChartPoint } from '@/components/charts/AssetsChart.vue'
import { investmentsApi } from '@/api/investments'
import { INSTRUMENT_TYPE_LABELS } from '@/types/investment'
import type { InvestmentHolding, AddTransactionRequest } from '@/types/investment'

const route = useRoute()
const router = useRouter()
const investmentsStore = useInvestmentsStore()
const householdStore = useHouseholdStore()
const subscriptionStore = useSubscriptionStore()

const formModalOpen = ref(false)
const importModalOpen = ref(false)
const actionLoading = ref(false)
const refreshing = ref(false)
const initialLoading = ref(true) // cobre desde o 1.º render até os dados chegarem (evita o card vazio a "piscar")

/* ── Seleção em massa ── */
const selectedIds = ref<string[]>([])
const bulkDeleteOpen = ref(false)
const bulkDeleting = ref(false)

function isSelected(id: string): boolean {
  return selectedIds.value.includes(id)
}
function toggleSelect(id: string) {
  selectedIds.value = isSelected(id) ? selectedIds.value.filter((x) => x !== id) : [...selectedIds.value, id]
}
const allSelected = computed(
  () => displayedHoldings.value.length > 0 && selectedIds.value.length === displayedHoldings.value.length,
)
const someSelected = computed(() => selectedIds.value.length > 0 && !allSelected.value)
function toggleSelectAll() {
  selectedIds.value = allSelected.value ? [] : displayedHoldings.value.map((h) => h.id)
}
function clearSelection() {
  selectedIds.value = []
}

async function confirmBulkDelete() {
  bulkDeleting.value = true
  try {
    for (const id of [...selectedIds.value]) {
      await investmentsStore.deleteHolding(id)
    }
    selectedIds.value = []
    bulkDeleteOpen.value = false
    await reloadHistory()
  } catch {
    // erro na store
  } finally {
    bulkDeleting.value = false
  }
}

const canAccess = computed(() => subscriptionStore.canAccessInvestments)

onMounted(async () => {
  try {
    // household + subscrição em paralelo; só depois (uma vez) decidimos buscar as posições —
    // evita a corrida que obrigava a um 2.º fetchHoldings de fallback.
    await Promise.all([householdStore.fetchHousehold(), subscriptionStore.fetchSubscription()])
    if (householdStore.household && subscriptionStore.canAccessInvestments) {
      await investmentsStore.fetchHoldings().catch(() => {})
      if (investmentsStore.holdings.length > 0) fetchHistory()
      if (route.query.action === 'new') openAdd()
    }
  } catch {
    // erros tratados nas stores
  } finally {
    initialLoading.value = false
  }
})

/* ── Gráfico de evolução (valor diário da carteira, em EUR) ── */
const DAY = 86_400_000
const historyPoints = ref<AssetChartPoint[]>([])
const historyLoading = ref(true)
let historySeq = 0

/* Filtros de período (como nos outros gráficos): YTD · 3M · 6M · 1A · 5A · Tudo (desde sempre). */
type InvPeriod = 'YTD' | '3M' | '6M' | '1A' | '5A' | 'Tudo'
const invPeriods: InvPeriod[] = ['YTD', '3M', '6M', '1A', '5A', 'Tudo']
const period = ref<InvPeriod>('6M')

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// Início de cada período (rolling, igual ao Património):
//  YTD = 1 Jan; 3M = mês atual + 2 anteriores; 6M = mês atual + 5 anteriores;
//  1A = este mês há 1 ano; 5A = este mês há 5 anos (exatos); Tudo = desde a 1ª compra.
function rangeFor(p: InvPeriod): { from: string; to: string } {
  const now = new Date()
  if (p === 'Tudo') return { from: '', to: localDateStr(now) }
  let start: Date
  if (p === '3M') start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
  else if (p === '6M') start = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  else if (p === '1A') start = new Date(now.getFullYear() - 1, now.getMonth(), 1)
  else if (p === '5A') start = new Date(now.getFullYear() - 5, now.getMonth(), 1)
  else start = new Date(now.getFullYear(), 0, 1) // YTD
  return { from: localDateStr(start), to: localDateStr(now) }
}

// Memoização do histórico por período (na sessão): alternar entre chips já vistos não repete o pedido.
// Limpa-se em qualquer mutação (refresh/adicionar/importar/eliminar) via reloadHistory().
const historyCache = new Map<InvPeriod, AssetChartPoint[]>()

async function fetchHistory() {
  const p = period.value
  const cached = historyCache.get(p)
  if (cached) {
    historyPoints.value = cached
    historyLoading.value = false
    return
  }
  const seq = ++historySeq
  historyLoading.value = true
  try {
    const { data } = await investmentsApi.history(rangeFor(p))
    if (seq !== historySeq) return
    const pts = data.points.map((pt) => ({ date: pt.date, value: pt.value, cost: pt.cost }))
    historyCache.set(p, pts)
    historyPoints.value = pts
  } catch {
    if (seq === historySeq) historyPoints.value = []
  } finally {
    if (seq === historySeq) historyLoading.value = false
  }
}

// Após mutações: invalida a memoização e recarrega o período atual.
function reloadHistory() {
  historyCache.clear()
  return fetchHistory()
}

function selectPeriod(p: InvPeriod) {
  if (period.value === p) return
  period.value = p
  fetchHistory()
}

const showChart = computed(() => historyPoints.value.length >= 2)

const chartYearTicks = computed(() => {
  const pts = historyPoints.value
  if (pts.length < 2) return false
  const span =
    (new Date(pts[pts.length - 1].date + 'T00:00:00').getTime() - new Date(pts[0].date + 'T00:00:00').getTime()) / DAY
  // > ~18 meses: comprime os anos antigos (anos à esquerda + meses do ano atual) antes de os
  // meses ficarem apertados na vista "Tudo". O 5A (~1826 dias) está sempre acima deste limite.
  return span > 540
})

/* Hero segue o hover do gráfico (valor + custo desse dia). */
const hovered = ref<{ date: string; value: number; cost: number } | null>(null)
function onChartHover(p: { date: string; value: number; cost: number } | null) {
  hovered.value = p
}
const heroValue = computed(() => hovered.value?.value ?? totalValue.value)
const heroInvested = computed(() => hovered.value?.cost ?? totalInvested.value)
const heroReturn = computed(() => heroValue.value - heroInvested.value)
const heroReturnPct = computed(() =>
  heroInvested.value !== 0 ? (heroReturn.value / Math.abs(heroInvested.value)) * 100 : null,
)
const heroDateLabel = computed(() => {
  if (!hovered.value) return lastUpdate.value ? `preços a ${formatDate(lastUpdate.value)}` : ''
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  if (hovered.value.date === todayStr) return 'Hoje'
  const d = new Date(hovered.value.date + 'T00:00:00')
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })
})

/* ── Totais ── */
const totalValue = computed(() => investmentsStore.totalCurrentValueEur)
const totalInvested = computed(() => investmentsStore.totalInvestedEur)

const lastUpdate = computed(() => {
  const dates = investmentsStore.holdings.map((h) => h.priceAsOf).filter((d): d is string => !!d)
  if (dates.length === 0) return null
  return dates.sort().at(-1) ?? null
})

const sortedHoldings = computed(() =>
  [...investmentsStore.activeHoldings].sort((a, b) => (b.currentValueEur ?? b.investedEur) - (a.currentValueEur ?? a.investedEur)),
)
// Posições fechadas/negativas (quantidade ≤ 0) — mostradas numa secção esbatida, para gerir/apagar.
const closedHoldings = computed(() =>
  investmentsStore.holdings.filter((h) => h.quantity <= 1e-9).sort((a, b) => a.name.localeCompare(b.name)),
)
const displayedHoldings = computed(() => [...sortedHoldings.value, ...closedHoldings.value])

function formatEur(v: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)
}
function formatPrice(v: number, currency: string): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: currency || 'EUR' }).format(v)
}
function formatQty(v: number): string {
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 6 }).format(v)
}
function formatSignedEur(v: number): string {
  return `${v >= 0 ? '+' : '−'}${formatEur(Math.abs(v))}`
}
function formatPct(pct: number): string {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2).replace('.', ',')}%`
}
function formatDate(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/* ── Fluxo ── */
function openAdd() {
  investmentsStore.clearError()
  formModalOpen.value = true
}

function openPosition(h: InvestmentHolding) {
  router.push({ name: 'investimento-detalhe', params: { id: h.id } })
}

async function handleFormSubmit(payload: AddTransactionRequest) {
  actionLoading.value = true
  try {
    const h = await investmentsStore.addTransaction(payload)
    formModalOpen.value = false
    reloadHistory()
    if (h) router.push({ name: 'investimento-detalhe', params: { id: h.id } })
  } catch {
    // erro na store
  } finally {
    actionLoading.value = false
  }
}

/* ── Cooldown do botão "Atualizar" (10 min, persistido para não dar para contornar com F5) ── */
const REFRESH_COOLDOWN_MS = 10 * 60 * 1000
const REFRESH_KEY = 'finora_inv_refresh_at'
const lastRefreshAt = ref<number>(Number(localStorage.getItem(REFRESH_KEY) || 0))
const nowTs = ref(Date.now())
let cooldownTimer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  cooldownTimer = setInterval(() => { nowTs.value = Date.now() }, 1000)
})
onUnmounted(() => {
  if (cooldownTimer) clearInterval(cooldownTimer)
})
const cooldownMs = computed(() => Math.max(0, REFRESH_COOLDOWN_MS - (nowTs.value - lastRefreshAt.value)))
const refreshDisabled = computed(() => refreshing.value || cooldownMs.value > 0)

async function handleRefresh() {
  if (refreshDisabled.value) return
  refreshing.value = true
  try {
    await investmentsStore.refresh()
    await reloadHistory()
    // Cooldown só arranca quando a atualização correu (se falhar, pode tentar logo).
    lastRefreshAt.value = Date.now()
    localStorage.setItem(REFRESH_KEY, String(lastRefreshAt.value))
  } catch {
    // erro na store
  } finally {
    refreshing.value = false
  }
}

function openImport() {
  formModalOpen.value = false
  importModalOpen.value = true
}

async function handleImportDone() {
  importModalOpen.value = false
  await investmentsStore.fetchHoldings()
  reloadHistory()
}
</script>

<template>
  <div class="investments-page">
    <div v-if="!householdStore.household && householdStore.loading" class="loading-state">
      <div class="spinner"></div>
      <p>A carregar...</p>
    </div>

    <template v-else>
      <div class="page-header">
        <div class="page-header-text">
          <h1 class="page-title">Investimentos</h1>
          <p class="page-subtitle">Ações e ETFs — preços atualizados diariamente</p>
        </div>
        <button
          v-if="canAccess && investmentsStore.holdings.length > 0"
          type="button"
          class="btn-add"
          @click="openAdd"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
          Adicionar
        </button>
      </div>

      <div v-if="initialLoading" class="loading-state">
        <div class="spinner"></div>
        <p>A carregar investimentos...</p>
      </div>

      <PlanUpsellCard
        v-else-if="!canAccess"
        title="Investimentos nos planos Pro e Couple"
        description="Acompanhe as suas ações e ETFs com preços atualizados todos os dias, e veja o valor entrar no seu Património Total."
        :features="[
          'Pesquise qualquer ticker (ações e ETFs)',
          'Registe compras e vendas, com data e comissão',
          'Preços de fecho atualizados 1×/dia, convertidos para EUR',
        ]"
      >
        <template #icon>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
        </template>
      </PlanUpsellCard>

      <template v-else>
        <div v-if="investmentsStore.error" class="global-error">{{ investmentsStore.error }}</div>

        <div v-if="investmentsStore.holdings.length === 0" class="empty-card">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" class="empty-icon"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
          <p class="empty-text">Ainda não tem investimentos</p>
          <p class="empty-hint">Adicione a sua primeira transação (compra de uma ação ou ETF).</p>
          <button type="button" class="btn-confirm" @click="openAdd">Adicionar transação</button>
        </div>

        <template v-else>
          <div class="hero-card">
            <div class="hero-head">
              <div class="hero-info">
                <div class="hero-summary">
                  <span class="hero-value">{{ formatEur(heroValue) }}</span>
                  <span class="hero-return" :class="{ negative: heroReturn < 0 }">{{ formatSignedEur(heroReturn) }}</span>
                  <span v-if="heroReturnPct !== null" class="hero-pct" :class="{ negative: heroReturn < 0 }">
                    {{ formatPct(heroReturnPct) }}
                  </span>
                </div>
                <p class="hero-sub">
                  Investido: {{ formatEur(heroInvested) }}
                  <span v-if="heroDateLabel" class="hero-date">· {{ heroDateLabel }}</span>
                </p>
              </div>
              <div class="hero-controls">
                <div class="period-chips">
                  <button
                    v-for="p in invPeriods"
                    :key="p"
                    type="button"
                    class="period-chip"
                    :class="{ active: period === p }"
                    @click="selectPeriod(p)"
                  >{{ p }}</button>
                </div>
                <button
                  type="button"
                  class="btn-refresh"
                  :disabled="refreshDisabled"
                  :title="cooldownMs > 0 ? 'Aguarde uns minutos antes de atualizar de novo' : 'Atualizar cotações'"
                  @click="handleRefresh"
                >
                  <svg :class="{ spin: refreshing }" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                  {{ refreshing ? 'A atualizar...' : 'Atualizar' }}
                </button>
              </div>
            </div>

            <div class="hero-chart">
              <div v-if="historyLoading" class="hero-chart-loading"><div class="spinner"></div></div>
              <AssetsChart v-else-if="showChart" :points="historyPoints" currency="EUR" :year-ticks="chartYearTicks" cost-label="Investido" @hover="onChartHover" />
            </div>
          </div>

          <div v-if="selectedIds.length > 0" class="bulk-bar">
            <span class="bulk-count">{{ selectedIds.length }} {{ selectedIds.length === 1 ? 'selecionada' : 'selecionadas' }}</span>
            <div class="bulk-actions">
              <button type="button" class="bulk-clear" @click="clearSelection">Limpar</button>
              <button type="button" class="bulk-delete" @click="bulkDeleteOpen = true">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                Eliminar
              </button>
            </div>
          </div>

          <div class="table-card">
            <table class="inv-table">
              <thead>
                <tr>
                  <th class="check-col">
                    <input
                      type="checkbox"
                      class="inv-check"
                      :checked="allSelected"
                      :indeterminate.prop="someSelected"
                      aria-label="Selecionar todas"
                      @change="toggleSelectAll"
                    />
                  </th>
                  <th>Ativo</th>
                  <th class="num">Qtd.</th>
                  <th class="num">Preço</th>
                  <th class="num">Valor</th>
                  <th class="num">Retorno</th>
                  <th class="num">% Retorno</th>
                  <th class="chev"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="h in sortedHoldings" :key="h.id" class="inv-row" :class="{ 'row-selected': isSelected(h.id) }" @click="openPosition(h)">
                  <td class="check-col" @click.stop>
                    <input
                      type="checkbox"
                      class="inv-check"
                      :checked="isSelected(h.id)"
                      :aria-label="`Selecionar ${h.providerSymbol || h.symbol}`"
                      @change="toggleSelect(h.id)"
                    />
                  </td>
                  <td>
                    <div class="asset-cell">
                      <InstrumentLogo :symbol="h.symbol" :name="h.name" :type="h.type" :domain="h.logoDomain" :size="32" />
                      <div class="asset-text">
                        <div class="asset-top">
                          <span class="asset-symbol">{{ h.providerSymbol || h.symbol }}</span>
                          <span class="asset-badge">{{ INSTRUMENT_TYPE_LABELS[h.type] }}</span>
                        </div>
                        <span class="asset-name">{{ h.name }}</span>
                      </div>
                    </div>
                  </td>
                  <td class="num">{{ formatQty(h.quantity) }}</td>
                  <td class="num">
                    <template v-if="h.currentPrice !== null">{{ formatPrice(h.currentPrice, h.currency) }}</template>
                    <span v-else class="muted">—</span>
                  </td>
                  <td class="num strong">
                    <template v-if="h.currentValueEur !== null">{{ formatEur(h.currentValueEur) }}</template>
                    <span v-else class="muted">{{ formatEur(h.investedEur) }}</span>
                  </td>
                  <td class="num" :class="(h.returnEur ?? 0) >= 0 ? 'pos' : 'neg'">
                    <template v-if="h.returnEur !== null">{{ formatSignedEur(h.returnEur) }}</template>
                    <span v-else class="muted">—</span>
                  </td>
                  <td class="num">
                    <span v-if="h.returnPct !== null" class="pct-badge" :class="{ negative: h.returnPct < 0 }">
                      {{ formatPct(h.returnPct) }}
                    </span>
                    <span v-else class="muted">—</span>
                  </td>
                  <td class="chev">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </td>
                </tr>
                <tr v-if="sortedHoldings.length === 0" class="inv-empty-row">
                  <td :colspan="8">Sem posições abertas.</td>
                </tr>
              </tbody>

              <!-- Posições fechadas (quantidade ≤ 0) -->
              <tbody v-if="closedHoldings.length > 0">
                <tr class="closed-sep">
                  <td :colspan="8">Fechadas</td>
                </tr>
                <tr
                  v-for="h in closedHoldings"
                  :key="h.id"
                  class="inv-row inv-row--closed"
                  :class="{ 'row-selected': isSelected(h.id) }"
                  @click="openPosition(h)"
                >
                  <td class="check-col" @click.stop>
                    <input
                      type="checkbox"
                      class="inv-check"
                      :checked="isSelected(h.id)"
                      :aria-label="`Selecionar ${h.providerSymbol || h.symbol}`"
                      @change="toggleSelect(h.id)"
                    />
                  </td>
                  <td>
                    <div class="asset-cell">
                      <InstrumentLogo :symbol="h.symbol" :name="h.name" :type="h.type" :domain="h.logoDomain" :size="32" />
                      <div class="asset-text">
                        <div class="asset-top">
                          <span class="asset-symbol">{{ h.providerSymbol || h.symbol }}</span>
                          <span class="asset-badge">{{ INSTRUMENT_TYPE_LABELS[h.type] }}</span>
                        </div>
                        <span class="asset-name">{{ h.name }}</span>
                      </div>
                    </div>
                  </td>
                  <td class="num">{{ formatQty(h.quantity) }}</td>
                  <td class="num"><span class="muted">—</span></td>
                  <td class="num"><span class="muted">Fechada</span></td>
                  <td class="num"><span class="muted">—</span></td>
                  <td class="num"><span class="muted">—</span></td>
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

    <InvestmentFormModal
      :open="formModalOpen"
      :loading="actionLoading"
      @close="formModalOpen = false"
      @submit="handleFormSubmit"
      @import="openImport"
    />

    <ImportStatementModal
      :open="importModalOpen"
      @close="importModalOpen = false"
      @done="handleImportDone"
    />

    <ConfirmDeleteModal
      :open="bulkDeleteOpen"
      title="Eliminar posições"
      :message="`Tem a certeza que deseja eliminar ${selectedIds.length} ${selectedIds.length === 1 ? 'posição' : 'posições'}? As transações associadas também serão removidas.`"
      :loading="bulkDeleting"
      @close="bulkDeleteOpen = false"
      @confirm="confirmBulkDelete"
    />
  </div>
</template>

<style scoped>
.investments-page {
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
  flex-wrap: wrap;
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

.hero-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.period-chips {
  display: flex;
  gap: 2px;
  padding: 2px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 9px;
}

.period-chip {
  padding: 0.3rem 0.55rem;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: inherit;
  color: var(--color-text-muted);
  background: transparent;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.period-chip:hover {
  color: var(--color-text);
}

.period-chip.active {
  background: var(--color-bg-card);
  color: #166534;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

html.dark .period-chip.active {
  color: #4ade80;
}

.hero-chart {
  margin-top: 1rem;
}

.hero-chart-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 240px;
}

@media (max-width: 768px) {
  .hero-chart-loading {
    height: 200px;
  }
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
  margin-left: 0.25rem;
}

.btn-refresh {
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

.btn-refresh:hover:not(:disabled) {
  background: var(--color-table-row-hover);
  border-color: var(--color-text-muted);
}

.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-refresh .spin {
  animation: spin 0.8s linear infinite;
}

.bulk-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
  padding: 0.625rem 1rem;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
}

.bulk-count {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text);
}

.bulk-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bulk-clear {
  padding: 0.4rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  color: var(--color-text-muted);
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.bulk-clear:hover {
  color: var(--color-text);
  background: var(--color-table-row-hover);
}

.bulk-delete {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4rem 0.875rem;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  color: #dc2626;
  background: transparent;
  border: 1px solid #fecaca;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.bulk-delete:hover {
  background: #fef2f2;
}

html.dark .bulk-delete {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.3);
}

html.dark .bulk-delete:hover {
  background: rgba(248, 113, 113, 0.1);
}

.check-col {
  width: 44px;
  text-align: center;
  padding-left: 1rem !important;
  padding-right: 0 !important;
}

.inv-check {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #166534;
  vertical-align: middle;
}

html.dark .inv-check {
  accent-color: #4ade80;
}

.inv-row.row-selected {
  background: rgba(22, 101, 52, 0.06);
}

html.dark .inv-row.row-selected {
  background: rgba(74, 222, 128, 0.08);
}

.inv-row--closed {
  opacity: 0.6;
}

.closed-sep td {
  padding: 0.5rem 1.25rem;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  background: var(--color-table-row-hover);
  border-bottom: 1px solid var(--color-border);
}

.inv-empty-row td {
  padding: 1.25rem;
  text-align: center;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.table-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  overflow: hidden;
}

.inv-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.inv-table th {
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

.inv-table th.num {
  text-align: right;
}

.inv-table th.chev {
  width: 36px;
}

.inv-row {
  cursor: pointer;
  transition: background 0.12s;
}

.inv-row:hover {
  background: var(--color-table-row-hover);
}

.inv-table td {
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  white-space: nowrap;
}

.inv-table tbody tr:last-child td {
  border-bottom: none;
}

.inv-table .num {
  text-align: right;
}

.inv-table .strong {
  font-weight: 700;
}

.inv-table .pos {
  color: #166534;
  font-weight: 600;
}

html.dark .inv-table .pos {
  color: #4ade80;
}

.inv-table .neg {
  color: #dc2626;
  font-weight: 600;
}

html.dark .inv-table .neg {
  color: #f87171;
}

.inv-table .muted {
  color: var(--color-text-muted);
}

.inv-table .chev {
  color: var(--color-text-muted);
  text-align: right;
}

.asset-cell {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.asset-text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.asset-top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.asset-symbol {
  font-weight: 700;
  color: var(--color-text);
}

.asset-badge {
  font-size: 0.625rem;
  font-weight: 600;
  color: #166534;
  background: rgba(22, 101, 52, 0.1);
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
}

html.dark .asset-badge {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.12);
}

.asset-name {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
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
  .inv-table th.num:nth-child(2),
  .inv-table td.num:nth-child(2),
  .inv-table th.num:nth-child(3),
  .inv-table td.num:nth-child(3) {
    display: none;
  }
}
</style>
