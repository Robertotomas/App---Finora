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
  costDataset,
  crosshairPlugin,
  formatChartDate,
  formatCurrency,
  formatPct,
  thinLabels,
  CHART_FONT,
  MONTH_LABELS,
} from './chartTheme'
import { useChartTheme } from './useChartTheme'
import { PT_GROUPING } from '@/utils/numberFormat'
import { periodChange, periodPerformanceSeries, seriesExtremes } from './heroSeries'

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
  /**
   * Se definido, desenha uma 2ª linha com o custo investido.
   * `default`: tracejada âmbar + legenda. `hero`: cinza fina com o rótulo na ponta direita.
   */
  costLabel?: string
  /**
   * `default` (Dashboard): eixo X com meses, grelha, tooltip, linha verde.
   * `hero` (páginas de Investimentos / Bens): linha colorida pelo sinal da variação do período,
   * eixo X só com início/"Hoje", sem eixo Y/grelha/tooltip (o cabeçalho segue o hover).
   */
  variant?: 'default' | 'hero'
  /** Só `hero`: `value` (valor de mercado) ou `performance` (rentabilidade % ao longo do tempo). */
  mode?: 'value' | 'performance'
  /** Só `hero`: anota o mínimo e o máximo da série visível (default true). */
  showExtremes?: boolean
  /** Só `hero`: mascara os valores do mín./máx. ("•••••"). */
  hideValues?: boolean
}>()

const emit = defineEmits<{
  hover: [point: { date: string; value: number; cost: number } | null]
}>()

const { isDark } = useChartTheme()

const isHero = computed(() => props.variant === 'hero')
const isPerf = computed(() => isHero.value && props.mode === 'performance')

// Início do ano atual (vistas longas). Pontos < cutoff = anos anteriores; >= cutoff = ano atual.
const cutoff = computed(() => {
  if (!props.yearTicks || props.points.length === 0) return ''
  return props.points[props.points.length - 1].date.substring(0, 4) + '-01-01'
})
// Vistas longas: comprime os anos anteriores (planos) e dá largura ao ano atual (mostra os meses).
const displayPoints = computed(() => (props.yearTicks ? compressLongView(props.points, cutoff.value) : props.points))

const chartKey = computed(
  () =>
    `${isDark.value}-${displayPoints.value.length}-${props.yearTicks}-${props.costLabel ?? ''}-${props.variant ?? 'default'}-${props.mode ?? 'value'}-${!!props.hideValues}`,
)

/* ── Série principal (valor € ou rentabilidade %) ── */
const mainData = computed<(number | null)[]>(() =>
  isPerf.value ? periodPerformanceSeries(displayPoints.value) : displayPoints.value.map((p) => p.value),
)

/** Hero: verde se a variação do período ≥ 0, vermelho se < 0. */
const positive = computed(() => {
  if (isPerf.value) {
    const vals = mainData.value.filter((v): v is number => v !== null)
    return vals.length < 2 || vals[vals.length - 1] - vals[0] >= 0
  }
  return periodChange(props.points).abs >= 0
})

function lineColor(): string {
  const c = chartColors()
  if (!isHero.value) return c.primary
  return positive.value ? c.income : c.expense
}

function formatExtreme(v: number): string {
  if (props.hideValues) return '•••••'
  if (isPerf.value) return `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatPct(Math.abs(v))}`
  return new Intl.NumberFormat('pt-PT', {
    ...PT_GROUPING,
    style: 'currency',
    currency: props.currency || 'EUR',
    maximumFractionDigits: 0,
  }).format(v)
}

// Intervalos curtos: meses. Intervalos longos: ano nos anteriores + meses do ano atual. Máx. ~7 rótulos.
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
        if (!prev || dateStr.substring(0, 7) !== prev.substring(0, 7)) label = MONTH_LABELS[Number(dateStr.substring(5, 7)) - 1]
      } else if (!prev || dateStr.substring(0, 4) !== prev.substring(0, 4)) {
        // Anos anteriores → só o ano (na mudança de ano, ou no 1.º ponto).
        label = dateStr.substring(0, 4)
      }
    } else if (!prev || dateStr.substring(0, 7) !== prev.substring(0, 7)) {
      // Intervalo curto → meses (incluindo o 1.º ponto), igual ao gráfico do património.
      label = MONTH_LABELS[Number(dateStr.substring(5, 7)) - 1]
    }
    if (label !== null && i - lastShown >= minGap) {
      labels[i] = label
      lastShown = i
    }
  }
  return thinLabels(labels, 7)
})

