<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useHouseholdStore } from '@/stores/household'
import { useSubscriptionStore } from '@/stores/subscription'
import { reportsApi, type MonthlyReportListItem } from '@/api/reports'
import PlanUpsellCard from '@/components/PlanUpsellCard.vue'

const householdStore = useHouseholdStore()
const subscriptionStore = useSubscriptionStore()

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

const yearDropOpen = ref(false)
const monthDropOpen = ref(false)
const yearDropRef = ref<HTMLElement | null>(null)
const monthDropRef = ref<HTMLElement | null>(null)

function toggleYearDrop() { yearDropOpen.value = !yearDropOpen.value; monthDropOpen.value = false }
function toggleMonthDrop() { monthDropOpen.value = !monthDropOpen.value; yearDropOpen.value = false }

function pickYear(val: number | null) {
  filterYear.value = val
  yearDropOpen.value = false
  if (filterMonth.value && !availableMonths.value.includes(filterMonth.value)) {
    filterMonth.value = null
  }
}

function pickMonth(val: number | null) {
  filterMonth.value = val
  monthDropOpen.value = false
}

const yearLabel = computed(() => filterYear.value ? String(filterYear.value) : 'Todos os anos')
const monthFilterLabel = computed(() => filterMonth.value ? monthLabel(filterMonth.value) : 'Todos os meses')

function onFilterOutsideClick(e: MouseEvent) {
  const t = e.target as Node
  if (yearDropOpen.value && yearDropRef.value && !yearDropRef.value.contains(t)) yearDropOpen.value = false
  if (monthDropOpen.value && monthDropRef.value && !monthDropRef.value.contains(t)) monthDropOpen.value = false
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
    error.value = 'Não foi possível carregar o PDF.'
    previewOpen.value = false
  } finally {
    previewLoading.value = false
  }
}

