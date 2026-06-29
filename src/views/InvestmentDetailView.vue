<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useInvestmentsStore } from '@/stores/investments'
import InvestmentFormModal from '@/components/InvestmentFormModal.vue'
import InstrumentLogo from '@/components/InstrumentLogo.vue'
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue'
import AssetsChart from '@/components/charts/AssetsChart.vue'
import type { AssetChartPoint } from '@/components/charts/AssetsChart.vue'
import { investmentsApi } from '@/api/investments'
import {
  INSTRUMENT_TYPE_LABELS,
  InvestmentOperation,
  INVESTMENT_OPERATION_LABELS,
} from '@/types/investment'
import type { InvestmentTransaction, AddTransactionRequest } from '@/types/investment'

const route = useRoute()
const router = useRouter()
const investmentsStore = useInvestmentsStore()

const loading = ref(true)
const actionLoading = ref(false)

const formModalOpen = ref(false)
const formTransaction = ref<InvestmentTransaction | null>(null)
const txToDelete = ref<InvestmentTransaction | null>(null)
const positionDeleteOpen = ref(false)

const holdingId = computed(() => String(route.params.id))
const holding = computed(() => investmentsStore.holdings.find((h) => h.id === holdingId.value) ?? null)

onMounted(async () => {
  try {
    if (investmentsStore.holdings.length === 0) await investmentsStore.fetchHoldings()
    fetchHistory()
  } catch {
    // erro na store
  } finally {
    loading.value = false
  }
})

/* ── Gráfico de evolução da posição (valor diário em EUR) ── */
const DAY = 86_400_000
const historyPoints = ref<AssetChartPoint[]>([])
const historyLoading = ref(true)
let historySeq = 0

async function fetchHistory() {
  if (!holdingId.value) return
  const seq = ++historySeq
  historyLoading.value = true
  try {
    const { data } = await investmentsApi.holdingHistory(holdingId.value)
    if (seq !== historySeq) return
    historyPoints.value = data.points.map((p) => ({ date: p.date, value: p.value, cost: p.cost }))
  } catch {
    if (seq === historySeq) historyPoints.value = []
  } finally {
    if (seq === historySeq) historyLoading.value = false
  }
}

const showChart = computed(() => historyPoints.value.length >= 2)
const chartYearTicks = computed(() => {
  const pts = historyPoints.value
  if (pts.length < 2) return false
  const span =
    (new Date(pts[pts.length - 1].date + 'T00:00:00').getTime() - new Date(pts[0].date + 'T00:00:00').getTime()) / DAY
  // > ~18 meses: anos comprimidos à esquerda + meses do ano atual (igual à vista "Tudo" da lista).
  return span > 540
})

const fixedInstrument = computed(() => {
  const h = holding.value
  if (!h) return null
  return {
    symbol: h.symbol,
    exchange: h.exchange,
    micCode: '',
    providerSymbol: h.providerSymbol,
    name: h.name,
    currency: h.currency,
    type: h.type,
    logoDomain: h.logoDomain,
  }
})

/* ── Métricas ── */
const currentValue = computed(() => holding.value?.currentValueEur ?? holding.value?.investedEur ?? 0)
const change = computed(() => currentValue.value - (holding.value?.investedEur ?? 0))
const changePct = computed(() => {
  const inv = holding.value?.investedEur ?? 0
  return inv !== 0 ? (change.value / Math.abs(inv)) * 100 : null
})
const weight = computed(() => {
  const total = investmentsStore.totalCurrentValueEur
  return total !== 0 ? (currentValue.value / total) * 100 : null
})

