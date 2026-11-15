import { InvestmentOperation } from '@/types/investment'
import type { BrokerTrade } from '@/types/investment'
import { normalize, parseNumber, parseDate, guessType, applyExchangeSuffix } from './shared'
import type { NormalizedImport, TableData } from './types'

export { parseNumber, parseDate } from './shared'

/**
 * Importador genérico de CSV/Excel de corretoras.
 * Lê uma tabela plana (qualquer corretora), auto-mapeia as colunas por sinónimos multilíngua
 * (cobre Trading 212, DEGIRO, IBKR, Trade Republic/pytr…) e deixa o utilizador corrigir o mapeamento.
 * Os adaptadores dedicados (XTB, Trading 212, DEGIRO…) vivem nos outros ficheiros desta pasta;
 * os de tabela plana reutilizam buildTrades + o mesmo profileKey para manter os externalIds.
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

/** Uma tabela tem o mínimo para extrair negócios com este mapeamento. */
export function isMappingValid(m: ColumnMapping): boolean {
  return m.date != null && m.quantity != null && (m.price != null || m.amount != null) && (m.ticker != null || m.isin != null)
}

/** Mapeamento a usar para uma tabela: o memorizado (corrigido pelo utilizador) ou o automático. */
export function resolveMapping(headers: string[]): ColumnMapping {
  return loadSavedMapping(headers) ?? autoMap(headers)
}

/**
 * Importação genérica (só negócios). O externalId é `{profileKey}:{id}` ou a chave composta —
 * NÃO alterar: é o que já está gravado para quem importou por este caminho.
 */
export function buildGenericImport(table: TableData, mapping: ColumnMapping, label = 'Outra corretora'): NormalizedImport {
  const built = buildTrades(table.rows, mapping, profileKeyFor(table.headers))
  const warnings: string[] = []
  if (built.failed > 0) warnings.push(`${built.failed} ${built.failed === 1 ? 'linha não foi reconhecida' : 'linhas não foram reconhecidas'}.`)
  return {
    broker: 'generic',
    brokerLabel: label,
    trades: built.items,
    deposits: [],
    dividends: [],
    fxSamples: [],
    warnings,
    hasUnparsedRows: built.failed > 0,
  }
}
