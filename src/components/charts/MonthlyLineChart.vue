<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import type { MonthlyTrend } from '@/types/dashboard'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const props = defineProps<{
  data: MonthlyTrend[]
  period?: string
}>()

const chartData = computed(() => ({
  labels: props.data.map((d) => d.label),
  datasets: [
    {
      label: 'Receitas',
      data: props.data.map((d) => d.income),
      borderColor: '#059669',
      backgroundColor: 'rgba(5, 150, 105, 0.1)',
      fill: true,
      tension: 0.3,
    },
    {
      label: 'Despesas',
      data: props.data.map((d) => d.expenses),
      borderColor: '#dc2626',
      backgroundColor: 'rgba(220, 38, 38, 0.1)',
      fill: true,
      tension: 0.3,
    },
  ],
}))

const options = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index' as const,
    intersect: false,
  },
  plugins: {
    legend: {
      position: 'top' as const,
      labels: {
        padding: 16,
        usePointStyle: true,
      },
    },
    tooltip: {
      callbacks: {
        label: (ctx: { dataset: { label?: string }; raw: unknown }) =>
          `${ctx.dataset.label ?? ''}: ${Number(ctx.raw).toFixed(2)} €`,
      },
    },
  },
  scales: {
    x: {
      ticks: {
        maxRotation: 0,
        autoSkip: false,
        callback: function (_value: unknown, index: number) {
          const item = props.data[index]
          if (!item) return null
          if (props.period === '5A') {
            const prev = index > 0 ? props.data[index - 1] : null
            if (!prev || item.year !== prev.year) return String(item.year)
            return null
          }
          return item.label
        },
      },
    },
    y: {
      beginAtZero: true,
    },
  },
}))
</script>

<template>
  <div class="chart-container">
    <Line :data="chartData" :options="options" />
  </div>
</template>

<style scoped>
.chart-container {
  height: 280px;
  position: relative;
}
</style>
