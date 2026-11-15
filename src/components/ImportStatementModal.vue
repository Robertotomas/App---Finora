<script setup lang="ts">
import { PT_GROUPING } from '@/utils/numberFormat'
import { ref, computed } from 'vue'
import BaseModal from './BaseModal.vue'
import BaseSelect from './BaseSelect.vue'
import UiButton from './ui/UiButton.vue'
import { investmentsApi } from '@/api/investments'
import { useInvestmentsStore } from '@/stores/investments'
import { useToast } from '@/composables/useToast'
import {
  parseStatement, importWithMapping, detectSideMode, saveMapping, isMappingValid, FIELD_DEFS,
} from '@/utils/brokerImport'
import type { ColumnMapping, FieldKey, NormalizedImport, TableAdapter, TableData, FxFeeEstimate } from '@/utils/brokerImport'
import type { InvestmentImportResult } from '@/types/investment'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; done: [created: number] }>()

const store = useInvestmentsStore()
const toast = useToast()

type Step = 'pick' | 'mapping' | 'preview'
const step = ref<Step>('pick')

const file = ref<File | null>(null)
const normalized = ref<NormalizedImport | null>(null)
const previewing = ref(false)
const importing = ref(false)
const preview = ref<InvestmentImportResult | null>(null)
const error = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

// Estado do mapeador (genérico, ou corretora detetada cujas colunas não foram todas reconhecidas)
const table = ref<TableData | null>(null)
const mapping = ref<ColumnMapping>({})
const mappingAdapter = ref<TableAdapter | null>(null)
const mappingLabel = ref('')

// Taxa de conversão: definição atual do agregado + checkbox "Usar X%" (só aplicada ao importar).
const currentFee = ref<number | null>(null)
const applyFee = ref(false)

const fields = FIELD_DEFS
const headers = computed(() => table.value?.headers ?? [])
const rows = computed(() => table.value?.rows ?? [])

function reset() {
  step.value = 'pick'
  file.value = null
  normalized.value = null
  preview.value = null
  error.value = null
  previewing.value = false
  importing.value = false
  table.value = null
  mapping.value = {}
  mappingAdapter.value = null
  mappingLabel.value = ''
  applyFee.value = false
}

function handleClose() {
  if (previewing.value || importing.value) return
  reset()
  emit('close')
}

function pickFile() {
  fileInput.value?.click()
}
async function onFileChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) await loadFile(f)
}
async function onDrop(e: DragEvent) {
  const f = e.dataTransfer?.files?.[0]
  if (f) await loadFile(f)
}

async function loadFile(f: File) {
  if (!/\.(xlsx|xls|csv)$/i.test(f.name)) {
    error.value = 'Escolha um ficheiro Excel (.xlsx) ou CSV.'
    return
  }
  file.value = f
  error.value = null
  preview.value = null
  previewing.value = true
  // Em paralelo: a taxa atual do agregado (para comparar com a detetada). Tolerante a falhas.
  const feePromise = store.fetchSettings().then((v) => { currentFee.value = v }).catch(() => {})
  try {
    const outcome = await parseStatement(f)
    if (outcome.kind === 'error') {
      error.value = outcome.message
      return
    }
    table.value = outcome.table
    if (outcome.kind === 'mapping') {
      mapping.value = outcome.mapping
      mappingAdapter.value = outcome.adapter
      mappingLabel.value = outcome.brokerLabel
      step.value = 'mapping'
      return
    }
    normalized.value = outcome.data
    await feePromise
    await runPreview()
  } catch {
    error.value = 'Não foi possível ler o ficheiro. Tente novamente.'
  } finally {
    previewing.value = false
  }
}

/** "Não é esta corretora?" → mapeamento manual (genérico, sem os extras do adaptador). */
function mapManually() {
  if (!table.value) return
  mappingAdapter.value = null
  mappingLabel.value = ''
  preview.value = null
  error.value = null
  step.value = 'mapping'
}

/* ── Mapeamento ── */
const columnOptions = computed(() => [
  { value: -1, label: '—' },
  ...headers.value.map((h, i) => ({ value: i, label: h || `Coluna ${i + 1}` })),
])

