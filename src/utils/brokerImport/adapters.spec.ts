import { describe, it, expect } from 'vitest'
import { analyzeStatement, detectBroker, tableFromRows } from './index'
import type { NormalizedImport, StatementContext } from './types'
import { parseXtbRows } from './xtb'
import { InvestmentOperation } from '@/types/investment'

/** Contexto a partir de linhas cruas (o que o readStatement produz de um CSV). */
function ctxOf(raw: string[][], xtbRows: unknown[][] | null = null): StatementContext {
  return { fileName: 'x.csv', sheetNames: ['Sheet1'], xtbRows, rawRows: raw, table: tableFromRows(raw) }
}
function ready(ctx: StatementContext): NormalizedImport {
  const o = analyzeStatement(ctx)
  if (o.kind !== 'ready') throw new Error(`esperado ready, veio ${o.kind}: ${JSON.stringify(o)}`)
  return o.data
}

/* ── Amostras (as mesmas do generic.spec.ts + linhas extra de depósitos/dividendos) ── */
const T212_H = ['Action', 'Time', 'ISIN', 'Ticker', 'Name', 'No. of shares', 'Price / share', 'Currency (Price / share)', 'Exchange rate', 'Total', 'ID', 'Currency conversion fee']
const T212_TRADES = [
  ['Market buy', '2024-03-10 14:30:00', 'US0378331005', 'AAPL', 'Apple Inc', '2', '170.50', 'USD', '0.92', '313.72', 'EOF111', '0.50'],
  ['Market sell', '2024-04-01 10:00:00', 'US0378331005', 'AAPL', 'Apple Inc', '1', '180.00', 'USD', '0.93', '167.40', 'EOF112', '0.30'],
]
const DEGIRO_H = ['Date', 'Time', 'Product', 'ISIN', 'Reference exchange', 'Quantity', 'Price', 'Local value', 'Exchange rate', 'Transaction costs', 'Total', 'Order ID']
const DEGIRO_ROWS = [['10-03-2024', '14:30', 'APPLE INC', 'US0378331005', 'NDQ', '2', '170.50', '-341.00', '0.92', '-0.50', '-341.50', 'ord-1']]
const DEGIRO_NL_H = ['Datum', 'Tijd', 'Product', 'ISIN', 'Beurs', 'Aantal', 'Koers', '', 'Lokale waarde', '', 'Waarde', '', 'Wisselkoers', 'Transactiekosten', '', 'Totaal', 'Order ID']
const DEGIRO_NL_ROWS = [['10-03-2024', '09:05', 'APPLE INC', 'US0378331005', 'NDQ', '2', '170,50', 'USD', '341', 'USD', '313,5', 'EUR', '0,92', '-0,50', 'EUR', '313', 'ord-1']]
const IBKR_H = ['Symbol', 'ISIN', 'Buy/Sell', 'Quantity', 'TradePrice', 'IBCommission', 'CurrencyPrimary', 'FXRateToBase', 'TradeDate', 'TransactionID']
const IBKR_ROWS = [['AAPL', 'US0378331005', 'BUY', '10', '170.50', '-1.00', 'USD', '0.92', '20240310', '2316076751']]
const TR_H = ['date', 'type', 'value', 'note', 'isin', 'shares', 'fees', 'taxes', 'isin2', 'shares2']
const TR_ROWS = [
  ['2024-03-10', 'BUY', '-340.00', 'Apple', 'US0378331005', '2', '0.00', '0.00', '', ''],
  ['2024-04-01', 'SELL', '180.00', 'Apple', 'US0378331005', '1', '0.00', '0.00', '', ''],
]
const TR_NL_H = ['Datum', 'Transactietype', 'Waarde (netto)', 'Opmerking', 'ISIN', 'Aantal', 'Kosten', 'Belasting']
const TR_NL_ROWS = [
  ['2024-07-23', 'Aankoop', '-5', 'FTSE Dev World', 'IE00BKX55T58', '0,052361', '', ''],
  ['2024-11-29', 'Verkoop', '10,799', 'FTSE Dev World', 'IE00BKX55T58', '0,104341', '', ''],
]
const REV_H = ['Date', 'Ticker', 'Type', 'Quantity', 'Price per share', 'Total Amount', 'Currency', 'FX Rate']
const REV_ROWS = [
  ['2023-09-22T13:30:10.514Z', 'O', 'BUY - MARKET', '1.63453043', '$52.07', '$85.11', 'USD', '1.0665'],
  ['2023-07-14T13:30:00.797Z', 'MA', 'SELL - MARKET', '0.1998348', '$402.13', '$80.34', 'USD', '1.1241'],
  ['2025-09-08T07:29:03Z', 'MSFT', 'BUY - MARKET', '0,76672417', '€26.09', '€20', 'EUR', '1'],
]

