<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useHouseholdStore } from '@/stores/household'
import { useSubscriptionStore } from '@/stores/subscription'
import { reportsApi, type MonthlyReportListItem } from '@/api/reports'
import PlanUpsellCard from '@/components/PlanUpsellCard.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import BaseSelect from '@/components/BaseSelect.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import UiButton from '@/components/ui/UiButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { zipSync } from 'fflate'
import { useToast } from '@/composables/useToast'

const householdStore = useHouseholdStore()
const subscriptionStore = useSubscriptionStore()
const toast = useToast()

const pageReady = ref(false)
const loading = ref(true)
const error = ref<string | null>(null)
const items = ref<MonthlyReportListItem[]>([])

const previewOpen = ref(false)
const previewUrl = ref<string | null>(null)
const previewLoading = ref(false)
const previewTitle = ref('')

const refreshingId = ref<string | null>(null)

const reportsLocked = computed(() => !subscriptionStore.canAccessMonthlyReports)

const filterYear = ref<number | null>(null)
const filterMonth = ref<number | null>(null)

const availableYears = computed(() => {
  const years = [...new Set(items.value.map((i) => i.year))].sort((a, b) => b - a)
  return years
})

const availableMonths = computed(() => {
  const filtered = filterYear.value
    ? items.value.filter((i) => i.year === filterYear.value)
    : items.value
  const months = [...new Set(filtered.map((i) => i.month))].sort((a, b) => a - b)
  return months
})

const filteredItems = computed(() => {
  let list = items.value
  if (filterYear.value) list = list.filter((i) => i.year === filterYear.value)
  if (filterMonth.value) list = list.filter((i) => i.month === filterMonth.value)
  return list
})

function monthLabel(m: number): string {
  const d = new Date(2024, m - 1, 1)
  const str = d.toLocaleDateString('pt-PT', { month: 'long' })
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function pickYear(val: number | null) {
  filterYear.value = val
  if (filterMonth.value && !availableMonths.value.includes(filterMonth.value)) {
    filterMonth.value = null
  }
}

function pickMonth(val: number | null) {
  filterMonth.value = val
}

// BaseSelect não aceita null: 0 = "todos".
const yearSelect = computed<string | number>({
  get: () => filterYear.value ?? 0,
  set: (v) => pickYear(Number(v) || null),
})
const monthSelect = computed<string | number>({
  get: () => filterMonth.value ?? 0,
  set: (v) => pickMonth(Number(v) || null),
})
const yearSelectOptions = computed(() => [
  { value: 0, label: 'Todos os anos' },
  ...availableYears.value.map((y) => ({ value: y, label: String(y) })),
])
const monthSelectOptions = computed(() => [
  { value: 0, label: 'Todos os meses' },
  ...availableMonths.value.map((m) => ({ value: m, label: monthLabel(m) })),
])

function clearFilters() {
  filterYear.value = null
  filterMonth.value = null
}

/* ── Seleção múltipla (só aparece com mais do que um relatório) ── */
const selectedIds = ref<Set<string>>(new Set())
const canSelect = computed(() => items.value.length > 1)
const selectedCount = computed(() => filteredItems.value.filter((r) => selectedIds.value.has(r.id)).length)
const allSelected = computed(() => filteredItems.value.length > 0 && selectedCount.value === filteredItems.value.length)
const someSelected = computed(() => selectedCount.value > 0 && !allSelected.value)
const downloadSelectedLabel = computed(() =>
  selectedCount.value === 1 ? 'Descarregar PDF' : 'Descarregar ' + selectedCount.value + ' (.zip)',
)

function toggleRow(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}
function toggleAll() {
  selectedIds.value = allSelected.value ? new Set() : new Set(filteredItems.value.map((r) => r.id))
}
function clearSelection() {
  selectedIds.value = new Set()
}

function reportFileName(row: MonthlyReportListItem): string {
  return 'finora-relatorio-' + row.year + '-' + String(row.month).padStart(2, '0') + '.pdf'
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const zipping = ref(false)

/** Descarrega os selecionados: 1 → o PDF; vários → um .zip com os PDFs (abre como pasta). */
async function downloadSelected() {
  if (reportsLocked.value || zipping.value) return
  const rows = filteredItems.value.filter((r) => selectedIds.value.has(r.id))
  if (rows.length === 0) return
  if (rows.length === 1) {
    await downloadReport(rows[0])
    return
  }
  zipping.value = true
  try {
    const files: Record<string, Uint8Array> = {}
    // Sequencial: evita rebentar o rate-limit da API com muitos pedidos em simultâneo.
    for (const row of rows) {
      const blob = await reportsApi.downloadBlob(row.id)
      files[reportFileName(row)] = new Uint8Array(await blob.arrayBuffer())
    }
    // PDFs já vêm comprimidos: guardar sem recomprimir (level 0) é instantâneo.
    const zipped = zipSync(files, { level: 0 })
    saveBlob(new Blob([zipped], { type: 'application/zip' }), 'finora-relatorios-' + rows.length + '.zip')
    toast.success(rows.length + ' relatórios descarregados')
    clearSelection()
  } catch {
    toast.error('Não foi possível descarregar os relatórios. Tente novamente.')
  } finally {
    zipping.value = false
  }
}

async function load() {
  if (!householdStore.household || reportsLocked.value) {
    items.value = []
    loading.value = false
    return
  }
  loading.value = true
  error.value = null
  try {
    items.value = await reportsApi.list()
  } catch (e: unknown) {
    const err = e as { response?: { status?: number; data?: { message?: string } } }
    if (err.response?.status === 403) {
      error.value = 'Relatórios disponíveis nos planos Pro e Couple.'
    } else {
      error.value = err.response?.data?.message ?? 'Não foi possível carregar os relatórios.'
    }
  } finally {
    loading.value = false
  }
}

function closePreview() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = null
  }
  previewOpen.value = false
  previewLoading.value = false
}

