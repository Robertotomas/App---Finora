<script setup lang="ts">
import PageSkeleton from '@/components/PageSkeleton.vue'
import { PT_GROUPING } from '@/utils/numberFormat'
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useInvestmentsStore } from '@/stores/investments'
import { useHouseholdStore } from '@/stores/household'
import { useSubscriptionStore } from '@/stores/subscription'
import { useAccountsStore } from '@/stores/accounts'
import InvestmentFormModal from '@/components/InvestmentFormModal.vue'
import ImportStatementModal from '@/components/ImportStatementModal.vue'
import DepositFormModal from '@/components/DepositFormModal.vue'
import InvestmentAddChooser from '@/components/InvestmentAddChooser.vue'
import type { InvestmentAddKind } from '@/components/InvestmentAddChooser.vue'
import DividendFormModal from '@/components/DividendFormModal.vue'
import BrokerFxFeeModal from '@/components/BrokerFxFeeModal.vue'
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue'
import InstrumentLogo from '@/components/InstrumentLogo.vue'
import PlanUpsellCard from '@/components/PlanUpsellCard.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UiCard from '@/components/ui/UiCard.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import FilterChips from '@/components/ui/FilterChips.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ActionMenu from '@/components/ui/ActionMenu.vue'
import type { ActionMenuItem } from '@/components/ui/ActionMenu.vue'
import { useToast } from '@/composables/useToast'
import ValueHeroCard from '@/components/charts/ValueHeroCard.vue'
import HeroStat from '@/components/charts/HeroStat.vue'
import CategoryDoughnut from '@/components/charts/CategoryDoughnut.vue'
import type { DoughnutItem } from '@/components/charts/CategoryDoughnut.vue'
import { allocationSlices, holdingWeight } from '@/utils/portfolioAllocation'
import type { AllocationGrouping } from '@/utils/portfolioAllocation'
import { sortHoldings } from '@/utils/holdingSort'
import type { HoldingSortKey, SortDir } from '@/utils/holdingSort'
import type { AssetChartPoint } from '@/components/charts/AssetsChart.vue'
import { investmentsApi } from '@/api/investments'
import { INSTRUMENT_TYPE_LABELS } from '@/types/investment'
import type {
  InvestmentHolding,
  AddTransactionRequest,
  AddDepositRequest,
  InvestmentDepositItem,
  InvestmentDividendItem,
  SaveDividendRequest,
} from '@/types/investment'

const route = useRoute()
const router = useRouter()
const investmentsStore = useInvestmentsStore()
const householdStore = useHouseholdStore()
const subscriptionStore = useSubscriptionStore()
const accountsStore = useAccountsStore()
const toast = useToast()

const formModalOpen = ref(false)
const importModalOpen = ref(false)
const depositModalOpen = ref(false)
const depositLoading = ref(false)
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
  const count = selectedIds.value.length
  try {
    for (const id of [...selectedIds.value]) {
      await investmentsStore.deleteHolding(id)
    }
    selectedIds.value = []
    toast.success(count === 1 ? 'Posição eliminada' : `${count} posições eliminadas`)
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
      investmentsStore.fetchDeposits()
      investmentsStore.fetchDividends() // tolerante: falha → "sem dividendos", sem banner
      investmentsStore.fetchSettings() // tolerante: falha → taxa 0
      accountsStore.fetchAccounts().catch(() => {}) // para o dropdown de débito do depósito
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
const periodOptions = invPeriods.map((p) => ({ value: p, label: p }))

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

const chartYearTicks = computed(() => {
  const pts = historyPoints.value
  if (pts.length < 2) return false
  const span =
    (new Date(pts[pts.length - 1].date + 'T00:00:00').getTime() - new Date(pts[0].date + 'T00:00:00').getTime()) / DAY
  // > ~18 meses: comprime os anos antigos (anos à esquerda + meses do ano atual) antes de os
  // meses ficarem apertados na vista "Tudo". O 5A (~1826 dias) está sempre acima deste limite.
  return span > 540
})

/* Texto do período na linha da variação do hero. */
const PERIOD_TEXT: Record<InvPeriod, string> = {
  YTD: 'este ano',
  '3M': 'em 3 meses',
  '6M': 'em 6 meses',
  '1A': 'em 1 ano',
  '5A': 'em 5 anos',
  Tudo: 'desde o início',
}
const periodLabel = computed(() => PERIOD_TEXT[period.value])

/* ── Totais ── */
const totalValue = computed(() => investmentsStore.totalCurrentValueEur)
const totalInvested = computed(() => investmentsStore.totalInvestedEur)

const lastUpdate = computed(() => {
  const dates = investmentsStore.holdings.map((h) => h.priceAsOf).filter((d): d is string => !!d)
  if (dates.length === 0) return null
  return dates.sort().at(-1) ?? null
})

/* ── Ordenação da tabela (clique no cabeçalho; por defeito Valor desc) ── */
const sortKey = ref<HoldingSortKey>('value')
const sortDir = ref<SortDir>('desc')
function toggleSort(key: HoldingSortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortKey.value = key
    sortDir.value = key === 'name' ? 'asc' : 'desc'
  }
}
function ariaSort(key: HoldingSortKey): 'ascending' | 'descending' | 'none' {
  if (sortKey.value !== key) return 'none'
  return sortDir.value === 'asc' ? 'ascending' : 'descending'
}

