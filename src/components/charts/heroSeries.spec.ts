import { describe, it, expect } from 'vitest'
import { returnPct, performanceSeries, periodChange, periodPerformanceSeries, seriesExtremes, indexOfDate } from './heroSeries'

const p = (date: string, value: number, cost: number) => ({ date, value, cost })

describe('returnPct / performanceSeries', () => {
  it('calcula (valor − custo) / custo', () => {
    expect(returnPct({ value: 110, cost: 100 })).toBeCloseTo(10)
    expect(returnPct({ value: 90, cost: 100 })).toBeCloseTo(-10)
  })
  it('custo ≤ 0 → null', () => {
    expect(returnPct({ value: 10, cost: 0 })).toBeNull()
    expect(performanceSeries([p('a', 0, 0), p('b', 120, 100)])).toEqual([null, 20])
  })
})

describe('periodChange', () => {
  it('sem novas entradas = retorno simples', () => {
    const r = periodChange([p('a', 100, 100), p('b', 150, 100)])
    expect(r.abs).toBeCloseTo(50)
    expect(r.pct).toBeCloseTo(50)
  })
  it('dinheiro novo não conta como ganho', () => {
    // compra de 1000 a meio: valor sobe 1000, ganho não muda
    const r = periodChange([p('a', 100, 100), p('b', 1100, 1100)])
    expect(r.abs).toBeCloseTo(0)
    expect(r.pct).toBeCloseTo(0)
  })
  it('a começar antes da 1.ª compra = retorno total', () => {
    const r = periodChange([p('a', 0, 0), p('b', 120, 100)])
    expect(r.abs).toBeCloseTo(20)
    expect(r.pct).toBeCloseTo(20)
  })
  it('respeita endIndex (hover)', () => {
    const r = periodChange([p('a', 100, 100), p('b', 80, 100), p('c', 150, 100)], 1)
    expect(r.abs).toBeCloseTo(-20)
    expect(r.pct).toBeCloseTo(-20)
  })
  it('sem custo (Património total) = variação simples do valor, % sobre o valor inicial', () => {
    const r = periodChange([p('a', 20000, 0), p('b', 18000, 0), p('c', 25000, 0)])
    expect(r.abs).toBeCloseTo(5000)
    expect(r.pct).toBeCloseTo(25)
    const h = periodChange([p('a', 20000, 0), p('b', 18000, 0), p('c', 25000, 0)], 1)
    expect(h.abs).toBeCloseTo(-2000)
    expect(h.pct).toBeCloseTo(-10)
  })
  it('vazio / base ≤ 0', () => {
    expect(periodChange([])).toEqual({ abs: 0, pct: null })
    expect(periodChange([p('a', 0, 0), p('b', 0, 0)]).pct).toBeNull()
  })
})

describe('seriesExtremes', () => {
  it('encontra mín. e máx. ignorando null', () => {
    expect(seriesExtremes([null, 5, 2, 9, 4])).toEqual({ min: 2, max: 3 })
  })
  it('série plana ou vazia → null', () => {
    expect(seriesExtremes([3, 3, 3])).toBeNull()
    expect(seriesExtremes([null, null])).toBeNull()
  })
})

describe('indexOfDate', () => {
  it('devolve a última ocorrência', () => {
    expect(indexOfDate([{ date: 'a' }, { date: 'b' }, { date: 'b' }], 'b')).toBe(2)
    expect(indexOfDate([{ date: 'a' }], 'z')).toBe(-1)
  })
})

describe('periodPerformanceSeries', () => {
  it('começa em 0 % e acaba na % do período (não na rentabilidade total)', () => {
    // Investiu 100 há muito tempo; no início do período valia 150 (+50 % total) e agora vale 165.
    const pts = [p('a', 150, 100), p('b', 160, 100), p('c', 165, 100)]
    const s = periodPerformanceSeries(pts)
    expect(s[0]).toBe(0)
    expect(s[2]).toBeCloseTo(10) // 15 / 150
    expect(returnPct(pts[2])).toBeCloseTo(65) // total ≠ período
  })
  it('dinheiro novo no período não conta como ganho', () => {
    const pts = [p('a', 100, 100), p('b', 200, 200)]
    expect(periodPerformanceSeries(pts)[1]).toBe(0)
  })
  it('a começar antes da 1.ª compra = rentabilidade total', () => {
    const pts = [p('a', 0, 0), p('b', 120, 100)]
    expect(periodPerformanceSeries(pts)[1]).toBeCloseTo(20)
  })
})
