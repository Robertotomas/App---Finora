import { InstrumentType, InvestmentOperation } from '@/types/investment'
import type { BrokerTrade, BrokerDeposit, BrokerDividend, BrokerCashMovement } from '@/types/investment'
import type { BrokerFxSample, NormalizedImport, StatementContext } from './types'
import type { CustomAdapter } from './tableAdapter'

/**
 * Adaptador da XTB (Excel/CSV): lê a folha "CASH OPERATION HISTORY" — o ledger completo de
 * compras/vendas, cada uma com um ID único. Quantidade e preço vêm no comentário
 * ("OPEN BUY 1 @ 99.7320"); a moeda infere-se do sufixo do símbolo; o câmbio deriva do montante em €.
 */

// Sufixo XTB → [sufixo Yahoo, moeda].
const EXCHANGE_MAP: Record<string, [string, string]> = {
  US: ['', 'USD'], DE: ['.DE', 'EUR'], NL: ['.AS', 'EUR'], FR: ['.PA', 'EUR'], IT: ['.MI', 'EUR'],
  ES: ['.MC', 'EUR'], UK: ['.L', 'GBP'], GB: ['.L', 'GBP'], CH: ['.SW', 'CHF'], PT: ['.LS', 'EUR'], BE: ['.BR', 'EUR'],
}

// ETFs conhecidos (só afeta o ícone/logo).
const ETF_SYMBOLS = new Set([
  'VUAA', 'VWCE', 'VWRA', 'QDVE', 'IMAE', 'SXR8', 'IWDA', 'EUNL', 'CSPX', 'SXRV',
  'VHYL', 'VUSA', 'SWRD', 'AGGH', 'XDWD', 'SPYY', 'VFEM',
])