const rows = computed(() =>
  [...(holding.value?.transactions ?? [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
)

/* ── Formatação ── */
function fmtEur(v: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)
}
function fmtPrice(v: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: holding.value?.currency || 'EUR' }).format(v)
}
function fmtQty(v: number): string {
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 6 }).format(v)
}
function fmtSignedEur(v: number): string {
  return `${v >= 0 ? '+' : '−'}${fmtEur(Math.abs(v))}`
}
function fmtPct(pct: number): string {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2).replace('.', ',')}%`
}
function fmtDate(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
}

/* ── Ações ── */
function openAdd() {
  formTransaction.value = null
  investmentsStore.clearError()
  formModalOpen.value = true
}
function openEdit(tx: InvestmentTransaction) {
  formTransaction.value = tx
  investmentsStore.clearError()
  formModalOpen.value = true
}

async function handleFormSubmit(payload: AddTransactionRequest) {
  if (!holding.value) return
  actionLoading.value = true
  try {
    if (formTransaction.value) {
      await investmentsStore.updateTransaction(formTransaction.value.id, {
        operation: payload.operation,
        date: payload.date,
        quantity: payload.quantity,
        unitPrice: payload.unitPrice,
        commission: payload.commission,
        fxFeePercent: payload.fxFeePercent,
      })
    } else {
      await investmentsStore.addTransaction(payload)
    }
    formModalOpen.value = false
    fetchHistory()
  } catch {
    // erro na store
  } finally {
    actionLoading.value = false
  }
}

async function confirmDeleteTx() {
  if (!holding.value || !txToDelete.value) return
  actionLoading.value = true
  const id = holding.value.id
  try {
    await investmentsStore.deleteTransaction(id, txToDelete.value.id)
    txToDelete.value = null
    if (!investmentsStore.holdings.some((h) => h.id === id)) router.push({ name: 'investimentos' })
    else fetchHistory()
  } catch {
    // erro na store
  } finally {
    actionLoading.value = false
  }
}

async function confirmDeletePosition() {
  if (!holding.value) return
  actionLoading.value = true
  try {
    await investmentsStore.deleteHolding(holding.value.id)
    router.push({ name: 'investimentos' })
  } catch {
    // erro na store
  } finally {
    actionLoading.value = false
  }
}
</script>

<template>
  <div class="inv-detail-page">
    <router-link :to="{ name: 'investimentos' }" class="back-link">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      Investimentos
    </router-link>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>A carregar...</p>
    </div>

    <div v-else-if="!holding" class="empty-card">
      <p class="empty-text">Posição não encontrada</p>
      <router-link :to="{ name: 'investimentos' }" class="btn-confirm">Voltar</router-link>
    </div>

    <template v-else>
      <div class="detail-grid">
        <!-- Hero -->
        <div class="hero-card">
          <div class="hero-top">
            <InstrumentLogo :symbol="holding.symbol" :name="holding.name" :type="holding.type" :domain="holding.logoDomain" :size="44" />
            <div class="hero-head">
              <h1 class="hero-name">{{ holding.name }}</h1>
              <span class="hero-cat">{{ INSTRUMENT_TYPE_LABELS[holding.type] }}</span>
            </div>
            <button type="button" class="action-btn action-btn--danger" title="Eliminar posição" @click="positionDeleteOpen = true">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
            </button>
          </div>

          <div class="hero-value-row">
            <span class="hero-value">{{ fmtEur(currentValue) }}</span>
            <span class="hero-change" :class="{ negative: change < 0 }">{{ fmtSignedEur(change) }}</span>
            <span v-if="changePct !== null" class="hero-pct" :class="{ negative: change < 0 }">{{ fmtPct(changePct) }}</span>
          </div>
          <p class="hero-date">Hoje</p>

          <div class="hero-chart">
            <div v-if="historyLoading" class="hero-chart-loading"><div class="spinner"></div></div>
            <AssetsChart v-else-if="showChart" :points="historyPoints" currency="EUR" :year-ticks="chartYearTicks" cost-label="Investido" />
            <div v-else class="chart-placeholder">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
              <p>O gráfico aparece quando houver histórico de cotações suficiente</p>
            </div>
          </div>
        </div>

        <!-- Side -->
        <div class="side-col">
          <div class="info-card">
            <h2 class="info-title">Insights</h2>
            <div class="info-row">
              <span class="info-label">Custo total</span>
              <span class="info-value">{{ fmtEur(holding.investedEur) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Quantidade</span>
              <span class="info-value">{{ fmtQty(holding.quantity) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Peso na carteira</span>
              <span class="info-value">{{ weight !== null ? weight.toFixed(2).replace('.', ',') + '%' : '—' }}</span>
            </div>
          </div>

          <div class="info-card">
            <h2 class="info-title">Detalhes</h2>
            <div class="info-row">
              <span class="info-label">Categoria</span>
              <span class="info-value">{{ INSTRUMENT_TYPE_LABELS[holding.type] }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Preço médio</span>
              <span class="info-value">{{ fmtPrice(holding.averageCost) }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Preço atual</span>
              <span class="info-value">{{ holding.currentPrice !== null ? fmtPrice(holding.currentPrice) : '—' }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Valor de mercado</span>
              <span class="info-value">{{ holding.currentValueEur !== null ? fmtEur(holding.currentValueEur) : '—' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Transações -->
      <div class="tx-section">
        <div class="tx-header">
          <h2 class="section-title">Transações</h2>
          <button type="button" class="btn-add" @click="openAdd">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
            Adicionar transação
          </button>
        </div>

        <div v-if="investmentsStore.error" class="global-error">{{ investmentsStore.error }}</div>

        <div class="table-wrap">
          <table class="tx-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Mercado</th>
                <th class="num">Qtd.</th>
                <th class="num">Preço</th>
                <th class="num">Total</th>
                <th class="num">Comissão</th>
                <th class="act"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in rows" :key="t.id">
                <td>{{ fmtDate(t.date) }}</td>
                <td>
                  <span class="op-tag" :class="t.operation === InvestmentOperation.Buy ? 'buy' : 'sell'">
                    {{ INVESTMENT_OPERATION_LABELS[t.operation] }}
                  </span>
                </td>
                <td class="muted">{{ holding.exchange }}</td>
                <td class="num">{{ fmtQty(t.quantity) }}</td>
                <td class="num">{{ fmtPrice(t.unitPrice) }}</td>
                <td class="num strong">{{ fmtPrice(t.quantity * t.unitPrice) }}</td>
                <td class="num">{{ t.commission ? fmtPrice(t.commission) : '—' }}</td>
                <td class="act">
                  <div class="row-actions">
                    <button type="button" class="row-btn" title="Editar" @click="openEdit(t)">
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    </button>
                    <button type="button" class="row-btn row-btn--del" title="Eliminar" @click="txToDelete = t">
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="tx-count">{{ rows.length }} {{ rows.length === 1 ? 'transação' : 'transações' }}</p>
      </div>
    </template>

    <InvestmentFormModal
      :open="formModalOpen"
      :instrument="fixedInstrument"
      :transaction="formTransaction"
      :loading="actionLoading"
      @close="formModalOpen = false"
      @submit="handleFormSubmit"
    />

    <ConfirmDeleteModal
      :open="txToDelete !== null"
      title="Eliminar transação"
      message="Tem a certeza que deseja eliminar esta transação?"
      :loading="actionLoading"
      @close="txToDelete = null"
      @confirm="confirmDeleteTx"
    />

    <ConfirmDeleteModal
      :open="positionDeleteOpen"
      title="Eliminar posição"
      :message="holding ? `Tem a certeza que deseja eliminar ${holding.symbol} e todas as suas transações?` : ''"
      :loading="actionLoading"
      @close="positionDeleteOpen = false"
      @confirm="confirmDeletePosition"
    />
  </div>
</template>

<style scoped>
.inv-detail-page {
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

.hero-chart-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 240px;
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

.tx-section {
  margin-top: 1.5rem;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 1.25rem 1.5rem 1.5rem;
}

.tx-header {
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

.tx-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.tx-table th {
  text-align: left;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.tx-table th.num {
  text-align: right;
}

.tx-table td {
  padding: 0.75rem;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  white-space: nowrap;
}

.tx-table tbody tr:last-child td {
  border-bottom: none;
}

.tx-table .num {
  text-align: right;
}

.tx-table .strong {
  font-weight: 700;
}

.tx-table .muted {
  color: var(--color-text-muted);
}

.op-tag {
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
}

.op-tag.buy {
  color: #059669;
  background: rgba(5, 150, 105, 0.12);
}

html.dark .op-tag.buy {
  color: #34d399;
}

.op-tag.sell {
  color: #dc2626;
  background: rgba(220, 38, 38, 0.12);
}

html.dark .op-tag.sell {
  color: #f87171;
}

.tx-table .act {
  width: 64px;
  text-align: right;
}

.row-actions {
  display: flex;
  gap: 0.2rem;
  justify-content: flex-end;
}

.row-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid transparent;
  border-radius: 6px;
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

.tx-count {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0.875rem 0 0;
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
  flex-shrink: 0;
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