async function downloadReport(row: MonthlyReportListItem) {
  if (reportsLocked.value) return
  try {
    const blob = await reportsApi.downloadBlob(row.id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `finora-relatorio-${row.year}-${String(row.month).padStart(2, '0')}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    error.value = 'Não foi possível descarregar o PDF.'
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
  } catch (e: unknown) {
    const err = e as { rateLimited?: boolean; rateLimitMessage?: string; response?: { status?: number; data?: { message?: string } } }
    if (err.rateLimited) {
      error.value = err.rateLimitMessage || 'Demasiados pedidos. Tenta novamente dentro de 1 minuto.'
    } else if (err.response?.status === 403) {
      error.value = 'Atualizar relatórios está disponível nos planos Pro e Couple.'
    } else {
      error.value = err.response?.data?.message ?? 'Não foi possível atualizar o PDF.'
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
  document.addEventListener('click', onFilterOutsideClick, true)
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
  document.removeEventListener('click', onFilterOutsideClick, true)
  closePreview()
})
</script>

<template>
  <div class="reports-page">
    <!-- Loading until household + subscription resolved -->
    <div v-if="!pageReady" class="loading-state">
      <div class="spinner"></div>
      <p>A carregar…</p>
    </div>

    <!-- No household -->
    <div v-else-if="!householdStore.household" class="empty-state">
      <p>Configure primeiro o seu household.</p>
      <router-link to="/overview" class="link">Ir para o painel</router-link>
    </div>

    <template v-else>
      <!-- Page header -->
      <div class="page-header">
        <div class="page-header-text">
          <h1 class="page-title">Relatórios</h1>
          <p class="page-subtitle">Relatórios mensais com resumo de receitas, despesas e gráficos</p>
        </div>
      </div>

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

      <div v-else class="reports-shell-wrap">
        <div class="reports-shell-inner">
          <!-- Global error -->
          <div v-if="error" class="global-error">{{ error }}</div>

          <!-- Loading reports -->
          <div v-if="loading" class="loading-state">
            <div class="spinner"></div>
            <p>A carregar relatórios…</p>
          </div>

          <!-- Empty state -->
          <div v-else-if="!loading && items.length === 0" class="empty-card">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="empty-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            <p class="empty-text">Ainda não há relatórios</p>
            <p class="empty-hint">Os relatórios são gerados automaticamente ao fim de cada mês.</p>
          </div>

          <!-- Reports list -->
          <template v-else-if="items.length > 0">
            <div class="reports-toolbar">
              <div class="section-label" style="margin-bottom:0">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/></svg>
                Relatórios Mensais
              </div>
              <div class="reports-filters">
                <div ref="yearDropRef" class="custom-dropdown">
                  <button type="button" class="custom-dropdown-btn" :class="{ active: filterYear !== null }" @click.stop="toggleYearDrop">
                    <span>{{ yearLabel }}</span>
                    <svg class="custom-dropdown-chevron" :class="{ open: yearDropOpen }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                  <Transition name="panel">
                    <div v-show="yearDropOpen" class="custom-dropdown-panel" @click.stop>
                      <button type="button" class="custom-dropdown-item" :class="{ selected: filterYear === null }" @click="pickYear(null)">Todos os anos</button>
                      <button v-for="y in availableYears" :key="y" type="button" class="custom-dropdown-item" :class="{ selected: filterYear === y }" @click="pickYear(y)">{{ y }}</button>
                    </div>
                  </Transition>
                </div>
                <div ref="monthDropRef" class="custom-dropdown">
                  <button type="button" class="custom-dropdown-btn" :class="{ active: filterMonth !== null }" @click.stop="toggleMonthDrop">
                    <span>{{ monthFilterLabel }}</span>
                    <svg class="custom-dropdown-chevron" :class="{ open: monthDropOpen }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                  <Transition name="panel">
                    <div v-show="monthDropOpen" class="custom-dropdown-panel" @click.stop>
                      <button type="button" class="custom-dropdown-item" :class="{ selected: filterMonth === null }" @click="pickMonth(null)">Todos os meses</button>
                      <button v-for="m in availableMonths" :key="m" type="button" class="custom-dropdown-item" :class="{ selected: filterMonth === m }" @click="pickMonth(m)">{{ monthLabel(m) }}</button>
                    </div>
                  </Transition>
                </div>
              </div>
            </div>

            <div v-if="filteredItems.length === 0" class="empty-card" style="margin-top:0.5rem">
              <p class="empty-text">Nenhum relatório encontrado</p>
              <p class="empty-hint">Tenta ajustar os filtros.</p>
            </div>

            <div v-else class="reports-grid">
              <div v-for="row in filteredItems" :key="row.id" class="report-card">
                <div class="report-card__main">
                  <!-- Icon -->
                  <div class="card-icon-wrap">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/></svg>
                  </div>

                  <!-- Info -->
                  <div class="card-body">
                    <h3 class="card-name">{{ formatMonthYear(row) }}</h3>
                    <p class="card-meta">Gerado em {{ formatGenerated(row.generatedAt) }}</p>
                    <div class="card-tags">
                      <span class="card-tag">PDF</span>
                      <span class="card-tag">{{ formatFileSize(row.fileSizeBytes) }}</span>
                    </div>
                  </div>

                  <!-- Actions -->
                  <div class="card-actions">
                    <button
                      type="button"
                      class="action-btn"
                      title="Pré-visualizar"
                      @click="openPreview(row)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    <button
                      type="button"
                      class="action-btn action-btn--download"
                      title="Descarregar PDF"
                      @click="downloadReport(row)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    </button>
                  </div>
                </div>

                <!-- Footer: refresh row -->
                <div class="report-card__footer">
                  <p class="card-hint">Alterou transações? Atualize o PDF.</p>
                  <button
                    type="button"
                    class="action-btn action-btn--refresh"
                    title="Atualizar PDF"
                    :disabled="refreshingId === row.id"
                    @click="refreshReportPdf(row)"
                  >
                    <svg v-if="refreshingId !== row.id" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.22-8.56"/><polyline points="21 3 21 9 15 9"/></svg>
                    <div v-else class="spinner-sm"></div>
                  </button>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>

    <!-- Generating overlay -->
    <Teleport to="body">
      <div v-if="generatingOverlay" class="generating-overlay">
        <div class="generating-panel">
          <div class="spinner"></div>
          <p class="generating-title">A gerar relatório…</p>
          <p class="generating-hint">Isto pode demorar alguns segundos. Não feches nem mudes de página.</p>
        </div>
      </div>
    </Teleport>

    <!-- PDF Preview modal -->
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
            <button type="button" class="action-btn" aria-label="Fechar pré-visualização" @click="closePreview">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
            </button>
          </div>
          <div class="pdf-preview-body">
            <div v-if="previewLoading" class="preview-inline-loading">
              <div class="spinner"></div>
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
  max-width: min(860px, 100%);
  margin: 0 auto;
  padding: 0 0 3rem;
}

/* ── Page header ── */
.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.page-header-text {
  min-width: 0;
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

/* ── Section label ── */
.section-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 0.75rem;
}

/* ── Reports toolbar ── */
.reports-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.reports-filters {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* ── Custom dropdowns (same as TransactionsView) ── */
.custom-dropdown {
  position: relative;
}

.custom-dropdown-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4375rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 0.8125rem;
  font-family: inherit;
  font-weight: 500;
  background: var(--color-input-bg);
  color: var(--color-text);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  white-space: nowrap;
}

.custom-dropdown-btn:hover {
  border-color: var(--color-text-muted);
}

.custom-dropdown-btn.active {
  border-color: var(--color-text-muted);
  color: var(--color-text);
}

.custom-dropdown-chevron {
  flex-shrink: 0;
  color: var(--color-text-muted);
  transition: transform 0.2s ease;
}

.custom-dropdown-chevron.open {
  transform: rotate(180deg);
}

.custom-dropdown-panel {
  position: absolute;
  top: calc(100% + 0.375rem);
  left: 0;
  z-index: 50;
  min-width: 100%;
  max-height: 260px;
  overflow-y: auto;
  padding: 0.375rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg-card);
  box-shadow: 0 8px 24px -4px rgba(15, 23, 42, 0.12);
}

.custom-dropdown-item {
  display: block;
  width: 100%;
  padding: 0.4375rem 0.625rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  font-size: 0.8125rem;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s;
  white-space: nowrap;
}

.custom-dropdown-item:hover {
  background: var(--color-table-row-hover);
}

.custom-dropdown-item.selected {
  background: rgba(22, 101, 52, 0.1);
  color: #166534;
  font-weight: 600;
}

html.dark .custom-dropdown-item.selected {
  background: rgba(74, 222, 128, 0.12);
  color: #4ade80;
}

.panel-enter-active,
.panel-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ── Reports grid ── */
.reports-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.875rem;
}

.report-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  overflow: hidden;
  transition: box-shadow 0.2s, transform 0.2s;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
}

.report-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.report-card__main {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  padding: 1.125rem 1.25rem;
}

.report-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.625rem 1.25rem;
  border-top: 1px solid var(--color-border);
  background: var(--color-table-row-hover);
}

/* ── Card icon ── */
.card-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 10px;
  background: #ecfdf5;
  color: #166534;
}

html.dark .card-icon-wrap {
  background: rgba(22, 101, 52, 0.2);
  color: #4ade80;
}

/* ── Card body ── */
.card-body {
  flex: 1;
  min-width: 0;
}

.card-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 0.25rem;
}

.card-meta {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0 0 0.5rem;
}

.card-hint {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.4;
}

.card-tags {
  display: flex;
  gap: 0.375rem;
}

.card-tag {
  display: inline-block;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--color-text-muted);
  background: var(--color-table-row-hover);
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
}

/* ── Card actions ── */
.card-actions {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex-shrink: 0;
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
}

.action-btn:hover {
  background: var(--color-table-row-hover);
  color: var(--color-text);
  border-color: var(--color-text-muted);
}

.action-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.action-btn--download:hover {
  color: #166534;
  border-color: #bbf7d0;
  background: #f0fdf4;
}

html.dark .action-btn--download:hover {
  color: #4ade80;
  border-color: rgba(74, 222, 128, 0.3);
  background: rgba(74, 222, 128, 0.1);
}

.action-btn--refresh:hover:not(:disabled) {
  color: #2563eb;
  border-color: #bfdbfe;
  background: #eff6ff;
}

html.dark .action-btn--refresh:hover:not(:disabled) {
  color: #4ade80;
  border-color: rgba(74, 222, 128, 0.3);
  background: rgba(74, 222, 128, 0.1);
}

.spinner-sm {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border);
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* ── Buttons ── */
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
  border-radius: 10px;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s, transform 0.15s;
}

.btn-confirm:hover {
  background: #15803d;
  transform: translateY(-1px);
}

/* ── Empty state ── */
.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem 1.5rem;
  background: var(--color-bg-card);
  border: 1px dashed var(--color-border);
  border-radius: 14px;
  text-align: center;
}

.empty-icon {
  color: var(--color-text-muted);
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-text {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 0.25rem;
}

.empty-hint {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.5;
  max-width: 400px;
}

/* ── Loading / Error ── */
.loading-state,
.empty-state {
  text-align: center;
  padding: 3rem;
  color: var(--color-text-muted);
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--color-border);
  border-top-color: #166534;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.global-error {
  padding: 0.625rem 1rem;
  background: #fef2f2;
  color: #dc2626;
  border-radius: 10px;
  font-size: 0.8125rem;
  margin-bottom: 1rem;
}

html.dark .global-error {
  background: rgba(220, 38, 38, 0.1);
  color: #f87171;
}

.link {
  color: #166534;
  font-weight: 600;
}

/* ── PDF Preview modal ── */
.pdf-preview-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
}

.pdf-preview-dialog {
  display: flex;
  flex-direction: column;
  width: min(960px, 100%);
  height: min(88vh, 900px);
  max-height: 100%;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.pdf-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.pdf-preview-title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pdf-preview-body {
  position: relative;
  flex: 1;
  min-height: 0;
  background: var(--color-bg-muted, #f5f5f5);
}

html.dark .pdf-preview-body {
  background: #1a1a1a;
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
  gap: 0.75rem;
  height: 100%;
  min-height: 280px;
  color: var(--color-text-muted);
}

/* ── Placeholder cards (locked state) ── */
/* ── Generating overlay ── */
.generating-overlay {
  position: fixed;
  inset: 0;
  z-index: 10100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.generating-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  max-width: 340px;
  padding: 2.5rem 2rem;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
  text-align: center;
}

.generating-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
}

.generating-hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  line-height: 1.5;
}

/* ── Responsive ── */
@media (max-width: 600px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .stat-cards {
    grid-template-columns: 1fr;
  }

  .reports-grid {
    grid-template-columns: 1fr;
  }

  .reports-toolbar {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
