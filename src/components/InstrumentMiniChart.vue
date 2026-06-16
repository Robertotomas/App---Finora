<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js'
import { investmentsApi } from '@/api/investments'
import type { InstrumentPricePoint } from '@/types/investment'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

const props = defineProps<{
  symbol: string
  currency: string
}>()

type Period = 'ytd' | '3m' | '6m' | '1y' | '5y'
const periods: { value: Period; label: string }[] = [
  { value: 'ytd', label: 'YTD' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1A' },
  { value: '5y', label: '5A' },
]
const period = ref<Period>('1y')

const loading = ref(false)
const points = ref<InstrumentPricePoint[]>([])
let reqSeq = 0

const isDark = ref(document.documentElement.classList.contains('dark'))
let observer: MutationObserver | null = null

onMounted(() => {
  observer = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('dark')
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  fetchData()
})
onBeforeUnmount(() => observer?.disconnect())

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function dayStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function rangeFor(p: Period): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  if (p === 'ytd') from.setMonth(0, 1)
  else if (p === '3m') from.setMonth(from.getMonth() - 3)
  else if (p === '6m') from.setMonth(from.getMonth() - 6)
  else if (p === '1y') from.setFullYear(from.getFullYear() - 1)
  else from.setFullYear(from.getFullYear() - 5)
  return { from: dayStr(from), to: dayStr(to) }
}

async function fetchData() {
  if (!props.symbol) return
  const seq = ++reqSeq
  loading.value = true
  try {
    const { data } = await investmentsApi.quoteHistory(props.symbol, rangeFor(period.value))
    if (seq !== reqSeq) return
    points.value = data.points
  } catch {
    if (seq === reqSeq) points.value = []
  } finally {
    if (seq === reqSeq) loading.value = false
  }
}

watch(() => props.symbol, () => fetchData())
function selectPeriod(p: Period) {
  if (period.value === p) return
  period.value = p
  fetchData()
}

const hasData = computed(() => points.value.length >= 2)

const change = computed(() => {
  if (!hasData.value) return { abs: 0, pct: null as number | null, up: true }
  const first = points.value[0].value
  const last = points.value[points.value.length - 1].value
  const abs = last - first
  const pct = first !== 0 ? (abs / Math.abs(first)) * 100 : null
  return { abs, pct, up: abs >= 0 }
})

const lineColor = computed(() => {
  if (change.value.up) return isDark.value ? '#4ade80' : '#166534'
  return isDark.value ? '#f87171' : '#dc2626'
})

