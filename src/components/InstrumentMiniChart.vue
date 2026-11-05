<script setup lang="ts">
import { PT_GROUPING } from '@/utils/numberFormat'
import { ref, computed, watch, onMounted } from 'vue'
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
import { chartColors, baseTooltip, heroYScale, lineDataset, crosshairPlugin, formatChartDate } from './charts/chartTheme'
import { useChartTheme } from './charts/useChartTheme'
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

const { isDark } = useChartTheme()
const plugins = [crosshairPlugin]

onMounted(() => fetchData())

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
  void isDark.value
  const c = chartColors()
  return change.value.up ? c.primary : c.expense
})

function fmtPrice(v: number): string {
  return new Intl.NumberFormat('pt-PT', { ...PT_GROUPING, style: 'currency', currency: props.currency || 'EUR' }).format(v)
}
function fmtPct(pct: number): string {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2).replace('.', ',')}%`
}

const currentPrice = computed(() => (hasData.value ? points.value[points.value.length - 1].value : null))

const chartKey = computed(() => `${isDark.value}-${period.value}-${points.value.length}`)

const chartData = computed(() => {
  const pts = points.value
  return {
    labels: pts.map((p) => p.date),
    datasets: [
      {
        ...lineDataset(lineColor.value, pts.map((p) => p.value), { label: 'Preço', tension: 0.15 }),
        clip: false as const,
      },
    ],
  }
})

const chartOptions = computed(() => {
  void isDark.value
  const pts = points.value
  const y = heroYScale('8%')
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    layout: { padding: { top: 8, right: 6, left: 2, bottom: 0 } },
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...baseTooltip(),
        callbacks: {
          title: (items: { dataIndex: number }[]) => {
            if (items.length === 0) return ''
            return formatChartDate(pts[items[0].dataIndex]?.date ?? '')
          },
          label: (ctx: { raw: unknown }) => fmtPrice(Number(ctx.raw)),
        },
      },
    },
    scales: {
      x: { display: false, grid: { display: false } },
      y: { ...y, grid: { ...y.grid, display: true } },
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
      <Line v-else :key="chartKey" :data="chartData" :options="chartOptions" :plugins="plugins" />
    </div>
  </div>
</template>

<style scoped>
.mini {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-3) var(--space-2);
  background: var(--color-surface);
}

.mini-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.mini-meta {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  min-height: 1.25rem;
}

.mini-price {
  font-size: var(--text-md);
  font-weight: var(--weight-bold);
  color: var(--color-text-strong);
  font-variant-numeric: tabular-nums;
}

.mini-change {
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  color: var(--color-primary-text);
  font-variant-numeric: tabular-nums;
}

.mini-change.neg {
  color: var(--color-danger);
}

.mini-chips {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
}

.mini-chip {
  padding: 3px 8px;
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
  font-family: inherit;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.mini-chip:hover {
  color: var(--color-text);
}

.mini-chip.active {
  color: var(--color-text-strong);
  background: var(--color-surface);
  box-shadow: var(--shadow-xs);
}

.mini-body {
  height: 130px;
  position: relative;
  margin-top: var(--space-2);
}

.mini-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.mini-empty {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.mini-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary-text);
  border-radius: 50%;
  animation: mini-spin 0.7s linear infinite;
}

@keyframes mini-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
