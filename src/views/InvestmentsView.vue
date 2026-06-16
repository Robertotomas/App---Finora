<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useInvestmentsStore } from '@/stores/investments'
import { useHouseholdStore } from '@/stores/household'
import { useSubscriptionStore } from '@/stores/subscription'
import InvestmentFormModal from '@/components/InvestmentFormModal.vue'
import InstrumentLogo from '@/components/InstrumentLogo.vue'
import PlanUpsellCard from '@/components/PlanUpsellCard.vue'
import DateRangePicker from '@/components/DateRangePicker.vue'
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
const actionLoading = ref(false)
const refreshing = ref(false)

const canAccess = computed(() => subscriptionStore.canAccessInvestments)

onMounted(async () => {
  try {
    await Promise.all([
      householdStore.fetchHousehold().then(() => {
        if (householdStore.household && subscriptionStore.canAccessInvestments) return investmentsStore.fetchHoldings()
      }),
      subscriptionStore.fetchSubscription(),
    ])
    if (householdStore.household && subscriptionStore.canAccessInvestments && investmentsStore.holdings.length === 0) {
      await investmentsStore.fetchHoldings().catch(() => {})
    }
    if (subscriptionStore.canAccessInvestments && investmentsStore.holdings.length > 0) fetchHistory()
    if (route.query.action === 'new' && subscriptionStore.canAccessInvestments) openAdd()
  } catch {
    // erros tratados nas stores
  }
})

/* ── Gráfico de evolução (valor diário da carteira, em EUR) ── */
const DAY = 86_400_000
const historyPoints = ref<AssetChartPoint[]>([])
const rangeFrom = ref('')
const rangeTo = ref('')
let historySeq = 0

async function fetchHistory() {
  const seq = ++historySeq
  try {
    const { data } = await investmentsApi.history({ from: rangeFrom.value, to: rangeTo.value })
    if (seq !== historySeq) return
    historyPoints.value = data.points.map((p) => ({ date: p.date, value: p.value, cost: p.cost }))
  } catch {
    if (seq === historySeq) historyPoints.value = []
  }
}

function onRangeChange(r: { from: string; to: string }) {
  rangeFrom.value = r.from
  rangeTo.value = r.to
  fetchHistory()
}

const showChart = computed(() => historyPoints.value.length >= 2)

const chartYearTicks = computed(() => {
  const pts = historyPoints.value
  if (pts.length < 2) return false
  const span =
    (new Date(pts[pts.length - 1].date + 'T00:00:00').getTime() - new Date(pts[0].date + 'T00:00:00').getTime()) / DAY
  return span > 760
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
  [...investmentsStore.holdings].sort((a, b) => (b.currentValueEur ?? b.investedEur) - (a.currentValueEur ?? a.investedEur)),
)

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
    fetchHistory()
    if (h) router.push({ name: 'investimento-detalhe', params: { id: h.id } })
  } catch {
    // erro na store
  } finally {
    actionLoading.value = false
  }
}

async function handleRefresh() {
  refreshing.value = true
  try {
    await investmentsStore.refresh()
    await fetchHistory()
  } catch {
    // erro na store
  } finally {
    refreshing.value = false
  }
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

      <PlanUpsellCard
        v-if="!canAccess"
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

        <div v-if="investmentsStore.loading && investmentsStore.holdings.length === 0" class="loading-state">
          <div class="spinner"></div>
          <p>A carregar investimentos...</p>
        </div>

        <div v-else-if="investmentsStore.holdings.length === 0" class="empty-card">
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
                <DateRangePicker initial-preset="year" align="right" @change="onRangeChange" />
                <button type="button" class="btn-refresh" :disabled="refreshing" @click="handleRefresh">
                  <svg :class="{ spin: refreshing }" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                  {{ refreshing ? 'A atualizar...' : 'Atualizar' }}
                </button>
              </div>
            </div>

            <div v-if="showChart" class="hero-chart">
              <AssetsChart :points="historyPoints" currency="EUR" :year-ticks="chartYearTicks" @hover="onChartHover" />
            </div>
          </div>

          <div class="table-card">
            <table class="inv-table">
              <thead>
                <tr>
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
                <tr v-for="h in sortedHoldings" :key="h.id" class="inv-row" @click="openPosition(h)">
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
}

.hero-chart {
  margin-top: 1rem;
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
