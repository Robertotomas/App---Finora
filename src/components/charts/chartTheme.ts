/**
 * Tema único dos gráficos (Chart.js + SVG próprios como o Sankey). FONTE DE VERDADE do estilo.
 * Lê os tokens CSS em tempo de execução para acompanhar claro/escuro.
 *
 * Regras visuais:
 *  - Linhas: 2px, sem pontos (só no hover: raio 4, borda 2px da cor da superfície).
 *    Tensão 0.3 em séries mensais; 0–0.15 em séries diárias de preço/valor. Nunca `stepped`.
 *  - Área: gradiente vertical da cor da série, 18% → 0% no escuro, 8% → 0% no claro (sem tom menta) (`areaGradient`).
 *  - Linha de custo/investido: cor `cost`, 1.5px tracejada [4,4], sem área (no hero: `reference`, 1px sólida cinza).
 *  - Grelha: só horizontal, tracejada, cor --color-border-subtle; sem bordas de eixo.
 *  - Eixos: texto 11px --color-text-subtle; máx. ~7 rótulos no X (`thinLabels`); Y em moeda compacta.
 *  - Hover: linha vertical (crosshair) via `crosshairPlugin`.
 *  - Tooltip: `baseTooltip()` — superfície, borda, raio 8, título = data ("12 out 2026").
 *  - Barras: raio 6, `borderSkipped: false`, espessura máx. 28.
 *  - Donuts: cutout 72%, borda 2px da cor da superfície, legenda HTML própria.
 *  - Categorias: `seriesColors()` por ordem (paleta validada, distinguível em claro e escuro),
 *    ou a cor da categoria (`categoryMeta.ts`) quando o gráfico é por categoria.
 *  - Tema: os componentes usam `useChartTheme()` (reage à classe `dark` no <html>) e incluem
 *    `isDark` na `:key` do gráfico para redesenhar com as cores certas. Sem filtros CSS no canvas.
 */
import { PT_GROUPING } from '@/utils/numberFormat'

export function cssVar(name: string, fallback = ''): string {
  if (typeof window === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

export function isDark(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
}

/** Cores semânticas (resolvidas no momento — chamar dentro de computed/ao renderizar). */
export function chartColors() {
  const dark = isDark()
  return {
    primary: dark ? '#4ade80' : '#075e46',
    income: cssVar('--color-income', dark ? '#4ade80' : '#15803d'),
    expense: cssVar('--color-expense', dark ? '#f87171' : '#dc2626'),
    cost: dark ? '#fbbf24' : '#d97706', // linha de custo/investido (tracejada)
    reference: cssVar('--color-border-strong', dark ? '#3a3a3a' : '#d1d5db'), // linha de referência neutra (hero)
    transfer: cssVar('--color-transfer', dark ? '#60a5fa' : '#2563eb'),
    grid: cssVar('--color-border-subtle', dark ? '#222222' : '#eef0f3'),
    axis: cssVar('--color-text-subtle', dark ? '#737373' : '#94a3b8'),
    text: cssVar('--color-text', dark ? '#ededed' : '#1e293b'),
    textMuted: cssVar('--color-text-muted', dark ? '#a3a3a3' : '#64748b'),
    textStrong: cssVar('--color-text-strong', dark ? '#fafafa' : '#0f172a'),
    surface: cssVar('--color-surface', dark ? '#161616' : '#ffffff'),
    border: cssVar('--color-border', dark ? '#2a2a2a' : '#e5e7eb'),
    track: cssVar('--color-surface-muted', dark ? '#222222' : '#f1f5f9'),
    crosshair: dark ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.14)',
  }
}

/** Paleta categórica (ordem fixa). Verde da marca primeiro. */
export const CHART_SERIES_LIGHT = ['#075e46', '#2563eb', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#64748b']
export const CHART_SERIES_DARK = ['#4ade80', '#60a5fa', '#fbbf24', '#a78bfa', '#f472b6', '#22d3ee', '#a3e635', '#a3a3a3']
export function seriesColors(): string[] {
  return isDark() ? CHART_SERIES_DARK : CHART_SERIES_LIGHT
}

/** Converte #rrggbb (ou #rgb) em rgba(). Outros formatos são devolvidos tal como estão. */
export function alpha(hex: string, a: number): string {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6) return hex
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

type GradientCtx = { chart: { ctx: CanvasRenderingContext2D; chartArea?: { top: number; bottom: number } } }

/** Gradiente vertical de área para datasets de linha (usar em `backgroundColor: (ctx) => areaGradient(ctx, cor)`). */
export function areaGradient(ctx: GradientCtx, hex: string, top = isDark() ? 0.18 : 0.08) {
  const area = ctx.chart.chartArea
  if (!area) return alpha(hex, top / 2)
  const g = ctx.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom)
  g.addColorStop(0, alpha(hex, top))
  g.addColorStop(1, alpha(hex, 0))
  return g
}

export const CHART_FONT = { family: "'Plus Jakarta Sans', system-ui, sans-serif", size: 11 }

/** Opções base de tooltip (Chart.js). */
export function baseTooltip() {
  const c = chartColors()
  return {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: 1,
    titleColor: c.textMuted,
    bodyColor: c.textStrong,
    titleFont: { ...CHART_FONT, size: 11, weight: 500 as const },
    bodyFont: { ...CHART_FONT, size: 12, weight: 600 as const },
    titleMarginBottom: 6,
    bodySpacing: 4,
    padding: 10,
    cornerRadius: 8,
    displayColors: false,
    caretSize: 0,
    caretPadding: 10,
  }
}

/** Escalas base (eixo X sem grelha, eixo Y com grelha tracejada e moeda compacta). */
export function baseScales(currency = 'EUR') {
  const c = chartColors()
  return {
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: { color: c.axis, font: CHART_FONT, padding: 8, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 },
    },
    y: {
      grid: { color: c.grid, drawTicks: false },
      border: { display: false, dash: [3, 3] },
      ticks: {
        color: c.axis,
        font: CHART_FONT,
        padding: 8,
        maxTicksLimit: 5,
        callback: (v: number | string) => formatCompactCurrency(Number(v), currency),
      },
    },
  }
}

