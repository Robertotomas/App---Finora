/**
 * Lógica pura do gráfico "hero" (Investimentos / Bens e valores) — sem Chart.js, testável.
 * Pontos = { date, value, cost } (valor de mercado e custo/investido à data).
 */
export interface HeroPoint {
  date: string
  value: number
  cost: number
}

/** Rentabilidade (%) de um ponto: (valor − custo) / custo × 100. `null` se custo ≤ 0. */
export function returnPct(p: { value: number; cost: number }): number | null {
  return p.cost > 0 ? ((p.value - p.cost) / p.cost) * 100 : null
}

/** Série de rentabilidade (%) por ponto (modo "Desempenho"). Pontos sem custo → `null` (não desenhados). */
export function performanceSeries(points: HeroPoint[]): (number | null)[] {
  return points.map(returnPct)
}

/**
 * Variação do período entre o 1.º ponto e `endIndex` (default: o último).
 * Usa a variação do GANHO (valor − custo), não do valor: dinheiro novo investido (compras/depósitos)
 * não aparece como "lucro". A % é relativa ao valor inicial + dinheiro novo no período
 * (sem novas entradas = retorno simples; a começar antes da 1.ª compra = retorno total).
 */
export function periodChange(points: HeroPoint[], endIndex = points.length - 1): { abs: number; pct: number | null } {
  if (points.length === 0 || endIndex < 0) return { abs: 0, pct: null }
  const first = points[0]
  const last = points[Math.min(endIndex, points.length - 1)]
  const abs = last.value - last.cost - (first.value - first.cost)
  const base = first.value + (last.cost - first.cost)
  return { abs, pct: base > 0 ? (abs / base) * 100 : null }
}

/**
 * Série de desempenho DO PERÍODO (modo "Desempenho"): em cada ponto, a rentabilidade acumulada desde o
 * início do período visível (`periodChange` até esse ponto). Começa em 0 % e acaba na % do período —
 * assim o gráfico e o número grande mudam com o período escolhido (1A, 6M…). Em "Tudo" (início antes
 * da 1.ª compra) coincide com a rentabilidade total.
 */
export function periodPerformanceSeries(points: HeroPoint[]): (number | null)[] {
  return points.map((_, i) => periodChange(points, i).pct)
}

/**
 * Índices do mínimo e do máximo da série (ignora `null`). `null` se a série for plana/vazia.
 * Em empate fica a 1.ª ocorrência.
 */
export function seriesExtremes(data: (number | null)[]): { min: number; max: number } | null {
  let min = -1
  let max = -1
  for (let i = 0; i < data.length; i++) {
    const v = data[i]
    if (v === null || !Number.isFinite(v)) continue
    if (min < 0 || v < (data[min] as number)) min = i
    if (max < 0 || v > (data[max] as number)) max = i
  }
  if (min < 0 || max < 0 || data[min] === data[max]) return null
  return { min, max }
}

/** Índice do último ponto com a data dada (as vistas longas podem repetir datas ao reamostrar). */
export function indexOfDate(points: { date: string }[], date: string): number {
  for (let i = points.length - 1; i >= 0; i--) if (points[i].date === date) return i
  return -1
}
