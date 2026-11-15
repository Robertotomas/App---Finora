import { xtbAdapter } from './xtb'
import { trading212Adapter } from './trading212'
import { degiroAdapter } from './degiro'
import { ibkrActivityAdapter, ibkrFlexAdapter } from './ibkr'
import { revolutAdapter } from './revolut'
import { tradeRepublicAdapter } from './tradeRepublic'
import type { AnyAdapter } from './tableAdapter'
import type { StatementContext } from './types'

/** Adaptadores dedicados, por ordem de desempate (o mais específico primeiro). */
export const ADAPTERS: AnyAdapter[] = [
  xtbAdapter,
  ibkrActivityAdapter,
  trading212Adapter,
  degiroAdapter,
  ibkrFlexAdapter,
  revolutAdapter,
  tradeRepublicAdapter,
]

/** Confiança mínima para usar um adaptador dedicado; abaixo disso → genérico (mapeamento de colunas). */
export const MIN_CONFIDENCE = 0.6

export interface Detection {
  adapter: AnyAdapter | null
  confidence: number
}

/** Escolhe o adaptador com maior confiança pela "assinatura" do ficheiro (folhas/cabeçalhos). */
export function detectBroker(ctx: StatementContext): Detection {
  let best: AnyAdapter | null = null
  let bestScore = 0
  for (const a of ADAPTERS) {
    const s = a.detect(ctx)
    if (s > bestScore) { bestScore = s; best = a }
  }
  return bestScore >= MIN_CONFIDENCE ? { adapter: best, confidence: bestScore } : { adapter: null, confidence: bestScore }
}