function colValue(key: FieldKey): number {
  const v = mapping.value[key]
  return v == null ? -1 : v
}
function setCol(key: FieldKey, value: number) {
  const next = { ...mapping.value }
  if (value < 0) delete next[key]
  else next[key] = value
  mapping.value = next
}
function sampleFor(key: FieldKey): string {
  const idx = mapping.value[key]
  if (idx == null || !rows.value.length) return ''
  const v = rows.value.find((r) => (r[idx] ?? '').trim())?.[idx] ?? ''
  return String(v).slice(0, 28)
}

const sideBySign = computed(() => rows.value.length > 0 && detectSideMode(rows.value, mapping.value).mode === 'sign')
const mappingValid = computed(() => isMappingValid(mapping.value))

async function confirmMapping() {
  if (!mappingValid.value || !table.value) return
  const data = importWithMapping(table.value, mapping.value, mappingAdapter.value)
  if (data.trades.length === 0) {
    error.value = 'Não foi possível extrair compras/vendas com este mapeamento. Verifique as colunas.'
    return
  }
  saveMapping(table.value.headers, mapping.value)
  normalized.value = data
  await runPreview()
}

const hasNewData = computed(
  () =>
    !!preview.value &&
    (preview.value.created > 0 ||
      preview.value.depositsImported > 0 ||
      (preview.value.dividendsImported ?? 0) > 0 ||
      (preview.value.cashMovementsImported ?? 0) > 0),
)

function send(n: NormalizedImport, dryRun: boolean) {
  return investmentsApi.import(n.trades, n.hasUnparsedRows, dryRun, n.deposits, n.dividends, n.fxSamples, n.cashMovements ?? [])
}

async function runPreview() {
  const n = normalized.value
  if (!n) return
  previewing.value = true
  error.value = null
  try {
    const { data } = await send(n, true)
    preview.value = data
    step.value = 'preview'
    if (data.error) error.value = data.error
  } catch {
    error.value = 'Falha ao processar. Tente novamente.'
  } finally {
    previewing.value = false
  }
}

async function confirmImport() {
  // Importa se há transações, depósitos ou dividendos novos; aplica a taxa só se a checkbox estiver marcada.
  const n = normalized.value
  const saveFee = applyFee.value && showFeeNotice.value && detectedFee.value
  if (!n || !preview.value || (!hasNewData.value && !saveFee)) return
  importing.value = true
  error.value = null
  try {
    let created = 0
    if (hasNewData.value) created = (await send(n, false)).data.created
    if (saveFee) {
      try {
        currentFee.value = await store.saveSettings(saveFee.percent)
        toast.success(`Taxa de conversão definida para ${fmtPct(saveFee.percent)}`)
      } catch {
        toast.error(hasNewData.value
          ? 'Os dados foram importados, mas não foi possível atualizar a taxa de conversão.'
          : 'Não foi possível atualizar a taxa de conversão. Tente novamente.')
      }
    }
    emit('done', created)
    reset()
  } catch {
    error.value = 'Falha ao importar. Tente novamente.'
  } finally {
    importing.value = false
  }
}

/* ── Corretora detetada ── */
const brokerLabel = computed(() => normalized.value?.brokerLabel ?? '')
const isDetected = computed(() => !!normalized.value && normalized.value.broker !== 'generic')
const counts = computed(() => ({
  trades: normalized.value?.trades.length ?? 0,
  deposits: normalized.value?.deposits.length ?? 0,
  dividends: normalized.value?.dividends.length ?? 0,
}))
const warnings = computed(() => normalized.value?.warnings ?? [])

/* ── Taxa de conversão detetada (explícita no extrato, ou inferida no servidor) ── */
const detectedFee = computed<FxFeeEstimate | null>(() => {
  const explicit = normalized.value?.fxFee
  if (explicit) return explicit
  const inferred = preview.value?.fxFeeEstimate
  return inferred ? { percent: Number(inferred.percent), source: inferred.source, sampleSize: inferred.sampleSize } : null
})
const showFeeNotice = computed(
  () => !!detectedFee.value && currentFee.value != null && Math.abs(detectedFee.value.percent - currentFee.value) >= 0.01,
)
function fmtPct(v: number): string {
  return new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + '%'
}
function fmtPrice(v: number, ccy: string): string {
  try {
    return new Intl.NumberFormat('pt-PT', { ...PT_GROUPING, style: 'currency', currency: ccy || 'EUR' }).format(v)
  } catch {
    return `${v} ${ccy}`
  }
}
function fmtQty(v: number): string {
  return new Intl.NumberFormat('pt-PT', { ...PT_GROUPING, maximumFractionDigits: 6 }).format(v)
}
function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
</script>

