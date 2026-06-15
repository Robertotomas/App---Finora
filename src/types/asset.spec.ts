import { describe, it, expect } from 'vitest'
import {
  assetChangeVsCost,
  annualizedReturn,
  holdingPeriodLabel,
  valuationDeltas,
  type AssetValuation,
} from './asset'

describe('assetChangeVsCost', () => {
  it('calcula variação absoluta e percentual', () => {
    expect(assetChangeVsCost(220_000, 200_000)).toEqual({ abs: 20_000, pct: 10 })
  })

  it('variação negativa', () => {
    expect(assetChangeVsCost(180_000, 200_000)).toEqual({ abs: -20_000, pct: -10 })
  })

  it('pct null quando custo é zero', () => {
    expect(assetChangeVsCost(100, 0)).toEqual({ abs: 100, pct: null })
  })
})

describe('annualizedReturn', () => {
  it('CAGR de ~2 anos com duplicação ≈ 41%', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const r = annualizedReturn(100, 200, '2024-01-01T00:00:00Z', now)
    expect(r).not.toBeNull()
    // ~2 anos (contagem exata de dias varia com bissextos) → perto de 2^(1/2)-1 = 41,4%
    expect(r as number).toBeGreaterThan(40)
    expect(r as number).toBeLessThan(42)
  })

  it('~1 ano com +10% ≈ 10%', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const r = annualizedReturn(100, 110, '2025-01-01T00:00:00Z', now)
    expect(r as number).toBeCloseTo(10, 1)
  })

  it('null se período < 1 mês', () => {
    const now = new Date('2026-01-10T00:00:00Z')
    expect(annualizedReturn(100, 200, '2026-01-05T00:00:00Z', now)).toBeNull()
  })

  it('null se custo <= 0', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    expect(annualizedReturn(0, 200, '2020-01-01T00:00:00Z', now)).toBeNull()
  })
})

describe('holdingPeriodLabel', () => {
  it('anos e meses', () => {
    const now = new Date('2026-06-14T00:00:00Z')
    expect(holdingPeriodLabel('2010-03-10T00:00:00Z', now)).toBe('16 anos, 3 meses')
  })

  it('só meses', () => {
    const now = new Date('2026-06-14T00:00:00Z')
    expect(holdingPeriodLabel('2026-01-14T00:00:00Z', now)).toBe('5 meses')
  })

  it('singular ano/mês', () => {
    const now = new Date('2026-06-14T00:00:00Z')
    expect(holdingPeriodLabel('2025-05-14T00:00:00Z', now)).toBe('1 ano, 1 mês')
  })

  it('menos de 1 mês', () => {
    const now = new Date('2026-06-14T00:00:00Z')
    expect(holdingPeriodLabel('2026-06-01T00:00:00Z', now)).toBe('Menos de 1 mês')
  })
})

describe('valuationDeltas', () => {
  const valuations: AssetValuation[] = [
    { id: 'a', date: '2010-03-10T00:00:00Z', value: 200_000 },
    { id: 'c', date: '2026-05-07T00:00:00Z', value: 220_000 },
    { id: 'b', date: '2026-04-25T00:00:00Z', value: 250_000 },
  ]

  it('ordena por data desc e calcula variação vs anterior', () => {
    const rows = valuationDeltas(valuations)
    expect(rows.map((r) => r.id)).toEqual(['c', 'b', 'a'])
    // mais recente (220k) vs 250k anterior
    expect(rows[0].deltaAbs).toBe(-30_000)
    expect(rows[0].deltaPct).toBeCloseTo(-12, 4)
    // 250k vs 200k
    expect(rows[1].deltaAbs).toBe(50_000)
    expect(rows[1].deltaPct).toBeCloseTo(25, 4)
    // aquisição (a mais antiga) sem variação
    expect(rows[2].deltaAbs).toBeNull()
    expect(rows[2].deltaPct).toBeNull()
  })
})
