import { describe, it, expect } from 'vitest'
import { aggregateFxFee, explicitFeePercent, median, roundToStep } from './fxFee'

describe('aggregateFxFee', () => {
  it('mediana, arredondada a 0,05', () => {
    expect(aggregateFxFee([0.48, 0.52, 0.51], 'explicit')).toEqual({ percent: 0.5, source: 'explicit', sampleSize: 3 })
    expect(aggregateFxFee([0.1, 0.2, 0.3, 0.4], 'inferred')?.percent).toBe(0.25)
  })
  it('exige pelo menos 3 operações válidas', () => {
    expect(aggregateFxFee([0.5, 0.5], 'explicit')).toBeUndefined()
    expect(aggregateFxFee([0.5, 0.5, 9], 'explicit')).toBeUndefined() // 9% é outlier
  })
  it('descarta outliers (|taxa| > 3%) e limita a ≥ 0', () => {
    expect(aggregateFxFee([0.5, 0.5, 0.5, 4, -7], 'inferred')).toEqual({ percent: 0.5, source: 'inferred', sampleSize: 3 })
    expect(aggregateFxFee([-0.3, -0.2, -0.4], 'inferred')?.percent).toBe(0)
  })
})

describe('helpers', () => {
  it('median / roundToStep / explicitFeePercent', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
    expect(roundToStep(0.174)).toBe(0.15)
    expect(roundToStep(0.176)).toBe(0.2)
    expect(explicitFeePercent(-0.15, 100)).toBeCloseTo(0.15)
    expect(explicitFeePercent(null, 100)).toBeNull()
    expect(explicitFeePercent(1, 0)).toBeNull()
  })
})
