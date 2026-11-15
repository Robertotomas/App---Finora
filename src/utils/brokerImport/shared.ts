import { InstrumentType } from '@/types/investment'

/** Helpers partilhados pelos adaptadores de extratos de corretoras. */

// Marcas diacríticas combinantes (acentos) — escapes unicode para não corromper o ficheiro ao gravar.
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g')

export function normalize(s: string): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[-_]+/g, ' ') // "Order-ID" → "order id"
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return value
  let s = String(value ?? '').trim()
  if (!s) return null
  const neg = /^\(.*\)$/.test(s) || s.includes('-')
  s = s.replace(/[^0-9.,]/g, '')
  if (!s) return null
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.') // 1.234,56 (EU)
    else s = s.replace(/,/g, '') // 1,234.56 (US)
  } else if (lastComma > -1) {
    // Só vírgulas (sem ponto): uma vírgula = decimal (EU, ex.: "10,799"); várias = milhares.
    const commaCount = (s.match(/,/g) || []).length
    s = commaCount === 1 ? s.replace(',', '.') : s.replace(/,/g, '')
  }
  const n = parseFloat(s)
  if (isNaN(n)) return null
  return neg ? -Math.abs(n) : n
}

export function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function parseDate(value: unknown): string {
  if (value instanceof Date) return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`
  const s = String(value ?? '').trim()
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{4})(\d{2})(\d{2})/) // IBKR yyyymmdd
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/)
  if (m) {
    let d = Number(m[1])
    let mo = Number(m[2])
    if (mo > 12 && d <= 12) [d, mo] = [mo, d] // mm/dd → dd/mm
    return `${m[3]}-${pad(mo)}-${pad(d)}`
  }
  return s.slice(0, 10)
}

export function guessType(name: string, symbol: string): InstrumentType {
  const s = `${name} ${symbol}`.toLowerCase()
  return /\betf\b|ucits|index|ishares|vanguard|amundi|xtrackers|lyxor/.test(s) ? InstrumentType.Etf : InstrumentType.Stock
}

// NOTA: manter esta lista igual à original — o providerSymbol decide a posição onde caem compras novas
// de quem já importou pelo caminho genérico. Códigos novos (ex.: IBKR) vão em EXTRA_EXCHANGE_SUFFIX.
const EXCHANGE_SUFFIX: { match: RegExp; suffix: string }[] = [
  { match: /xetra|xetr|frankfurt|\bfra\b|gettex|tradegate|\bde\b|deutsche|german/i, suffix: '.DE' },
  { match: /amsterdam|xams|\baex\b|euronext a/i, suffix: '.AS' },
  { match: /paris|xpar|euronext p/i, suffix: '.PA' },
  { match: /milan|xmil|borsa ital|\bmil\b/i, suffix: '.MI' },
  { match: /london|xlon|\blse\b/i, suffix: '.L' },
  { match: /madrid|xmad|\bbme\b|spain/i, suffix: '.MC' },
  { match: /swiss|\bsix\b|xswx|zurich/i, suffix: '.SW' },
  { match: /lisbon|lisboa|xlis|euronext l/i, suffix: '.LS' },
  { match: /brussels|xbru/i, suffix: '.BR' },
  // EUA → sem sufixo
  { match: /nasdaq|nyse|arca|\bbats\b|\bus\b|united states|amex/i, suffix: '' },
]

/** Códigos de bolsa adicionais (IBKR "Listing Exch"), usados só pelos adaptadores novos. */
const EXTRA_EXCHANGE_SUFFIX: { match: RegExp; suffix: string }[] = [
  { match: /^ibis2?$|^fwb2?$|^gettex$|^tgate$/i, suffix: '.DE' },
  { match: /^aeb$|^eae$/i, suffix: '.AS' },
  { match: /^sbf$/i, suffix: '.PA' },
  { match: /^bvme(\.etf)?$/i, suffix: '.MI' },
  { match: /^lse(etf)?$/i, suffix: '.L' },
  { match: /^ebs$|^swx$/i, suffix: '.SW' },
  { match: /^bvl$/i, suffix: '.LS' },
  { match: /^enext\.be$/i, suffix: '.BR' },
  { match: /^(nasdaq|nyse|arca|amex|bats|island|pink)$/i, suffix: '' },
]

/**
 * Acrescenta o sufixo Yahoo da bolsa ("VUAA" + "XETRA" → "VUAA.DE"). Sem bolsa/já com sufixo → igual.
 * `extended` também reconhece códigos curtos da IBKR (IBIS, AEB, SBF…).
 */
export function applyExchangeSuffix(symbol: string, exchange: string, extended = false): string {
  if (!exchange || symbol.includes('.')) return symbol
  if (extended) {
    for (const e of EXTRA_EXCHANGE_SUFFIX) {
      if (e.match.test(exchange.trim())) return symbol + e.suffix
    }
  }
  for (const e of EXCHANGE_SUFFIX) {
    if (e.match.test(exchange)) return symbol + e.suffix
  }
  return symbol
}

/** Índice da 1.ª coluna cujo cabeçalho normalizado é igual (ou, em 2.º lugar, começa por) a um candidato. */
export function findCol(headers: string[], candidates: string[]): number {
  const norm = headers.map(normalize)
  for (const c of candidates) {
    const i = norm.indexOf(c)
    if (i >= 0) return i
  }
  for (const c of candidates) {
    const i = norm.findIndex((h) => h.startsWith(c))
    if (i >= 0) return i
  }
  return -1
}

/** Fração (0..1) de grupos de cabeçalho presentes; cada grupo é satisfeito por qualquer candidato. */
export function headerScore(headers: string[], groups: string[][]): number {
  if (!groups.length) return 0
  const norm = new Set(headers.map(normalize))
  let hit = 0
  for (const g of groups) if (g.some((c) => norm.has(c))) hit++
  return hit / groups.length
}

/**
 * Gera chaves compostas determinísticas; repetições exatas no mesmo ficheiro recebem "#2", "#3"…
 * (a 1.ª ocorrência fica sem sufixo).
 */
export function compositeKeyer(): (key: string) => string {
  const seen = new Map<string, number>()
  return (key: string) => {
    const n = (seen.get(key) ?? 0) + 1
    seen.set(key, n)
    return n === 1 ? key : `${key}#${n}`
  }
}

