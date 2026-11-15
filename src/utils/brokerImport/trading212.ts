import type { BrokerDeposit, BrokerDividend } from '@/types/investment'
import { compositeKeyer, findCol, headerScore, normalize, parseDate, parseNumber, round6 } from './shared'
import { aggregateFxFee, explicitFeePercent } from './fxFee'
import type { TableAdapter, TableExtras } from './tableAdapter'
import type { StatementContext, TableData } from './types'

/**
 * Trading 212 (CSV "History"). Negócios: caminho genérico (mesmo externalId de sempre: `{perfil}:{ID}`).
 * Aqui: depósitos/levantamentos, dividendos (+ retenção) e a taxa de conversão explícita
 * ("Currency conversion fee", na moeda da conta).
 */

function accountCurrencyFromHeader(header: string): string | null {
  const m = header.match(/\(([A-Za-z]{3})\)\s*$/)
  return m ? m[1].toUpperCase() : null
}

export function trading212Extras(table: TableData): TableExtras {
  const h = table.headers
  const col = {
    action: findCol(h, ['action']),
    time: findCol(h, ['time']),
    id: findCol(h, ['id']),
    ticker: findCol(h, ['ticker']),
    isin: findCol(h, ['isin']),
    shares: findCol(h, ['no. of shares']),
    pps: findCol(h, ['price / share']),
    ppsCcy: findCol(h, ['currency (price / share)']),
    total: findCol(h, ['total']),
    totalCcy: findCol(h, ['currency (total)']),
    wht: findCol(h, ['withholding tax']),
    whtCcy: findCol(h, ['currency (withholding tax)']),
    fee: findCol(h, ['currency conversion fee']),
  }
  const headerCcy = col.total >= 0 ? accountCurrencyFromHeader(h[col.total]) : null
  const cell = (r: string[], i: number) => (i >= 0 ? String(r[i] ?? '').trim() : '')
  const key = compositeKeyer()

  const deposits: BrokerDeposit[] = []
  const dividends: BrokerDividend[] = []
  const feeSamples: number[] = []

  for (const r of table.rows) {
    const action = normalize(cell(r, col.action))
    if (!action) continue
    const total = parseNumber(cell(r, col.total))
    const accountCcy = (cell(r, col.totalCcy) || headerCcy || 'EUR').toUpperCase().slice(0, 3)
    const date = parseDate(cell(r, col.time))
    const id = cell(r, col.id)

    if (action === 'deposit' || action === 'withdrawal') {
      if (total == null || total === 0) continue
      const amount = action === 'deposit' ? Math.abs(total) : -Math.abs(total)
      deposits.push({
        date,
        amount,
        currency: accountCcy,
        externalId: id ? `t212:${id}` : key(`t212:dep:${cell(r, col.time)}:${amount}`),
      })
      continue
    }

    if (action.startsWith('dividend')) {
      if (total == null || total <= 0) continue
      const symbol = cell(r, col.ticker).toUpperCase() || cell(r, col.isin).toUpperCase()
      if (!symbol) continue
      let tax = Math.abs(parseNumber(cell(r, col.wht)) ?? 0)
      const whtCcy = cell(r, col.whtCcy).toUpperCase()
      if (tax > 0 && whtCcy && whtCcy !== accountCcy) {
        // Retenção na moeda do título → converte pelo rácio líquido(conta) / líquido(título).
        const shares = parseNumber(cell(r, col.shares)) ?? 0
        const pps = parseNumber(cell(r, col.pps)) ?? 0
        const netInstr = shares * pps - tax
        tax = netInstr > 0 ? tax * (total / netInstr) : 0
      }
      dividends.push({
        providerSymbol: symbol,
        date,
        amountGross: round6(total + tax),
        withholdingTax: round6(tax),
        currency: accountCcy,
        externalId: id ? `t212:${id}` : key(`t212:div:${date}:${symbol}:${total}`),
      })
      continue
    }

    // Taxa de conversão explícita nas compras/vendas em moeda estrangeira.
    const isBuy = /buy/.test(action)
    const isSell = /sell/.test(action)
    if ((isBuy || isSell) && col.fee >= 0) {
      const priceCcy = cell(r, col.ppsCcy).toUpperCase()
      const fee = parseNumber(cell(r, col.fee))
      if (!priceCcy || priceCcy === accountCcy || fee == null || total == null) continue
      const gross = isBuy ? Math.abs(total) - Math.abs(fee) : Math.abs(total) + Math.abs(fee)
      const pct = explicitFeePercent(fee, gross)
      if (pct != null) feeSamples.push(pct)
    }
  }

  return { deposits, dividends, fxFee: aggregateFxFee(feeSamples, 'explicit') }
}

export const trading212Adapter: TableAdapter = {
  id: 'trading212',
  label: 'Trading 212',
  kind: 'table',
  detect(ctx: StatementContext) {
    const h = ctx.table?.headers ?? []
    const core = headerScore(h, [['action'], ['time'], ['no. of shares'], ['price / share']])
    if (core < 1) return core >= 0.75 ? 0.5 : 0
    return headerScore(h, [['currency conversion fee'], ['currency (price / share)'], ['ticker'], ['isin']]) > 0 ? 0.95 : 0.85
  },
  extras: trading212Extras,
}
