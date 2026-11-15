import type { BrokerDeposit, BrokerDividend } from '@/types/investment'
import { compositeKeyer, exactCol, headerScore, normalize, parseDate, parseNumber, round6 } from './shared'
import type { TableAdapter, TableExtras } from './tableAdapter'
import type { StatementContext, TableData } from './types'

/**
 * Trade Republic (exportação do pytr: "Date;Type;Value;Note;ISIN;Shares;Fees;Taxes", também em DE/NL).
 * Negócios pelo caminho genérico (chave composta `{perfil}:…`, como sempre; o preço deriva do valor).
 * Aqui: depósitos/levantamentos e dividendos (valor líquido + impostos). Conta em EUR → sem taxa de câmbio.
 */

const GROUPS = [
  ['date', 'datum'],
  ['type', 'typ', 'transactietype', 'transaction type'],
  ['value', 'wert', 'waarde (netto)', 'waarde'],
  ['note', 'notiz', 'opmerking'],
  ['isin'],
  ['shares', 'stuck', 'aantal'],
  ['fees', 'gebuhren', 'kosten'],
  ['taxes', 'steuern', 'belasting'],
]

const DEPOSIT_RE = /^(deposit|einzahlung|storting|deposito)/
const WITHDRAW_RE = /^(removal|withdrawal|auszahlung|onttrekking|levantamento)/
const DIVIDEND_RE = /^(dividend|dividende|distribution|ausschuttung|uitkering)/

export function tradeRepublicExtras(table: TableData): TableExtras {
  const h = table.headers
  const col = {
    date: exactCol(h, GROUPS[0]),
    type: exactCol(h, GROUPS[1]),
    value: exactCol(h, GROUPS[2]),
    isin: exactCol(h, GROUPS[4]),
    taxes: exactCol(h, GROUPS[7]),
  }
  const key = compositeKeyer()
  const deposits: BrokerDeposit[] = []
  const dividends: BrokerDividend[] = []
  for (const r of table.rows) {
    const type = normalize(r[col.type] ?? '')
    const value = parseNumber(r[col.value])
    if (!type || value == null || value === 0) continue
    const date = parseDate(r[col.date])

    if (DEPOSIT_RE.test(type) || WITHDRAW_RE.test(type)) {
      const signed = WITHDRAW_RE.test(type) ? -Math.abs(value) : Math.abs(value)
      deposits.push({ date, amount: round6(signed), currency: 'EUR', externalId: key(`tr:dep:${date}:${signed}`) })
    } else if (DIVIDEND_RE.test(type)) {
      const isin = String(r[col.isin] ?? '').trim().toUpperCase()
      if (!isin || value <= 0) continue
      const tax = Math.abs(parseNumber(r[col.taxes]) ?? 0)
      dividends.push({
        providerSymbol: isin,
        date,
        amountGross: round6(value + tax),
        withholdingTax: round6(tax),
        currency: 'EUR',
        externalId: key(`tr:div:${date}:${isin}:${value}`),
      })
    }
  }
  return { deposits, dividends }
}

export const tradeRepublicAdapter: TableAdapter = {
  id: 'tradeRepublic',
  label: 'Trade Republic',
  kind: 'table',
  detect(ctx: StatementContext) {
    const s = headerScore(ctx.table?.headers ?? [], GROUPS)
    return s >= 0.85 ? 0.85 : s >= 0.7 ? 0.5 : 0
  },
  extras: tradeRepublicExtras,
}