async function openPreview(row: MonthlyReportListItem) {
  if (reportsLocked.value) return
  closePreview()
  previewTitle.value = `Pré-visualização — ${formatMonthYear(row)}`
  previewOpen.value = true
  previewLoading.value = true
  error.value = null
  try {
    const blob = await reportsApi.downloadBlob(row.id)
    previewUrl.value = URL.createObjectURL(blob)
  } catch {
    toast.error('Não foi possível abrir o PDF. Tente novamente.')
    previewOpen.value = false
  } finally {
    previewLoading.value = false
  }
}

async function downloadReport(row: MonthlyReportListItem) {
  if (reportsLocked.value) return
  try {
    const blob = await reportsApi.downloadBlob(row.id)
    saveBlob(blob, reportFileName(row))
  } catch {
    toast.error('Não foi possível descarregar o PDF. Tente novamente.')
  }
}

const generatingOverlay = ref(false)

async function refreshReportPdf(row: MonthlyReportListItem) {
  if (reportsLocked.value || refreshingId.value) return
  refreshingId.value = row.id
  generatingOverlay.value = true
  error.value = null
  try {
    const updated = await reportsApi.refresh(row.id)
    const idx = items.value.findIndex((x) => x.id === row.id)
    if (idx >= 0) items.value[idx] = updated
    closePreview()
    toast.success(`Relatório de ${formatMonthYear(row)} atualizado`)
  } catch (e: unknown) {
    const err = e as { rateLimited?: boolean; rateLimitMessage?: string; response?: { status?: number; data?: { message?: string } } }
    if (err.rateLimited) {
      toast.error(err.rateLimitMessage || 'Demasiados pedidos. Tente novamente dentro de 1 minuto.')
    } else if (err.response?.status === 403) {
      toast.error('Atualizar relatórios está disponível nos planos Pro e Couple.')
    } else {
      toast.error(err.response?.data?.message ?? 'Não foi possível atualizar o PDF.')
    }
  } finally {
    refreshingId.value = null
    generatingOverlay.value = false
  }
}

