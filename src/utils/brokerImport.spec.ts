import { describe, it, expect } from 'vitest'
import { autoMap, buildTrades, parseNumber, parseDate } from './brokerImport'
import { InvestmentOperation } from '@/types/investment'

function run(headers: string[], rows: string[][]) {
  const mapping = autoMap(headers)
  const built = buildTrades(rows, mapping, 'test')
  return { mapping, ...built }
}

describe('parseNumber', () => {
  it('handles US and EU decimal formats', () => {
    expect(parseNumber('170.50')).toBe(170.5)
    expect(parseNumber('1.234,56')).toBe(1234.56)
    expect(parseNumber('1,234.56')).toBe(1234.56)
    expect(parseNumber('1234,5')).toBe(1234.5)
    expect(parseNumber('10,799')).toBe(10.799) // vírgula decimal com 3 casas (Trade Republic)
    expect(parseNumber('0,052361')).toBe(0.052361)
    expect(parseNumber('-1')).toBe(-1)
    expect(parseNumber('$1,000.00')).toBe(1000)
    expect(parseNumber('')).toBeNull()
  })
})

describe('parseDate', () => {
  it('normalizes common formats to yyyy-MM-dd', () => {
    expect(parseDate('2024-03-10 14:30:00')).toBe('2024-03-10')
    expect(parseDate('10-03-2024')).toBe('2024-03-10')
    expect(parseDate('10/03/2024')).toBe('2024-03-10')
    expect(parseDate('20240310')).toBe('2024-03-10')
  })
})

describe('Trading 212 (CSV, Action column + ID)', () => {
  const headers = ['Action', 'Time', 'ISIN', 'Ticker', 'Name', 'No. of shares', 'Price / share', 'Currency (Price / share)', 'Exchange rate', 'Total', 'ID', 'Currency conversion fee']
  const rows = [
    ['Market buy', '2024-03-10 14:30:00', 'US0378331005', 'AAPL', 'Apple Inc', '2', '170.50', 'USD', '0.92', '313.72', 'EOF111', '0.50'],
    ['Market sell', '2024-04-01 10:00:00', 'US0378331005', 'AAPL', 'Apple Inc', '1', '180.00', 'USD', '0.93', '167.40', 'EOF112', '0.30'],
    ['Dividend (Ordinary)', '2024-05-01 00:00:00', 'US0378331005', 'AAPL', 'Apple Inc', '', '', 'USD', '', '1.20', 'EOF113', ''],
  ]
  it('imports buys/sells and skips dividends', () => {
    const r = run(headers, rows)
    expect(r.items.length).toBe(2)
    expect(r.items[0].operation).toBe(InvestmentOperation.Buy)
    expect(r.items[0].providerSymbol).toBe('AAPL')
    expect(r.items[0].quantity).toBe(2)
    expect(r.items[0].unitPrice).toBe(170.5)
    expect(r.items[0].externalId).toBe('test:EOF111')
    expect(r.items[1].operation).toBe(InvestmentOperation.Sell)
  })
})

describe('DEGIRO (signed quantity, ISIN only, Order ID)', () => {
  const headers = ['Date', 'Time', 'Product', 'ISIN', 'Reference exchange', 'Quantity', 'Price', 'Local value', 'Exchange rate', 'Transaction costs', 'Total', 'Order ID']
  const rows = [
    ['10-03-2024', '14:30', 'APPLE INC', 'US0378331005', 'NDQ', '2', '170.50', '-341.00', '0.92', '-0.50', '-341.50', 'ord-1'],
    ['11-03-2024', '10:00', 'APPLE INC', 'US0378331005', 'NDQ', '-1', '180.00', '180.00', '0.93', '-0.50', '179.50', 'ord-2'],
  ]
  it('infers buy/sell from sign of quantity', () => {
    const r = run(headers, rows)
    expect(r.items.length).toBe(2)
    expect(r.items[0].operation).toBe(InvestmentOperation.Buy)
    expect(r.items[1].operation).toBe(InvestmentOperation.Sell)
    expect(r.items[1].quantity).toBe(1)
    expect(r.items[0].providerSymbol).toBe('US0378331005') // sem ticker → usa ISIN
    expect(r.items[0].externalId).toBe('test:ord-1')
  })
})

describe('IBKR (Flex CSV, Buy/Sell text, yyyymmdd, transactionID)', () => {
  const headers = ['Symbol', 'ISIN', 'Buy/Sell', 'Quantity', 'TradePrice', 'IBCommission', 'CurrencyPrimary', 'FXRateToBase', 'TradeDate', 'TransactionID']
  const rows = [
    ['AAPL', 'US0378331005', 'BUY', '10', '170.50', '-1.00', 'USD', '0.92', '20240310', '2316076751'],
    ['AAPL', 'US0378331005', 'SELL', '-5', '180.00', '-1.00', 'USD', '0.93', '20240401', '2316076752'],
  ]
  it('uses Buy/Sell column and transactionID for dedup', () => {
    const r = run(headers, rows)
    expect(r.items.length).toBe(2)
    expect(r.mapping.side).toBe(2)
    expect(r.items[0].operation).toBe(InvestmentOperation.Buy)
    expect(r.items[0].date).toBe('2024-03-10')
    expect(r.items[1].operation).toBe(InvestmentOperation.Sell)
    expect(r.items[1].quantity).toBe(5)
    expect(r.items[0].externalId).toBe('test:2316076751')
  })
})