const XTB_ROWS: unknown[][] = [
  ['Cash operation history'],
  ['ID', 'Type', 'Time', 'Comment', 'Symbol', 'Amount'],
  [501, 'Deposit', '2024-01-02 09:00:00', 'Deposit', '', 1000],
  [502, 'Stock purchase', '2024-01-03 15:30:00', 'OPEN BUY 2 @ 100.00', 'AAPL.US', -183.0],
  [503, 'Stock purchase', '2024-01-04 15:30:00', 'OPEN BUY 1 @ 50.00', 'VUAA.DE', -50],
  [504, 'Stock sale', '2024-02-01 15:30:00', 'CLOSE BUY 1 @ 110.00', 'AAPL.US', 100.5],
  [505, 'DIVIDENT', '2024-02-15', 'AAPL.US USD 0.24/ SHR', 'AAPL.US', 0.4],
  [506, 'Withholding tax', '2024-02-15', 'WHT 15%', 'AAPL.US', -0.06],
  [507, 'Stock purchase', '2024-02-20 15:30:00', 'sem formato', 'AAPL.US', -10],
  [508, 'Withdrawal', '2024-03-01', 'Withdrawal', '', -200],
]

describe('detectBroker', () => {
  const cases: [string, StatementContext, string][] = [
    ['XTB', ctxOf([['ID', 'Type']], XTB_ROWS), 'xtb'],
    ['Trading 212', ctxOf([T212_H, ...T212_TRADES]), 'trading212'],
    ['DEGIRO (EN)', ctxOf([DEGIRO_H, ...DEGIRO_ROWS]), 'degiro'],
    ['DEGIRO (NL)', ctxOf([DEGIRO_NL_H, ...DEGIRO_NL_ROWS]), 'degiro'],
    ['IBKR Flex', ctxOf([IBKR_H, ...IBKR_ROWS]), 'ibkr'],
    ['Trade Republic (pytr EN)', ctxOf([TR_H, ...TR_ROWS]), 'tradeRepublic'],
    ['Trade Republic (pytr NL)', ctxOf([TR_NL_H, ...TR_NL_ROWS]), 'tradeRepublic'],
    ['Revolut', ctxOf([REV_H, ...REV_ROWS]), 'revolut'],
  ]
  for (const [name, ctx, id] of cases) {
    it(`reconhece ${name}`, () => {
      const d = detectBroker(ctx)
      expect(d.adapter?.id).toBe(id)
      expect(d.confidence).toBeGreaterThanOrEqual(0.6)
    })
  }
  it('ficheiro desconhecido → genérico (sem adaptador)', () => {
    const d = detectBroker(ctxOf([['Data', 'Ativo', 'Qtd', 'Preço unit.'], ['2024-01-01', 'AAPL', '1', '100']]))
    expect(d.adapter).toBeNull()
  })
})

