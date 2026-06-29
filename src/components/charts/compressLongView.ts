/**
 * Em vistas longas (ex.: 5A), reamostra a série para que cada "rótulo" — cada ANO anterior e cada
 * MÊS do ano atual — ocupe EXATAMENTE a mesma largura. Como o eixo é uniforme (largura igual por
 * ponto), basta dar a cada ano/mês o mesmo número de pontos: os anos antigos "juntam-se" e os meses
 * do ano atual (Jan → mês atual) ficam simetricamente espaçados, sem sobreposição nem gaps estranhos.
 *
 * Sem isto, os meses ficariam proporcionais ao nº de dias (Fev mais estreito que Mar, etc.).
 *
 * cutoff = "AAAA-01-01" (início do ano atual). Pontos < cutoff = anteriores; >= cutoff = ano atual.
 */
function resample<T>(group: T[], slot: number): T[] {
  if (group.length === 0) return []
  if (group.length === 1) return new Array(slot).fill(group[0])
  const step = (group.length - 1) / (slot - 1)
  const out: T[] = []
  for (let i = 0; i < slot; i++) out.push(group[Math.round(i * step)])
  return out
}

export function compressLongView<T extends { date: string }>(points: T[], cutoff: string): T[] {
  if (!cutoff) return points
  const older = points.filter((p) => p.date < cutoff)
  const current = points.filter((p) => p.date >= cutoff)
  if (older.length < 3 || current.length === 0) return points

  // Buckets: cada ano anterior e cada mês do ano atual.
  const olderYears = [...new Set(older.map((p) => p.date.substring(0, 4)))].sort()
  const currentMonths = [...new Set(current.map((p) => p.date.substring(0, 7)))].sort()

  // Nº de pontos por bucket = maior contagem mensal do ano atual (preserva o detalhe do mês mais cheio).
  const slot = Math.max(
    2,
    ...currentMonths.map((m) => current.filter((p) => p.date.substring(0, 7) === m).length),
  )

  // Ano atual: cada mês com `slot` pontos (a âncora "hoje" — último ponto do último mês — é preservada).
  const evenCurrent = currentMonths.flatMap((m) =>
    resample(current.filter((p) => p.date.substring(0, 7) === m), slot),
  )
  // Anos anteriores: cada ano com `slot` pontos → mesma largura de um mês.
  const evenOlder = olderYears.flatMap((y) =>
    resample(older.filter((p) => p.date.substring(0, 4) === y), slot),
  )

  return [...evenOlder, ...evenCurrent]
}
