<script setup lang="ts">
/**
 * Donut por categoria (base de ExpensesPieChart/IncomePieChart).
 * Cutout 72%, borda da cor da superfície entre fatias, total ao centro e legenda HTML (ponto, nome, valor, %).
 */
import { computed, ref } from 'vue'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'
import { categoryColor } from '@/types/categoryMeta'
import { chartColors, seriesColors, baseTooltip, formatCurrency, formatPct } from './chartTheme'
import { useChartTheme } from './useChartTheme'

ChartJS.register(ArcElement, Tooltip)

export interface DoughnutItem {
  category: number
  categoryName: string
  amount: number
  percentage: number
}

const props = defineProps<{
  items: DoughnutItem[]
  /** 'category' = cor da categoria (igual aos ícones das listas); 'series' = paleta categórica. */
  colorMode: 'category' | 'series'
}>()

const { isDark } = useChartTheme()
const chartRef = ref<{ chart?: ChartJS } | null>(null)
const activeIndex = ref<number | null>(null)

const chartKey = computed(() => `${isDark.value}-${props.items.length}-${props.colorMode}`)

const total = computed(() => props.items.reduce((s, d) => s + d.amount, 0))

// Cores: por categoria; se duas fatias partilham a cor (mesmo grupo), a repetida usa a próxima da paleta.
const colors = computed<string[]>(() => {
  void isDark.value
  const palette = seriesColors()
  if (props.colorMode === 'series') return props.items.map((_, i) => palette[i % palette.length])
  const used = new Set<string>()
  let p = 0
  return props.items.map((d) => {
    let col = categoryColor(d.category).toLowerCase()
    if (used.has(col)) {
      while (p < palette.length * 2 && used.has(palette[p % palette.length].toLowerCase())) p++
      col = palette[p % palette.length].toLowerCase()
      p++
    }
    used.add(col)
    return col
  })
})

const chartData = computed(() => {
  const c = chartColors()
  return {
    labels: props.items.map((d) => d.categoryName),
    datasets: [
      {
        data: props.items.map((d) => d.amount),
        backgroundColor: colors.value,
        hoverBackgroundColor: colors.value,
        borderColor: c.surface,
        hoverBorderColor: c.surface,
        borderWidth: 2,
        borderRadius: 4,
        hoverOffset: 4,
      },
    ],
  }
})

const options = computed(() => {
  void isDark.value
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    layout: { padding: 4 },
    animation: { duration: 400 },
    onHover: (_e: unknown, elements: { index: number }[]) => {
      activeIndex.value = elements.length ? elements[0].index : null
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...baseTooltip(),
        callbacks: {
          title: (items: { dataIndex: number }[]) => props.items[items[0]?.dataIndex ?? -1]?.categoryName ?? '',
          label: (ctx: { raw: unknown; dataIndex: number }) => {
            const pct = props.items[ctx.dataIndex]?.percentage ?? 0
            return `${formatCurrency(Number(ctx.raw))} · ${formatPct(pct)}`
          },
        },
      },
    },
  }
})

function highlight(i: number | null) {
  activeIndex.value = i
  const chart = chartRef.value?.chart
  if (!chart) return
  const els = i === null ? [] : [{ datasetIndex: 0, index: i }]
  chart.setActiveElements(els)
  chart.tooltip?.setActiveElements(els, { x: 0, y: 0 })
  chart.update()
}
</script>

<template>
  <div class="donut-root">
  <div class="donut">
    <div class="donut-chart">
      <Doughnut ref="chartRef" :key="chartKey" :data="chartData" :options="options" />
      <div class="donut-center">
        <span class="donut-center-label">Total</span>
        <span class="donut-center-value">{{ formatCurrency(total) }}</span>
      </div>
    </div>
    <ul class="donut-legend">
      <li
        v-for="(d, i) in items"
        :key="`${d.category}-${i}`"
        class="donut-legend-row"
        :class="{ dim: activeIndex !== null && activeIndex !== i }"
        @mouseenter="highlight(i)"
        @mouseleave="highlight(null)"
      >
        <span class="donut-dot" :style="{ background: colors[i] }"></span>
        <span class="donut-name">{{ d.categoryName }}</span>
        <span class="donut-value">{{ formatCurrency(d.amount) }}</span>
        <span class="donut-pct">{{ formatPct(d.percentage) }}</span>
      </li>
    </ul>
  </div>
  </div>
</template>

<style scoped>
.donut-root {
  container-type: inline-size;
}

.donut {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  min-height: 200px;
}

.donut-chart {
  position: relative;
  flex: 0 0 184px;
  width: 184px;
  height: 184px;
}

.donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  text-align: center;
  padding: 0 28px;
}

.donut-center-label {
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
  letter-spacing: var(--tracking-caps);
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.donut-center-value {
  font-size: var(--text-md);
  font-weight: var(--weight-bold);
  letter-spacing: var(--tracking-tight);
  color: var(--color-text-strong);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.donut-legend {
  flex: 1 1 auto;
  min-width: 0;
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 220px;
  overflow-y: auto;
}

.donut-legend-row {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto 3.25rem;
  align-items: center;
  gap: var(--space-2);
  padding: 5px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  transition: opacity var(--transition-fast), background var(--transition-fast);
  cursor: default;
}

.donut-legend-row:hover {
  background: var(--color-surface-hover);
}

.donut-legend-row.dim {
  opacity: 0.45;
}

.donut-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
}

.donut-name {
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.donut-value {
  color: var(--color-text-strong);
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.donut-pct {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

@container (max-width: 420px) {
  .donut {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-4);
  }

  .donut-chart {
    align-self: center;
  }

  .donut-legend {
    max-height: none;
  }
}
</style>
