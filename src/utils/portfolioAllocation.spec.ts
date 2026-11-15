import { describe, it, expect } from 'vitest'
import { allocationSlices, holdingValueEur, holdingWeight } from './portfolioAllocation'
import { sortHoldings } from './holdingSort'
import { InstrumentType } from '@/types/investment'
import type { InvestmentHolding } from '@/types/investment'

function h(over: Partial<InvestmentHolding>): InvestmentHolding {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    householdId: 'hh',
    symbol: over.symbol ?? 'X',
    exchange: '',
    providerSymbol: over.providerSymbol ?? over.symbol ?? 'X',
    name: over.name ?? 'X',
    currency: over.currency ?? 'EUR',
    type: over.type ?? InstrumentType.Stock,
    quantity: over.quantity ?? 1,
    averageCost: 0,
    currentPrice: null,
    priceAsOf: null,
    investedEur: over.investedEur ?? 0,
    currentValueEur: over.currentValueEur === undefined ? null : over.currentValueEur,
    returnEur: null,
    returnPct: null,
    previousClose: null,
    dayChangeEur: over.dayChangeEur === undefined ? null : over.dayChangeEur,
    dayChangePct: null,
    realizedGainEur: 0,
    realizedCostEur: 0,
    dividendsEur: 0,
    totalReturnEur: over.totalReturnEur === undefined ? null : over.totalReturnEur,
    totalReturnPct: null,
    transactions: [],
  }
}

describe('holdingValueEur / holdingWeight', () => {
  it('usa o valor de mercado e cai para o custo sem cotação', () => {
    expect(holdingValueEur(h({ currentValueEur: 120, investedEur: 100 }))).toBe(120)
    expect(holdingValueEur(h({ currentValueEur: null, investedEur: 100 }))).toBe(100)
  })
  it('peso = valor / total; null com total 0', () => {
    expect(holdingWeight(h({ currentValueEur: 25 }), 100)).toBeCloseTo(25)
    expect(holdingWeight(h({ currentValueEur: 25 }), 0)).toBeNull()
  })
})

describe('allocationSlices', () => {
  const portfolio = [
    h({ id: 'a', symbol: 'VWCE', providerSymbol: 'VWCE.DE', type: InstrumentType.Etf, currency: 'EUR', currentValueEur: 600 }),
    h({ id: 'b', symbol: 'AAPL', type: InstrumentType.Stock, currency: 'USD', currentValueEur: 300 }),
    h({ id: 'c', symbol: 'MSFT', type: InstrumentType.Stock, currency: 'USD', currentValueEur: null, investedEur: 100 }),
    h({ id: 'closed', symbol: 'TSLA', quantity: 0, currentValueEur: 0, investedEur: 0 }),
  ]

  it('por ativo: só posições ativas, ordenado por valor, % somam 100', () => {
    const s = allocationSlices(portfolio, 'asset')
    expect(s.map((x) => x.label)).toEqual(['VWCE.DE', 'AAPL', 'MSFT'])
    expect(s[0].percentage).toBeCloseTo(60)
    expect(s.reduce((t, x) => t + x.percentage, 0)).toBeCloseTo(100)
  })

  it('por tipo: agrupa com os rótulos do enum', () => {
    const s = allocationSlices(portfolio, 'type')
    expect(s).toEqual([
      expect.objectContaining({ label: 'ETF', value: 600 }),
      expect.objectContaining({ label: 'Ação', value: 400 }),
    ])
  })

  it('por moeda: exposição pela moeda da posição', () => {
    const s = allocationSlices(portfolio, 'currency')
    expect(s.map((x) => [x.label, x.value])).toEqual([
      ['EUR', 600],
      ['USD', 400],
    ])
  })

  it('por ativo: mostra todas as posições por defeito (sem "Outros")', () => {
    const many = Array.from({ length: 10 }, (_, i) => h({ id: `h${i}`, symbol: `S${i}`, currentValueEur: 100 - i }))
    const s = allocationSlices(many, 'asset')
    expect(s).toHaveLength(10)
    expect(s.some((x) => x.label === 'Outros')).toBe(false)
  })

  it('por ativo: top N opcional junta o resto em "Outros"', () => {
    const many = Array.from({ length: 10 }, (_, i) => h({ id: `h${i}`, symbol: `S${i}`, currentValueEur: 100 - i }))
    const s = allocationSlices(many, 'asset', 8)
    expect(s).toHaveLength(9)
    expect(s[8].label).toBe('Outros')
    expect(s[8].value).toBe(91 + 92)
  })

  it('carteira vazia → sem fatias', () => {
    expect(allocationSlices([], 'asset')).toEqual([])
  })
})

describe('sortHoldings', () => {
  const list = [
    h({ id: '1', symbol: 'BBB', currentValueEur: 100, dayChangeEur: 5, totalReturnEur: -10 }),
    h({ id: '2', symbol: 'AAA', currentValueEur: 300, dayChangeEur: null, totalReturnEur: 20 }),
    h({ id: '3', symbol: 'CCC', currentValueEur: 200, dayChangeEur: -2, totalReturnEur: null }),
  ]
  it('por valor desc (default da tabela)', () => {
    expect(sortHoldings(list, 'value', 'desc').map((x) => x.id)).toEqual(['2', '3', '1'])
  })
  it('por nome asc', () => {
    expect(sortHoldings(list, 'name', 'asc').map((x) => x.id)).toEqual(['2', '1', '3'])
  })
  it('desconhecidos (null) ficam no fim em ambas as direções', () => {
    expect(sortHoldings(list, 'day', 'asc').map((x) => x.id)).toEqual(['3', '1', '2'])
    expect(sortHoldings(list, 'day', 'desc').map((x) => x.id)).toEqual(['1', '3', '2'])
    expect(sortHoldings(list, 'return', 'desc').map((x) => x.id)).toEqual(['2', '1', '3'])
  })
  it('não altera o array original', () => {
    const copy = [...list]
    sortHoldings(list, 'value', 'asc')
    expect(list).toEqual(copy)
  })
})
