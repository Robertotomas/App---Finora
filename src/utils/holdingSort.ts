import type { InvestmentHolding } from '@/types/investment'
import { holdingValueEur } from './portfolioAllocation'

/** Colunas ordenáveis da tabela de posições. */
export type HoldingSortKey = 'name' | 'quantity' | 'value' | 'day' | 'return' | 'returnPct' | 'weight'
export type SortDir = 'asc' | 'desc'

function sortValue(h: InvestmentHolding, key: HoldingSortKey): number | string | null {
  switch (key) {
    case 'name':
      return (h.providerSymbol || h.symbol || h.name).toLowerCase()
    case 'quantity':
      return h.quantity
    case 'value':
    case 'weight': // peso é proporcional ao valor
      return holdingValueEur(h)
    case 'day':
      return h.dayChangeEur
    case 'return':
      return h.totalReturnEur
    case 'returnPct':
      return h.totalReturnPct
  }
}

/**
 * Ordena posições por coluna. Valores desconhecidos (null) ficam sempre no fim, qualquer que seja a
 * direção; empates desempatam pelo nome. Não altera o array original.
 */
export function sortHoldings(holdings: InvestmentHolding[], key: HoldingSortKey, dir: SortDir): InvestmentHolding[] {
  const sign = dir === 'asc' ? 1 : -1
  const name = (h: InvestmentHolding) => (h.providerSymbol || h.symbol || h.name).toLowerCase()
  return [...holdings].sort((a, b) => {
    const va = sortValue(a, key)
    const vb = sortValue(b, key)
    if (va === null && vb === null) return name(a).localeCompare(name(b))
    if (va === null) return 1
    if (vb === null) return -1
    const cmp = typeof va === 'string' ? va.localeCompare(String(vb)) : va - (vb as number)
    return cmp !== 0 ? cmp * sign : name(a).localeCompare(name(b))
  })
}