describe('compatibilidade de externalIds (NÃO podem mudar — dedup de reimportações)', () => {
  // Valores produzidos pelo código anterior (brokerImport.ts / xtbExcel.ts) para estas amostras.
  it('Trading 212 → {perfil}:{ID}', () => {
    expect(ready(ctxOf([T212_H, ...T212_TRADES])).trades.map((t) => t.externalId)).toEqual(['imp6gzpiw:EOF111', 'imp6gzpiw:EOF112'])
  })
  it('DEGIRO → {perfil}:{ID da Ordem}', () => {
    expect(ready(ctxOf([DEGIRO_H, ...DEGIRO_ROWS])).trades.map((t) => t.externalId)).toEqual(['impyspopn:ord-1'])
  })
  it('IBKR Flex → {perfil}:{TransactionID}', () => {
    expect(ready(ctxOf([IBKR_H, ...IBKR_ROWS])).trades.map((t) => t.externalId)).toEqual(['imp14p1ree:2316076751'])
  })
  it('Trade Republic → chave composta', () => {
    expect(ready(ctxOf([TR_H, ...TR_ROWS])).trades.map((t) => t.externalId)).toEqual([
      'imp1g4ctrt:2024-03-10:US0378331005:2:170:0',
      'imp1g4ctrt:2024-04-01:US0378331005:1:180:1',
    ])
    expect(ready(ctxOf([TR_NL_H, ...TR_NL_ROWS])).trades.map((t) => t.externalId)).toEqual([
      'imp1e7ym0t:2024-07-23:IE00BKX55T58:0.052361:95.49091881362082:0',
      'imp1e7ym0t:2024-11-29:IE00BKX55T58:0.104341:103.49718710765661:1',
    ])
  })
  it('Revolut → chave composta', () => {
    expect(ready(ctxOf([REV_H, ...REV_ROWS])).trades.map((t) => t.externalId)).toEqual([
      'imp1jv6z5t:2023-09-22:O:1.63453043:52.07:0',
      'imp1jv6z5t:2023-07-14:MA:0.1998348:402.13:1',
      'imp1jv6z5t:2025-09-08:MSFT:0.76672417:26.09:0',
    ])
  })
  it('XTB → xtb:{ID} para negócios, depósitos e dividendos', () => {
    const r = parseXtbRows(XTB_ROWS)
    expect(r.trades.map((t) => t.externalId)).toEqual(['xtb:502', 'xtb:503', 'xtb:504'])
    expect(r.deposits.map((d) => d.externalId)).toEqual(['xtb:501', 'xtb:508'])
    expect(r.dividends.map((d) => d.externalId)).toEqual(['xtb:505'])
  })
})

describe('XTB', () => {
  const r = parseXtbRows(XTB_ROWS)
  it('negócios, depósitos (com sinal), dividendos com retenção e linhas falhadas', () => {
    expect(r.broker).toBe('xtb')
    expect(r.trades[0]).toMatchObject({ providerSymbol: 'AAPL', currency: 'USD', quantity: 2, unitPrice: 100, fxRateToEur: 0.915 })
    expect(r.trades[1]).toMatchObject({ providerSymbol: 'VUAA.DE', currency: 'EUR', fxRateToEur: 1 })
    expect(r.trades[2].operation).toBe(InvestmentOperation.Sell)
    expect(r.deposits.map((d) => d.amount)).toEqual([1000, -200])
    expect(r.dividends[0]).toMatchObject({ amountGross: 0.4, withholdingTax: 0.06 })
    expect(r.hasUnparsedRows).toBe(true)
    expect(r.warnings.length).toBe(1)
  })
  it('gera amostras de câmbio só para operações não-EUR (para a taxa inferida)', () => {
    expect(r.fxSamples).toEqual([
      { currency: 'USD', date: '2024-01-03', operation: InvestmentOperation.Buy, quantity: 2, unitPrice: 100, amountEur: 183 },
      { currency: 'USD', date: '2024-02-01', operation: InvestmentOperation.Sell, quantity: 1, unitPrice: 110, amountEur: 100.5 },
    ])
  })
  it('sem cabeçalho → erro amigável', () => {
    const o = analyzeStatement(ctxOf([['x']], [['nada']]))
    expect(o.kind).toBe('error')
  })
})

