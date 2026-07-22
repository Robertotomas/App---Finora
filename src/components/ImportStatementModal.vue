<script setup lang="ts">
import { ref, computed } from 'vue'
import BaseModal from './BaseModal.vue'
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
const columnOptions = computed(() => headers.value.map((h, i) => ({ value: i, label: h || `Coluna ${i + 1}` })))

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
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: ccy || 'EUR' }).format(v)
  } catch {
    return `${v} ${ccy}`
  }
}
function fmtQty(v: number): string {
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 6 }).format(v)
}
function fmtDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
</script>

<template>
  <BaseModal v-if="open" title="Importar de corretora" @close="handleClose">
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

        <div class="modal-actions">
          <button type="button" class="btn-cancel" :disabled="previewing" @click="handleClose">Fechar</button>
        </div>
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
              <select class="imp-select" :value="colValue(f.key)" @change="setCol(f.key, Number(($event.target as HTMLSelectElement).value))">
                <option :value="-1">—</option>
                <option v-for="o in columnOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
              <span v-if="sampleFor(f.key)" class="imp-map-sample">ex.: {{ sampleFor(f.key) }}</span>
            </div>
          </div>
        </div>

        <p v-if="sideBySign && mapping.side == null" class="imp-note">
          Compra/Venda será deduzida pelo <strong>sinal da quantidade</strong> (negativo = venda).
        </p>
        <p v-if="error" class="imp-error">{{ error }}</p>

        <div class="modal-actions">
          <button type="button" class="btn-cancel" :disabled="previewing" @click="reset">Voltar</button>
          <button type="button" class="btn-primary" :disabled="previewing || !mappingValid" @click="confirmMapping">
            {{ previewing ? 'A processar…' : 'Continuar' }}
          </button>
        </div>
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
        <p v-if="preview.hasUnparsedRows" class="imp-warn">
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

        <div class="modal-actions">
          <button type="button" class="btn-cancel" :disabled="importing" @click="reset">Escolher outro</button>
          <button type="button" class="btn-primary" :disabled="importing || preview.created === 0" @click="confirmImport">
            {{ importing ? 'A importar…' : `Importar ${preview.created} ${preview.created === 1 ? 'nova' : 'novas'}` }}
          </button>
        </div>
      </template>
    </div>
  </BaseModal>
</template>

<style scoped>
.imp {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.imp-intro {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  line-height: 1.5;
  margin: 0;
}

.imp-drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 2rem 1rem;
  border: 1.5px dashed var(--color-border);
  border-radius: 12px;
  color: var(--color-text-muted);
  cursor: pointer;
  text-align: center;
  transition: border-color 0.15s, background 0.15s;
}

.imp-drop:hover {
  border-color: #166534;
  background: rgba(22, 101, 52, 0.04);
}

html.dark .imp-drop:hover {
  border-color: #4ade80;
  background: rgba(74, 222, 128, 0.06);
}

.imp-drop.busy {
  cursor: default;
}

.imp-file {
  display: none;
}

.imp-drop-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.imp-drop-sub {
  font-size: 0.75rem;
  margin: 0;
}

/* Mapeamento */
.imp-map {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 320px;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.imp-map-row {
  display: grid;
  grid-template-columns: 130px 1fr;
  align-items: center;
  gap: 0.625rem;
}

.imp-map-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text);
}

.imp-req {
  color: #dc2626;
  margin-left: 2px;
}

.imp-map-control {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.imp-select {
  width: 100%;
  padding: 0.45rem 0.625rem;
  font-size: 0.8125rem;
  font-family: inherit;
  color: var(--color-text);
  background: var(--color-input-bg, #fff);
  border: 1px solid var(--color-input-border, #e2e8f0);
  border-radius: 8px;
}

.imp-select:focus {
  outline: none;
  border-color: #166534;
}

.imp-map-sample {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.imp-summary {
  display: flex;
  gap: 0.5rem;
}

.imp-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 12px;
}

.imp-stat-num {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--color-text);
}

.imp-stat-label {
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text-muted);
}

.imp-stat--new .imp-stat-num {
  color: #166534;
}

html.dark .imp-stat--new .imp-stat-num {
  color: #4ade80;
}

.imp-stat--dup .imp-stat-num {
  color: var(--color-text-muted);
}

.imp-note {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0;
}

.imp-warn {
  font-size: 0.75rem;
  color: #b45309;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 8px;
  padding: 0.5rem 0.625rem;
  margin: 0;
}

html.dark .imp-warn {
  color: #fbbf24;
}

.imp-list {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  max-height: 260px;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.imp-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.4rem 0.5rem;
  border-radius: 8px;
}

.imp-row:hover {
  background: var(--color-table-row-hover);
}

.imp-row.dup {
  opacity: 0.55;
}

.imp-row-op {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 6px;
  font-size: 0.6875rem;
  font-weight: 800;
}

.imp-row-op.buy {
  color: #059669;
  background: rgba(5, 150, 105, 0.12);
}

html.dark .imp-row-op.buy {
  color: #34d399;
}

.imp-row-op.sell {
  color: #dc2626;
  background: rgba(220, 38, 38, 0.12);
}

html.dark .imp-row-op.sell {
  color: #f87171;
}

.imp-row-main {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
  flex: 1;
}

.imp-row-sym {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-text);
}

.imp-row-meta {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
}

.imp-row-badge {
  flex-shrink: 0;
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--color-text-muted);
  background: var(--color-table-row-hover);
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
}

.imp-error {
  font-size: 0.8125rem;
  color: #dc2626;
  margin: 0;
}

html.dark .imp-error {
  color: #f87171;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 0.25rem;
}

.btn-cancel {
  padding: 0.5rem 1rem;
  background: var(--color-bg, #f1f5f9);
  color: var(--color-text-muted, #475569);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  font-size: 0.875rem;
  cursor: pointer;
  font-family: inherit;
}

.btn-cancel:hover:not(:disabled) {
  background: var(--color-table-row-hover, #e2e8f0);
}

.btn-cancel:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #166534 0%, #15803d 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 28px;
  height: 28px;
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