/* ── Eixo X minimalista (hero): 1.ª data à esquerda, "Hoje" à direita ── */
function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const axisStart = computed(() => (props.points.length ? formatChartDate(props.points[0].date) : ''))
const axisEnd = computed(() => {
  const last = props.points[props.points.length - 1]?.date
  if (!last) return ''
  return last === todayStr() ? 'Hoje' : formatChartDate(last)
})

const chartData = computed(() => {
  void isDark.value
  const pts = displayPoints.value
  const c = chartColors()
  const color = lineColor()
  // Série diária de valor: linha reta entre pontos (sem degraus, sem overshoot).
  const valueDataset = {
    ...lineDataset(color, mainData.value as number[], { label: isPerf.value ? 'Rentabilidade' : 'Valor', tension: 0 }),
    // Não cortar os pontos na fronteira: a bola do último ponto (hoje) fica inteira.
    clip: false as const,
    order: 1,
  }

  if (isHero.value) {
    // Linha de referência neutra: custo/investido (valor) ou 0 % (desempenho).
    const refData = isPerf.value ? pts.map(() => 0) : pts.map((p) => p.cost)
    const showRef = isPerf.value || !!props.costLabel
    const ref = {
      ...costDataset(refData, isPerf.value ? '0%' : props.costLabel),
      borderColor: c.reference,
      borderWidth: 1,
      borderDash: [] as number[],
      clip: false as const,
      order: 2,
    }
    return { labels: pts.map((p) => p.date), datasets: showRef ? [valueDataset, ref] : [valueDataset] }
  }

  // 2ª linha: custo investido (tracejada). Desenhada por cima (order 0) para ler bem.
  const cost = { ...costDataset(pts.map((p) => p.cost), props.costLabel), clip: false as const, order: 0 }
  return {
    labels: pts.map((p) => p.date),
    datasets: props.costLabel ? [valueDataset, cost] : [valueDataset],
  }
})

type PtEl = { x: number; y: number; skip?: boolean }
type HeroChart = {
  width: number
  height: number
  ctx: CanvasRenderingContext2D
  chartArea: { top: number; bottom: number; left: number; right: number }
  getDatasetMeta: (i: number) => { data: PtEl[] }
  data: { datasets: unknown[] }
}

function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, surface: string, r = 3.5) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = surface
  ctx.stroke()
}

