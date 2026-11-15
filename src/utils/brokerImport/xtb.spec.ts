import { describe, it, expect } from 'vitest'
import { extractXtbDividends, parseXtbRows, xtbToYahooSymbol } from './xtb'
import { xtbNewToLegacyRows } from './read'

// Linhas da folha "CASH OPERATION HISTORY": [ID, Type, Time, Comment, Symbol, Amount]
const row = (id: number, type: string, date: string, symbol: string, amount: number) => [
  id, type, date, '', symbol, amount,
]

describe('xtbToYahooSymbol', () => {
  it('mapeia o sufixo XTB para o Yahoo', () => {
    expect(xtbToYahooSymbol('AAPL.US')).toBe('AAPL')
    expect(xtbToYahooSymbol('VUAA.DE')).toBe('VUAA.DE')
    expect(xtbToYahooSymbol('VUSA.UK')).toBe('VUSA.L')
    expect(xtbToYahooSymbol('SEMSUFIXO')).toBeNull()
  })
})

describe('extractXtbDividends', () => {
  it('aceita as duas grafias (DIVIDENT / Dividend) e associa a retenção pelo símbolo + data', () => {
    const divs = extractXtbDividends([
      row(1, 'DIVIDENT', '2024-03-15 10:00:00', 'AAPL.US', 1.2),
      row(2, 'Withholding tax', '2024-03-15 10:00:00', 'AAPL.US', -0.18),
      row(3, 'Dividend', '2024-04-02', 'VUAA.DE', 3.5),
      row(4, 'Stock purchase', '2024-04-02', 'VUAA.DE', -100),
    ])
    expect(divs).toEqual([
      { providerSymbol: 'AAPL', date: '2024-03-15', amountGross: 1.2, withholdingTax: 0.18, currency: 'EUR', externalId: 'xtb:1' },
      { providerSymbol: 'VUAA.DE', date: '2024-04-02', amountGross: 3.5, withholdingTax: 0, currency: 'EUR', externalId: 'xtb:3' },
    ])
  })

  it('"Dividend tax" com data ligeiramente diferente vai para o dividendo mais próximo do mesmo símbolo', () => {
    const divs = extractXtbDividends([
      row(10, 'DIVIDENT', '2024-06-10', 'MSFT.US', 2),
      row(11, 'DIVIDENT', '2024-09-10', 'MSFT.US', 2),
      row(12, 'Dividend tax', '2024-09-11', 'MSFT.US', -0.3),
      row(13, 'Withholding tax', '2024-09-11', 'AAPL.US', -5), // sem dividendo correspondente → ignorado
    ])
    expect(divs.map((d) => d.withholdingTax)).toEqual([0, 0.3])
  })

  it('junta pagamentos do mesmo título no mesmo dia e nunca deixa o imposto passar o bruto', () => {
    const divs = extractXtbDividends([
      row(20, 'DIVIDENT', '2024-01-05', 'KO.US', 1),
      row(21, 'DIVIDENT', '2024-01-05', 'KO.US', 0.5),
      row(22, 'Withholding tax', '2024-01-05', 'KO.US', -9),
    ])
    expect(divs).toHaveLength(1)
    expect(divs[0].amountGross).toBe(1.5)
    expect(divs[0].withholdingTax).toBe(1.5)
    expect(divs[0].externalId).toBe('xtb:20')
  })
})

