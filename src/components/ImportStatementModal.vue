<script setup lang="ts">
import { PT_GROUPING } from '@/utils/numberFormat'
import { ref, computed } from 'vue'
import BaseModal from './BaseModal.vue'
import BaseSelect from './BaseSelect.vue'
import UiButton from './ui/UiButton.vue'
import { investmentsApi } from '@/api/investments'
import { parseXtbWorkbook } from '@/utils/xtbExcel'
import {
  readTable, autoMap, buildTrades, detectSideMode, saveMapping, loadSavedMapping, profileKeyFor,
  FIELD_DEFS,
} from '@/utils/brokerImport'
import type { ColumnMapping, FieldKey } from '@/utils/brokerImport'
import type { InvestmentImportResult, BrokerTrade, BrokerDeposit } from '@/types/investment'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; done: [created: number] }>()

type Step = 'pick' | 'mapping' | 'preview'
const step = ref<Step>('pick')

const file = ref<File | null>(null)
const items = ref<BrokerTrade[]>([])
const deposits = ref<BrokerDeposit[]>([])
const hasUnparsedRows = ref(false)
const previewing = ref(false)
const importing = ref(false)
const preview = ref<InvestmentImportResult | null>(null)
const error = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

// Estado do mapeador genérico
const headers = ref<string[]>([])
const rows = ref<string[][]>([])
const mapping = ref<ColumnMapping>({})
const profileKey = ref('')

const fields = FIELD_DEFS

function reset() {
  step.value = 'pick'
  file.value = null
  items.value = []
  deposits.value = []
  hasUnparsedRows.value = false
  preview.value = null
  error.value = null
  previewing.value = false
  importing.value = false
  headers.value = []
  rows.value = []
  mapping.value = {}
  profileKey.value = ''
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
  try {
    // 1) XTB (Excel multi-folha) — deteção dedicada.
    if (/\.(xlsx|xls)$/i.test(f.name)) {
      const xtb = await parseXtbWorkbook(f)
      if (xtb.items.length > 0) {
        items.value = xtb.items
        deposits.value = xtb.deposits
        hasUnparsedRows.value = xtb.hasUnparsedRows
        await runPreview()
        return
      }
    }

    // 2) Genérico (CSV/Excel de tabela plana) — mapeamento de colunas.
    const table = await readTable(f)
    if (table.error) { error.value = table.error; return }
    if (table.rows.length === 0) { error.value = 'O ficheiro não tem linhas de dados.'; return }

    headers.value = table.headers
    rows.value = table.rows
    profileKey.value = profileKeyFor(table.headers)
    mapping.value = loadSavedMapping(table.headers) ?? autoMap(table.headers)
    // Se reconheceu as colunas todas, vai direto à pré-visualização (sem o ecrã de mapeamento).
    if (mappingValid.value) await confirmMapping()
    else step.value = 'mapping'
  } catch {
    error.value = 'Não foi possível ler o ficheiro. Tente novamente.'
  } finally {
    previewing.value = false
  }
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
const mappingValid = computed(() => {
  const m = mapping.value
  return m.date != null && m.quantity != null && (m.price != null || m.amount != null) && (m.ticker != null || m.isin != null)
})

async function confirmMapping() {
  if (!mappingValid.value) return
  const built = buildTrades(rows.value, mapping.value, profileKey.value)
  if (built.items.length === 0) {
    error.value = 'Não foi possível extrair compras/vendas com este mapeamento. Verifique as colunas.'
    return
  }
  saveMapping(headers.value, mapping.value)
  items.value = built.items
  hasUnparsedRows.value = built.failed > 0
  await runPreview()
}

async function runPreview() {
  previewing.value = true
  error.value = null
  try {
    const { data } = await investmentsApi.import(items.value, hasUnparsedRows.value, true, deposits.value)
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
  // Permite importar se há transações novas OU depósitos novos.
  if (!preview.value || (preview.value.created === 0 && preview.value.depositsImported === 0)) return
  importing.value = true
  error.value = null
  try {
    const { data } = await investmentsApi.import(items.value, hasUnparsedRows.value, false, deposits.value)
    emit('done', data.created)
    reset()
  } catch {
    error.value = 'Falha ao importar. Tente novamente.'
  } finally {
    importing.value = false
  }
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
        <p class="imp-intro">Associe as colunas do seu ficheiro aos campos. Auto-preenchemos o que reconhecemos.</p>

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
        <p v-if="preview.depositsImported > 0" class="imp-note">
          + {{ preview.depositsImported }} {{ preview.depositsImported === 1 ? 'depósito' : 'depósitos' }} para a métrica de depósitos.
        </p>
        <p v-if="preview.created === 0 && preview.depositsImported === 0" class="imp-note">Não há dados novos para importar.</p>

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
        <UiButton :loading="importing" :disabled="preview.created === 0" @click="confirmImport">
          Importar {{ preview.created }} {{ preview.created === 1 ? 'nova' : 'novas' }}
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
