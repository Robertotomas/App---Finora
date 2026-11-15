import type { StatementContext, TableData } from './types'

/** Leitura de ficheiro (CSV/Excel) → contexto de deteção (SheetJS, carregado on-demand). */

export const XTB_SHEET = 'CASH OPERATION HISTORY'
/** Exportação nova da XTB (2026+): folhas "Cash Operations", "Open Positions", "Closed Positions". */
export const XTB_NEW_SHEET = 'cash operations'

/**
 * Converte a folha "Cash Operations" da exportação nova da XTB para o layout da folha antiga
 * ("CASH OPERATION HISTORY": ID, Type, Time, Comment, Symbol, Amount), acrescentando Instrument e
 * Category no fim. Assim o adaptador XTB (provado) serve os dois formatos e os ExternalIds `xtb:{ID}`
 * são os mesmos (dedup de reimportações). Null se o cabeçalho esperado não existir.
 */
export function xtbNewToLegacyRows(rows: unknown[][]): unknown[][] | null {
  const norm = (c: unknown) => String(c ?? '').trim().toLowerCase()
  const headerIdx = rows.findIndex((r) => {
    const cells = r.map(norm)
    return cells.includes('type') && cells.includes('id') && cells.includes('ticker') && cells.includes('amount')
  })
  if (headerIdx < 0) return null
  const header = rows[headerIdx].map(norm)
  const col = (name: string) => header.indexOf(name)
  const iId = col('id'), iType = col('type'), iTime = col('time'), iComment = col('comment')
  const iTicker = col('ticker'), iAmount = col('amount'), iInstrument = col('instrument'), iCategory = col('category')
  const out: unknown[][] = [['ID', 'Type', 'Time', 'Comment', 'Symbol', 'Amount', 'Instrument', 'Category']]
  for (const r of rows.slice(headerIdx + 1)) {
    const id = r[iId]
    if (id == null || String(id).trim() === '') continue // linha "Total" e linhas vazias
    out.push([
      id,
      r[iType],
      iTime >= 0 ? r[iTime] : null,
      iComment >= 0 ? r[iComment] : null,
      r[iTicker],
      r[iAmount],
      iInstrument >= 0 ? r[iInstrument] : null,
      iCategory >= 0 ? r[iCategory] : null,
    ])
  }
  return out
}

function detectDelimiter(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim()) || ''
  const counts: Record<string, number> = { ';': 0, ',': 0, '\t': 0 }
  for (const ch of line) if (ch in counts) counts[ch]++
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]) || ','
}

// Converte cada célula para texto sem perder a data (Date → ISO).
function cellToStr(c: unknown): string {
  if (c == null) return ''
  if (c instanceof Date) return c.toISOString()
  return String(c).trim()
}

/** Tabela plana a partir das linhas cruas: cabeçalho = 1.ª linha com ≥ 3 células preenchidas. */
export function tableFromRows(aoa: string[][]): TableData | null {
  const headerIdx = aoa.findIndex((r) => r.filter((c) => c).length >= 3)
  if (headerIdx < 0) return null
  const headers = aoa[headerIdx]
  const rows = aoa.slice(headerIdx + 1).filter((r) => r.some((c) => c))
  return { headers, rows }
}

export class StatementReadError extends Error {}

export async function readStatement(file: File): Promise<StatementContext> {
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
    throw new StatementReadError('Não foi possível ler o ficheiro.')
  }

  const sheetNames = wb.SheetNames
  const xtbSheet = wb.Sheets[XTB_SHEET]
  let xtbRows = xtbSheet ? XLSX.utils.sheet_to_json<unknown[]>(xtbSheet, { header: 1, raw: true, defval: null }) : null
  if (!xtbRows) {
    // Formato novo da XTB: folha "Cash Operations" com linhas de cabeçalho da conta antes da tabela.
    const newName = sheetNames.find((n) => n.trim().toLowerCase() === XTB_NEW_SHEET)
    if (newName) {
      const raw = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[newName], { header: 1, raw: true, defval: null })
      xtbRows = xtbNewToLegacyRows(raw)
    }
  }

  // Escolhe a folha com mais linhas (mais provável de ser a de transações).
  let bestAoa: unknown[][] = []
  for (const name of sheetNames) {
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: '' })
    if (aoa.length > bestAoa.length) bestAoa = aoa
  }
  const rawRows = bestAoa.map((r) => (r as unknown[]).map(cellToStr))
  return { fileName: file.name, sheetNames, xtbRows, rawRows, table: tableFromRows(rawRows) }
}