function formatMonthYear(row: MonthlyReportListItem): string {
  const d = new Date(row.year, row.month - 1, 1)
  const str = d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function formatGenerated(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-PT')
}

function formatFileSize(bytes: number | null): string {
  if (bytes == null || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(0)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && previewOpen.value) {
    e.preventDefault()
    closePreview()
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  try {
    await householdStore.fetchHousehold()
    await subscriptionStore.fetchSubscription()
  } catch {
    /* store handles */
  }
  pageReady.value = true
  await load()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  closePreview()
})
</script>

<template>
  <div class="reports-page">
    <!-- A carregar agregado + subscrição -->
    <PageSkeleton v-if="!pageReady" variant="table" :rows="5" />

    <!-- Sem agregado -->
    <EmptyState
      v-else-if="!householdStore.household"
      title="Ainda não tem um agregado"
      description="Configure primeiro o seu agregado para receber relatórios mensais."
    >
      <router-link to="/household" class="link-btn">Configurar agregado</router-link>
    </EmptyState>

    <template v-else>
      <PageHeader title="Relatórios" />

      <PlanUpsellCard
        v-if="reportsLocked"
        title="Receba relatórios mensais automáticos"
        description="Um resumo claro das suas finanças, gerado automaticamente ao fim de cada mês."
        :features="[
          'Resumo de receitas, despesas e saldo do mês',
          'Gráficos de evolução e repartição por categoria',
          'PDF pronto a descarregar e partilhar',
        ]"
      >
        <template #icon>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        </template>
      </PlanUpsellCard>

      <div v-else class="ui-stack">
        <div v-if="error" class="inline-error" role="alert">{{ error }}</div>

        <PageSkeleton v-if="loading" variant="table" :rows="5" />

        <EmptyState
          v-else-if="items.length === 0"
          class="empty-card"
          title="Ainda não há relatórios"
          description="Os relatórios são gerados automaticamente no fim de cada mês. O primeiro aparece aqui assim que o mês fechar."
        >
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/></svg>
          </template>
        </EmptyState>

        <section v-else class="reports-card">
          <header class="reports-card-head">
            <div class="reports-card-text">
              <h2 class="card-title">Relatórios mensais</h2>
              <p class="card-subtitle">Alterou movimentos de um mês já fechado? Atualize o PDF para refletir as mudanças.</p>
            </div>
            <div class="reports-filters">
              <BaseSelect v-model="yearSelect" :options="yearSelectOptions" class="filter-select" />
              <BaseSelect v-model="monthSelect" :options="monthSelectOptions" class="filter-select" />
            </div>
          </header>

          <!-- Barra de seleção: aparece quando há relatórios selecionados -->
          <div v-if="canSelect && selectedCount > 0" class="selection-bar" role="region" aria-label="Relatórios selecionados">
            <span class="selection-count">{{ selectedCount }} {{ selectedCount === 1 ? 'selecionado' : 'selecionados' }}</span>
            <div class="selection-actions">
              <UiButton variant="ghost" size="sm" @click="clearSelection">Limpar</UiButton>
              <UiButton variant="primary" size="sm" :loading="zipping" @click="downloadSelected">
                <template #icon>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                </template>
                {{ downloadSelectedLabel }}
              </UiButton>
            </div>
          </div>

          <EmptyState
            v-if="filteredItems.length === 0"
            compact
            title="Nenhum relatório encontrado"
            description="Não há relatórios para os filtros escolhidos."
          >
            <UiButton variant="secondary" size="sm" @click="clearFilters">Limpar filtros</UiButton>
          </EmptyState>

          <div v-else class="ui-table-wrap">
            <table class="ui-table reports-table">
              <thead>
                <tr>
                  <th v-if="canSelect" class="col-check">
                    <input
                      type="checkbox"
                      class="row-check"
                      :checked="allSelected"
                      :indeterminate.prop="someSelected"
                      aria-label="Selecionar todos"
                      @change="toggleAll"
                    />
                  </th>
                  <th>Mês</th>
                  <th class="col-status">Estado</th>
                  <th class="num"><span class="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in filteredItems" :key="row.id" :class="{ 'is-selected': selectedIds.has(row.id) }">
                  <td v-if="canSelect" class="col-check">
                    <input
                      type="checkbox"
                      class="row-check"
                      :checked="selectedIds.has(row.id)"
                      :aria-label="'Selecionar ' + formatMonthYear(row)"
                      @change="toggleRow(row.id)"
                    />
                  </td>
                  <td>
                    <div class="report-cell">
                      <span class="report-icon" aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/></svg>
                      </span>
                      <div class="report-text">
                        <span class="report-name">{{ formatMonthYear(row) }}</span>
                        <span class="report-meta">
                          Gerado a {{ formatGenerated(row.generatedAt) }}<template v-if="row.fileSizeBytes"> · PDF, {{ formatFileSize(row.fileSizeBytes) }}</template>
                        </span>
                      </div>
                    </div>
                  </td>
                  <td class="col-status">
                    <span v-if="refreshingId === row.id" class="ui-badge ui-badge--warning">A atualizar</span>
                    <span v-else class="ui-badge ui-badge--success">Disponível</span>
                  </td>
                  <td class="num">
                    <div class="row-actions">
                      <button type="button" class="icon-action" title="Ver" :aria-label="'Ver ' + formatMonthYear(row)" @click="openPreview(row)">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
                      </button>
                      <button
                        type="button"
                        class="icon-action"
                        title="Atualizar PDF"
                        :aria-label="'Atualizar PDF de ' + formatMonthYear(row)"
                        :disabled="refreshingId !== null"
                        @click="refreshReportPdf(row)"
                      >
                        <svg :class="{ spinning: refreshingId === row.id }" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/></svg>
                      </button>
                      <button type="button" class="icon-action" title="Descarregar PDF" :aria-label="'Descarregar PDF de ' + formatMonthYear(row)" @click="downloadReport(row)">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </template>

    <!-- A gerar -->
    <Teleport to="body">
      <div v-if="generatingOverlay" class="generating-overlay" role="status" aria-live="polite">
        <div class="generating-panel">
          <span class="spinner" aria-hidden="true" />
          <p class="generating-title">A gerar relatório…</p>
          <p class="generating-hint">Isto pode demorar alguns segundos. Não feche nem mude de página.</p>
        </div>
      </div>
    </Teleport>

    <!-- Pré-visualização do PDF -->
    <Teleport to="body">
      <div
        v-if="previewOpen"
        class="pdf-preview-backdrop"
        role="presentation"
        @click.self="closePreview"
      >
        <div
          class="pdf-preview-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pdf-preview-title"
          @click.stop
        >
          <div class="pdf-preview-header">
            <h2 id="pdf-preview-title" class="pdf-preview-title">{{ previewTitle }}</h2>
            <UiButton variant="ghost" size="sm" icon-only aria-label="Fechar pré-visualização" @click="closePreview">
              <template #icon>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
              </template>
            </UiButton>
          </div>
          <div class="pdf-preview-body">
            <div v-if="previewLoading" class="preview-inline-loading" role="status">
              <span class="spinner" aria-hidden="true" />
              <p>A carregar PDF…</p>
            </div>
            <iframe
              v-else-if="previewUrl"
              :src="previewUrl"
              class="pdf-preview-iframe"
              title="Pré-visualização do relatório PDF"
            />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.reports-page {
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 0 0 var(--space-12);
}