function fmtPrice(v: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: props.currency || 'EUR' }).format(v)
}
function fmtPct(pct: number): string {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2).replace('.', ',')}%`
}

const currentPrice = computed(() => (hasData.value ? points.value[points.value.length - 1].value : null))

const chartKey = computed(() => `${isDark.value}-${period.value}-${points.value.length}`)

const chartData = computed(() => {
  const pts = points.value
  const color = lineColor.value
  return {
    labels: pts.map((p) => p.date),
    datasets: [
      {
        label: 'Preço',
        data: pts.map((p) => p.value),
        clip: false as const,
        borderColor: color,
        borderWidth: 2,
        backgroundColor: (ctx: { chart: { ctx: CanvasRenderingContext2D; chartArea?: { top: number; bottom: number } } }) => {
          const chart = ctx.chart
          if (!chart.chartArea) return 'transparent'
          const g = chart.ctx.createLinearGradient(0, chart.chartArea.top, 0, chart.chartArea.bottom)
          const up = change.value.up
          if (up) {
            g.addColorStop(0, isDark.value ? 'rgba(74, 222, 128, 0.22)' : 'rgba(22, 101, 52, 0.14)')
            g.addColorStop(1, isDark.value ? 'rgba(74, 222, 128, 0.01)' : 'rgba(22, 101, 52, 0.01)')
          } else {
            g.addColorStop(0, isDark.value ? 'rgba(248, 113, 113, 0.22)' : 'rgba(220, 38, 38, 0.12)')
            g.addColorStop(1, isDark.value ? 'rgba(248, 113, 113, 0.01)' : 'rgba(220, 38, 38, 0.01)')
          }
          return g
        },
        fill: true,
        tension: 0.18,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: isDark.value ? '#0a0a0a' : '#fff',
        pointHoverBorderWidth: 2,
      },
    ],
  }
})

const chartOptions = computed(() => {
  const dark = isDark.value
  const pts = points.value
  return {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 12, right: 6, left: 2, bottom: 0 } },
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: dark ? '#161616' : '#fff',
        titleColor: dark ? '#d4d4d4' : '#334155',
        bodyColor: dark ? '#fafafa' : '#0f172a',
        borderColor: dark ? '#2a2a2a' : '#e2e8f0',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        titleFont: { size: 11, weight: 'normal' as const },
        bodyFont: { size: 12, weight: 'bold' as const },
        displayColors: false,
        callbacks: {
          title: (items: { dataIndex: number }[]) => {
            if (items.length === 0) return ''
            const ds = pts[items[0].dataIndex]?.date
            if (!ds) return ''
            const d = new Date(ds + 'T00:00:00')
            return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })
          },
          label: (ctx: { raw: unknown }) => fmtPrice(Number(ctx.raw)),
        },
      },
    },
    scales: {
      x: { display: false, grid: { display: false } },
      y: { display: false, grace: '8%' },
    },
  }
})
</script>

<template>
  <div class="mini">
    <div class="mini-head">
      <div class="mini-meta">
        <span v-if="currentPrice !== null" class="mini-price">{{ fmtPrice(currentPrice) }}</span>
        <span
          v-if="change.pct !== null"
          class="mini-change"
          :class="{ neg: !change.up }"
        >
          {{ fmtPct(change.pct) }}
        </span>
      </div>
      <div class="mini-chips">
        <button
          v-for="p in periods"
          :key="p.value"
          type="button"
          class="mini-chip"
          :class="{ active: period === p.value }"
          @click="selectPeriod(p.value)"
        >
          {{ p.label }}
        </button>
      </div>
    </div>

    <div class="mini-body">
      <div v-if="loading" class="mini-state">
        <span class="mini-spinner"></span>
      </div>
      <div v-else-if="!hasData" class="mini-state">
        <span class="mini-empty">Sem cotações para este período</span>
      </div>
      <Line v-else :key="chartKey" :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

<style scoped>
.mini {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 0.75rem 0.875rem 0.5rem;
  background: var(--color-bg-card);
}

.mini-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.mini-meta {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  min-height: 1.25rem;
}

.mini-price {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-text);
}

.mini-change {
  font-size: 0.75rem;
  font-weight: 700;
  color: #166534;
}

html.dark .mini-change {
  color: #4ade80;
}

.mini-change.neg {
  color: #dc2626;
}

html.dark .mini-change.neg {
  color: #f87171;
}

.mini-chips {
  display: flex;
  gap: 0.2rem;
}

.mini-chip {
  padding: 0.2rem 0.45rem;
  font-size: 0.6875rem;
  font-weight: 600;
  font-family: inherit;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.mini-chip:hover {
  color: var(--color-text);
  background: var(--color-table-row-hover);
}

.mini-chip.active {
  color: #166534;
  background: rgba(22, 101, 52, 0.1);
}

html.dark .mini-chip.active {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.12);
}

.mini-body {
  height: 130px;
  position: relative;
  margin-top: 0.25rem;
}

.mini-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.mini-empty {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.mini-spinner {
  width: 22px;
  height: 22px;
  border: 2.5px solid var(--color-border);
  border-top-color: #166534;
  border-radius: 50%;
  animation: mini-spin 0.7s linear infinite;
}

@keyframes mini-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