interface PositionColumn {
  key: HoldingSortKey | null
  label: string
  cls: string
  title?: string
}
/**
 * Rótulo da coluna de variação diária: "Hoje" só se as cotações forem de hoje; senão a data do
 * último dia de negociação (ex.: "06/11" ao fim de semana). Data local da cotação mais recente.
 */
function localYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const dayColumnLabel = computed(() => {
  const iso = lastUpdate.value
  if (!iso) return 'Dia'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Dia'
  if (localYmd(d) === localYmd(new Date())) return 'Hoje'
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
})

const positionColumns = computed<PositionColumn[]>(() => [
  { key: 'name', label: 'Ativo', cls: '' },
  { key: 'quantity', label: 'Qtd.', cls: 'num col-qty' },
  { key: null, label: 'Preço', cls: 'num col-price' },
  { key: 'value', label: 'Valor', cls: 'num' },
  { key: 'return', label: 'Retorno', cls: 'num', title: 'Retorno total: não realizado + ganhos realizados + dividendos' },
  { key: 'returnPct', label: '% Retorno', cls: 'num', title: 'Retorno total em % do total investido em compras' },
  { key: 'weight', label: 'Peso', cls: 'num col-weight', title: 'Peso na carteira (valor de mercado)' },
  {
    key: 'day',
    label: dayColumnLabel.value,
    cls: 'num col-day',
    title: dayColumnLabel.value === 'Hoje'
      ? 'Variação de hoje face ao fecho anterior'
      : `Variação no último dia de negociação (${dayColumnLabel.value}) face ao fecho anterior`,
  },
])
const COLSPAN = 8 + 2 // colunas + seleção + chevron

const sortedHoldings = computed(() => sortHoldings(investmentsStore.activeHoldings, sortKey.value, sortDir.value))
// Posições fechadas/negativas (quantidade ≤ 0) — mostradas numa secção esbatida, para gerir/apagar.
// Só o nome e o retorno fazem sentido nas fechadas (sem valor/peso/variação); nos outros casos, por nome.
const closedHoldings = computed(() => {
  const closed = investmentsStore.holdings.filter((h) => h.quantity <= 1e-9)
  const byReturn = sortKey.value === 'name' || sortKey.value === 'return' || sortKey.value === 'returnPct'
  return sortHoldings(closed, byReturn ? sortKey.value : 'name', byReturn ? sortDir.value : 'asc')
})

/** Peso (%) de uma posição ativa na carteira — mesma fórmula da página de detalhe. */
function weightOf(h: InvestmentHolding): number | null {
  return holdingWeight(h, totalValue.value)
}

/* ── Distribuição da carteira ── */
const allocationGrouping = ref<AllocationGrouping>('asset')
const allocationOptions: { value: AllocationGrouping; label: string }[] = [
  { value: 'asset', label: 'Ativo' },
  { value: 'type', label: 'Tipo' },
  { value: 'currency', label: 'Moeda' },
]
const allocationItems = computed<DoughnutItem[]>(() =>
  allocationSlices(investmentsStore.holdings, allocationGrouping.value).map((sl, i) => ({
    category: i,
    categoryName: sl.label,
    amount: sl.value,
    percentage: sl.percentage,
  })),
)

/* ── Retorno: realizados + dividendos ── */
const hasSales = computed(() => investmentsStore.holdings.some((h) => h.realizedCostEur > 0))
const showTotalReturn = computed(() => hasSales.value || investmentsStore.dividendsTotalNetEur > 0)
const displayedHoldings = computed(() => [...sortedHoldings.value, ...closedHoldings.value])

/* ── Chips de vista: Todos / Ativos / Fechadas / Depósitos (como nos objetivos) ── */
type InvTab = 'all' | 'active' | 'closed' | 'deposits' | 'dividends'
const tab = ref<InvTab>(
  (['active', 'closed', 'deposits', 'dividends'].includes(String(route.query.tab)) ? route.query.tab : 'all') as InvTab,
)
function selectTab(t: InvTab) {
  tab.value = t
  router.replace({ query: { ...route.query, tab: t === 'all' ? undefined : t } })
}
const tabOptions = computed(() => [
  { value: 'all' as InvTab, label: 'Todos', count: displayedHoldings.value.length },
  { value: 'active' as InvTab, label: 'Ativos', count: sortedHoldings.value.length },
  { value: 'closed' as InvTab, label: 'Fechadas', count: closedHoldings.value.length },
  { value: 'deposits' as InvTab, label: 'Depósitos', count: investmentsStore.deposits.length },
  { value: 'dividends' as InvTab, label: 'Dividendos', count: investmentsStore.dividends.length },
])
const isListTab = computed(() => tab.value !== 'deposits' && tab.value !== 'dividends')
const visibleActive = computed(() => (tab.value === 'all' || tab.value === 'active' ? sortedHoldings.value : []))
const visibleClosed = computed(() => (tab.value === 'all' || tab.value === 'closed' ? closedHoldings.value : []))

