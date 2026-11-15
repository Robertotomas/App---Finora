<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import { compressLongView } from './compressLongView'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js'
import {
  chartColors,
  baseTooltip,
  heroYScale,
  lineDataset,
  crosshairPlugin,
  formatChartDate,
  formatCurrency,
  thinLabels,
  CHART_FONT,
  MONTH_LABELS,
} from './chartTheme'
import { useChartTheme } from './useChartTheme'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

export interface DailyBalancePoint {
  date: string
  balance: number
}

const props = defineProps<{
  points: DailyBalancePoint[]
  currency: string
  hideValues?: boolean
  period?: string
}>()

const emit = defineEmits<{
  hover: [point: { date: string; balance: number } | null]
}>()

const { isDark } = useChartTheme()
const plugins = [crosshairPlugin]

// Início do ano atual (no 5A). Pontos < cutoff = anos anteriores; >= cutoff = ano atual.
const cutoff = computed(() => {
  if (props.period !== '5A' || props.points.length === 0) return ''
  return props.points[props.points.length - 1].date.substring(0, 4) + '-01-01'
})
// No 5A: comprime os anos anteriores (planos) e dá largura ao ano atual (mostra os meses).
const displayPoints = computed(() => (props.period === '5A' ? compressLongView(props.points, cutoff.value) : props.points))

const chartKey = computed(() => `${isDark.value}-${displayPoints.value.length}-${props.period}`)

const tickLabels = computed<(string | null)[]>(() => {
  const pts = displayPoints.value
  const n = pts.length
  const labels: (string | null)[] = new Array(n).fill(null)
  if (n === 0) return labels

  const is5A = props.period === '5A'
  const minGap = Math.max(2, Math.round(n / 24))
  let lastShown = -Infinity
  const cut = cutoff.value

  for (let i = 0; i < n; i++) {
    const dateStr = pts[i]?.date
    if (!dateStr) continue
    const prev = i > 0 ? pts[i - 1]?.date : null

    let label: string | null = null
    if (is5A) {
      if (dateStr >= cut) {
        // Ano atual → meses.
        if (!prev || dateStr.substring(0, 7) !== prev.substring(0, 7)) label = MONTH_LABELS[Number(dateStr.substring(5, 7)) - 1]
      } else if (!prev || dateStr.substring(0, 4) !== prev.substring(0, 4)) {
        label = dateStr.substring(0, 4)
      }
    } else {
      const ym = dateStr.substring(0, 7)
      if (!prev || ym !== prev.substring(0, 7)) {
        label = MONTH_LABELS[Number(dateStr.substring(5, 7)) - 1]
      }
    }

    if (label !== null && i - lastShown >= minGap) {
      labels[i] = label
      lastShown = i
    }
  }
  return thinLabels(labels, 7)
})

const chartData = computed(() => {
  void isDark.value
  const pts = displayPoints.value
  const c = chartColors()
  return {
    labels: pts.map((p) => p.date),
    datasets: [
      {
        ...lineDataset(c.primary, pts.map((p) => p.balance), { label: 'Saldo', tension: 0.15 }),
        // Não cortar os pontos na fronteira: a bola do último ponto (hoje) fica inteira.
        clip: false as const,
      },
    ],
  }
})

const chartOptions = computed(() => {
  void isDark.value
  const c = chartColors()
  const cur = props.currency || 'EUR'
  const pts = displayPoints.value

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    // Folga no topo/lados para a bola do hover não ser cortada.
    layout: { padding: { top: 12, right: 8, left: 4, bottom: 0 } },
    interaction: { mode: 'index' as const, intersect: false },
    onHover: (_event: unknown, elements: { index: number }[]) => {
      if (elements.length > 0) {
        const pt = pts[elements[0].index]
        if (pt) emit('hover', { date: pt.date, balance: pt.balance })
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...baseTooltip(),
        callbacks: {
          title: (items: { dataIndex: number }[]) => {
            if (items.length === 0) return ''
            return formatChartDate(pts[items[0].dataIndex]?.date ?? '')
          },
          label: (ctx: { raw: unknown }) => (props.hideValues ? '••••••' : formatCurrency(Number(ctx.raw), cur)),
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: c.axis,
          font: CHART_FONT,
          padding: 8,
          maxRotation: 0,
          autoSkip: false,
          callback: function (_value: unknown, index: number) {
            return tickLabels.value[index] ?? null
          },
        },
      },
      // Folga acima do máximo e abaixo do mínimo (bola do topo inteira, linha não colada ao fundo).
      y: heroYScale('18%'),
    },
  }
})

function onMouseLeave() {
  emit('hover', null)
}
</script>

<template>
  <div class="net-worth-chart" @mouseleave="onMouseLeave">
    <div v-if="points.length === 0" class="chart-empty">Sem dados para mostrar</div>
    <Line v-else :key="chartKey" :data="chartData" :options="chartOptions" :plugins="plugins" />
  </div>
</template>

<style scoped>
.net-worth-chart {
  height: 220px;
  position: relative;
}

.chart-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

@media (max-width: 768px) {
  .net-worth-chart {
    height: 200px;
  }
}
</style>