// Formato antigo: "OPEN BUY 1 @ 99.73"; novo: "OPEN BUY QDVE.DE 1 @ 41.285" (com o ticker antes da quantidade).
const COMMENT = /(OPEN|CLOSE)\s+(BUY|SELL)\s+(?:[A-Z][A-Z0-9._-]*\s+)?([\d.]+)(?:\/[\d.]+)?\s*@\s*([\d.]+)/i

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toDateStr(v: unknown): string {
  if (v instanceof Date) {
    // O Excel guarda "wall-clock"; usar UTC evita desvios de fuso (negócios são a meio do dia).
    return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`
  }
  const s = String(v ?? '')
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const dmy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`
  return s.slice(0, 10)
}

/** Símbolo XTB ("AAPL.US", "VUAA.DE") → símbolo Yahoo ("AAPL", "VUAA.DE"). Null se não tiver sufixo. */
export function xtbToYahooSymbol(xtbSymbol: string): string | null {
  const sym = String(xtbSymbol ?? '').trim().toUpperCase()
  const dot = sym.lastIndexOf('.')
  if (dot <= 0) return null
  const suffix = sym.slice(dot + 1)
  const [yahooSuffix] = EXCHANGE_MAP[suffix] ?? [`.${suffix}`, 'EUR']
  return sym.slice(0, dot) + yahooSuffix
}

// A XTB escreve "DIVIDENT" (sic) nalgumas versões do extrato e "Dividend" noutras.
const DIVIDEND_TYPE = /^(divident|dividend)s?$/i
// Retenção na fonte associada ao dividendo: "Withholding tax", "Dividend tax", "Tax IFTT"...
const DIVIDEND_TAX_TYPE = /(withholding\s*tax|dividend\s*tax)/i

function amountOf(v: unknown): number {
  return typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'))
}

/**
 * Dividendos da folha "CASH OPERATION HISTORY" (linhas de dados, sem cabeçalho; colunas
 * ID/Type/Time/Comment/Symbol/Amount). A retenção na fonte vem numa linha à parte: associa-se ao
 * dividendo do mesmo símbolo e data (ou, se a data não bater, ao mais próximo até 5 dias).
 * Montantes na moeda da conta (EUR). Exportado para testes.
 */
export function extractXtbDividends(data: unknown[][]): BrokerDividend[] {
  type Div = BrokerDividend & { _day: number }
  const DAY = 86_400_000
  const dayOf = (d: string) => new Date(d + 'T00:00:00Z').getTime() / DAY
  const divs: Div[] = []
  const taxes: { symbol: string; date: string; amount: number }[] = []

  for (const r of data) {
    const type = String(r[1] ?? '').trim()
    const isDiv = DIVIDEND_TYPE.test(type)
    const isTax = !isDiv && DIVIDEND_TAX_TYPE.test(type)
    if (!isDiv && !isTax) continue
    const symbol = xtbToYahooSymbol(String(r[4] ?? ''))
    const amount = amountOf(r[5])
    if (!symbol || !Number.isFinite(amount) || amount === 0) continue
    const date = toDateStr(r[2])

    if (isTax) {
      taxes.push({ symbol, date, amount: Math.abs(amount) })
      continue
    }
    if (amount < 0) continue // estorno/correção — ignorado
    // Vários pagamentos do mesmo título no mesmo dia → um só dividendo.
    const same = divs.find((d) => d.providerSymbol === symbol && d.date === date)
    if (same) {
      same.amountGross += amount
      continue
    }
    divs.push({
      providerSymbol: symbol,
      date,
      amountGross: amount,
      withholdingTax: 0,
      currency: 'EUR', // a conta XTB é em EUR
      externalId: `xtb:${String(r[0]).trim()}`,
      _day: dayOf(date),
    })
  }

  for (const t of taxes) {
    let target = divs.find((d) => d.providerSymbol === t.symbol && d.date === t.date)
    if (!target) {
      const day = dayOf(t.date)
      let best: Div | undefined
      for (const d of divs) {
        if (d.providerSymbol !== t.symbol) continue
        const dist = Math.abs(d._day - day)
        if (dist <= 5 && (!best || dist < Math.abs(best._day - day))) best = d
      }
      target = best
    }
    if (target) target.withholdingTax = Math.min(target.amountGross, target.withholdingTax + t.amount)
  }

  return divs.map((d) => ({
    providerSymbol: d.providerSymbol,
    date: d.date,
    amountGross: Number(d.amountGross.toFixed(6)),
    withholdingTax: Number(d.withholdingTax.toFixed(6)),
    currency: d.currency,
    externalId: d.externalId,
  }))
}


/**
 * Lê as linhas cruas da folha "CASH OPERATION HISTORY". Lança erro (mensagem PT-PT) se o cabeçalho
 * não for encontrado. ExternalIds = `xtb:{ID}` — NÃO alterar (dedup de reimportações).
 */
/** Tipos XTB tratados à parte (depósitos, negócios, dividendos e retenções); o resto é "outro movimento de caixa". */
const XTB_HANDLED_TYPE = /^(deposit|.*withdrawal.*|stock (purchase|sale|sell)|divident|dividends?|withholding\s*tax|dividend\s*tax)$/i

function xtbCashKind(type: string): BrokerCashMovement['kind'] {
  if (/interest/i.test(type)) return 'interest' // "Free funds interest" e "Free funds interest tax"
  if (/spin/i.test(type)) return 'spinoff'
  if (/fee|commission|tax/i.test(type)) return 'fee'
  return 'other'
}

export function parseXtbRows(rows: unknown[][]): NormalizedImport {
  const headerIdx = rows.findIndex((r) => String(r[0]).trim() === 'ID' && String(r[1]).trim() === 'Type')
  if (headerIdx < 0) throw new Error('Formato inesperado: cabeçalho de operações não encontrado.')

  const data = rows.slice(headerIdx + 1).filter((r) => r[0] != null && String(r[0]).trim() !== '')
  const items: BrokerTrade[] = []
  const deposits: BrokerDeposit[] = []
  const fxSamples: BrokerFxSample[] = []
  const cashMovements: BrokerCashMovement[] = []
  let failed = 0

  for (const r of data) {
    const type = String(r[1] ?? '').trim()

    // Outros movimentos de caixa (juros sobre fundos livres e imposto, taxas SEC, spinoffs, …): não são
    // depósitos, negócios nem dividendos, mas mexem nos fundos livres — sem eles o saldo não batia com a XTB.
    if (type && !XTB_HANDLED_TYPE.test(type)) {
      const amtRaw = r[5]
      const amt = typeof amtRaw === 'number' ? amtRaw : parseFloat(String(amtRaw))
      if (Number.isFinite(amt) && amt !== 0) {
        cashMovements.push({
          date: toDateStr(r[2]),
          amount: amt,
          currency: 'EUR',
          kind: xtbCashKind(type),
          description: type,
          externalId: `xtb:${String(r[0]).trim()}`,
        })
      }
      continue
    }

    // Depósitos/levantamentos (dinheiro para/da corretora) → métrica "Depósitos".
    if (/^deposit$/i.test(type) || /withdrawal/i.test(type)) {
      const amtRaw = r[5]
      const amt = typeof amtRaw === 'number' ? amtRaw : parseFloat(String(amtRaw))
      if (Number.isFinite(amt) && amt !== 0) {
        deposits.push({
          date: toDateStr(r[2]),
          amount: amt, // depósito positivo, levantamento negativo (já vem com sinal)
          currency: 'EUR', // a conta XTB é em EUR
          externalId: `xtb:${String(r[0]).trim()}`,
        })
      }
      continue
    }

    // "Stock sale" (formato antigo) / "Stock sell" (formato novo)
    if (!/^Stock (purchase|sale|sell)$/i.test(type)) continue // compras/vendas (dividendos tratados em extractXtbDividends)

    const m = String(r[3] ?? '').match(COMMENT)
    const sym = String(r[4] ?? '').toUpperCase()
    const dot = sym.lastIndexOf('.')
    if (!m || dot <= 0) {
      failed++
      continue
    }

    const base = sym.slice(0, dot)
    const suffix = sym.slice(dot + 1)
    const [yahooSuffix, currency] = EXCHANGE_MAP[suffix] ?? [`.${suffix}`, 'EUR']
    const quantity = parseFloat(m[3])
    const unitPrice = parseFloat(m[4])
    if (!(quantity > 0) || !(unitPrice >= 0)) {
      failed++
      continue
    }

    const amountRaw = r[5]
    const amount = typeof amountRaw === 'number' ? amountRaw : parseFloat(String(amountRaw))
    const operation = /purchase/i.test(type) ? InvestmentOperation.Buy : InvestmentOperation.Sell
    const fxRateToEur =
      currency === 'EUR' ? 1 : amount && quantity && unitPrice ? Math.abs(amount) / (quantity * unitPrice) : null
    const date = toDateStr(r[2])

    // Formato novo traz o nome ("S&P 500 IT Sector") e a categoria ("ETF"/"STOCK") nas colunas 6 e 7.
    const instrumentName = String(r[6] ?? '').trim()
    const category = String(r[7] ?? '').trim().toUpperCase()
    const isEtf = category ? category === 'ETF' : ETF_SYMBOLS.has(base)

    items.push({
      providerSymbol: base + yahooSuffix,
      baseSymbol: base,
      name: instrumentName || base,
      currency,
      exchange: suffix,
      type: isEtf ? InstrumentType.Etf : InstrumentType.Stock,
      operation,
      date,
      quantity,
      unitPrice,
      fxRateToEur: fxRateToEur != null ? Number(fxRateToEur.toFixed(6)) : null,
      externalId: `xtb:${String(r[0]).trim()}`,
    })

    // Montante em € já inclui a taxa de conversão → serve para a inferir (no servidor, vs. BCE).
    if (currency !== 'EUR' && Number.isFinite(amount) && amount !== 0 && unitPrice > 0) {
      fxSamples.push({ currency, date, operation, quantity, unitPrice, amountEur: Math.abs(amount) })
    }
  }

  const warnings: string[] = []
  if (failed > 0) warnings.push(`${failed} ${failed === 1 ? 'operação não foi reconhecida' : 'operações não foram reconhecidas'}.`)

  return {
    broker: 'xtb',
    brokerLabel: 'XTB',
    trades: items,
    deposits,
    dividends: extractXtbDividends(data),
    cashMovements,
    fxSamples,
    warnings,
    hasUnparsedRows: failed > 0,
  }
}

export const xtbAdapter: CustomAdapter = {
  id: 'xtb',
  label: 'XTB',
  kind: 'custom',
  detect: (ctx: StatementContext) => (ctx.xtbRows ? 1 : 0),
  parse: (ctx: StatementContext) => parseXtbRows(ctx.xtbRows ?? []),
}
