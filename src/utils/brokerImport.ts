import { InstrumentType, InvestmentOperation } from '@/types/investment'
import type { BrokerTrade } from '@/types/investment'

/**
 * Importador genérico de CSV/Excel de corretoras.
 * Lê uma tabela plana (qualquer corretora), auto-mapeia as colunas por sinónimos multilíngua
 * (cobre Trading 212, DEGIRO, IBKR, Trade Republic/pytr…) e deixa o utilizador corrigir o mapeamento.
 * O parser específico da XTB (multi-folha) vive em xtbExcel.ts.
 */

export type FieldKey =
  | 'date' | 'side' | 'quantity' | 'price' | 'amount' | 'ticker' | 'isin'
  | 'name' | 'currency' | 'fee' | 'fxRate' | 'exchange' | 'id'

export type ColumnMapping = Partial<Record<FieldKey, number>>

export interface FieldDef {
  key: FieldKey
  label: string
  required?: boolean
}

/** Campos-alvo, por ordem de prioridade de auto-mapeamento (específicos primeiro). */
export const FIELD_DEFS: FieldDef[] = [
  { key: 'isin', label: 'ISIN' },
  { key: 'ticker', label: 'Símbolo / Ticker' },
  { key: 'date', label: 'Data', required: true },
  { key: 'quantity', label: 'Quantidade', required: true },
  { key: 'price', label: 'Preço unitário' },
  { key: 'amount', label: 'Total / Montante' },
  { key: 'side', label: 'Compra / Venda' },
  { key: 'currency', label: 'Moeda' },
  { key: 'fee', label: 'Comissão' },
  { key: 'exchange', label: 'Bolsa / Mercado' },
  { key: 'name', label: 'Nome do ativo' },
  { key: 'id', label: 'ID da transação' },
]

const SYNONYMS: Record<FieldKey, string[]> = {
  isin: ['isin'],
  ticker: ['ticker', 'symbol', 'symbool', 'simbolo'],
  name: ['name', 'product', 'produkt', 'instrument', 'description', 'security', 'naam', 'produto', 'nome', 'designacao'],
  date: ['time', 'date', 'datum', 'data', 'fecha', 'datetime', 'date/time', 'date (utc)', 'trade date', 'transaction date', 'filled', 'executed', 'order date'],
  quantity: ['quantity', 'no. of shares', 'number of shares', 'shares', 'aantal', 'qty', 'anzahl', 'cantidad', 'nominal', 'units', 'quantidade', 'numero de acoes'],
  price: ['price / share', 'price/share', 'price per share', 'price', 'koers', 'kurs', 'trade price', 'tradeprice', 'preis', 'precio', 'unit price', 'share price', 'preco', 'cotacao'],
  amount: ['total amount', 'net amount', 'waarde (netto)', 'waarde', 'value', 'total', 'amount', 'montante', 'valor', 'mutatie', 'bedrag', 'betrag', 'gross amount', 'netto'],
  side: ['buy/sell', 'buysell', 'action', 'side', 'direction', 'transaction type', 'order type', 'type', 'tipo', 'operation', 'operacao', 'sentido'],
  currency: ['currency (price / share)', 'currency', 'valuta', 'wahrung', 'moeda', 'divisa', 'ccy', 'currency primary'],
  fee: ['currency conversion fee', 'transaction costs', 'transactiekosten', 'charge amount', 'commission', 'ibcommission', 'fees', 'fee', 'gebuhr', 'kosten', 'comissao', 'comision', 'costs', 'brokerage', 'taxa'],
  fxRate: ['exchange rate', 'fx rate to base', 'fxratetobase', 'fx rate', 'fxrate', 'wisselkoers', 'tipo de cambio', 'taxa de cambio', 'wechselkurs'],
  exchange: ['reference exchange', 'listingexchange', 'primaryexchange', 'exchange', 'venue', 'market', 'mic', 'beurs', 'borse', 'mercado', 'bolsa'],
  id: ['order id', 'orderid', 'transaction id', 'transactionid', 'trade id', 'tradeid', 'ibexecid', 'order reference', 'reference', 'referencia', 'id'],
}

// Correspondência por raiz (sem \b) para apanhar palavras compostas (aankoop, verkoop, kaufen…).
// IMPORTANTE: testar SELL primeiro — "verkoop"/"verkauf" contêm a raiz de compra (koop/kauf).
const BUY_RE = /(buy|bought|compra|comprar|kauf|aankoop|koop|kopen|achat|acquist|acquir|\bkop)/i
const SELL_RE = /(sell|sold|sale|venda|vender|verkauf|verkoop|verkopen|vente|vendit|salj|\bsale)/i

