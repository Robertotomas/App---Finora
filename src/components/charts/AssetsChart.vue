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

export interface AssetChartPoint {
  date: string
  value: number
  cost: number
}

const props = defineProps<{
  points: AssetChartPoint[]
  currency: string
  /** Em intervalos longos (vários anos), rotula os ticks por ano em vez de por mês. */
  yearTicks?: boolean
  /** Se definido, desenha uma 2ª linha (tracejada) com o custo investido e mostra a legenda. */
  costLabel?: string
}>()

const emit = defineEmits<{
  hover: [point: { date: string; value: number; cost: number } | null]
}>()

const isDark = ref(document.documentElement.classList.contains('dark'))
let observer: MutationObserver | null = null

onMounted(() => {
  observer = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains('dark')
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})

onBeforeUnmount(() => observer?.disconnect())

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// Início do ano atual (vistas longas). Pontos < cutoff = anos anteriores; >= cutoff = ano atual.
const cutoff = computed(() => {
  if (!props.yearTicks || props.points.length === 0) return ''
  return props.points[props.points.length - 1].date.substring(0, 4) + '-01-01'
})
// Vistas longas: comprime os anos anteriores (planos) e dá largura ao ano atual (mostra os meses).
const displayPoints = computed(() => (props.yearTicks ? compressLongView(props.points, cutoff.value) : props.points))

const chartKey = computed(() => `${isDark.value}-${displayPoints.value.length}-${props.yearTicks}-${props.costLabel ?? ''}`)