/* ── Depósitos (gestão) ── */
const deposits = computed(() => investmentsStore.deposits)
const editingDeposit = ref<InvestmentDepositItem | null>(null)
const depositDeleteId = ref<string | null>(null)
const depositActionLoading = ref(false)
const accountName = (id?: string | null) => accountsStore.accounts.find((a) => a.id === id)?.name ?? null

function openAddDeposit() {
  editingDeposit.value = null
  depositModalOpen.value = true
}
function openEditDeposit(d: InvestmentDepositItem) {
  editingDeposit.value = d
  depositModalOpen.value = true
}
async function confirmDeleteDeposit() {
  if (!depositDeleteId.value) return
  depositActionLoading.value = true
  try {
    await investmentsStore.deleteDeposit(depositDeleteId.value)
    await accountsStore.fetchAccounts().catch(() => {})
    depositDeleteId.value = null
    toast.success('Depósito eliminado')
  } catch {
    // erro na store
  } finally {
    depositActionLoading.value = false
  }
}

function depositMenu(d: InvestmentDepositItem): ActionMenuItem[] {
  return [
    { label: 'Editar', onSelect: () => openEditDeposit(d) },
    { label: 'Eliminar', danger: true, onSelect: () => (depositDeleteId.value = d.id) },
  ]
}

/* ── Dividendos (gestão) ── */
const dividends = computed(() => investmentsStore.dividends)
const dividendModalOpen = ref(false)
const dividendLoading = ref(false)
const editingDividend = ref<InvestmentDividendItem | null>(null)
const dividendDeleteId = ref<string | null>(null)
const dividendActionLoading = ref(false)

function holdingOf(d: InvestmentDividendItem): InvestmentHolding | null {
  return investmentsStore.holdings.find((h) => h.id === d.holdingId) ?? null
}

/* ── Taxa de conversão da corretora ── */
const fxFeeModalOpen = ref(false)
const fxFeeSaving = ref(false)

const heroMenu = computed<ActionMenuItem[]>(() => [
  { label: 'Taxa de conversão da corretora…', onSelect: () => (fxFeeModalOpen.value = true) },
])

// Só se mostra a taxa no rodapé quando se aplica (> 0 e há posições ativas noutra moeda).
const showFxFee = computed(
  () =>
    investmentsStore.brokerFxFeePercent > 0 &&
    investmentsStore.activeHoldings.some((h) => (h.currency || 'EUR').toUpperCase() !== 'EUR'),
)
const fxFeeLabel = computed(
  () => `${investmentsStore.brokerFxFeePercent.toLocaleString('pt-PT', { maximumFractionDigits: 4 })}%`,
)

async function handleFxFeeSubmit(percent: number) {
  fxFeeSaving.value = true
  try {
    await investmentsStore.saveSettings(percent)
    fxFeeModalOpen.value = false
    toast.success('Taxa atualizada')
    reloadHistory()
  } catch (e) {
    toast.error(errorMessage(e, 'Não foi possível guardar a taxa. Tente novamente.'))
  } finally {
    fxFeeSaving.value = false
  }
}

function errorMessage(e: unknown, fallback: string): string {
  const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message
  return msg || fallback
}

function openAddDividend() {
  editingDividend.value = null
  dividendModalOpen.value = true
}
function openEditDividend(d: InvestmentDividendItem) {
  editingDividend.value = d
  dividendModalOpen.value = true
}
function closeDividendModal() {
  dividendModalOpen.value = false
  editingDividend.value = null
}

async function handleDividendSubmit(payload: SaveDividendRequest) {
  dividendLoading.value = true
  try {
    const editing = !!editingDividend.value
    if (editingDividend.value) await investmentsStore.updateDividend(editingDividend.value.id, payload)
    else await investmentsStore.addDividend(payload)
    toast.success(editing ? 'Dividendo atualizado' : 'Dividendo adicionado')
    closeDividendModal()
  } catch (e) {
    toast.error(errorMessage(e, 'Não foi possível guardar o dividendo. Tente novamente.'))
  } finally {
    dividendLoading.value = false
  }
}

async function confirmDeleteDividend() {
  if (!dividendDeleteId.value) return
  dividendActionLoading.value = true
  try {
    await investmentsStore.deleteDividend(dividendDeleteId.value)
    dividendDeleteId.value = null
    toast.success('Dividendo eliminado')
  } catch (e) {
    toast.error(errorMessage(e, 'Não foi possível eliminar o dividendo. Tente novamente.'))
  } finally {
    dividendActionLoading.value = false
  }
}

