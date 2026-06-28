import { InstrumentType, InvestmentOperation } from '@/types/investment'
import type { BrokerTrade } from '@/types/investment'

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

const COMMENT = /(OPEN|CLOSE)\s+(BUY|SELL)\s+([\d.]+)(?:\/[\d.]+)?\s*@\s*([\d.]+)/i

export interface XtbParseResult {
  items: BrokerTrade[]
  hasUnparsedRows: boolean
  error?: string
}

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

export async function parseXtbWorkbook(file: File): Promise<XtbParseResult> {
  const XLSX = await import('xlsx')
  let wb
  try {
    wb = XLSX.read(await file.arrayBuffer(), { cellDates: true })
  } catch {
    return { items: [], hasUnparsedRows: false, error: 'Não foi possível ler o ficheiro. Confirme que é um Excel (.xlsx) da XTB.' }
  }

  const ws = wb.Sheets['CASH OPERATION HISTORY']
  if (!ws) {
    return { items: [], hasUnparsedRows: false, error: 'O ficheiro não tem a folha "CASH OPERATION HISTORY" da XTB.' }
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null })
  const headerIdx = rows.findIndex((r) => String(r[0]).trim() === 'ID' && String(r[1]).trim() === 'Type')
  if (headerIdx < 0) {
    return { items: [], hasUnparsedRows: false, error: 'Formato inesperado: cabeçalho de operações não encontrado.' }
  }

  const data = rows.slice(headerIdx + 1).filter((r) => r[0] != null && String(r[0]).trim() !== '')
  const items: BrokerTrade[] = []
  let failed = 0

  for (const r of data) {
    const type = String(r[1] ?? '').trim()
    if (!/^Stock (purchase|sale)$/i.test(type)) continue // só compras/vendas (ignora dividendos, taxas, depósitos…)

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

    items.push({
      providerSymbol: base + yahooSuffix,
      baseSymbol: base,
      name: base,
      currency,
      exchange: suffix,
      type: ETF_SYMBOLS.has(base) ? InstrumentType.Etf : InstrumentType.Stock,
      operation,
      date: toDateStr(r[2]),
      quantity,
      unitPrice,
      fxRateToEur: fxRateToEur != null ? Number(fxRateToEur.toFixed(6)) : null,
      externalId: `xtb:${String(r[0]).trim()}`,
    })
  }

  return { items, hasUnparsedRows: failed > 0 }
}