// Termos de movimentos que NÃO são compras/vendas (ignorados).
const NON_TRADE_RE = /(dividend|deposit|withdraw|interest|fee|tax|transfer|cash|topup|top up|funding|reward|conversion|juro|imposto|deposito|levantamento)/i

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

// Marcas diacríticas combinantes (acentos) — escapes unicode para não corromper o ficheiro ao gravar.
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g')

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[-_]+/g, ' ') // "Order-ID" → "order id"
    .replace(/\s+/g, ' ')
    .trim()
}

/** Auto-mapeia cabeçalhos → campos. Cada coluna é usada no máximo uma vez. */
export function autoMap(headers: string[]): ColumnMapping {
  const norm = headers.map(normalize)
  const used = new Set<number>()
  const mapping: ColumnMapping = {}

  for (const field of FIELD_DEFS) {
    const syns = SYNONYMS[field.key]
    let best = -1
    let bestScore = 0
    for (let i = 0; i < norm.length; i++) {
      if (used.has(i) || !norm[i]) continue
      const h = norm[i]
      for (const syn of syns) {
        let score = 0
        if (h === syn) score = 100
        else if (h.startsWith(syn)) score = 60
        else if (h.includes(syn)) score = 40
        // bónus por sinónimo mais específico (mais longo)
        if (score > 0) score += Math.min(syn.length, 20)
        if (score > bestScore) { bestScore = score; best = i }
      }
    }
    if (best >= 0) { mapping[field.key] = best; used.add(best) }
  }
  return mapping
}

export interface SideInfo {
  mode: 'text' | 'sign'
}

/** Decide se a direção vem de uma coluna de texto (Action/Type) ou do sinal da quantidade (DEGIRO). */
export function detectSideMode(rows: string[][], mapping: ColumnMapping): SideInfo {
  if (mapping.side != null) {
    const idx = mapping.side
    const hasWords = rows.some((r) => {
      const v = normalize(r[idx] ?? '')
      return BUY_RE.test(v) || SELL_RE.test(v)
    })
    if (hasWords) return { mode: 'text' }
  }
  return { mode: 'sign' }
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

function pad(n: number): string {
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

function guessType(name: string, symbol: string): InstrumentType {
  const s = `${name} ${symbol}`.toLowerCase()
  return /\betf\b|ucits|index|ishares|vanguard|amundi|xtrackers|lyxor/.test(s) ? InstrumentType.Etf : InstrumentType.Stock
}

function applyExchangeSuffix(symbol: string, exchange: string): string {
  if (!exchange || symbol.includes('.')) return symbol
  for (const e of EXCHANGE_SUFFIX) {
    if (e.match.test(exchange)) return symbol + e.suffix
  }
  return symbol
}

export interface BuildResult {
  items: BrokerTrade[]
  skippedNonTrade: number
  failed: number
}

/** Constrói as transações a partir das linhas + mapeamento. profileKey namespaceia o externalId/dedup. */
export function buildTrades(rows: string[][], mapping: ColumnMapping, profileKey: string): BuildResult {
  const side = detectSideMode(rows, mapping)
  const items: BrokerTrade[] = []
  let skippedNonTrade = 0
  let failed = 0

  const cell = (r: string[], k: FieldKey): string => (mapping[k] != null ? String(r[mapping[k] as number] ?? '').trim() : '')

  for (const r of rows) {
    const ticker = cell(r, 'ticker').toUpperCase()
    const isin = cell(r, 'isin').toUpperCase()
    const symbolBase = ticker || isin
    if (!symbolBase) { continue }

    // Direção.
    let operation: InvestmentOperation | null = null
    if (side.mode === 'text') {
      const sv = normalize(cell(r, 'side'))
      if (SELL_RE.test(sv)) operation = InvestmentOperation.Sell
      else if (BUY_RE.test(sv)) operation = InvestmentOperation.Buy
      else { skippedNonTrade++; continue } // dividendos, depósitos, etc.
    }

    const qtyRaw = parseNumber(cell(r, 'quantity'))
    let price = parseNumber(cell(r, 'price'))
    const amount = parseNumber(cell(r, 'amount'))
    // Sem preço unitário (ex.: Trade Republic) → deriva do total: |montante| / quantidade.
    if (price == null && amount != null && qtyRaw != null && qtyRaw !== 0) {
      price = Math.abs(amount) / Math.abs(qtyRaw)
    }
    if (qtyRaw == null || price == null) {
      // linha sem números úteis: provavelmente não é um negócio
      if (NON_TRADE_RE.test(cell(r, 'side')) || NON_TRADE_RE.test(cell(r, 'name'))) skippedNonTrade++
      else failed++
      continue
    }

    if (side.mode === 'sign') {
      // Direção pelo sinal da quantidade (negativo = venda); ex.: DEGIRO.
      operation = qtyRaw < 0 ? InvestmentOperation.Sell : InvestmentOperation.Buy
    }
    if (operation == null) { failed++; continue }

    const quantity = Math.abs(qtyRaw)
    if (!(quantity > 0) || !(price >= 0)) { failed++; continue }

    const exchange = cell(r, 'exchange')
    const providerSymbol = ticker ? applyExchangeSuffix(ticker, exchange) : isin
    const currency = (cell(r, 'currency') || 'EUR').toUpperCase().slice(0, 3)
    const name = cell(r, 'name') || symbolBase
    const date = parseDate(cell(r, 'date'))
    const id = cell(r, 'id')

    const externalId = id
      ? `${profileKey}:${id}`
      : `${profileKey}:${date}:${symbolBase}:${quantity}:${price}:${operation}`

    items.push({
      providerSymbol,
      baseSymbol: symbolBase,
      isin: isin || null,
      name,
      currency,
      exchange,
      type: guessType(name, symbolBase),
      operation,
      date,
      quantity,
      unitPrice: price,
      // Não confiamos na coluna de câmbio das corretoras (direção ambígua) — o backend
      // calcula o câmbio histórico (BCE) pela data para os instrumentos não-EUR.
      fxRateToEur: currency === 'EUR' ? 1 : null,
      externalId,
    })
  }

  return { items, skippedNonTrade, failed }
}

/* ── Memória de perfis (mapeamento por assinatura de cabeçalho) ── */
const PROFILE_KEY = 'finora_import_profiles_v1'

export function headerSignature(headers: string[]): string {
  return headers.map((h) => normalize(h)).filter(Boolean).join('|')
}

/** Chave curta e estável para namespacing do externalId. */
export function profileKeyFor(headers: string[]): string {
  const sig = headerSignature(headers)
  let hash = 0
  for (let i = 0; i < sig.length; i++) hash = (hash * 31 + sig.charCodeAt(i)) | 0
  return 'imp' + (hash >>> 0).toString(36)
}

export function loadSavedMapping(headers: string[]): ColumnMapping | null {
  try {
    const all = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}')
    const m = all[headerSignature(headers)]
    return m && typeof m === 'object' ? m : null
  } catch {
    return null
  }
}

export function saveMapping(headers: string[], mapping: ColumnMapping) {
  try {
    const all = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}')
    all[headerSignature(headers)] = mapping
    localStorage.setItem(PROFILE_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}

/* ── Leitura de ficheiro (CSV/Excel) → tabela plana ── */
export interface TableResult {
  headers: string[]
  rows: string[][]
  sheetNames: string[]
  error?: string
}

function detectDelimiter(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim()) || ''
  const counts: Record<string, number> = { ';': 0, ',': 0, '\t': 0 }
  for (const ch of line) if (ch in counts) counts[ch]++
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]) || ','
}

