<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import type { MonthlyTrend } from '@/types/dashboard'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
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
      backgroundColor: 'rgba(5, 150, 105, 0.75)',
      borderColor: '#059669',
      borderWidth: 1,
      borderRadius: 4,
    },
    {
      label: 'Despesas',
      data: props.data.map((d) => d.expenses),
      backgroundColor: 'rgba(220, 38, 38, 0.75)',
      borderColor: '#dc2626',
      borderWidth: 1,
      borderRadius: 4,
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
      grid: {
        display: false,
      },
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
      grid: {
        color: 'rgba(0, 0, 0, 0.05)',
      },
    },
  },
}))
</script>

<template>
  <div class="chart-container">
    <Bar :data="chartData" :options="options" />
  </div>
</template>

<style scoped>
.chart-container {
  height: 280px;
  position: relative;
}
</style>