<template>
  <BaseModal
    v-if="open"
    title="Importar de corretora"
    @close="handleClose"
  >
    <div class="imp">
      <!-- Passo 1: escolher ficheiro -->
      <template v-if="step === 'pick'">
        <p class="imp-intro">
          Carregue o extrato de transações da sua corretora em <strong>Excel (.xlsx)</strong> ou <strong>CSV</strong>.
        </p>

        <div class="imp-drop" :class="{ busy: previewing }" @click="pickFile" @dragover.prevent @drop.prevent="onDrop">
          <input ref="fileInput" type="file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="imp-file" @change="onFileChange" />
          <template v-if="previewing">
            <div class="spinner"></div>
            <p>A ler “{{ file?.name }}”…</p>
          </template>
          <template v-else>
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            <p class="imp-drop-title">Selecionar ficheiro</p>
            <p class="imp-drop-sub">Excel (.xlsx) ou CSV — arraste para aqui</p>
          </template>
        </div>

        <p v-if="error" class="imp-error">{{ error }}</p>

      </template>

      <!-- Passo 2: mapeamento de colunas (genérico) -->
      <template v-else-if="step === 'mapping'">
        <p v-if="mappingLabel && mappingAdapter" class="imp-intro">
          Detetámos um extrato da <strong>{{ mappingLabel }}</strong>, mas não reconhecemos todas as colunas.
          Associe-as aos campos — auto-preenchemos o que reconhecemos.
        </p>
        <p v-else class="imp-intro">Associe as colunas do seu ficheiro aos campos. Auto-preenchemos o que reconhecemos.</p>

        <div class="imp-map">
          <div v-for="f in fields" :key="f.key" class="imp-map-row">
            <label class="imp-map-label">
              {{ f.label }}<span v-if="f.required" class="imp-req">*</span>
            </label>
            <div class="imp-map-control">
              <BaseSelect
                :model-value="colValue(f.key)"
                :options="columnOptions"
                placeholder="—"
                @update:model-value="(v) => setCol(f.key, Number(v))"
              />
              <span v-if="sampleFor(f.key)" class="imp-map-sample">ex.: {{ sampleFor(f.key) }}</span>
            </div>
          </div>
        </div>

        <p v-if="sideBySign && mapping.side == null" class="imp-note">
          Compra/Venda será deduzida pelo <strong>sinal da quantidade</strong> (negativo = venda).
        </p>
        <p v-if="error" class="imp-error">{{ error }}</p>

      </template>

      <!-- Passo 3: pré-visualização -->
      <template v-else-if="step === 'preview' && preview">
        <div v-if="isDetected" class="imp-broker">
          <p class="imp-broker-label">Detetámos: <strong>{{ brokerLabel }}</strong></p>
          <button v-if="table && table.headers.length" type="button" class="imp-link" @click="mapManually">
            Não é esta corretora? Mapear colunas manualmente
          </button>
        </div>

        <p class="imp-counts">
          No ficheiro: {{ counts.trades }} {{ counts.trades === 1 ? 'operação' : 'operações' }}
          · {{ counts.deposits }} {{ counts.deposits === 1 ? 'depósito' : 'depósitos' }}
          · {{ counts.dividends }} {{ counts.dividends === 1 ? 'dividendo' : 'dividendos' }}
        </p>

        <div class="imp-summary">
          <div class="imp-stat">
            <span class="imp-stat-num">{{ preview.detected }}</span>
            <span class="imp-stat-label">detetadas</span>
          </div>
          <div class="imp-stat imp-stat--new">
            <span class="imp-stat-num">{{ preview.created }}</span>
            <span class="imp-stat-label">novas</span>
          </div>
          <div class="imp-stat imp-stat--dup">
            <span class="imp-stat-num">{{ preview.skipped }}</span>
            <span class="imp-stat-label">duplicadas</span>
          </div>
        </div>

        <p v-if="preview.skipped > 0" class="imp-note">
          {{ preview.skipped }} {{ preview.skipped === 1 ? 'transação já existia' : 'transações já existiam' }}
          e {{ preview.skipped === 1 ? 'foi ignorada' : 'foram ignoradas' }}.
        </p>
        <p v-if="preview.hasUnparsedRows" class="modal-note modal-note--warning">
          Algumas linhas não foram reconhecidas. Confirme os valores antes de importar.
        </p>
        <p v-for="(w, i) in warnings" :key="'w' + i" class="imp-note">{{ w }}</p>

        <div v-if="detectedFee && currentFee != null" class="imp-fee">
          <p class="imp-fee-title">
            Taxa de conversão {{ detectedFee.source === 'explicit' ? 'indicada no extrato' : 'estimada' }}:
            <strong>{{ fmtPct(detectedFee.percent) }}</strong>
          </p>
          <p class="imp-fee-text">
            <template v-if="detectedFee.source === 'explicit'">
              Valor cobrado pela corretora nas conversões de moeda, lido diretamente do ficheiro.
            </template>
            <template v-else>
              É uma estimativa: comparámos o câmbio aplicado em {{ detectedFee.sampleSize }}
              {{ detectedFee.sampleSize === 1 ? 'operação' : 'operações' }} com o câmbio de referência do BCE.
              Pode diferir ligeiramente da taxa oficial da corretora — confirme no site da corretora.
            </template>
          </p>
          <p v-if="!showFeeNotice" class="imp-fee-text">
            É igual à taxa que já está definida — não é preciso alterar nada.
          </p>
          <template v-else>
          <label class="checkbox-row imp-fee-check">
            <input v-model="applyFee" type="checkbox" />
            Usar {{ fmtPct(detectedFee.percent) }} como taxa de conversão
          </label>
          <p class="imp-fee-text">
            Se não marcar, mantém-se a taxa atual de <strong>{{ fmtPct(currentFee) }}</strong>{{ currentFee === 0 ? ' (sem taxa)' : '' }}.
            Pode alterá-la a qualquer momento em Investimentos, no menu "⋯" → "Taxa de conversão da corretora".
          </p>
          </template>
        </div>
        <p v-if="preview.depositsImported > 0" class="imp-note">
          + {{ preview.depositsImported }} {{ preview.depositsImported === 1 ? 'depósito' : 'depósitos' }} para a métrica de depósitos.
        </p>
        <p v-if="(preview.dividendsImported ?? 0) > 0" class="imp-note">
          + {{ preview.dividendsImported }} {{ preview.dividendsImported === 1 ? 'dividendo' : 'dividendos' }}.
        </p>
        <p v-if="(preview.cashMovementsImported ?? 0) > 0" class="imp-note">
          + {{ preview.cashMovementsImported }}
          {{ preview.cashMovementsImported === 1 ? 'outro movimento' : 'outros movimentos' }} de caixa (juros, taxas) para os fundos livres.
        </p>
        <p v-if="!hasNewData" class="imp-note">Não há dados novos para importar.</p>

        <div class="imp-list">
          <div v-for="(it, i) in preview.items" :key="i" class="imp-row" :class="{ dup: it.status === 'duplicate' }">
            <span class="imp-row-op" :class="it.operation === 'Compra' ? 'buy' : 'sell'">{{ it.operation === 'Compra' ? 'C' : 'V' }}</span>
            <div class="imp-row-main">
              <span class="imp-row-sym">{{ it.providerSymbol }}</span>
              <span class="imp-row-meta">{{ fmtDate(it.date) }} · {{ fmtQty(it.quantity) }} × {{ fmtPrice(it.unitPrice, it.currency) }}</span>
            </div>
            <span v-if="it.status === 'duplicate'" class="imp-row-badge">já existe</span>
          </div>
        </div>

        <p v-if="error" class="imp-error">{{ error }}</p>

      </template>
    </div>

    <template #footer>
      <template v-if="step === 'pick'">
        <UiButton variant="secondary" :disabled="previewing" @click="handleClose">Fechar</UiButton>
      </template>
      <template v-else-if="step === 'mapping'">
        <UiButton variant="secondary" :disabled="previewing" @click="reset">Voltar</UiButton>
        <UiButton :loading="previewing" :disabled="!mappingValid" @click="confirmMapping">Continuar</UiButton>
      </template>
      <template v-else-if="step === 'preview' && preview">
        <UiButton variant="secondary" :disabled="importing" @click="reset">Escolher outro</UiButton>
        <UiButton :loading="importing" :disabled="!hasNewData && !(applyFee && showFeeNotice)" @click="confirmImport">
          <template v-if="!hasNewData">Guardar taxa</template>
          <template v-else-if="preview.created > 0">Importar {{ preview.created }} {{ preview.created === 1 ? 'nova' : 'novas' }}</template>
          <template v-else>Importar</template>
        </UiButton>
      </template>
    </template>
  </BaseModal>
