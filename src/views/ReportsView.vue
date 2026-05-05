<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useHouseholdStore } from '@/stores/household'
import { useSubscriptionStore } from '@/stores/subscription'
import { reportsApi, type MonthlyReportListItem } from '@/api/reports'

const householdStore = useHouseholdStore()
const subscriptionStore = useSubscriptionStore()

const loading = ref(true)
const error = ref<string | null>(null)
const items = ref<MonthlyReportListItem[]>([])

const previewOpen = ref(false)
const previewUrl = ref<string | null>(null)
const previewLoading = ref(false)
const previewTitle = ref('')

const refreshingId = ref<string | null>(null)

const reportsLocked = computed(() => !subscriptionStore.canAccessMonthlyReports)

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

async function refreshReportPdf(row: MonthlyReportListItem) {
  if (reportsLocked.value || refreshingId.value) return
  refreshingId.value = row.id
  error.value = null
  try {
    const updated = await reportsApi.refresh(row.id)
    const idx = items.value.findIndex((x) => x.id === row.id)
    if (idx >= 0) items.value[idx] = updated
    closePreview()
  } catch (e: unknown) {
    const err = e as { response?: { status?: number; data?: { message?: string } } }
    if (err.response?.status === 403) {
      error.value = 'Atualizar relatórios está disponível nos planos Pro e Couple.'
    } else {
      error.value = err.response?.data?.message ?? 'Não foi possível atualizar o PDF.'
    }
  } finally {
    refreshingId.value = null
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
  await load()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  closePreview()
})
</script>

<template>
  <div class="reports-page">
    <!-- No household -->
    <div v-if="!householdStore.household && !householdStore.loading" class="empty-state">
      <p>Configura primeiro o teu household.</p>
      <router-link to="/dashboard" class="link">Ir para o painel</router-link>
    </div>

    <!-- Loading household -->
    <div v-else-if="householdStore.loading" class="loading-state">
      <div class="spinner"></div>
      <p>A carregar…</p>
    </div>

    <template v-else>
      <!-- Page header -->
      <div class="page-header">
        <div class="page-header-text">
          <h1 class="page-title">Relatórios</h1>
          <p class="page-subtitle">PDFs mensais com resumo de receitas, despesas e gráficos</p>
        </div>
      </div>

      <div class="reports-shell-wrap" :class="{ 'reports-shell-wrap--locked': reportsLocked }">
        <div class="reports-shell-inner">
          <!-- Global error -->
          <div v-if="error && !reportsLocked" class="global-error">{{ error }}</div>

          <!-- Loading reports -->
          <div v-if="loading" class="loading-state">
            <div class="spinner"></div>
            <p>A carregar relatórios…</p>
          </div>

          <!-- Empty state -->
          <div v-else-if="!reportsLocked && items.length === 0" class="empty-card">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="empty-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            <p class="empty-text">Ainda não há relatórios</p>
            <p class="empty-hint">Os relatórios são gerados automaticamente quando a API está ativa, com base no teu fuso horário no perfil.</p>
          </div>

          <!-- Reports list -->
          <template v-else-if="!reportsLocked">
            <div class="section-label">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/></svg>
              Relatórios Mensais
            </div>
            <div class="reports-grid">
              <div v-for="row in items" :key="row.id" class="report-card">
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
                  <p class="card-hint">Alteraste transações? Atualiza o PDF.</p>
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

        <!-- Lock overlay -->
        <div v-if="reportsLocked" class="reports-lock-overlay" aria-hidden="true">
          <div class="reports-lock-panel">
            <div class="lock-icon-wrap">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <p class="reports-lock-title">Relatórios PDF nos planos Pro e Couple</p>
            <p class="reports-lock-text">
              Sobe de plano para listar e descarregar relatórios mensais automáticos com gráficos e totais.
            </p>
            <router-link :to="{ name: 'subscription' }" class="btn-confirm">Ver planos</router-link>
          </div>
        </div>
      </div>
    </template>

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
  color: #60a5fa;
  border-color: rgba(96, 165, 250, 0.3);
  background: rgba(96, 165, 250, 0.1);
}

.spinner-sm {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border);
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* ── Shell wrap (lock) ── */
.reports-shell-wrap {
  position: relative;
}

.reports-shell-wrap--locked .reports-shell-inner {
  filter: blur(9px) grayscale(0.25);
  opacity: 0.52;
  pointer-events: none;
  user-select: none;
}

.reports-lock-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.06);
  pointer-events: none;
}

html.dark .reports-lock-overlay {
  background: rgba(0, 0, 0, 0.28);
}

.reports-lock-panel {
  pointer-events: auto;
  max-width: 420px;
  text-align: center;
  padding: 2rem 1.75rem;
  border-radius: 14px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.lock-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--color-table-row-hover);
  color: var(--color-text-muted);
  margin-bottom: 1rem;
}

.reports-lock-title {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
}

.reports-lock-text {
  margin: 0 0 1.25rem;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: var(--color-text-muted);
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
}
</style>
