<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
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
import type { MonthlyTrend } from '@/types/dashboard'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

const props = defineProps<{
  trendData: MonthlyTrend[]
  currentBalance: number
  currency: string
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

/** Build cumulative balance series working backwards from currentBalance */
const balanceSeries = computed(() => {
  const trend = props.trendData
  if (trend.length === 0) {
    return { labels: [] as string[], values: [] as number[] }
  }

  // trend is chronological: oldest first
  const values: number[] = new Array(trend.length)
  values[trend.length - 1] = props.currentBalance

  for (let i = trend.length - 2; i >= 0; i--) {
    values[i] = values[i + 1] - trend[i + 1].savings
  }

  const labels = trend.map((t) => t.label)
  return { labels, values }
})

const chartKey = computed(() => `${isDark.value}-${balanceSeries.value.values.length}`)

const chartData = computed(() => {
  const { labels, values } = balanceSeries.value
  const dark = isDark.value

  return {
    labels,
    datasets: [
      {
        label: 'Saldo',
        data: values,
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
        pointHoverBorderColor: dark ? '#0f172a' : '#fff',
        pointHoverBorderWidth: 2.5,
      },
    ],
  }
})

const chartOptions = computed(() => {
  const dark = isDark.value
  const cur = props.currency || 'EUR'

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: dark ? '#1e293b' : '#fff',
        titleColor: dark ? '#e2e8f0' : '#334155',
        bodyColor: dark ? '#f8fafc' : '#0f172a',
        borderColor: dark ? '#334155' : '#e2e8f0',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10,
        titleFont: { size: 12, weight: 'normal' as const },
        bodyFont: { size: 14, weight: 'bold' as const },
        displayColors: false,
        callbacks: {
          label: (ctx: { raw: unknown }) => {
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
          color: dark ? '#64748b' : '#94a3b8',
          font: { size: 12 },
          padding: 8,
        },
      },
      y: {
        display: false,
        beginAtZero: false,
      },
    },
  }
})
</script>

<template>
  <div class="net-worth-chart">
    <Line :key="chartKey" :data="chartData" :options="chartOptions" />
  </div>
</template>

<style scoped>
.net-worth-chart {
  height: 280px;
  position: relative;
}

@media (max-width: 768px) {
  .net-worth-chart {
    height: 200px;
  }
}
</style>