function dividendMenu(d: InvestmentDividendItem): ActionMenuItem[] {
  return [
    { label: 'Editar', onSelect: () => openEditDividend(d) },
    { label: 'Eliminar', danger: true, onSelect: () => (dividendDeleteId.value = d.id) },
  ]
}

function formatEur(v: number): string {
  return new Intl.NumberFormat('pt-PT', { ...PT_GROUPING, style: 'currency', currency: 'EUR' }).format(v)
}
function formatPrice(v: number, currency: string): string {
  return new Intl.NumberFormat('pt-PT', { ...PT_GROUPING, style: 'currency', currency: currency || 'EUR' }).format(v)
}
function formatQty(v: number): string {
  return new Intl.NumberFormat('pt-PT', { ...PT_GROUPING, maximumFractionDigits: 6 }).format(v)
}
function formatSignedEur(v: number): string {
  return `${v >= 0 ? '+' : '−'}${formatEur(Math.abs(v))}`
}
function formatPct(pct: number): string {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2).replace('.', ',')}%`
}
function formatWeight(pct: number | null): string {
  return pct === null ? '—' : `${pct.toFixed(2).replace('.', ',')}%`
}
function signClass(v: number): string {
  return v >= 0 ? 'ui-amount--pos' : 'ui-amount--neg'
}
/** Dica do retorno total de uma posição (decomposição). */
function returnHint(h: InvestmentHolding): string {
  const parts: string[] = []
  if (h.returnEur !== null && h.quantity > 1e-9) parts.push(`Não realizado ${formatSignedEur(h.returnEur)}`)
  if (h.realizedCostEur > 0) parts.push(`Realizado ${formatSignedEur(h.realizedGainEur)}`)
  if (h.dividendsEur > 0) parts.push(`Dividendos ${formatSignedEur(h.dividendsEur)}`)
  return parts.join(' · ')
}
function formatDate(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/* ── Fluxo ── */
/** "Adicionar" abre primeiro a escolha (compra/venda, depósito, dividendo ou importar). */
const addChooserOpen = ref(false)
function openAdd() {
  investmentsStore.clearError()
  addChooserOpen.value = true
}
function openAddTrade() {
  investmentsStore.clearError()
  formModalOpen.value = true
}
function onAddChoose(kind: InvestmentAddKind) {
  addChooserOpen.value = false
  if (kind === 'trade') openAddTrade()
  else if (kind === 'deposit') openAddDeposit()
  else if (kind === 'dividend') openAddDividend()
  else openImport()
}

function openPosition(h: InvestmentHolding) {
  router.push({ name: 'investimento-detalhe', params: { id: h.id } })
}

async function handleFormSubmit(payload: AddTransactionRequest) {
  actionLoading.value = true
  try {
    const h = await investmentsStore.addTransaction(payload)
    formModalOpen.value = false
    toast.success('Transação adicionada')
    reloadHistory()
    if (h) router.push({ name: 'investimento-detalhe', params: { id: h.id } })
  } catch {
    // erro na store
  } finally {
    actionLoading.value = false
  }
}

/**
 * Botão "Atualizar" escondido: o backend já atualiza as cotações todos os dias (~22:40 UTC,
 * MarketDataRefreshHostedService) e ao arrancar. Pôr a true para voltar a mostrar (lógica intacta).
 */
const SHOW_REFRESH_BUTTON = false

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
    toast.success('Cotações atualizadas')
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
  toast.success('Extrato importado')
  await investmentsStore.fetchHoldings()
  investmentsStore.fetchDeposits()
  investmentsStore.fetchDividends()
  reloadHistory()
}

async function handleDepositSubmit(payload: AddDepositRequest) {
  depositLoading.value = true
  try {
    const editing = !!editingDeposit.value
    if (editingDeposit.value) await investmentsStore.updateDeposit(editingDeposit.value.id, payload)
    else await investmentsStore.addDeposit(payload)
    toast.success(editing ? 'Depósito atualizado' : 'Depósito adicionado')
    // O saldo de contas pode ter mudado (débito/reversão).
    await accountsStore.fetchAccounts().catch(() => {})
    depositModalOpen.value = false
    editingDeposit.value = null
  } catch {
    // erro na store
  } finally {
    depositLoading.value = false
  }
}
</script>

<template>
  <div class="investments-page">
    <div v-if="!householdStore.household && householdStore.loading" class="skeleton-state"><PageSkeleton variant="hero" /></div>

    <template v-else>
      <PageHeader title="Investimentos">
        <template v-if="canAccess && investmentsStore.holdings.length > 0" #actions>
          <UiButton @click="openAdd">
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
            </template>
            Adicionar
          </UiButton>
        </template>
      </PageHeader>

      <div v-if="initialLoading" class="skeleton-state"><PageSkeleton variant="hero" /></div>

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
        <div v-if="investmentsStore.error" class="global-error" role="alert">{{ investmentsStore.error }}</div>

        <UiCard v-if="investmentsStore.holdings.length === 0">
          <EmptyState
            title="Ainda não tem investimentos"
            description="Adicione a sua primeira transação (compra de uma ação ou ETF) ou importe o extrato da sua corretora."
          >
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
            </template>
            <UiButton @click="openAdd">
              <template #icon>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
              </template>
              Adicionar transação
            </UiButton>
          </EmptyState>
        </UiCard>

        <template v-else>
          <!-- Hero: valor da carteira + gráfico -->
          <ValueHeroCard
            class="hero-card"
            :points="historyPoints"
            :current-value="totalValue"
            :current-cost="totalInvested"
            cost-label="Investido"
            :period-label="periodLabel"
            :year-ticks="chartYearTicks"
            :loading="historyLoading"
          >
            <template #actions>
              <SegmentedControl
                :model-value="period"
                :options="periodOptions"
                size="sm"
                aria-label="Período do gráfico"
                @update:model-value="selectPeriod"
              />
              <!-- Botão "Atualizar" desativado (SHOW_REFRESH_BUTTON): as cotações já atualizam sozinhas todos os dias. -->
              <UiButton
                v-if="SHOW_REFRESH_BUTTON"
                variant="secondary"
                size="sm"
                :loading="refreshing"
                :disabled="refreshDisabled"
                :title="cooldownMs > 0 ? 'Aguarde uns minutos antes de atualizar de novo' : 'Atualizar cotações'"
                @click="handleRefresh"
              >
                <template #icon>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                </template>
                {{ refreshing ? 'A atualizar...' : 'Atualizar' }}
              </UiButton>
              <ActionMenu :items="heroMenu" aria-label="Definições da carteira" />
            </template>

            <template #footer>
              <HeroStat label="Investido" :value="formatEur(totalInvested)" />
              <HeroStat label="Depósitos">
                <span>{{ investmentsStore.depositsTotalEur > 0 ? formatEur(investmentsStore.depositsTotalEur) : '—' }}</span>
              </HeroStat>
              <HeroStat
                v-if="investmentsStore.uninvestedCashEur > 0"
                label="Fundos livres"
                :value="formatEur(investmentsStore.uninvestedCashEur)"
                hint="Dinheiro parado na corretora: depósitos − compras + vendas + dividendos + juros e taxas importados. Conta para o Património Total."
              />
              <HeroStat
                v-if="hasSales"
                label="Ganhos realizados"
                hint="Resultado das vendas: receita líquida menos o custo médio das unidades vendidas."
              >
                <span class="ui-amount" :class="signClass(investmentsStore.totalRealizedGainEur)">
                  {{ formatSignedEur(investmentsStore.totalRealizedGainEur) }}
                </span>
              </HeroStat>
              <HeroStat
                v-if="investmentsStore.dividendsTotalNetEur > 0"
                label="Dividendos recebidos"
                hint="Dividendos líquidos de retenção na fonte, em EUR."
                :value="formatEur(investmentsStore.dividendsTotalNetEur)"
              />
              <HeroStat
                v-if="showTotalReturn"
                label="Retorno total"
                hint="Não realizado (valor − custo) + ganhos realizados + dividendos."
              >
                <span class="ui-amount" :class="signClass(investmentsStore.totalReturnEur)">
                  {{ formatSignedEur(investmentsStore.totalReturnEur) }}
                </span>
              </HeroStat>
              <HeroStat
                v-if="showFxFee"
                label="Conversão"
                :value="fxFeeLabel"
                :hint="`Valores em moeda estrangeira líquidos de ${fxFeeLabel} de conversão da corretora (o que receberia em euros ao vender).`"
              />
              <HeroStat v-if="lastUpdate" label="Cotações de" :value="formatDate(lastUpdate)" />
            </template>
          </ValueHeroCard>

          <!-- Distribuição da carteira -->
          <UiCard v-if="allocationItems.length > 0" class="alloc-card" title="Distribuição da carteira">
            <template #actions>
              <SegmentedControl
                v-model="allocationGrouping"
                :options="allocationOptions"
                size="sm"
                aria-label="Agrupar distribuição por"
              />
            </template>
            <CategoryDoughnut :items="allocationItems" color-mode="series" full-legend />
          </UiCard>

          <div class="ui-toolbar">
            <FilterChips :model-value="tab" :options="tabOptions" aria-label="Filtrar investimentos" @update:model-value="selectTab" />
            <div v-if="isListTab && selectedIds.length > 0" class="ui-toolbar-group">
              <span class="bulk-count">{{ selectedIds.length }} {{ selectedIds.length === 1 ? 'selecionada' : 'selecionadas' }}</span>
              <UiButton variant="ghost" size="sm" @click="clearSelection">Limpar</UiButton>
              <UiButton variant="danger-ghost" size="sm" @click="bulkDeleteOpen = true">
                <template #icon>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                </template>
                Eliminar
              </UiButton>
            </div>
          </div>

          <!-- Vista de Depósitos -->
          <UiCard
            v-if="tab === 'deposits'"
            flush
            title="Depósitos"
            :subtitle="`Total: ${formatEur(investmentsStore.depositsTotalEur)}`"
          >
            <template #actions>
              <UiButton variant="secondary" size="sm" @click="openAddDeposit">
                <template #icon>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
                </template>
                Adicionar
              </UiButton>
            </template>

            <EmptyState
              v-if="deposits.length === 0"
              compact
              title="Ainda não há depósitos"
              description="Adicione um depósito ou importe o extrato da sua corretora."
            >
              <template #icon>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
              </template>
            </EmptyState>

            <div v-else class="ui-table-wrap">
              <table class="ui-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Origem</th>
                    <th>Conta</th>
                    <th class="num">Montante</th>
                    <th class="col-act"><span class="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="d in deposits" :key="d.id">
                    <td class="nowrap">{{ formatDate(d.date) }}</td>
                    <td>
                      <span class="ui-badge" :class="{ 'ui-badge--brand': d.source === 'import' }">
                        {{ d.source === 'import' ? 'Importado' : 'Manual' }}
                      </span>
                    </td>
                    <td><span :class="{ muted: !accountName(d.accountId) }">{{ accountName(d.accountId) ?? '—' }}</span></td>
                    <td class="num">
                      <span class="ui-amount" :class="{ 'ui-amount--neg': d.amount < 0 }">{{ formatSignedEur(d.amount) }}</span>
                    </td>
                    <td class="col-act">
                      <ActionMenu :items="depositMenu(d)" aria-label="Ações do depósito" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UiCard>

          <!-- Vista de Dividendos -->
          <UiCard
            v-else-if="tab === 'dividends'"
            flush
            title="Dividendos"
            :subtitle="`Líquido: ${formatEur(investmentsStore.dividendsTotalNetEur)} · Retido: ${formatEur(investmentsStore.dividendsTotalTaxEur)}`"
          >
            <template #actions>
              <UiButton variant="secondary" size="sm" @click="openAddDividend">
                <template #icon>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
                </template>
                Adicionar
              </UiButton>
            </template>

            <EmptyState
              v-if="dividends.length === 0"
              compact
              title="Ainda não há dividendos"
              description="Adicione um dividendo recebido ou importe o extrato da sua corretora."
            >
              <template #icon>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M14.5 9.5c-.4-1-1.4-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1.1 0-2.1-.5-2.5-1.5"/><path d="M12 6.5V8m0 8v1.5"/></svg>
              </template>
            </EmptyState>

            <div v-else class="ui-table-wrap">
              <table class="ui-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Ativo</th>
                    <th class="num col-qty">Bruto</th>
                    <th class="num col-qty">Imposto</th>
                    <th class="num">Líquido</th>
                    <th class="col-price">Origem</th>
                    <th class="col-act"><span class="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="d in dividends" :key="d.id">
                    <td class="nowrap">{{ formatDate(d.date) }}</td>
                    <td>
                      <div class="asset-cell">
                        <InstrumentLogo
                          :symbol="holdingOf(d)?.symbol ?? d.symbol"
                          :name="holdingOf(d)?.name ?? d.symbol"
                          :type="holdingOf(d)?.type"
                          :domain="holdingOf(d)?.logoDomain"
                          :size="28"
                        />
                        <div class="asset-text">
                          <span class="asset-symbol">{{ holdingOf(d)?.providerSymbol || d.symbol || '—' }}</span>
                          <span v-if="holdingOf(d)" class="asset-name">{{ holdingOf(d)?.name }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="num col-qty">{{ formatPrice(d.amountGross, d.currency) }}</td>
                    <td class="num col-qty" :class="{ muted: !d.withholdingTax }">
                      {{ d.withholdingTax ? formatPrice(d.withholdingTax, d.currency) : '—' }}
                    </td>
                    <td class="num"><span class="ui-amount ui-amount--pos">{{ formatEur(d.netEur) }}</span></td>
                    <td class="col-price">
                      <span class="ui-badge" :class="{ 'ui-badge--brand': d.source === 'import' }">
                        {{ d.source === 'import' ? 'Importado' : 'Manual' }}
                      </span>
                    </td>
                    <td class="col-act">
                      <ActionMenu :items="dividendMenu(d)" aria-label="Ações do dividendo" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UiCard>

          <!-- Posições -->
          <UiCard v-else flush>
            <EmptyState
              v-if="visibleActive.length === 0 && visibleClosed.length === 0"
              compact
              :title="tab === 'closed' ? 'Sem posições fechadas' : 'Sem posições'"
              :description="tab === 'closed' ? 'As posições totalmente vendidas aparecem aqui.' : undefined"
            />

            <div v-else class="ui-table-wrap">
              <table class="ui-table">
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
                    <th
                      v-for="col in positionColumns"
                      :key="col.label"
                      :class="col.cls"
                      :title="col.title"
                      :aria-sort="col.key ? ariaSort(col.key) : undefined"
                    >
                      <button
                        v-if="col.key"
                        type="button"
                        class="th-sort"
                        :class="{ active: sortKey === col.key }"
                        @click="toggleSort(col.key)"
                      >
                        {{ col.label }}
                        <svg
                          class="th-sort-icon"
                          :class="{ asc: sortKey === col.key && sortDir === 'asc' }"
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.5"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          aria-hidden="true"
                        ><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                      <template v-else>{{ col.label }}</template>
                    </th>
                    <th class="col-chev"><span class="sr-only">Abrir</span></th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="h in visibleActive"
                    :key="h.id"
                    class="inv-row"
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
                            <span class="ui-badge">{{ INSTRUMENT_TYPE_LABELS[h.type] }}</span>
                          </div>
                          <span class="asset-name">{{ h.name }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="num col-qty">{{ formatQty(h.quantity) }}</td>
                    <td class="num col-price">
                      <template v-if="h.currentPrice !== null">{{ formatPrice(h.currentPrice, h.currency) }}</template>
                      <span v-else class="muted">—</span>
                    </td>
                    <td class="num">
                      <span v-if="h.currentValueEur !== null" class="ui-amount">{{ formatEur(h.currentValueEur) }}</span>
                      <span v-else class="ui-amount muted">{{ formatEur(h.investedEur) }}</span>
                    </td>
                    <td class="num" :title="returnHint(h) || undefined">
                      <span v-if="h.totalReturnEur !== null" class="ui-amount" :class="signClass(h.totalReturnEur)">
                        {{ formatSignedEur(h.totalReturnEur) }}
                      </span>
                      <span v-else class="muted">—</span>
                    </td>
                    <td class="num">
                      <span v-if="h.totalReturnPct !== null" class="ui-badge" :class="h.totalReturnPct < 0 ? 'ui-badge--danger' : 'ui-badge--success'">
                        {{ formatPct(h.totalReturnPct) }}
                      </span>
                      <span v-else class="muted">—</span>
                    </td>
                    <td class="num col-weight">{{ formatWeight(weightOf(h)) }}</td>
                    <td class="num col-day">
                      <div v-if="h.dayChangeEur !== null" class="num-stack">
                        <span class="ui-amount" :class="signClass(h.dayChangeEur)">{{ formatSignedEur(h.dayChangeEur) }}</span>
                        <span v-if="h.dayChangePct !== null" class="num-sub">{{ formatPct(h.dayChangePct) }}</span>
                      </div>
                      <span v-else class="muted">—</span>
                    </td>
                    <td class="col-chev">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
                    </td>
                  </tr>
                </tbody>

                <!-- Posições fechadas (quantidade ≤ 0) -->
                <tbody v-if="visibleClosed.length > 0">
                  <tr v-if="tab === 'all'" class="closed-sep">
                    <td :colspan="COLSPAN">Fechadas</td>
                  </tr>
                  <tr
                    v-for="h in visibleClosed"
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
                            <span class="ui-badge">{{ INSTRUMENT_TYPE_LABELS[h.type] }}</span>
                          </div>
                          <span class="asset-name">{{ h.name }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="num col-qty">{{ formatQty(h.quantity) }}</td>
                    <td class="num col-price"><span class="muted">—</span></td>
                    <td class="num"><span class="ui-badge">Fechada</span></td>
                    <td class="num" :title="returnHint(h) || undefined">
                      <span v-if="h.totalReturnEur !== null && (h.realizedCostEur > 0 || h.dividendsEur > 0)" class="ui-amount" :class="signClass(h.totalReturnEur)">
                        {{ formatSignedEur(h.totalReturnEur) }}
                      </span>
                      <span v-else class="muted">—</span>
                    </td>
                    <td class="num">
                      <span
                        v-if="h.totalReturnPct !== null && (h.realizedCostEur > 0 || h.dividendsEur > 0)"
                        class="ui-badge"
                        :class="h.totalReturnPct < 0 ? 'ui-badge--danger' : 'ui-badge--success'"
                      >
                        {{ formatPct(h.totalReturnPct) }}
                      </span>
                      <span v-else class="muted">—</span>
                    </td>
                    <td class="num col-weight"><span class="muted">—</span></td>
                    <td class="num col-day"><span class="muted">—</span></td>
                    <td class="col-chev">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UiCard>
        </template>
      </template>
    </template>

    <InvestmentFormModal
      :open="formModalOpen"
      :loading="actionLoading"
      @close="formModalOpen = false"
      @submit="handleFormSubmit"
    />

    <InvestmentAddChooser
      :open="addChooserOpen"
      :can-add-dividend="investmentsStore.holdings.length > 0"
      @close="addChooserOpen = false"
      @choose="onAddChoose"
    />

    <ImportStatementModal
      :open="importModalOpen"
      @close="importModalOpen = false"
      @done="handleImportDone"
    />

    <DepositFormModal
      :open="depositModalOpen"
      :accounts="accountsStore.accounts"
      :deposit="editingDeposit"
      :loading="depositLoading"
      @close="depositModalOpen = false; editingDeposit = null"
      @submit="handleDepositSubmit"
    />

    <BrokerFxFeeModal
      :open="fxFeeModalOpen"
      :percent="investmentsStore.brokerFxFeePercent"
      :loading="fxFeeSaving"
      @close="fxFeeModalOpen = false"
      @submit="handleFxFeeSubmit"
    />

    <DividendFormModal
      :open="dividendModalOpen"
      :holdings="investmentsStore.holdings"
      :dividend="editingDividend"
      :loading="dividendLoading"
      @close="closeDividendModal"
      @submit="handleDividendSubmit"
    />

    <ConfirmDeleteModal
      :open="dividendDeleteId !== null"
      title="Eliminar dividendo"
      message="Tem a certeza que deseja eliminar este dividendo? Deixa de contar para o retorno total."
      :loading="dividendActionLoading"
      @close="dividendDeleteId = null"
      @confirm="confirmDeleteDividend"
    />

    <ConfirmDeleteModal
      :open="depositDeleteId !== null"
      title="Eliminar depósito"
      message="Tem a certeza que deseja eliminar este depósito? Se tiver debitado uma conta, o montante é devolvido ao saldo."
      :loading="depositActionLoading"
      @close="depositDeleteId = null"
      @confirm="confirmDeleteDeposit"
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
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 0 0 var(--space-12);
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

/* ── Hero ── */
.hero-card {
  margin-bottom: var(--space-6);
}

/* ── Distribuição ── */
.alloc-card {
  margin-bottom: var(--space-6);
}

/* ── Toolbar ── */
.bulk-count {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
  margin-right: var(--space-1);
}

/* ── Tabela ── */
.inv-row {
  cursor: pointer;
}

.inv-row.row-selected {
  background: var(--color-selected);
}

.inv-row--closed td {
  opacity: 0.65;
}

.closed-sep td {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-caps);
  color: var(--color-text-muted);
  background: transparent;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

.check-col {
  width: 44px;
  padding-right: 0 !important;
}

.inv-check {
  appearance: none;
  -webkit-appearance: none;
  display: block;
  width: 16px;
  height: 16px;
  margin: 0;
  border: 1.5px solid var(--color-border-strong);
  border-radius: 4px;
  background: var(--color-surface) center / 12px 12px no-repeat;
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast);
}

.inv-check:hover {
  border-color: var(--color-text-subtle);
}

.inv-check:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.inv-check:checked,
.inv-check:indeterminate {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
}

/* ícones brancos sobre o verde primário */
.inv-check:checked {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E");
}

.inv-check:indeterminate {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='3.5' stroke-linecap='round'%3E%3Cline x1='6' y1='12' x2='18' y2='12'/%3E%3C/svg%3E");
}

.asset-cell {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.asset-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.asset-top {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.asset-symbol {
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
  white-space: nowrap;
}

.asset-name {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 240px;
}

.num,
.nowrap {
  white-space: nowrap;
}

.muted {
  color: var(--color-text-muted);
}

.th-sort {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: none;
  background: transparent;
  font: inherit;
  color: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  cursor: pointer;
  white-space: nowrap;
}

.th-sort:hover,
.th-sort.active {
  color: var(--color-text-strong);
}

.th-sort:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
  border-radius: 4px;
}

.th-sort-icon {
  opacity: 0;
  transition: transform var(--transition-fast), opacity var(--transition-fast);
}

.th-sort:hover .th-sort-icon {
  opacity: 0.5;
}

.th-sort.active .th-sort-icon {
  opacity: 1;
}

.th-sort-icon.asc {
  transform: rotate(180deg);
}

.num .th-sort {
  flex-direction: row-reverse;
}

.num-stack {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}

.num-sub {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.col-chev {
  width: 36px;
  color: var(--color-text-subtle);
}

.col-chev svg {
  display: block;
  margin-left: auto;
}

.inv-row:hover .col-chev {
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

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Variação do dia: separada do resto da tabela (bloco próprio à direita, como uma mini-tabela ao lado) */
.ui-table th.col-day,
.ui-table td.col-day {
  border-left: 1px solid var(--color-border);
  padding-left: var(--space-6);
}

@media (max-width: 640px) {
  .col-qty,
  .col-price,
  .col-day,
  .col-weight {
    display: none;
  }

  .asset-name {
    max-width: 140px;
  }
}
</style>