describe('XTB — formato novo ("Cash Operations")', () => {
  // Folha nova: linhas da conta antes do cabeçalho, colunas noutra ordem, ticker no comentário, "Stock sell".
  const d = (s: string) => new Date(s + 'T10:00:00Z')
  const sheet: unknown[][] = [
    ['Account number', '51238367'],
    ['Cash Operations'],
    ['Date from', '2006-01-01'],
    ['Date to', '2026-11-08'],
    ['Type', 'Instrument', 'Ticker', 'Category', 'Time', 'Amount', 'ID', 'Comment', 'Product', 'Position ID'],
    ['Deposit', '', '', '', d('2024-01-02'), 1000, '1511544766', 'deposit', 'My Trades', null],
    ['Stock purchase', 'S&P 500 IT Sector', 'QDVE.DE', 'ETF', d('2024-01-03'), -41.29, '1511716518', 'OPEN BUY QDVE.DE 1 @ 41.285', 'My Trades', '2921113218'],
    ['Stock sell', 'Sony', 'SONY.US', 'STOCK', d('2024-02-01'), 19.3, '1383369010', 'CLOSE BUY 1 @ 22.35', 'My Trades', '1'],
    ['Dividend', 'NVIDIA', 'NVDA.US', 'STOCK', d('2024-03-01'), 1.1, '1460475263', 'NVDA.US USD 0.25/ SHR', 'My Trades', null],
    ['Withholding tax', 'NVIDIA', 'NVDA.US', 'STOCK', d('2024-03-01'), -0.16, '1460475264', 'NVDA.US USD WHT 15%', 'My Trades', null],
    ['Free funds interest', '', '', '', d('2024-03-02'), 0.5, '1460475300', 'Free-funds Interest 2024-02', 'My Trades', null],
    ['Free funds interest tax', '', '', '', d('2024-03-02'), -0.14, '1460475301', 'Free-funds Interest Tax 2024-02', 'My Trades', null],
    ['SEC fee', 'Sony', 'SONY.US', 'STOCK', d('2024-02-01'), -0.01, '1383369011', 'SEC fee', 'My Trades', null],
    ['Spinoff', 'X', 'X.US', 'STOCK', d('2024-04-01'), 0.82, '1460475400', 'Spinoff', 'My Trades', null],
    ['Total', null, null, null, null, 979.95, null, null, null, null],
  ]

  it('converte para o layout antigo e ignora a linha "Total"', () => {
    const rows = xtbNewToLegacyRows(sheet)!
    expect(rows[0].slice(0, 6)).toEqual(['ID', 'Type', 'Time', 'Comment', 'Symbol', 'Amount'])
    expect(rows).toHaveLength(10)
    expect(rows[2].slice(0, 6)).toEqual(['1511716518', 'Stock purchase', sheet[6][4], 'OPEN BUY QDVE.DE 1 @ 41.285', 'QDVE.DE', -41.29])
  })

  it('devolve null sem o cabeçalho esperado', () => {
    expect(xtbNewToLegacyRows([['a', 'b'], [1, 2]])).toBeNull()
  })

  it('extrai compras, vendas, depósitos e dividendos com os mesmos ExternalIds', () => {
    const res = parseXtbRows(xtbNewToLegacyRows(sheet)!)
    expect(res.trades.map((t) => t.externalId)).toEqual(['xtb:1511716518', 'xtb:1383369010'])
    const buy = res.trades[0]
    expect(buy.providerSymbol).toBe('QDVE.DE')
    expect(buy.name).toBe('S&P 500 IT Sector')
    expect(buy.quantity).toBe(1)
    expect(buy.unitPrice).toBeCloseTo(41.285)
    expect(res.trades[1].providerSymbol).toBe('SONY')
    expect(res.deposits.map((x) => x.externalId)).toEqual(['xtb:1511544766'])
    expect(res.dividends).toHaveLength(1)
    expect(res.dividends[0].withholdingTax).toBeCloseTo(0.16)
  })

  it('juros, taxas e spinoffs entram como outros movimentos de caixa (fundos livres)', () => {
    const res = parseXtbRows(xtbNewToLegacyRows(sheet)!)
    expect(res.cashMovements!.map((m) => [m.kind, m.amount, m.externalId])).toEqual([
      ['interest', 0.5, 'xtb:1460475300'],
      ['interest', -0.14, 'xtb:1460475301'],
      ['fee', -0.01, 'xtb:1383369011'],
      ['spinoff', 0.82, 'xtb:1460475400'],
    ])
    // Nada disto conta como negócio, depósito ou dividendo.
    expect(res.trades).toHaveLength(2)
    expect(res.deposits).toHaveLength(1)
    expect(res.dividends).toHaveLength(1)
  })
})