</template>

<style scoped>
.imp {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.imp-intro {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--color-text-secondary);
}
.imp-intro strong {
  color: var(--color-text-strong);
}

/* Zona de largar ficheiro */
.imp-drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: var(--space-8) var(--space-4);
  border: 1.5px dashed var(--color-border-strong);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-muted);
  cursor: pointer;
  text-align: center;
  transition: border-color var(--transition-fast), background var(--transition-fast), color var(--transition-fast);
}
.imp-drop:hover {
  border-color: var(--color-border-strong);
  background: var(--color-selected);
  color: var(--color-selected-text);
}
.imp-drop.busy {
  cursor: default;
}
.imp-drop p {
  margin: 0;
  font-size: var(--text-sm);
}
.imp-file {
  display: none;
}
.imp-drop .imp-drop-title {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}
.imp-drop .imp-drop-sub {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

/* Mapeamento */
.imp-map {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.imp-map-row {
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr);
  align-items: center;
  gap: var(--space-3);
}
@media (max-width: 520px) {
  .imp-map-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 6px;
  }
}
.imp-map-label {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}
.imp-req {
  margin-left: 2px;
  color: var(--color-danger);
}
.imp-map-control {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.imp-map-sample {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Pré-visualização */
.imp-broker {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-1) var(--space-3);
}
.imp-broker-label {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}
.imp-broker-label strong {
  color: var(--color-text-strong);
}
.imp-link {
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-primary-text);
  cursor: pointer;
}
.imp-link:hover {
  text-decoration: underline;
}
.imp-counts {
  margin: calc(-1 * var(--space-2)) 0 0;
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
}
.imp-fee {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}
.imp-fee-text {
  flex: 1;
  margin: 0;
  font-size: var(--text-xs);
  line-height: 1.45;
  color: var(--color-text-secondary);
}
.imp-fee-text strong {
  color: var(--color-text-strong);
}
.imp-fee-title {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text);
}
.imp-fee-title strong {
  color: var(--color-text-strong);
}
.imp-fee-check {
  margin: var(--space-1) 0;
}
.imp-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
}
.imp-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}
.imp-stat-num {
  font-size: var(--text-xl);
  font-weight: var(--weight-bold);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-strong);
}
.imp-stat-label {
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-caps);
  color: var(--color-text-muted);
}
.imp-stat--new .imp-stat-num {
  color: var(--color-primary-text);
}
.imp-stat--dup .imp-stat-num {
  color: var(--color-text-muted);
}

.imp-note {
  margin: 0;
  font-size: var(--text-xs);
  line-height: 1.45;
  color: var(--color-text-muted);
}

.imp-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 260px;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.imp-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px var(--space-2);
  border-radius: var(--radius-sm);
}
.imp-row:hover {
  background: var(--color-surface-hover);
}
.imp-row.dup {
  opacity: 0.55;
}
.imp-row-op {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border-radius: 6px;
  font-size: var(--text-2xs);
  font-weight: var(--weight-bold);
}
.imp-row-op.buy {
  color: var(--color-success);
  background: var(--color-success-soft);
}
.imp-row-op.sell {
  color: var(--color-danger);
  background: var(--color-danger-soft);
}
.imp-row-main {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}
.imp-row-sym {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}
.imp-row-meta {
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
}
.imp-row-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
  color: var(--color-text-secondary);
  background: var(--color-surface-muted);
}

.imp-error {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-danger);
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary-text);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
