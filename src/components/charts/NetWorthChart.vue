<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
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

const isDark = ref(document.documentElement.classList.contains('dark'))
let observer: MutationObserver | null = null

onMounted(() => {
  observer = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('dark')
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

onBeforeUnmount(() => {
  observer?.disconnect()
})

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

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
        if (!prev || dateStr.substring(0, 7) !== prev.substring(0, 7)) label = MONTH_NAMES[Number(dateStr.substring(5, 7)) - 1]
      } else if (!prev || dateStr.substring(0, 4) !== prev.substring(0, 4)) {
        label = dateStr.substring(0, 4)
      }
    } else {
      const ym = dateStr.substring(0, 7)
      if (!prev || ym !== prev.substring(0, 7)) {
        label = MONTH_NAMES[Number(dateStr.substring(5, 7)) - 1]
      }
    }

    if (label !== null && i - lastShown >= minGap) {
      labels[i] = label
      lastShown = i
    }
  }
  return labels
})

const chartData = computed(() => {
  const pts = displayPoints.value
  const dark = isDark.value

  return {
    labels: pts.map((p) => p.date),
    datasets: [
      {
        label: 'Saldo',
        data: pts.map((p) => p.balance),
        // Não cortar os pontos na fronteira: a bola do último ponto (hoje) fica inteira.
        clip: false as const,
        borderColor: dark ? '#4ade80' : '#166534',
        borderWidth: 2.5,
        backgroundColor: (ctx: { chart: { ctx: CanvasRenderingContext2D; chartArea?: { top: number; bottom: number } } }) => {
          const chart = ctx.chart
          if (!chart.chartArea) return 'transparent'
          const gradient = chart.ctx.createLinearGradient(0, chart.chartArea.top, 0, chart.chartArea.bottom)
          if (dark) {
            gradient.addColorStop(0, 'rgba(74, 222, 128, 0.25)')
            gradient.addColorStop(1, 'rgba(74, 222, 128, 0.02)')
          } else {
            gradient.addColorStop(0, 'rgba(22, 101, 52, 0.15)')
            gradient.addColorStop(1, 'rgba(22, 101, 52, 0.01)')
          }
          return gradient
        },
        fill: true,
        tension: 0.25,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: dark ? '#4ade80' : '#166534',
        pointHoverBorderColor: dark ? '#0a0a0a' : '#fff',
        pointHoverBorderWidth: 2.5,
      },
    ],
  }
})

const chartOptions = computed(() => {
  const dark = isDark.value
  const cur = props.currency || 'EUR'
  const pts = displayPoints.value

  return {
    responsive: true,
    maintainAspectRatio: false,
    // Folga no topo/lados para a bola do hover não ser cortada.
    layout: { padding: { top: 18, right: 16, left: 4, bottom: 0 } },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    onHover: (_event: unknown, elements: { index: number }[]) => {
      if (elements.length > 0) {
        const idx = elements[0].index
        const pt = pts[idx]
        if (pt) {
          emit('hover', { date: pt.date, balance: pt.balance })
        }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: dark ? '#161616' : '#fff',
        titleColor: dark ? '#d4d4d4' : '#334155',
        bodyColor: dark ? '#fafafa' : '#0f172a',
        borderColor: dark ? '#2a2a2a' : '#e2e8f0',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10,
        titleFont: { size: 12, weight: 'normal' as const },
        bodyFont: { size: 14, weight: 'bold' as const },
        displayColors: false,
        callbacks: {
          title: (items: { dataIndex: number }[]) => {
            if (items.length === 0) return ''
            const dateStr = pts[items[0].dataIndex]?.date
            if (!dateStr) return ''
            const d = new Date(dateStr + 'T00:00:00')
            return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })
          },
          label: (ctx: { raw: unknown }) => {
            if (props.hideValues) return '••••••'
            const v = Number(ctx.raw)
            return new Intl.NumberFormat('pt-PT', {
              style: 'currency',
              currency: cur,
              minimumFractionDigits: 2,
            }).format(v)
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: dark ? '#737373' : '#94a3b8',
          font: { size: 12 },
          padding: 8,
          maxRotation: 0,
          autoSkip: false,
          callback: function (_value: unknown, index: number) {
            return tickLabels.value[index] ?? null
          },
        },
      },
      y: {
        display: false,
        beginAtZero: false,
        // Folga acima do máximo e abaixo do mínimo (bola do topo inteira, linha não colada ao fundo).
        grace: '18%',
      },
    },
  }
})

function onMouseLeave() {
  emit('hover', null)
}
</script>

<template>
  <div class="net-worth-chart" @mouseleave="onMouseLeave">
    <Line :key="chartKey" :data="chartData" :options="chartOptions" />
  </div>
</template>

<style scoped>
.net-worth-chart {
  height: 220px;
  position: relative;
}

@media (max-width: 768px) {
  .net-worth-chart {
    height: 200px;
  }
}
</style>