describe('Trading 212 — depósitos, dividendos e taxa explícita', () => {
  const H = [...T212_H, 'Currency (Total)', 'Withholding tax', 'Currency (Withholding tax)']
  const row = (a: string, t: string, tk: string, n: string, p: string, pc: string, total: string, id: string, fee: string, wht = '', whtc = '') =>
    [a, t, tk ? 'US0000000000' : '', tk, tk, n, p, pc, '', total, id, fee, 'EUR', wht, whtc]
  const rows = [
    row('Deposit', '2024-01-01 10:00:00', '', '', '', '', '500', 'D1', ''),
    row('Withdrawal', '2024-06-01 10:00:00', '', '', '', '', '-100', 'W1', ''),
    row('Market buy', '2024-01-02 15:00:00', 'AAPL', '1', '100', 'USD', '92.15', 'B1', '0.14'),
    row('Market buy', '2024-01-03 15:00:00', 'MSFT', '1', '200', 'USD', '184.30', 'B2', '0.28'),
    row('Market sell', '2024-01-04 15:00:00', 'AAPL', '1', '110', 'USD', '100.85', 'S1', '0.15'),
    row('Market buy', '2024-01-05 15:00:00', 'VUAA', '1', '100', 'EUR', '100', 'B3', ''),
    row('Dividend (Ordinary)', '2024-02-15 00:00:00', 'AAPL', '10', '0.24', 'USD', '1.86', 'V1', '', '0.36', 'USD'),
  ]
  const r = ready(ctxOf([H, ...rows]))
  it('extrai depósitos com sinal e prefixo t212', () => {
    expect(r.broker).toBe('trading212')
    expect(r.deposits).toEqual([
      { date: '2024-01-01', amount: 500, currency: 'EUR', externalId: 't212:D1' },
      { date: '2024-06-01', amount: -100, currency: 'EUR', externalId: 't212:W1' },
    ])
  })
  it('dividendo líquido + retenção convertida para a moeda da conta', () => {
    expect(r.dividends).toHaveLength(1)
    const d = r.dividends[0]
    expect(d.externalId).toBe('t212:V1')
    // 0,36 USD × (1,86 / (2,40 − 0,36)) ≈ 0,328235 EUR
    expect(d.withholdingTax).toBeCloseTo(0.328235, 5)
    expect(d.amountGross).toBeCloseTo(1.86 + 0.328235, 5)
  })
  it('taxa explícita = mediana de fee / bruto nas operações em moeda estrangeira', () => {
    expect(r.fxFee).toEqual({ percent: 0.15, source: 'explicit', sampleSize: 3 })
    expect(r.trades).toHaveLength(4)
  })
})

describe('DEGIRO — extrato de conta (Account.csv)', () => {
  const H = ['Data', 'Hora', 'Data Valor', 'Produto', 'ISIN', 'Descrição', 'T. de câmbio', 'Variação', '', 'Saldo', '', 'ID da Ordem']
  const rows = [
    ['02-01-2024', '09:00', '02-01-2024', '', '', 'Depósito', '', 'EUR', '1000,00', 'EUR', '1000,00', ''],
    ['02-01-2024', '09:00', '02-01-2024', '', '', 'Reserva de depósito', '', 'EUR', '1000,00', 'EUR', '2000,00', ''],
    ['15-02-2024', '07:00', '15-02-2024', 'APPLE INC', 'US0378331005', 'Dividendo', '', 'USD', '2,40', 'USD', '2,40', ''],
    ['15-02-2024', '07:00', '15-02-2024', 'APPLE INC', 'US0378331005', 'Imposto sobre dividendo', '', 'USD', '-0,36', 'USD', '2,04', ''],
    ['01-03-2024', '10:00', '01-03-2024', '', '', 'Levantamento', '', 'EUR', '-200,00', 'EUR', '800,00', ''],
    ['03-01-2024', '15:30', '03-01-2024', 'APPLE INC', 'US0378331005', 'Compra 2 Apple@170 USD', '', 'USD', '-340,00', 'USD', '-340,00', 'abc'],
  ]
  const r = ready(ctxOf([H, ...rows]))
  it('só extras (sem negócios): depósitos, levantamentos e dividendos com imposto', () => {
    expect(r.broker).toBe('degiro')
    expect(r.trades).toHaveLength(0)
    expect(r.deposits).toEqual([
      { date: '2024-01-02', amount: 1000, currency: 'EUR', externalId: 'degiro:dep:2024-01-02:09:00:1000' },
      { date: '2024-03-01', amount: -200, currency: 'EUR', externalId: 'degiro:dep:2024-03-01:10:00:-200' },
    ])
    expect(r.dividends).toEqual([
      { providerSymbol: 'US0378331005', date: '2024-02-15', amountGross: 2.4, withholdingTax: 0.36, currency: 'USD', externalId: 'degiro:div:2024-02-15:US0378331005:2.4' },
    ])
  })
})