/** Hero: ponto final, mínimo/máximo anotados e rótulo da linha de referência. */
const heroPlugin = {
  id: 'finoraHeroAnnotations',
  afterDatasetsDraw(chart: HeroChart) {
    if (!isHero.value || !chart.chartArea) return
    const c = chartColors()
    const color = lineColor()
    const ctx = chart.ctx
    const area = chart.chartArea
    const main = chart.getDatasetMeta(0)?.data ?? []
    const data = mainData.value
    const lastIdx = (() => {
      for (let i = data.length - 1; i >= 0; i--) if (data[i] !== null) return i
      return -1
    })()

    ctx.save()
    ctx.font = `500 11px ${CHART_FONT.family}`
    ctx.textBaseline = 'alphabetic'

    type Rect = { x1: number; y1: number; x2: number; y2: number }
    const LABEL_H = 11
    const overlaps = (a: Rect, b: Rect) => a.x1 < b.x2 + 4 && a.x2 + 4 > b.x1 && a.y1 < b.y2 + 3 && a.y2 + 3 > b.y1
    const taken: Rect[] = []
    // As datas do eixo (HTML por baixo, puxado 20px para cima — ver .hero-axis) ocupam os cantos
    // inferiores do canvas: "1 jun 2026" à esquerda e "Hoje" à direita. Reservar essas zonas para
    // os rótulos do mínimo/máximo não ficarem por cima delas (passam para o outro lado do ponto).
    taken.push({ x1: 0, y1: chart.height - 22, x2: 150, y2: chart.height })
    taken.push({ x1: chart.width - 90, y1: chart.height - 22, x2: chart.width, y2: chart.height })

    // Rótulo da linha de referência (ponta direita), do lado oposto ao da linha principal.
    const refMeta = chart.data.datasets.length > 1 ? chart.getDatasetMeta(1)?.data ?? [] : []
    const refEnd = refMeta[refMeta.length - 1]
    const refLabel = isPerf.value ? '' : props.costLabel
    if (refEnd && refLabel && Number.isFinite(refEnd.y)) {
      const mainEnd = lastIdx >= 0 ? main[lastIdx] : null
      // Por cima da linha, salvo quando a linha principal passa logo acima (aí vai para baixo).
      const below = !!mainEnd && mainEnd.y < refEnd.y && refEnd.y - mainEnd.y < 18
      const baseline = below ? refEnd.y + 14 : refEnd.y - 6
      const w = ctx.measureText(refLabel).width
      ctx.fillStyle = c.textMuted
      ctx.textAlign = 'right'
      ctx.fillText(refLabel, area.right - 12, baseline)
      taken.push({ x1: area.right - 12 - w, y1: baseline - LABEL_H, x2: area.right - 12, y2: baseline })
    }
    // A própria linha de referência também é "ocupada" (um rótulo não deve ficar por cima dela).
    const refYAt = (x: number): number | null => {
      if (refMeta.length === 0) return null
      let best: PtEl | null = null
      for (const p of refMeta) if (!best || Math.abs(p.x - x) < Math.abs(best.x - x)) best = p
      return best && Number.isFinite(best.y) ? best.y : null
    }

    // Mínimo e máximo (só se não forem o último ponto). Se o rótulo colidir com outro rótulo, com a
    // linha de referência ou sair da área, troca de lado; se continuar sem caber, fica só o ponto.
    if (props.showExtremes !== false) {
      const ext = seriesExtremes(data)
      if (ext) {
        for (const [idx, prefer] of [
          [ext.max, 'above'],
          [ext.min, 'below'],
        ] as const) {
          const el = main[idx]
          const v = data[idx]
          if (!el || v === null || idx === lastIdx || el.skip) continue
          drawDot(ctx, el.x, el.y, color, c.surface, 3)
          const text = formatExtreme(v)
          const w = ctx.measureText(text).width
          let x1 = el.x - w / 2
          let align: CanvasTextAlign = 'center'
          let tx = el.x
          if (x1 < area.left + 4) {
            align = 'left'
            tx = Math.max(el.x - 4, area.left + 4)
            x1 = tx
          } else if (x1 + w > area.right - 4) {
            align = 'right'
            tx = Math.min(el.x + 4, area.right - 4)
            x1 = tx - w
          }
          const sides = prefer === 'above' ? (['above', 'below'] as const) : (['below', 'above'] as const)
          for (const side of sides) {
            const baseline = side === 'above' ? el.y - 9 : el.y + 17
            const rect: Rect = { x1, y1: baseline - LABEL_H, x2: x1 + w, y2: baseline }
            // Tem de caber inteiro no canvas (as descendentes do texto incluídas), senão troca de lado.
            if (rect.y1 < 2 || rect.y2 + 3 > chart.height) continue
            if (taken.some((t) => overlaps(rect, t))) continue
            const ry = refYAt(el.x)
            if (ry !== null && ry > rect.y1 - 6 && ry < rect.y2 + 8) continue
            ctx.textAlign = align
            // Contorno da cor do fundo: o rótulo lê-se mesmo quando cruza a linha.
            ctx.lineJoin = 'round'
            ctx.lineWidth = 4
            ctx.strokeStyle = c.surface
            ctx.strokeText(text, tx, baseline)
            ctx.fillStyle = c.textMuted
            ctx.fillText(text, tx, baseline)
            taken.push(rect)
            break
          }
        }
      }
    }

    // Ponto final (hoje).
    const end = lastIdx >= 0 ? main[lastIdx] : null
    if (end && !end.skip) drawDot(ctx, end.x, end.y, color, c.surface)
    ctx.restore()
  },
}