export async function readTable(file: File): Promise<TableResult> {
  const XLSX = await import('xlsx')
  const isCsv = /\.csv$/i.test(file.name)
  let wb
  try {
    if (isCsv) {
      // raw:true → mantém o texto original; senão o SheetJS reformata datas ("2023-12-18" → "12/18/23").
      const text = await file.text()
      wb = XLSX.read(text, { type: 'string', FS: detectDelimiter(text), raw: true })
    } else {
      wb = XLSX.read(await file.arrayBuffer(), { cellDates: true })
    }
  } catch {
    return { headers: [], rows: [], sheetNames: [], error: 'Não foi possível ler o ficheiro.' }
  }

  // Converte cada célula para texto sem perder a data (Date → ISO).
  const cellToStr = (c: unknown): string => {
    if (c == null) return ''
    if (c instanceof Date) return c.toISOString()
    return String(c).trim()
  }

  const sheetNames = wb.SheetNames
  // Escolhe a folha com mais linhas (mais provável de ser a de transações).
  let best = sheetNames[0]
  let bestRows = -1
  for (const name of sheetNames) {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: '' })
    if (aoa.length > bestRows) { bestRows = aoa.length; best = name }
  }

  const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[best], { header: 1, raw: true, defval: '' })
  const headerIdx = aoa.findIndex((r) => r.filter((c) => cellToStr(c)).length >= 3)
  if (headerIdx < 0) return { headers: [], rows: [], sheetNames, error: 'Não foram encontradas colunas reconhecíveis.' }

  const headers = (aoa[headerIdx] as unknown[]).map((c) => cellToStr(c))
  const rows = aoa
    .slice(headerIdx + 1)
    .map((r) => (r as unknown[]).map((c) => cellToStr(c)))
    .filter((r) => r.some((c) => c))
  return { headers, rows, sheetNames }
}