describe('DEGIRO — taxa AutoFX explícita', () => {
  const H = ['Data', 'Hora', 'Produto', 'ISIN', 'Bolsa de referência', 'Quantidade', 'Preços', '', 'Valor local', '', 'Valor', '', 'Taxa de câmbio', 'Custo de câmbio AutoFX', 'Custos de transação', '', 'Total', '', 'ID da Ordem']
  const row = (id: string, ccy: string, value: string, fx: string) =>
    ['10-03-2024', '14:30', 'X', 'US0378331005', 'NDQ', '1', '100', ccy, '-100', ccy, value, 'EUR', '1,08', fx, '-1', 'EUR', value, 'EUR', id]
  const r = ready(ctxOf([H, row('a', 'USD', '-92,00', '-0,23'), row('b', 'USD', '-184,00', '-0,46'), row('c', 'USD', '-46,00', '-0,12'), row('d', 'EUR', '-100,00', '0')]))
  it('mediana de AutoFX / valor em € (0,25%)', () => {
    expect(r.fxFee).toEqual({ percent: 0.25, source: 'explicit', sampleSize: 3 })
    expect(r.trades.map((t) => t.externalId).every((id) => id.startsWith('imp'))).toBe(true)
  })
})

describe('IBKR Activity Statement (multi-secção)', () => {
  const raw: string[][] = [
    ['Statement', 'Header', 'Field Name', 'Field Value'],
    ['Statement', 'Data', 'BrokerName', 'Interactive Brokers'],
    ['Trades', 'Header', 'DataDiscriminator', 'Asset Category', 'Currency', 'Symbol', 'Date/Time', 'Quantity', 'T. Price', 'C. Price', 'Proceeds', 'Comm/Fee'],
    ['Trades', 'Data', 'Order', 'Stocks', 'USD', 'AAPL', '2024-03-10, 14:30:00', '1,000', '170.5', '171', '-170500', '-1'],
    ['Trades', 'Data', 'Order', 'Stocks', 'EUR', 'VUAA', '2024-03-11, 09:00:00', '-5', '90', '90', '450', '-1.25'],
    ['Trades', 'Data', 'Order', 'Forex', 'USD', 'EUR.USD', '2024-03-10, 14:00:00', '1000', '1.09', '', '', ''],
    ['Trades', 'SubTotal', '', 'Stocks', 'USD', 'AAPL', '', '1000', '', '', '', ''],
    ['Deposits & Withdrawals', 'Header', 'Currency', 'Settle Date', 'Description', 'Amount'],
    ['Deposits & Withdrawals', 'Data', 'EUR', '2024-03-01', 'Electronic Fund Transfer', '10,000'],
    ['Deposits & Withdrawals', 'Data', 'Total', '', '', '10,000'],
    ['Dividends', 'Header', 'Currency', 'Date', 'Description', 'Amount'],
    ['Dividends', 'Data', 'USD', '2024-05-16', 'AAPL(US0378331005) Cash Dividend USD 0.25 per Share (Ordinary Dividend)', '250'],
    ['Dividends', 'Data', 'Total', '', '', '250'],
    ['Withholding Tax', 'Header', 'Currency', 'Date', 'Description', 'Amount', 'Code'],
    ['Withholding Tax', 'Data', 'USD', '2024-05-16', 'AAPL(US0378331005) Cash Dividend USD 0.25 per Share - US Tax', '-37.5', ''],
    ['Financial Instrument Information', 'Header', 'Asset Category', 'Symbol', 'Description', 'Conid', 'Security ID', 'Listing Exch'],
    ['Financial Instrument Information', 'Data', 'Stocks', 'AAPL', 'APPLE INC', '265598', 'US0378331005', 'NASDAQ'],
    ['Financial Instrument Information', 'Data', 'Stocks', 'VUAA', 'VANGUARD S&P 500 UCITS ETF', '1', 'IE00BFMXXD54', 'IBIS2'],
  ]
  const ctx: StatementContext = { fileName: 'a.csv', sheetNames: ['Sheet1'], xtbRows: null, rawRows: raw, table: tableFromRows(raw) }
  it('é detetado como IBKR e extrai negócios/depósitos/dividendos', () => {
    expect(detectBroker(ctx).adapter?.id).toBe('ibkr')
    const r = ready(ctx)
    expect(r.trades).toHaveLength(2)
    expect(r.trades[0]).toMatchObject({ providerSymbol: 'AAPL', quantity: 1000, unitPrice: 170.5, operation: InvestmentOperation.Buy, isin: 'US0378331005', date: '2024-03-10' })
    expect(r.trades[1]).toMatchObject({ providerSymbol: 'VUAA.DE', quantity: 5, operation: InvestmentOperation.Sell, fxRateToEur: 1 })
    expect(r.trades[0].externalId).toBe('ibkr:2024-03-10, 14:30:00:AAPL:1000:170.5')
    expect(r.deposits).toEqual([{ date: '2024-03-01', amount: 10000, currency: 'EUR', externalId: 'ibkr:dep:2024-03-01:10000' }])
    expect(r.dividends).toEqual([
      { providerSymbol: 'AAPL', date: '2024-05-16', amountGross: 250, withholdingTax: 37.5, currency: 'USD', externalId: 'ibkr:div:2024-05-16:AAPL:250' },
    ])
  })
})