// Intervalos curtos: meses. Intervalos longos: ano nos anteriores + meses do ano atual.
const tickLabels = computed<(string | null)[]>(() => {
  const pts = displayPoints.value
  const n = pts.length
  const labels: (string | null)[] = new Array(n).fill(null)
  if (n === 0) return labels
  const minGap = Math.max(2, Math.round(n / 24))
  let lastShown = -Infinity
  const cut = cutoff.value

  for (let i = 0; i < n; i++) {
    const dateStr = pts[i]?.date
    if (!dateStr) continue
    const prev = i > 0 ? pts[i - 1]?.date : null
    let label: string | null = null
    if (props.yearTicks) {
      if (dateStr >= cut) {
        // Ano atual → meses (na mudança de mês).
        if (!prev || dateStr.substring(0, 7) !== prev.substring(0, 7)) label = MONTH_NAMES[Number(dateStr.substring(5, 7)) - 1]
      } else if (!prev || dateStr.substring(0, 4) !== prev.substring(0, 4)) {
        // Anos anteriores → só o ano (na mudança de ano, ou no 1.º ponto).
        label = dateStr.substring(0, 4)
      }
    } else if (!prev || dateStr.substring(0, 7) !== prev.substring(0, 7)) {
      // Intervalo curto → meses (incluindo o 1.º ponto), igual ao gráfico do património.
      label = MONTH_NAMES[Number(dateStr.substring(5, 7)) - 1]
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
  const valueDataset = {
    label: 'Valor',
    data: pts.map((p) => p.value),
    // Não cortar os pontos na fronteira: a bola do último ponto (hoje) fica inteira.
    clip: false as const,
    borderColor: dark ? '#4ade80' : '#166534',
    borderWidth: 2.5,
    backgroundColor: (ctx: { chart: { ctx: CanvasRenderingContext2D; chartArea?: { top: number; bottom: number } } }) => {
      const chart = ctx.chart
      if (!chart.chartArea) return 'transparent'
      const g = chart.ctx.createLinearGradient(0, chart.chartArea.top, 0, chart.chartArea.bottom)
      if (dark) {
        g.addColorStop(0, 'rgba(74, 222, 128, 0.25)')
        g.addColorStop(1, 'rgba(74, 222, 128, 0.02)')
      } else {
        g.addColorStop(0, 'rgba(22, 101, 52, 0.15)')
        g.addColorStop(1, 'rgba(22, 101, 52, 0.01)')
      }
      return g
    },
    fill: true,
    tension: 0,
    stepped: true,
    pointRadius: 0,
    pointHoverRadius: 6,
    pointHoverBackgroundColor: dark ? '#4ade80' : '#166534',
    pointHoverBorderColor: dark ? '#0a0a0a' : '#fff',
    pointHoverBorderWidth: 2.5,
    order: 1,
  }

  // 2ª linha: custo investido (tracejada, neutra). Desenhada por cima (order 0) para ler bem.
  const costDataset = {
    label: props.costLabel,
    data: pts.map((p) => p.cost),
    clip: false as const,
    borderColor: dark ? '#fbbf24' : '#d97706',
    borderWidth: 1.5,
    borderDash: [5, 4],
    backgroundColor: 'transparent',
    fill: false,
    tension: 0,
    stepped: true,
    pointRadius: 0,
    pointHoverRadius: 0,
    order: 0,
  }

  return {
    labels: pts.map((p) => p.date),
    datasets: props.costLabel ? [valueDataset, costDataset] : [valueDataset],
  }
})

const chartOptions = computed(() => {
  const dark = isDark.value
  const cur = props.currency || 'EUR'
  const pts = displayPoints.value
  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-PT', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(v)

  return {
    responsive: true,
    maintainAspectRatio: false,
    // Folga no topo/lados para a bola do hover não ser cortada.
    layout: { padding: { top: 18, right: 16, left: 4, bottom: 0 } },
    interaction: { mode: 'index' as const, intersect: false },
    onHover: (_event: unknown, elements: { index: number }[]) => {
      if (elements.length > 0) {
        const pt = pts[elements[0].index]
        if (pt) emit('hover', { date: pt.date, value: pt.value, cost: pt.cost })
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
        bodyFont: { size: 13, weight: 'bold' as const },
        displayColors: false,
        callbacks: {
          title: (items: { dataIndex: number }[]) => {
            if (items.length === 0) return ''
            const dateStr = pts[items[0].dataIndex]?.date
            if (!dateStr) return ''
            const d = new Date(dateStr + 'T00:00:00')
            return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })
          },
          label: (ctx: { raw: unknown; dataset: { label?: string } }) =>
            props.costLabel ? `${ctx.dataset.label}: ${fmt(Number(ctx.raw))}` : fmt(Number(ctx.raw)),
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
      // grace dá folga acima do máximo e abaixo do mínimo: a bola do topo não é
      // cortada e a linha plana não fica colada ao eixo de baixo.
      y: { display: false, beginAtZero: false, grace: '18%' },
    },
  }
})

function onMouseLeave() {
  emit('hover', null)
}
</script>

<template>
  <div class="assets-chart-wrap">
    <div v-if="costLabel" class="chart-legend">
      <span class="leg-item"><span class="leg-swatch leg-value"></span>Valor</span>
      <span class="leg-item"><span class="leg-swatch leg-cost"></span>{{ costLabel }}</span>
    </div>
    <div class="assets-chart" @mouseleave="onMouseLeave">
      <Line :key="chartKey" :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>

<style scoped>
.chart-legend {
  display: flex;
  justify-content: flex-end;
  gap: 1.25rem;
  margin-bottom: 0.25rem;
}

.leg-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.leg-swatch {
  width: 16px;
  height: 0;
  border-top: 2.5px solid;
  border-radius: 2px;
}

.leg-value {
  border-color: #166534;
}

html.dark .leg-value {
  border-color: #4ade80;
}

.leg-cost {
  border-top-style: dashed;
  border-top-width: 2px;
  border-color: #d97706;
}

html.dark .leg-cost {
  border-color: #fbbf24;
}

.assets-chart {
  height: 240px;
  position: relative;
}

@media (max-width: 768px) {
  .assets-chart {
    height: 200px;
  }
}
</style>
