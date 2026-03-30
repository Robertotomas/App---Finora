<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useHouseholdStore } from '@/stores/household'
import { useSubscriptionStore } from '@/stores/subscription'
import { reportsApi, type MonthlyReportListItem } from '@/api/reports'

const householdStore = useHouseholdStore()
const subscriptionStore = useSubscriptionStore()

/** Começa a true para não mostrar o estado vazio antes do primeiro pedido. */
const loading = ref(true)
const error = ref<string | null>(null)
const items = ref<MonthlyReportListItem[]>([])

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

function formatMonthYear(row: MonthlyReportListItem): string {
  const d = new Date(row.year, row.month - 1, 1)
  return d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
}

function formatGenerated(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-PT')
}

onMounted(async () => {
  try {
    await householdStore.fetchHousehold()
    await subscriptionStore.fetchSubscription()
  } catch {
    /* store handles */
  }
  await load()
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
      <router-link to="/household" class="link">Ir para Household</router-link>
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

          <div v-else-if="!reportsLocked" class="table-container">
            <table class="reports-table">
              <thead>
                <tr>
                  <th>Período</th>
                  <th>Gerado em</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in items" :key="row.id">
                  <td>{{ formatMonthYear(row) }}</td>
                  <td>{{ formatGenerated(row.generatedAt) }}</td>
                  <td class="cell-actions">
                    <button type="button" class="btn-download" @click="downloadReport(row)">Descarregar PDF</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="reportsLocked" class="reports-lock-overlay" aria-hidden="true">
          <div class="reports-lock-panel">
            <p class="reports-lock-title">Relatórios PDF nos planos Pro e Couple</p>
            <p class="reports-lock-text">
              Sobe de plano para listar e descarregar relatórios mensais automáticos com gráficos e totais.
            </p>
            <router-link :to="{ name: 'subscription' }" class="btn-download reports-lock-cta">Ver planos</router-link>
          </div>
        </div>
      </div>
    </template>
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
  color: #dc2626;
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
}

.table-container {
  overflow-x: auto;
}

.reports-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9375rem;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
}

.reports-table th,
.reports-table td {
  padding: 0.75rem 1rem;
  text-align: left;
  border-bottom: 1px solid var(--color-border);
}

.reports-table th {
  background: var(--color-bg-muted, rgba(0, 0, 0, 0.03));
  font-weight: 600;
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.reports-table tr:last-child td {
  border-bottom: none;
}

.cell-actions {
  text-align: right;
  width: 1%;
  white-space: nowrap;
}

.btn-download {
  padding: 0.4rem 0.85rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #fff;
  background: #166534;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.btn-download:hover {
  background: #15803d;
}
</style>