describe('Revolut — carregamentos e dividendos', () => {
  const rows = [
    ...REV_ROWS,
    ['2023-01-01T10:00:00Z', '', 'CASH TOP-UP', '', '', '$100', 'USD', '1.07'],
    ['2023-02-01T10:00:00Z', '', 'CASH WITHDRAWAL', '', '', '$20', 'USD', '1.08'],
    ['2019-12-13T08:40:00Z', 'MSFT', 'DIVIDEND', '', '', '$0.08', 'USD', '1.1179'],
  ]
  const r = ready(ctxOf([REV_H, ...rows]))
  it('depósitos com sinal e dividendos (líquidos)', () => {
    expect(r.trades).toHaveLength(3)
    expect(r.deposits.map((d) => [d.amount, d.currency])).toEqual([[100, 'USD'], [-20, 'USD']])
    expect(r.dividends).toEqual([
      { providerSymbol: 'MSFT', date: '2019-12-13', amountGross: 0.08, withholdingTax: 0, currency: 'USD', externalId: 'revolut:div:2019-12-13T08:40:00Z:MSFT:0.08' },
    ])
    expect(r.fxFee).toBeUndefined()
  })
})

describe('Trade Republic — depósitos e dividendos', () => {
  const rows = [
    ['2024-11-30', 'Onttrekking', '-10,84', 'John Doe', '', '', '', ''],
    ['2024-01-05', 'Storting', '100', '', '', '', '', ''],
    ...TR_NL_ROWS,
    ['2024-09-25', 'Dividend', '0,03', 'FTSE Dev World', 'IE00BKX55T58', '', '', '-0,01'],
  ]
  const r = ready(ctxOf([TR_NL_H, ...rows]))
  it('extrai levantamento, depósito e dividendo com imposto', () => {
    expect(r.trades).toHaveLength(2)
    expect(r.deposits.map((d) => d.amount)).toEqual([-10.84, 100])
    expect(r.dividends[0]).toMatchObject({ providerSymbol: 'IE00BKX55T58', amountGross: 0.04, withholdingTax: 0.01, externalId: 'tr:div:2024-09-25:IE00BKX55T58:0.03' })
  })
})

describe('genérico', () => {
  it('colunas não reconhecidas → ecrã de mapeamento', () => {
    const o = analyzeStatement(ctxOf([['Quando', 'Ativo', 'Nº', 'Valor unit.'], ['2024-01-01', 'AAPL', '1', '100']]))
    expect(o.kind).toBe('mapping')
    if (o.kind === 'mapping') expect(o.adapter).toBeNull()
  })
})
