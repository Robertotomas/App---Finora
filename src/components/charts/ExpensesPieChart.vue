<script setup lang="ts">
import { computed } from 'vue'
import { Pie } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import type { ExpenseByCategory } from '@/types/dashboard'

ChartJS.register(ArcElement, Tooltip, Legend)

const COLORS = [
  '#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed',
  '#0891b2', '#65a30d', '#ea580c', '#4f46e5', '#0d9488',
]

const props = defineProps<{
  data: ExpenseByCategory[]
}>()

const chartData = computed(() => ({
  labels: props.data.map((d) => d.categoryName),
  datasets: [
    {
      data: props.data.map((d) => d.amount),
      backgroundColor: props.data.map((_, i) => COLORS[i % COLORS.length]),
      borderWidth: 0,
    },
  ],
}))

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        padding: 16,
        usePointStyle: true,
      },
    },
    tooltip: {
      callbacks: {
        label: (ctx: { raw: unknown; dataIndex: number }) => {
          const pct = props.data[ctx.dataIndex]?.percentage ?? 0
          return `${Number(ctx.raw).toFixed(2)} € (${pct}%)`
        },
      },
    },
  },
}
</script>

<template>
  <div class="chart-container">
    <Pie :data="chartData" :options="options" />
  </div>
</template>

<style scoped>
.chart-container {
  height: 280px;
  position: relative;
}
</style>
