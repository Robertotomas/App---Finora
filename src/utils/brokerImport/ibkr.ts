import { InvestmentOperation } from '@/types/investment'
import type { BrokerDeposit, BrokerDividend, BrokerTrade } from '@/types/investment'
import { applyExchangeSuffix, attachWithholding, compositeKeyer, guessType, headerScore, parseDate, round6 } from './shared'
import type { TaxLine } from './shared'
import type { CustomAdapter, TableAdapter } from './tableAdapter'
import type { NormalizedImport, StatementContext } from './types'

/**
 * Interactive Brokers. Dois formatos:
 * - **Flex Query** (CSV plano: ClientAccountID/AssetClass/Symbol/TradeDate/Quantity/TradePrice/IBCommission/
 *   FXRateToBase…): negócios pelo caminho genérico (externalId `{perfil}:{TransactionID}`), sem extras.
 * - **Activity Statement** (CSV multi-secção "Trades,Header,…" / "Trades,Data,…"): parser próprio —
 *   negócios (só ações/ETFs), depósitos/levantamentos, dividendos e retenções na fonte.
 * A IBKR cobra a conversão de moeda em negócios Forex à parte → sem deteção de taxa.
 */

export const ibkrFlexAdapter: TableAdapter = {
  id: 'ibkr',
  label: 'Interactive Brokers',
  kind: 'table',
  detect(ctx: StatementContext) {
    const h = ctx.table?.headers ?? []
    const specific = headerScore(h, [['clientaccountid'], ['tradeprice'], ['ibcommission'], ['fxratetobase'], ['assetclass'], ['ibexecid'], ['currencyprimary']])
    if (specific * 7 >= 2) return 0.9
    return specific > 0 ? 0.4 : 0
  },
  extras: () => ({}),
}

