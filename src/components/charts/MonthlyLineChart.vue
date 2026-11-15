<script setup lang="ts">
import { computed } from 'vue'
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
import { chartColors, baseTooltip, baseScales, lineDataset, crosshairPlugin, formatCurrency, thinLabels } from './chartTheme'
import { useChartTheme } from './useChartTheme'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

const props = defineProps<{
  data: MonthlyTrend[]
  period?: string
}>()

const { isDark } = useChartTheme()
const plugins = [crosshairPlugin]
const chartKey = computed(() => `${isDark.value}-${props.data.length}-${props.period ?? ''}`)

// 5A: só o ano na mudança de ano. Restantes: rótulo do mês, no máximo ~7.
const tickLabels = computed<(string | null)[]>(() => {
  const raw = props.data.map((item, index) => {
    if (props.period === '5A') {
      const prev = index > 0 ? props.data[index - 1] : null
      return !prev || item.year !== prev.year ? String(item.year) : null
    }
    return item.label
  })
  return thinLabels(raw, 7)
})

const chartData = computed(() => {
  void isDark.value
  const c = chartColors()
  return {
    labels: props.data.map((d) => d.label),
    datasets: [
      lineDataset(c.income, props.data.map((d) => d.income), { label: 'Receitas', tension: 0.3 }),
      lineDataset(c.expense, props.data.map((d) => d.expenses), { label: 'Despesas', tension: 0.3 }),
    ],
  }
})

const options = computed(() => {
  void isDark.value
  const scales = baseScales('EUR')
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    layout: { padding: { top: 8, right: 4 } },
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...baseTooltip(),
        callbacks: {
          label: (ctx: { dataset: { label?: string }; raw: unknown }) =>
            `${ctx.dataset.label ?? ''}: ${formatCurrency(Number(ctx.raw))}`,
        },
      },
    },
    scales: {
      x: {
        ...scales.x,
        ticks: {
          ...scales.x.ticks,
          autoSkip: false,
          callback: function (_value: unknown, index: number) {
            return tickLabels.value[index] ?? null
          },
        },
      },
      y: { ...scales.y, beginAtZero: true },
    },
  }
})
</script>

<template>
  <div class="chart-wrap">
    <div class="chart-legend">
      <span class="leg-item"><span class="leg-dot leg-income"></span>Receitas</span>
      <span class="leg-item"><span class="leg-dot leg-expense"></span>Despesas</span>
    </div>
    <div class="chart-container">
      <div v-if="data.length === 0" class="chart-empty">Sem dados para mostrar</div>
      <Line v-else :key="chartKey" :data="chartData" :options="options" :plugins="plugins" />
    </div>
  </div>
</template>

<style scoped>
.chart-legend {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-4);
  margin-bottom: var(--space-2);
}

.leg-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-text-muted);
}

.leg-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
}

.leg-income {
  background: var(--color-income);
}

.leg-expense {
  background: var(--color-expense);
}

.chart-container {
  height: 256px;
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
</style>