/** Eixo Y "limpo" para gráficos hero: sem rótulos, só a grelha tracejada horizontal. */
export function heroYScale(grace = '18%') {
  const c = chartColors()
  return {
    display: true,
    beginAtZero: false,
    grace,
    grid: { color: c.grid, drawTicks: false },
    border: { display: false, dash: [3, 3] },
    ticks: { display: false, maxTicksLimit: 4 },
  }
}

/** Dataset de linha principal (valor/saldo/preço). */
export function lineDataset(color: string, data: number[], opts: { label?: string; tension?: number; fill?: boolean } = {}) {
  const surface = chartColors().surface
  return {
    label: opts.label,
    data,
    borderColor: color,
    borderWidth: 2,
    backgroundColor: opts.fill === false ? 'transparent' : (ctx: GradientCtx) => areaGradient(ctx, color),
    fill: opts.fill !== false,
    tension: opts.tension ?? 0.3,
    pointRadius: 0,
    pointHitRadius: 8,
    pointHoverRadius: 4,
    pointHoverBackgroundColor: color,
    pointHoverBorderColor: surface,
    pointHoverBorderWidth: 2,
    borderCapStyle: 'round' as const,
    borderJoinStyle: 'round' as const,
  }
}

/** Dataset da linha de custo/investido (tracejada, sem área, sem ponto no hover). */
export function costDataset(data: number[], label?: string) {
  const c = chartColors()
  return {
    label,
    data,
    borderColor: c.cost,
    borderWidth: 1.5,
    borderDash: [4, 4],
    backgroundColor: 'transparent',
    fill: false,
    tension: 0,
    pointRadius: 0,
    pointHoverRadius: 0,
    pointHitRadius: 0,
  }
}

type CrosshairChart = {
  ctx: CanvasRenderingContext2D
  chartArea: { top: number; bottom: number }
  tooltip?: { getActiveElements?: () => { element: { x: number } }[] } | null
}

/** Plugin inline: linha vertical no ponto ativo (hover). Usar em `:plugins="[crosshairPlugin]"`. */
export const crosshairPlugin = {
  id: 'finoraCrosshair',
  afterDatasetsDraw(chart: CrosshairChart) {
    const active = chart.tooltip?.getActiveElements?.() ?? []
    if (!active.length || !chart.chartArea) return
    const x = active[0].element.x
    const { top, bottom } = chart.chartArea
    const ctx = chart.ctx
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(x, top)
    ctx.lineTo(x, bottom)
    ctx.lineWidth = 1
    ctx.strokeStyle = chartColors().crosshair
    ctx.stroke()
    ctx.restore()
  },
}

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
/** Rótulos curtos de mês para o eixo X (capitalizados). */
export const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** "2026-10-12" → "12 out 2026" (título do tooltip). */
export function formatChartDate(iso: string): string {
  if (!iso || iso.length < 10) return iso ?? ''
  const y = iso.substring(0, 4)
  const m = Number(iso.substring(5, 7)) - 1
  const d = Number(iso.substring(8, 10))
  return `${d} ${MONTHS_SHORT[m] ?? ''} ${y}`
}

/** Moeda pt-PT com 2 casas ("1 234,56 €"). */
export function formatCurrency(v: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('pt-PT', {
    ...PT_GROUPING,
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)
}

/** Moeda compacta para eixos ("950 €", "1,5 mil €", "12 mil €", "1 M €"). */
export function formatCompactCurrency(v: number, currency = 'EUR'): string {
  if (!Number.isFinite(v)) return ''
  const abs = Math.abs(v)
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: currency || 'EUR',
    notation: 'compact',
    maximumFractionDigits: abs >= 1000 && abs < 10000 ? 1 : 0,
  }).format(v)
}

/** Percentagem pt-PT ("12,5%"). */
export function formatPct(v: number, digits = 1): string {
  return `${v.toFixed(digits).replace('.', ',')}%`
}

/**
 * Reduz rótulos candidatos (null = sem rótulo) a no máximo `max`, mantendo espaçamento uniforme
 * entre candidatos (o 1.º candidato é sempre mantido).
 */
export function thinLabels(labels: (string | null)[], max = 7): (string | null)[] {
  const idx = labels.map((l, i) => (l !== null ? i : -1)).filter((i) => i >= 0)
  if (idx.length <= max) return labels
  const step = Math.ceil(idx.length / max)
  const keep = new Set(idx.filter((_, k) => k % step === 0))
  return labels.map((l, i) => (keep.has(i) ? l : null))
}
