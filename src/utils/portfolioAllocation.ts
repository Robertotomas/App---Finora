import { INSTRUMENT_TYPE_LABELS } from '@/types/investment'
import type { InvestmentHolding } from '@/types/investment'

/**
 * "Distribuição da carteira": agrupa as posições ATIVAS pelo valor de mercado atual em EUR
 * (`currentValueEur ?? investedEur` — a mesma base do "Peso na carteira"). Lógica pura, testada.
 */

export type AllocationGrouping = 'asset' | 'type' | 'currency'

export interface AllocationSlice {
  key: string
  label: string
  value: number
  /** Percentagem do total (0–100). */
  percentage: number
}

/** Quantidade mínima para uma posição contar como ativa (igual ao store). */
const ACTIVE_EPS = 1e-9

/** Valor de mercado em EUR de uma posição (fallback: custo, quando ainda não há cotação). */
export function holdingValueEur(h: Pick<InvestmentHolding, 'currentValueEur' | 'investedEur'>): number {
  return h.currentValueEur ?? h.investedEur
}

/** Peso (%) de uma posição na carteira ativa. Null se o total for 0. */
export function holdingWeight(
  h: Pick<InvestmentHolding, 'currentValueEur' | 'investedEur'>,
  totalEur: number,
): number | null {
  return totalEur !== 0 ? (holdingValueEur(h) / totalEur) * 100 : null
}

function keyAndLabel(h: InvestmentHolding, grouping: AllocationGrouping): [string, string] {
  if (grouping === 'type') return [String(h.type), INSTRUMENT_TYPE_LABELS[h.type] ?? 'Outro']
  if (grouping === 'currency') {
    const ccy = (h.currency || 'EUR').toUpperCase()
    return [ccy, ccy]
  }
  return [h.id, h.providerSymbol || h.symbol || h.name]
}

/**
 * Fatias da distribuição, ordenadas por valor desc. Só posições ativas com valor > 0.
 * Por defeito mostra TODAS as posições (preferência do utilizador — sem "Outros"); `topN` opcional
 * junta o resto em "Outros" se algum dia for preciso.
 */
export function allocationSlices(
  holdings: InvestmentHolding[],
  grouping: AllocationGrouping,
  topN = Infinity,
): AllocationSlice[] {
  const groups = new Map<string, { label: string; value: number }>()
  for (const h of holdings) {
    if (!(h.quantity > ACTIVE_EPS)) continue
    const value = holdingValueEur(h)
    if (!(value > 0)) continue
    const [key, label] = keyAndLabel(h, grouping)
    const g = groups.get(key)
    if (g) g.value += value
    else groups.set(key, { label, value })
  }

  let slices = [...groups.entries()]
    .map(([key, g]) => ({ key, label: g.label, value: g.value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))

  if (grouping === 'asset' && slices.length > topN) {
    const rest = slices.slice(topN)
    slices = [
      ...slices.slice(0, topN),
      { key: '__others', label: 'Outros', value: rest.reduce((s, x) => s + x.value, 0) },
    ]
  }

  const total = slices.reduce((s, x) => s + x.value, 0)
  return slices.map((s) => ({ ...s, percentage: total > 0 ? (s.value / total) * 100 : 0 }))
}