const plugins = [crosshairPlugin, heroPlugin]

const chartOptions = computed(() => {
  void isDark.value
  const c = chartColors()
  const cur = props.currency || 'EUR'
  const pts = displayPoints.value
  const hero = isHero.value

  const onHover = (_event: unknown, elements: { index: number }[]) => {
    if (elements.length > 0) {
      const pt = pts[elements[0].index]
      if (pt) emit('hover', { date: pt.date, value: pt.value, cost: pt.cost })
    }
  }

  if (hero) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      // Sem folga lateral à esquerda (gráfico de ponta a ponta); folga em cima/baixo para os rótulos
      // do máximo/mínimo e à direita para a bola do último ponto.
      layout: { padding: { top: 24, right: 10, left: 0, bottom: 24 } },
      interaction: { mode: 'index' as const, intersect: false },
      onHover,
      plugins: {
        legend: { display: false },
        // O cabeçalho do cartão segue o hover — sem tooltip (o crosshair continua ativo).
        tooltip: { enabled: false, mode: 'index' as const, intersect: false },
      },
      scales: {
        x: { display: false },
        // bounds 'data': sem arredondar o mínimo/máximo para valores "redondos" (evita espaço vazio).
        y: { display: false, beginAtZero: false, grace: '4%', bounds: 'data' as const },
      },
    }
  }

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    // Folga no topo/lados para a bola do hover não ser cortada.
    layout: { padding: { top: 12, right: 8, left: 4, bottom: 0 } },
    interaction: { mode: 'index' as const, intersect: false },
    onHover,
    plugins: {
      legend: { display: false },
      tooltip: {
        ...baseTooltip(),
        callbacks: {
          title: (items: { dataIndex: number }[]) => {
            if (items.length === 0) return ''
            return formatChartDate(pts[items[0].dataIndex]?.date ?? '')
          },
          label: (ctx: { raw: unknown; dataset: { label?: string } }) =>
            props.costLabel ? `${ctx.dataset.label}: ${formatCurrency(Number(ctx.raw), cur)}` : formatCurrency(Number(ctx.raw), cur),
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
      // grace dá folga acima do máximo e abaixo do mínimo: a bola do topo não é
      // cortada e a linha plana não fica colada ao eixo de baixo.
      y: heroYScale('18%'),
    },
  }
})

function onMouseLeave() {
  emit('hover', null)
}
</script>

<template>
  <div class="assets-chart-wrap" :class="{ 'assets-chart-wrap--hero': isHero }">
    <div v-if="costLabel && !isHero" class="chart-legend">
      <span class="leg-item"><span class="leg-swatch leg-value"></span>Valor</span>
      <span class="leg-item"><span class="leg-swatch leg-cost"></span>{{ costLabel }}</span>
    </div>
    <div class="assets-chart" @mouseleave="onMouseLeave">
      <div v-if="points.length === 0" class="chart-empty">Sem dados para mostrar</div>
      <Line v-else :key="chartKey" :data="chartData" :options="chartOptions" :plugins="plugins" />
    </div>
    <div v-if="isHero && points.length > 0" class="hero-axis" aria-hidden="true">
      <span>{{ axisStart }}</span>
      <span>{{ axisEnd }}</span>
    </div>
  </div>
</template>

<style scoped>
.chart-legend {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-4);
  margin-bottom: var(--space-1);
}

.leg-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-text-muted);
}

.leg-swatch {
  width: 14px;
  height: 0;
  border-top: 2px solid;
  border-radius: 2px;
}

.leg-value {
  border-color: var(--color-primary-text);
}

.leg-cost {
  border-top-style: dashed;
  border-top-width: 1.5px;
  border-color: var(--color-warning);
}

.assets-chart {
  height: 240px;
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

/* Eixo X do hero: só início e fim. O gutter vem do cartão (gráfico de ponta a ponta). */
.hero-axis {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 0 var(--hero-gutter, 0px);
  margin-top: -20px; /* encosta as datas ao fundo do gráfico (a folga inferior do canvas é para o rótulo do mínimo) */
  font-size: var(--text-2xs);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

@media (max-width: 768px) {
  .assets-chart {
    height: 200px;
  }
}
</style>