.inline-error {
  padding: 10px var(--space-4);
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}

.empty-card {
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
}

/* ── Cartão da lista ── */
.reports-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.reports-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  padding: var(--space-5);
}
.reports-card-text {
  min-width: 0;
  flex: 1 1 260px;
}
.card-title {
  margin: 0;
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}
.card-subtitle {
  margin: 2px 0 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  line-height: 1.5;
}
.reports-filters {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.filter-select {
  width: 160px;
}

/* ── Tabela ── */
.reports-table th:first-child,
.reports-table td:first-child {
  padding-left: var(--space-5);
}
.reports-table th:last-child,
.reports-table td:last-child {
  padding-right: var(--space-5);
}
.col-status {
  width: 1%;
  white-space: nowrap;
}
.report-cell {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}
.report-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
}
.report-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.report-name {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}
.report-meta {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
.row-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-1);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.link-btn {
  display: inline-flex;
  align-items: center;
  height: var(--control-h);
  padding: 0 var(--space-4);
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  text-decoration: none;
}
.link-btn:hover { background: var(--color-primary-hover); }

.spinner {
  display: block;
  width: 28px;
  height: 28px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Pré-visualização ── */
.pdf-preview-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: var(--color-modal-overlay);
  backdrop-filter: blur(4px);
}
.pdf-preview-dialog {
  display: flex;
  flex-direction: column;
  width: min(960px, 100%);
  height: min(88vh, 900px);
  max-height: 100%;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}
.pdf-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4) var(--space-3) var(--space-5);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.pdf-preview-title {
  margin: 0;
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pdf-preview-body {
  position: relative;
  flex: 1;
  min-height: 0;
  background: var(--color-surface-muted);
}
.pdf-preview-iframe {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 400px;
  border: none;
}
.preview-inline-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  height: 100%;
  min-height: 280px;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.preview-inline-loading p { margin: 0; }

/* ── A gerar ── */
.generating-overlay {
  position: fixed;
  inset: 0;
  z-index: 10100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: var(--color-modal-overlay);
  backdrop-filter: blur(4px);
}
.generating-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  max-width: 340px;
  padding: var(--space-8) var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  text-align: center;
}
.generating-title {
  margin: 0;
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}
.generating-hint {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  line-height: 1.5;
}

/* ── Responsivo ── */
@media (max-width: 640px) {
  .reports-card-head { padding: var(--space-4); }
  .reports-filters { width: 100%; }
  .filter-select { flex: 1; width: auto; min-width: 0; }
  .reports-table th:first-child,
  .reports-table td:first-child { padding-left: var(--space-4); }
  .reports-table th:last-child,
  .reports-table td:last-child { padding-right: var(--space-4); }
  .col-status { display: none; }
  .report-icon { display: none; }
}

/* ── Seleção múltipla ── */
.col-check {
  width: 44px;
}
.row-check {
  width: 16px;
  height: 16px;
  margin: 0;
  cursor: pointer;
  accent-color: var(--color-primary);
}
.reports-table tr.is-selected td {
  background: var(--color-surface-hover);
}
.selection-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin: 0 var(--space-5) var(--space-3);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.selection-count {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}
.selection-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* ── Ações da linha: ícones sempre visíveis ── */
.icon-action {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast);
}
.icon-action svg {
  width: 17px;
  height: 17px;
}
.icon-action:hover:not(:disabled) {
  background: var(--color-surface-muted);
  color: var(--color-text-strong);
}
.icon-action:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.icon-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.icon-action .spinning {
  animation: report-spin 0.9s linear infinite;
}
@keyframes report-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
