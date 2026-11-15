import type { FxFeeEstimate } from './types'

/**
 * Agregação da taxa de conversão de moeda da corretora a partir de amostras por operação (%).
 * Mesmas regras do backend (`FxFeeEstimator` em Finora.Infrastructure — manter em sincronia):
 * descarta outliers (|taxa| > 3%), exige ≥ 3 operações, mediana, arredonda a 0,05 e limita a 0–5.
 */
export const FX_FEE_RULES = {
  minSamples: 3,
  maxAbsPercent: 3,
  step: 0.05,
  max: 5,
} as const

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Arredonda ao múltiplo de 0,05 mais próximo (sem lixo de vírgula flutuante). */
export function roundToStep(value: number, step: number = FX_FEE_RULES.step): number {
  return Number((Math.round(value / step) * step).toFixed(4))
}

export function aggregateFxFee(samples: number[], source: FxFeeEstimate['source']): FxFeeEstimate | undefined {
  const valid = samples.filter((p) => Number.isFinite(p) && Math.abs(p) <= FX_FEE_RULES.maxAbsPercent)
  if (valid.length < FX_FEE_RULES.minSamples) return undefined
  const pct = Math.min(FX_FEE_RULES.max, Math.max(0, roundToStep(median(valid))))
  return { percent: pct, source, sampleSize: valid.length }
}

/** Taxa explícita de uma operação: |taxa| / |montante bruto| × 100 (ambos na moeda da conta). */
export function explicitFeePercent(fee: number | null, gross: number | null): number | null {
  if (fee == null || gross == null || !Number.isFinite(fee) || !Number.isFinite(gross) || gross === 0) return null
  return (Math.abs(fee) / Math.abs(gross)) * 100
}
