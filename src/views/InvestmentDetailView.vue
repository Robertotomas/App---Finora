<script setup lang="ts">
import { PT_GROUPING } from '@/utils/numberFormat'
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useInvestmentsStore } from '@/stores/investments'
import InvestmentFormModal from '@/components/InvestmentFormModal.vue'
import InstrumentLogo from '@/components/InstrumentLogo.vue'
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiCard from '@/components/ui/UiCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ActionMenu from '@/components/ui/ActionMenu.vue'
import type { ActionMenuItem } from '@/components/ui/ActionMenu.vue'
import { useToast } from '@/composables/useToast'
import ValueHeroCard from '@/components/charts/ValueHeroCard.vue'
import HeroStat from '@/components/charts/HeroStat.vue'
import type { AssetChartPoint } from '@/components/charts/AssetsChart.vue'
import { investmentsApi } from '@/api/investments'
import { holdingWeight } from '@/utils/portfolioAllocation'
import {
  INSTRUMENT_TYPE_LABELS,
  InvestmentOperation,
  INVESTMENT_OPERATION_LABELS,
} from '@/types/investment'
import type { InvestmentTransaction, AddTransactionRequest } from '@/types/investment'

const route = useRoute()
const router = useRouter()
const investmentsStore = useInvestmentsStore()
const toast = useToast()

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
const weight = computed(() =>
  holding.value && holding.value.quantity > 1e-9 ? holdingWeight(holding.value, investmentsStore.totalCurrentValueEur) : null,
)
const hasRealized = computed(() => (holding.value?.realizedCostEur ?? 0) > 0)
const realizedPct = computed(() => {
  const h = holding.value
  return h && h.realizedCostEur > 0 ? (h.realizedGainEur / h.realizedCostEur) * 100 : null
})
const hasDividends = computed(() => (holding.value?.dividendsEur ?? 0) > 0)