describe('Trade Republic / pytr (no unit price → derive from total)', () => {
  const headers = ['date', 'type', 'value', 'note', 'isin', 'shares', 'fees', 'taxes', 'isin2', 'shares2']
  const rows = [
    ['2024-03-10', 'BUY', '-340.00', 'Apple', 'US0378331005', '2', '0.00', '0.00', '', ''],
    ['2024-04-01', 'SELL', '180.00', 'Apple', 'US0378331005', '1', '0.00', '0.00', '', ''],
  ]
  it('derives unit price from total/quantity and dedups by composite key', () => {
    const r = run(headers, rows)
    expect(r.items.length).toBe(2)
    expect(r.items[0].operation).toBe(InvestmentOperation.Buy)
    expect(r.items[0].unitPrice).toBe(170) // 340 / 2
    expect(r.items[0].providerSymbol).toBe('US0378331005')
    // sem coluna de ID → chave composta
    expect(r.items[0].externalId).toContain('test:2024-03-10:US0378331005:2:170')
  })
})

describe('Revolut Invest (ticker, símbolos $/€, decimal misto, tipos compostos)', () => {
  const headers = ['Date', 'Ticker', 'Type', 'Quantity', 'Price per share', 'Total Amount', 'Currency', 'FX Rate']
  const rows = [
    ['2023-09-22T13:30:10.514Z', 'O', 'BUY - MARKET', '1.63453043', '$52.07', '$85.11', 'USD', '1.0665'],
    ['2023-07-14T13:30:00.797Z', 'MA', 'SELL - MARKET', '0.1998348', '$402.13', '$80.34', 'USD', '1.1241'],
    ['2019-12-13T08:40:00Z', 'MSFT', 'DIVIDEND', '', '', '$0.08', 'USD', '1.1179'], // ignorado
    ['2025-09-08T07:29:03Z', 'MSFT', 'BUY - MARKET', '0,76672417', '€26.09', '€20', 'EUR', '1'],
  ]
  it('reconhece BUY/SELL - MARKET, limpa $/€ e ignora a coluna de câmbio (usa histórico)', () => {
    const r = run(headers, rows)
    expect(r.items.length).toBe(3)
    expect(r.items[0].providerSymbol).toBe('O')
    expect(r.items[0].operation).toBe(InvestmentOperation.Buy)
    expect(r.items[0].unitPrice).toBe(52.07)
    expect(r.items[0].fxRateToEur).toBeNull() // USD → backend calcula câmbio histórico
    expect(r.items[1].operation).toBe(InvestmentOperation.Sell)
    expect(r.items[2].fxRateToEur).toBe(1) // EUR
  })
})

describe('DEGIRO Transações (quantidade com sinal, colunas de moeda sem cabeçalho)', () => {
  const headers = ['Datum', 'Tijd', 'Product', 'ISIN', 'Beurs', 'Aantal', 'Koers', '', 'Lokale waarde', '', 'Waarde', '', 'Wisselkoers', 'Transactiekosten', '', 'Totaal', 'Order ID']
  const rows = [
    ['10-03-2024', '09:05', 'APPLE INC', 'US0378331005', 'NDQ', '2', '170,50', 'USD', '341', 'USD', '313,5', 'EUR', '0,92', '-0,50', 'EUR', '313', 'ord-1'],
    ['11-03-2024', '10:00', 'APPLE INC', 'US0378331005', 'NDQ', '-1', '180,00', 'USD', '180', 'USD', '167,4', 'EUR', '0,93', '-0,50', 'EUR', '167,9', 'ord-2'],
  ]
  it('mapeia data/isin/quantidade/koers/order-id e deduz compra/venda pelo sinal', () => {
    const r = run(headers, rows)
    expect(r.items.length).toBe(2)
    expect(r.items[0].operation).toBe(InvestmentOperation.Buy)
    expect(r.items[0].unitPrice).toBe(170.5)
    expect(r.items[1].operation).toBe(InvestmentOperation.Sell)
    expect(r.items[1].quantity).toBe(1)
    expect(r.items[0].externalId).toBe('test:ord-1')
  })
})

describe('Trade Republic / pytr — holandês, vírgula decimal, palavras compostas', () => {
  const headers = ['Datum', 'Transactietype', 'Waarde (netto)', 'Opmerking', 'ISIN', 'Aantal', 'Kosten', 'Belasting']
  const rows = [
    ['2024-11-30', 'Onttrekking', '-10,84', 'John Doe', '', '', '', ''], // levantamento → ignorado (sem ISIN)
    ['2024-07-23', 'Aankoop', '-5', 'FTSE Dev World', 'IE00BKX55T58', '0,052361', '', ''],
    ['2024-11-29', 'Verkoop', '10,799', 'FTSE Dev World', 'IE00BKX55T58', '0,104341', '', ''],
    ['2024-09-25', 'Dividend', '0,03', 'FTSE Dev World', 'IE00BKX55T58', '', '', ''], // dividendo → ignorado
  ]
  it('reconhece Aankoop/Verkoop e deriva o preço com vírgula decimal', () => {
    const r = run(headers, rows)
    expect(r.items.length).toBe(2)
    expect(r.items[0].operation).toBe(InvestmentOperation.Buy)
    expect(r.items[0].providerSymbol).toBe('IE00BKX55T58')
    expect(r.items[0].unitPrice).toBeCloseTo(95.49, 1) // 5 / 0,052361
    expect(r.items[1].operation).toBe(InvestmentOperation.Sell)
  })
})
