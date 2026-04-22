<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useHouseholdStore } from '@/stores/household'
import { useSubscriptionStore } from '@/stores/subscription'
import { reportsApi, type MonthlyReportListItem } from '@/api/reports'

const householdStore = useHouseholdStore()
const subscriptionStore = useSubscriptionStore()

/** Começa a true para não mostrar o estado vazio antes do primeiro pedido. */
const loading = ref(true)
const error = ref<string | null>(null)
const items = ref<MonthlyReportListItem[]>([])

const previewOpen = ref(false)
const previewUrl = ref<string | null>(null)
const previewLoading = ref(false)
const previewTitle = ref('')

/** Linha em regeneração de PDF */
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
  return d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
}

function formatGenerated(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-PT')
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
  <div class="reports-view">
    <div class="page-header">
      <h1>Relatórios</h1>
      <p class="subtitle">PDFs mensais com resumo de receitas, despesas e gráficos.</p>
    </div>

    <div v-if="!householdStore.household && !householdStore.loading" class="empty-state">
      <p>Configura primeiro o teu household.</p>
      <router-link to="/dashboard" class="link">Ir para o painel</router-link>
    </div>

    <div v-else-if="householdStore.loading" class="loading-state">
      <div class="spinner"></div>
      <p>A carregar…</p>
    </div>

    <template v-else>
      <div class="reports-shell-wrap" :class="{ 'reports-shell-wrap--locked': reportsLocked }">
        <div class="reports-shell-inner">
          <div v-if="error && !reportsLocked" class="global-error">{{ error }}</div>

          <div v-if="loading" class="loading-state">
            <div class="spinner"></div>
            <p>A carregar relatórios…</p>
          </div>

          <div v-else-if="!reportsLocked && items.length === 0" class="empty-state">
            <p>Ainda não há relatórios gerados.</p>
            <p class="hint">
              No dia 1 de cada mês é criado automaticamente o PDF do mês anterior (planos Pro/Couple), com base no teu
              fuso horário no perfil.
            </p>
          </div>

          <div v-else-if="!reportsLocked" class="reports-cards">
            <article v-for="row in items" :key="row.id" class="report-card">
              <div class="report-card__main">
                <div class="report-card__info">
                  <h3 class="report-card__period">{{ formatMonthYear(row) }}</h3>
                  <p class="report-card__generated">Gerado em {{ formatGenerated(row.generatedAt) }}</p>
                </div>
                <div class="report-card__toolbar">
                  <div class="action-buttons">
                    <button
                      type="button"
                      class="btn-icon-preview"
                      title="Pré-visualizar"
                      aria-label="Pré-visualizar PDF"
                      @click="openPreview(row)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      class="btn-icon-download"
                      title="Descarregar PDF"
                      aria-label="Descarregar PDF"
                      @click="downloadReport(row)"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" x2="12" y1="15" y2="3" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              <div class="report-card__footer">
                <div class="report-card__footer-copy">
                  <p class="report-card__message">Alteraste transações neste mês?</p>
                  <p class="report-card__hint">
                    Podes atualizar o PDF com os dados mais recentes.
                  </p>
                </div>
                <button
                  type="button"
                  class="btn-refresh-pdf"
                  :disabled="refreshingId === row.id"
                  :aria-busy="refreshingId === row.id"
                  @click="refreshReportPdf(row)"
                >
                  {{ refreshingId === row.id ? 'A atualizar…' : 'Atualizar PDF' }}
                </button>
              </div>
            </article>
          </div>
        </div>

        <div v-if="reportsLocked" class="reports-lock-overlay" aria-hidden="true">
          <div class="reports-lock-panel">
            <p class="reports-lock-title">Relatórios PDF nos planos Pro e Couple</p>
            <p class="reports-lock-text">
              Sobe de plano para listar e descarregar relatórios mensais automáticos com gráficos e totais.
            </p>
            <router-link :to="{ name: 'subscription' }" class="reports-lock-cta">Ver planos</router-link>
          </div>
        </div>
      </div>
    </template>

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
            <button type="button" class="pdf-preview-close" aria-label="Fechar pré-visualização" @click="closePreview">
              ×
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
.reports-view {
  max-width: min(960px, 100%);
  margin: 0 auto;
  padding: 0 0 2.5rem;
}

.page-header {
  margin-bottom: 1.5rem;
}

.page-header h1 {
  margin: 0 0 0.35rem;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
}

.subtitle {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--color-text-muted);
}

.loading-state {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--color-text-muted);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border);
  border-top-color: #166534;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-state {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--color-text-muted);
}

.empty-state .hint {
  margin-top: 0.75rem;
  font-size: 0.875rem;
  line-height: 1.45;
  max-width: 480px;
  margin-left: auto;
  margin-right: auto;
}

.link {
  color: #166534;
  font-weight: 600;
}

.global-error {
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  background: #fef2f2;
  color: var(--color-error);
  border: 1px solid #fecaca;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

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
  padding: 1.25rem 1.5rem;
  border-radius: 12px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.reports-lock-title {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
}

.reports-lock-text {
  margin: 0 0 1rem;
  font-size: 0.875rem;
  line-height: 1.45;
  color: var(--color-text-muted);
}

.reports-lock-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  padding: 0.4rem 0.85rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #fff;
  background: #166534;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.reports-lock-cta:hover {
  background: #15803d;
  color: #fff;
}

.reports-cards {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.report-card {
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--color-bg-card);
}

.report-card__main {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--color-border);
}

.report-card__info {
  min-width: 0;
}

.report-card__period {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
  line-height: 1.25;
}

.report-card__generated {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.report-card__toolbar {
  flex-shrink: 0;
}

.report-card__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem 1rem;
  padding: 0.75rem 1rem 0.9rem;
  background: var(--color-bg-muted, rgba(0, 0, 0, 0.03));
}

.report-card__footer-copy {
  min-width: min(100%, 12rem);
  flex: 1;
}

.report-card__message {
  margin: 0 0 0.25rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
}

.report-card__hint {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: var(--color-text-muted);
}

.btn-refresh-pdf {
  flex-shrink: 0;
  align-self: center;
  margin-left: auto;
  padding: 0.4rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #fff;
  background: #166534;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s ease;
}

.btn-refresh-pdf:hover:not(:disabled) {
  background: #15803d;
}

.btn-refresh-pdf:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.action-buttons {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: nowrap;
  justify-content: flex-end;
}

.btn-icon-preview {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-card);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.btn-icon-preview:hover {
  background: var(--color-bg-muted, rgba(0, 0, 0, 0.06));
  color: #166534;
  border-color: #166534;
}

.btn-icon-download {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-card);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.btn-icon-download:hover {
  background: var(--color-bg-muted, rgba(0, 0, 0, 0.06));
  color: #166534;
  border-color: #166534;
}

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
  border-radius: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.pdf-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.pdf-preview-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pdf-preview-close {
  flex-shrink: 0;
  width: 2.25rem;
  height: 2.25rem;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
}

.pdf-preview-close:hover {
  background: var(--color-bg-muted, rgba(0, 0, 0, 0.06));
  color: var(--color-text);
}

.pdf-preview-body {
  position: relative;
  flex: 1;
  min-height: 0;
  background: var(--color-bg-muted, #1e1e1e);
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
</style>
