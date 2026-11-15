import type { BrokerDeposit, BrokerDividend } from '@/types/investment'
import { compositeKeyer, exactCol, headerScore, normalize, parseDate, parseNumber, round6 } from './shared'
import type { TableAdapter, TableExtras } from './tableAdapter'
import type { StatementContext, TableData } from './types'

/**
 * Revolut Invest (CSV "Date,Ticker,Type,Quantity,Price per share,Total Amount,Currency,FX Rate").
 * Negócios pelo caminho genérico (chave composta `{perfil}:…`, como sempre). Aqui: carregamentos/
 * levantamentos de dinheiro e dividendos (a Revolut indica-os já líquidos de retenção).
 * Sem taxa de conversão no extrato (a conversão é feita na conta Revolut) → sem deteção de taxa.
 */

const GROUPS = [['ticker'], ['type'], ['quantity'], ['price per share'], ['total amount'], ['currency'], ['fx rate']]

export function revolutExtras(table: TableData): TableExtras {
  const h = table.headers
  const col = {
    date: exactCol(h, ['date']),
    ticker: exactCol(h, ['ticker']),
    type: exactCol(h, ['type']),
    total: exactCol(h, ['total amount']),
    ccy: exactCol(h, ['currency']),
  }
  const key = compositeKeyer()
  const deposits: BrokerDeposit[] = []
  const dividends: BrokerDividend[] = []
  for (const r of table.rows) {
    const type = normalize(r[col.type] ?? '')
    const amount = parseNumber(r[col.total])
    if (amount == null || amount === 0) continue
    const rawDate = String(r[col.date] ?? '').trim()
    const date = parseDate(rawDate)
    const currency = (String(r[col.ccy] ?? '').trim() || 'USD').toUpperCase().slice(0, 3)

    if (type.startsWith('cash top up') || type.startsWith('cash withdrawal')) {
      const signed = type.startsWith('cash withdrawal') ? -Math.abs(amount) : Math.abs(amount)
      deposits.push({ date, amount: round6(signed), currency, externalId: key(`revolut:dep:${rawDate}:${signed}`) })
    } else if (type.startsWith('dividend')) {
      const ticker = String(r[col.ticker] ?? '').trim().toUpperCase()
      if (!ticker || amount <= 0) continue
      dividends.push({
        providerSymbol: ticker,
        date,
        amountGross: round6(amount),
        withholdingTax: 0,
        currency,
        externalId: key(`revolut:div:${rawDate}:${ticker}:${amount}`),
      })
    }
  }
  return { deposits, dividends }
}

export const revolutAdapter: TableAdapter = {
  id: 'revolut',
  label: 'Revolut',
  kind: 'table',
  detect(ctx: StatementContext) {
    const s = headerScore(ctx.table?.headers ?? [], GROUPS)
    return s >= 0.85 ? 0.9 : s >= 0.7 ? 0.5 : 0
  },
  extras: revolutExtras,
}
