import type { BrokerDeposit, BrokerDividend } from '@/types/investment'
import { attachWithholding, compositeKeyer, exactCol, headerScore, normalize, parseDate, parseNumber, round6 } from './shared'
import type { TaxLine } from './shared'
import { aggregateFxFee, explicitFeePercent } from './fxFee'
import type { TableAdapter, TableExtras } from './tableAdapter'
import type { StatementContext, TableData } from './types'

/**
 * DEGIRO (PT/EN/NL/DE). Dois ficheiros:
 * - **Transações** (Transactions.csv): negócios pelo caminho genérico (externalId `{perfil}:{ID da Ordem}`);
 *   aqui só a taxa AutoFX explícita, se a coluna existir.
 * - **Conta** (Account.csv): depósitos/levantamentos e dividendos (+ imposto sobre dividendos). Sem negócios.
 */

const TX_GROUPS = [
  ['isin'],
  ['bolsa', 'bolsa de referencia', 'reference exchange', 'beurs', 'referentiebeurs', 'borse', 'referenzborse', 'venue', 'local de execucao', 'uitvoeringsplaats', 'ausfuhrungsort'],
  ['valor local', 'local value', 'lokale waarde', 'lokaler wert'],
  ['id da ordem', 'order id', 'orderid', 'order id.'],
  ['quantidade', 'quantity', 'aantal', 'anzahl'],
]

const ACCOUNT_GROUPS = [
  ['descricao', 'description', 'omschrijving', 'beschreibung'],
  ['variacao', 'change', 'mutatie', 'anderung'],
  ['saldo', 'balance'],
  ['isin'],
  ['data valor', 'value date', 'valutadatum', 'valuta'],
]

const CCY = /^[A-Z]{3}$/

export function isDegiroAccount(table: TableData): boolean {
  return headerScore(table.headers, ACCOUNT_GROUPS) >= 0.8
}

/** Moeda na coluna sem cabeçalho a seguir (padrão DEGIRO: "Valor local", "", …). */
function ccyAfter(r: string[], idx: number): string {
  if (idx < 0) return ''
  const a = String(r[idx + 1] ?? '').trim().toUpperCase()
  if (CCY.test(a)) return a
  const b = String(r[idx] ?? '').trim().toUpperCase()
  return CCY.test(b) ? b : ''
}

function transactionExtras(table: TableData): TableExtras {
  const h = table.headers
  const norm = h.map(normalize)
  const autoFx = norm.findIndex((x) => x.includes('autofx'))
  if (autoFx < 0) return {}
  const localValue = exactCol(h, ['valor local', 'local value', 'lokale waarde', 'lokaler wert'])
  const price = exactCol(h, ['precos', 'preco', 'price', 'koers', 'kurs'])
  const value = exactCol(h, ['valor', 'value', 'waarde', 'wert'])
  const samples: number[] = []
  for (const r of table.rows) {
    const localCcy = ccyAfter(r, localValue) || ccyAfter(r, price)
    const valueCcy = ccyAfter(r, value) || 'EUR'
    if (!localCcy || localCcy === valueCcy) continue
    const pct = explicitFeePercent(parseNumber(r[autoFx]), parseNumber(r[value]))
    if (pct != null) samples.push(pct)
  }
  return { fxFee: aggregateFxFee(samples, 'explicit') }
}

const DIV_TAX_RE = /(imposto sobre dividendo|dividend tax|dividendbelasting|dividendensteuer|retencao)/
const DIV_RE = /^(dividendo|dividend|dividende)\b/
const RESERVE_RE = /(reserv|cash sweep|conta de caixa|cash account|geldmarkt|money market)/
const DEPOSIT_RE = /(deposito|deposit|storting|einzahlung)/
const WITHDRAW_RE = /(levantamento|withdrawal|terugstorting|auszahlung)/

function accountExtras(table: TableData): TableExtras {
  const h = table.headers
  const col = {
    date: exactCol(h, ['data', 'date', 'datum']),
    time: exactCol(h, ['hora', 'time', 'tijd', 'uhrzeit']),
    isin: exactCol(h, ['isin']),
    desc: exactCol(h, ['descricao', 'description', 'omschrijving', 'beschreibung']),
    change: exactCol(h, ['variacao', 'change', 'mutatie', 'anderung']),
  }
  const key = compositeKeyer()
  const deposits: BrokerDeposit[] = []
  const dividends: BrokerDividend[] = []
  const taxes: TaxLine[] = []

  for (const r of table.rows) {
    const desc = normalize(r[col.desc] ?? '')
    if (!desc) continue
    // "Variação" = moeda; o montante está na coluna sem cabeçalho seguinte.
    const first = String(r[col.change] ?? '').trim().toUpperCase()
    const currency = CCY.test(first) ? first : 'EUR'
    const amount = parseNumber(CCY.test(first) ? r[col.change + 1] : r[col.change])
    if (amount == null || amount === 0) continue
    const date = parseDate(r[col.date])
    const isin = String(r[col.isin] ?? '').trim().toUpperCase()

    if (DIV_TAX_RE.test(desc)) {
      if (isin) taxes.push({ symbol: isin, date, amount: Math.abs(amount) })
      continue
    }
    if (DIV_RE.test(desc)) {
      if (!isin || amount < 0) continue
      dividends.push({
        providerSymbol: isin,
        date,
        amountGross: round6(amount),
        withholdingTax: 0,
        currency,
        externalId: key(`degiro:div:${date}:${isin}:${amount}`),
      })
      continue
    }
    if (RESERVE_RE.test(desc)) continue
    if (DEPOSIT_RE.test(desc) || WITHDRAW_RE.test(desc)) {
      const signed = WITHDRAW_RE.test(desc) ? -Math.abs(amount) : Math.abs(amount)
      deposits.push({
        date,
        amount: round6(signed),
        currency,
        externalId: key(`degiro:dep:${date}:${String(r[col.time] ?? '').trim()}:${signed}`),
      })
    }
  }

  return { deposits, dividends: attachWithholding(dividends, taxes) }
}

export const degiroAdapter: TableAdapter = {
  id: 'degiro',
  label: 'DEGIRO',
  kind: 'table',
  detect(ctx: StatementContext) {
    const h = ctx.table?.headers ?? []
    const tx = headerScore(h, TX_GROUPS)
    const acc = headerScore(h, ACCOUNT_GROUPS)
    const best = Math.max(tx, acc)
    return best >= 0.8 ? 0.9 : best >= 0.6 ? 0.5 : 0
  },
  noTrades: isDegiroAccount,
  extras: (table) => (isDegiroAccount(table) ? accountExtras(table) : transactionExtras(table)),
}