export function round6(n: number): number {
  return Number(n.toFixed(6))
}

/** Índice da coluna com cabeçalho normalizado exatamente igual a um dos candidatos (-1 se nenhum). */
export function exactCol(headers: string[], candidates: string[]): number {
  const norm = headers.map(normalize)
  for (const c of candidates) {
    const i = norm.indexOf(c)
    if (i >= 0) return i
  }
  return -1
}

export interface TaxLine {
  symbol: string
  date: string
  /** Valor positivo da retenção. */
  amount: number
}

/**
 * Associa retenções na fonte a dividendos: mesmo símbolo e data; senão o mais próximo (≤ 5 dias).
 * A retenção nunca passa o bruto. Muta e devolve `divs`.
 */
export function attachWithholding<T extends { providerSymbol: string; date: string; amountGross: number; withholdingTax: number }>(
  divs: T[],
  taxes: TaxLine[],
): T[] {
  const DAY = 86_400_000
  const dayOf = (d: string) => new Date(d + 'T00:00:00Z').getTime() / DAY
  for (const t of taxes) {
    let target = divs.find((d) => d.providerSymbol === t.symbol && d.date === t.date)
    if (!target) {
      const day = dayOf(t.date)
      let bestDist = Infinity
      for (const d of divs) {
        if (d.providerSymbol !== t.symbol) continue
        const dist = Math.abs(dayOf(d.date) - day)
        if (dist <= 5 && dist < bestDist) { bestDist = dist; target = d }
      }
    }
    if (target) target.withholdingTax = round6(Math.min(target.amountGross, target.withholdingTax + t.amount))
  }
  return divs
}