const rows = computed(() =>
  [...(holding.value?.transactions ?? [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
)

/* ── Formatação ── */
function fmtEur(v: number): string {
  return new Intl.NumberFormat('pt-PT', { ...PT_GROUPING, style: 'currency', currency: 'EUR' }).format(v)
}
function fmtSignedEur(v: number): string {
  return `${v >= 0 ? '+' : '−'}${fmtEur(Math.abs(v))}`
}
function fmtPct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2).replace('.', ',')}%`
}
function signClass(v: number): string {
  return v >= 0 ? 'ui-amount--pos' : 'ui-amount--neg'
}
function fmtPrice(v: number): string {
  return new Intl.NumberFormat('pt-PT', { ...PT_GROUPING, style: 'currency', currency: holding.value?.currency || 'EUR' }).format(v)
}
function fmtQty(v: number): string {
  return new Intl.NumberFormat('pt-PT', { ...PT_GROUPING, maximumFractionDigits: 6 }).format(v)
}
function fmtDate(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
}

const subtitle = computed(() => {
  const h = holding.value
  if (!h) return ''
  return [h.providerSymbol || h.symbol, h.exchange, INSTRUMENT_TYPE_LABELS[h.type]].filter(Boolean).join(' · ')
})

const positionMenu = computed<ActionMenuItem[]>(() => [
  { label: 'Eliminar posição', danger: true, onSelect: () => (positionDeleteOpen.value = true) },
])

function txMenu(t: InvestmentTransaction): ActionMenuItem[] {
  return [
    { label: 'Editar', onSelect: () => openEdit(t) },
    { label: 'Eliminar', danger: true, onSelect: () => (txToDelete.value = t) },
  ]
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
    const editing = !!formTransaction.value
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
    toast.success(editing ? 'Transação atualizada' : 'Transação adicionada')
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
    toast.success('Transação eliminada')
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
    toast.success('Posição eliminada')
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
    <template v-if="loading || !holding">
      <router-link :to="{ name: 'investimentos' }" class="back-link back-link--standalone">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
        Voltar
      </router-link>

      <PageSkeleton v-if="loading" variant="hero" />

      <UiCard v-else>
        <EmptyState title="Posição não encontrada" description="Esta posição pode ter sido eliminada.">
          <UiButton variant="secondary" @click="router.push({ name: 'investimentos' })">Voltar aos investimentos</UiButton>
        </EmptyState>
      </UiCard>
    </template>

    <template v-else>
      <PageHeader :title="holding.name" :subtitle="subtitle">
        <template #back>
          <router-link :to="{ name: 'investimentos' }" class="back-link">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
            Voltar
          </router-link>
        </template>
        <template #actions>
          <ActionMenu :items="positionMenu" aria-label="Ações da posição" />
          <UiButton @click="openAdd">
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
            </template>
            Adicionar transação
          </UiButton>
        </template>
      </PageHeader>

      <div v-if="investmentsStore.error" class="global-error" role="alert">{{ investmentsStore.error }}</div>

      <div class="detail-grid">
        <!-- Hero -->
        <ValueHeroCard
          :points="historyPoints"
          :current-value="currentValue"
          :current-cost="holding.investedEur"
          cost-label="Investido"
          period-label="desde o início"
          :year-ticks="chartYearTicks"
          :loading="historyLoading"
        >
          <template #leading>
            <InstrumentLogo :symbol="holding.symbol" :name="holding.name" :type="holding.type" :domain="holding.logoDomain" :size="44" />
          </template>
          <template #empty>
            <EmptyState
              compact
              title="Sem gráfico ainda"
              description="O gráfico aparece quando houver histórico de cotações suficiente."
            >
              <template #icon>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
              </template>
            </EmptyState>
          </template>
          <template #footer>
            <HeroStat label="Investido" :value="fmtEur(holding.investedEur)" />
            <HeroStat label="Quantidade" :value="fmtQty(holding.quantity)" />
            <HeroStat label="Preço médio" :value="fmtPrice(holding.averageCost)" />
          </template>
        </ValueHeroCard>

        <!-- Side -->
        <div class="side-col">
          <UiCard title="Insights">
            <dl class="dl">
              <div class="dl-row">
                <dt>Custo total</dt>
                <dd>{{ fmtEur(holding.investedEur) }}</dd>
              </div>
              <div class="dl-row">
                <dt>Quantidade</dt>
                <dd>{{ fmtQty(holding.quantity) }}</dd>
              </div>
              <div class="dl-row">
                <dt>Peso na carteira</dt>
                <dd>{{ weight !== null ? weight.toFixed(2).replace('.', ',') + '%' : '—' }}</dd>
              </div>
              <div v-if="holding.returnEur !== null && holding.quantity > 1e-9" class="dl-row">
                <dt>Não realizado</dt>
                <dd><span class="ui-amount" :class="signClass(holding.returnEur)">{{ fmtSignedEur(holding.returnEur) }}</span></dd>
              </div>
              <div v-if="hasRealized" class="dl-row" title="Receita líquida das vendas menos o custo médio das unidades vendidas">
                <dt>Ganho realizado</dt>
                <dd>
                  <span class="ui-amount" :class="signClass(holding.realizedGainEur)">{{ fmtSignedEur(holding.realizedGainEur) }}</span>
                  <span v-if="realizedPct !== null" class="dd-sub">{{ fmtPct(realizedPct) }}</span>
                </dd>
              </div>
              <div v-if="hasDividends" class="dl-row" title="Dividendos líquidos de retenção na fonte">
                <dt>Dividendos recebidos</dt>
                <dd><span class="ui-amount ui-amount--pos">{{ fmtEur(holding.dividendsEur) }}</span></dd>
              </div>
              <div v-if="(hasRealized || hasDividends) && holding.totalReturnEur !== null" class="dl-row" title="Não realizado + ganho realizado + dividendos">
                <dt>Retorno total</dt>
                <dd>
                  <span class="ui-amount" :class="signClass(holding.totalReturnEur)">{{ fmtSignedEur(holding.totalReturnEur) }}</span>
                  <span v-if="holding.totalReturnPct !== null" class="dd-sub">{{ fmtPct(holding.totalReturnPct) }}</span>
                </dd>
              </div>
            </dl>
          </UiCard>

          <UiCard title="Detalhes">
            <dl class="dl">
              <div class="dl-row">
                <dt>Categoria</dt>
                <dd>{{ INSTRUMENT_TYPE_LABELS[holding.type] }}</dd>
              </div>
              <div class="dl-row">
                <dt>Preço médio</dt>
                <dd>{{ fmtPrice(holding.averageCost) }}</dd>
              </div>
              <div class="dl-row">
                <dt>Preço atual</dt>
                <dd>{{ holding.currentPrice !== null ? fmtPrice(holding.currentPrice) : '—' }}</dd>
              </div>
              <div class="dl-row">
                <dt>Valor de mercado</dt>
                <dd>{{ holding.currentValueEur !== null ? fmtEur(holding.currentValueEur) : '—' }}</dd>
              </div>
            </dl>
          </UiCard>
        </div>
      </div>

      <!-- Transações -->
      <UiCard
        class="tx-card"
        flush
        title="Transações"
        :subtitle="`${rows.length} ${rows.length === 1 ? 'transação' : 'transações'}`"
      >
        <EmptyState v-if="rows.length === 0" compact title="Sem transações" description="Adicione uma compra ou venda desta posição." />
        <div v-else class="ui-table-wrap">
          <table class="ui-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Mercado</th>
                <th class="num">Qtd.</th>
                <th class="num">Preço</th>
                <th class="num">Total</th>
                <th class="num">Comissão</th>
                <th class="col-act"><span class="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="t in rows" :key="t.id">
                <td class="nowrap">{{ fmtDate(t.date) }}</td>
                <td>
                  <span class="ui-badge" :class="t.operation === InvestmentOperation.Buy ? 'ui-badge--success' : 'ui-badge--danger'">
                    {{ INVESTMENT_OPERATION_LABELS[t.operation] }}
                  </span>
                </td>
                <td class="muted">{{ holding.exchange }}</td>
                <td class="num">{{ fmtQty(t.quantity) }}</td>
                <td class="num">{{ fmtPrice(t.unitPrice) }}</td>
                <td class="num"><span class="ui-amount">{{ fmtPrice(t.quantity * t.unitPrice) }}</span></td>
                <td class="num" :class="{ muted: !t.commission }">{{ t.commission ? fmtPrice(t.commission) : '—' }}</td>
                <td class="col-act">
                  <ActionMenu :items="txMenu(t)" aria-label="Ações da transação" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UiCard>
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
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 0 0 var(--space-12);
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-muted);
  text-decoration: none;
  transition: color var(--transition-fast);
}

.back-link:hover {
  color: var(--color-text-strong);
}

.back-link--standalone {
  margin-bottom: var(--space-5);
}

.global-error {
  margin-bottom: var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-danger-soft);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
  font-size: var(--text-sm);
}

.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.8fr) minmax(0, 1fr);
  gap: var(--space-5);
  align-items: start;
}

/* ── Insights / Detalhes ── */
.side-col {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.dl {
  margin: 0;
}

.dl-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
  padding: 10px 0;
}

.dl-row:first-child {
  padding-top: 0;
}

.dl-row:last-child {
  padding-bottom: 0;
}

.dl-row + .dl-row {
  border-top: 1px solid var(--color-border-subtle);
}

.dl dt {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.dl dd {
  margin: 0;
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.dd-sub {
  margin-left: var(--space-2);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-text-muted);
}

/* ── Transações ── */
.tx-card {
  margin-top: var(--space-6);
}

.num,
.nowrap {
  white-space: nowrap;
}

.muted {
  color: var(--color-text-muted);
}

.col-act {
  width: 48px;
  text-align: right;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 760px) {
  .detail-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

</style>