/** Números da IBKR: formato US com separador de milhares ("1,000.50"). */
function usNumber(v: unknown): number | null {
  const s = String(v ?? '').replace(/,/g, '').trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

type Row = Record<string, string>

/** Agrupa as linhas "Secção,Header|Data,…" em objetos por secção (cada Data usa o último Header). */
export function ibkrSections(raw: string[][]): Map<string, Row[]> {
  const out = new Map<string, Row[]>()
  const headers = new Map<string, string[]>()
  for (const r of raw) {
    const section = String(r[0] ?? '').trim()
    const kind = String(r[1] ?? '').trim()
    if (!section) continue
    if (kind === 'Header') {
      headers.set(section, r.slice(2).map((c) => String(c ?? '').trim()))
    } else if (kind === 'Data') {
      const h = headers.get(section)
      if (!h) continue
      const obj: Row = {}
      h.forEach((name, i) => { if (name) obj[name] = String(r[i + 2] ?? '').trim() })
      const list = out.get(section) ?? []
      list.push(obj)
      out.set(section, list)
    }
  }
  return out
}

export function isIbkrActivity(raw: string[][]): boolean {
  return raw.some((r) => String(r[1] ?? '').trim() === 'Header' && /^(Trades|Statement|Account Information)$/.test(String(r[0] ?? '').trim()))
}

const isTotal = (v: string) => /^total/i.test(v)

function yahooSymbol(symbol: string, exchange: string): string {
  return applyExchangeSuffix(symbol.trim().toUpperCase().replace(/\s+/g, '-'), exchange, true)
}

export function parseIbkrActivity(raw: string[][]): NormalizedImport {
  const sections = ibkrSections(raw)
  const instruments = new Map<string, { exchange: string; isin: string; name: string }>()
  for (const i of sections.get('Financial Instrument Information') ?? []) {
    const sym = (i['Symbol'] ?? '').trim()
    if (!sym) continue
    instruments.set(sym, { exchange: i['Listing Exch'] ?? '', isin: i['Security ID'] ?? '', name: i['Description'] ?? '' })
  }
  const symbolFor = (sym: string) => yahooSymbol(sym, instruments.get(sym)?.exchange ?? '')

  const key = compositeKeyer()
  const trades: BrokerTrade[] = []
  let failed = 0
  for (const t of sections.get('Trades') ?? []) {
    if (t['DataDiscriminator'] && t['DataDiscriminator'] !== 'Order') continue
    if (!/^stocks?$/i.test(t['Asset Category'] ?? '')) continue
    const sym = (t['Symbol'] ?? '').trim()
    const qty = usNumber(t['Quantity'])
    const price = usNumber(t['T. Price'] ?? t['TradePrice'])
    const dateTime = t['Date/Time'] ?? ''
    if (!sym || qty == null || qty === 0 || price == null || price < 0) { failed++; continue }
    const currency = (t['Currency'] || 'USD').toUpperCase().slice(0, 3)
    const info = instruments.get(sym)
    const quantity = Math.abs(qty)
    trades.push({
      providerSymbol: symbolFor(sym),
      baseSymbol: sym,
      isin: info?.isin || null,
      name: info?.name || sym,
      currency,
      exchange: info?.exchange ?? '',
      type: guessType(info?.name ?? '', sym),
      operation: qty < 0 ? InvestmentOperation.Sell : InvestmentOperation.Buy,
      date: parseDate(dateTime),
      quantity,
      unitPrice: price,
      fxRateToEur: currency === 'EUR' ? 1 : null,
      externalId: key(`ibkr:${dateTime}:${sym}:${qty}:${price}`),
    })
  }

  const deposits: BrokerDeposit[] = []
  for (const d of sections.get('Deposits & Withdrawals') ?? []) {
    const ccy = d['Currency'] ?? ''
    if (!ccy || isTotal(ccy)) continue
    const amount = usNumber(d['Amount'])
    if (amount == null || amount === 0) continue
    const date = parseDate(d['Settle Date'] ?? d['Date'])
    deposits.push({ date, amount, currency: ccy.toUpperCase().slice(0, 3), externalId: key(`ibkr:dep:${date}:${amount}`) })
  }

  // "AAPL(US0378331005) Cash Dividend USD 0.24 per Share (Ordinary Dividend)" → AAPL
  const descSymbol = (desc: string) => (desc.match(/^\s*([^(]+?)\s*\(/)?.[1] ?? '').trim()
  const dividends: BrokerDividend[] = []
  for (const d of sections.get('Dividends') ?? []) {
    const ccy = d['Currency'] ?? ''
    if (!ccy || isTotal(ccy)) continue
    const amount = usNumber(d['Amount'])
    const sym = descSymbol(d['Description'] ?? '')
    if (!sym || amount == null || amount <= 0) continue
    const date = parseDate(d['Date'])
    const providerSymbol = symbolFor(sym)
    const same = dividends.find((x) => x.providerSymbol === providerSymbol && x.date === date)
    if (same) { same.amountGross = round6(same.amountGross + amount); continue }
    dividends.push({
      providerSymbol,
      date,
      amountGross: round6(amount),
      withholdingTax: 0,
      currency: ccy.toUpperCase().slice(0, 3),
      externalId: key(`ibkr:div:${date}:${sym}:${amount}`),
    })
  }
  const taxes: TaxLine[] = []
  for (const w of sections.get('Withholding Tax') ?? []) {
    const ccy = w['Currency'] ?? ''
    if (!ccy || isTotal(ccy)) continue
    const amount = usNumber(w['Amount'])
    const sym = descSymbol(w['Description'] ?? '')
    if (!sym || amount == null || amount >= 0) continue // positivos = estornos → ignorados
    taxes.push({ symbol: symbolFor(sym), date: parseDate(w['Date']), amount: Math.abs(amount) })
  }
  attachWithholding(dividends, taxes)

  const warnings: string[] = []
  if (failed > 0) warnings.push(`${failed} ${failed === 1 ? 'negócio não foi reconhecido' : 'negócios não foram reconhecidos'}.`)
  return {
    broker: 'ibkr',
    brokerLabel: 'Interactive Brokers',
    trades,
    deposits,
    dividends,
    fxSamples: [],
    warnings,
    hasUnparsedRows: failed > 0,
  }
}

export const ibkrActivityAdapter: CustomAdapter = {
  id: 'ibkr',
  label: 'Interactive Brokers',
  kind: 'custom',
  detect: (ctx: StatementContext) => (isIbkrActivity(ctx.rawRows) ? 0.95 : 0),
  parse: (ctx: StatementContext) => parseIbkrActivity(ctx.rawRows),
}
