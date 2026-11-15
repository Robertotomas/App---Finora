import { buildTrades, isMappingValid, profileKeyFor, resolveMapping } from './generic'
import type { ColumnMapping } from './generic'
import { detectBroker } from './detect'
import { readStatement, StatementReadError } from './read'
import type { TableAdapter } from './tableAdapter'
import type { NormalizedImport, StatementContext, TableData } from './types'

/**
 * Importação de extratos de corretoras (parsing no cliente):
 * Upload → readStatement → detectBroker → adaptador → NormalizedImport → dry-run no backend → importar.
 */

export type ParseOutcome =
  | { kind: 'ready'; data: NormalizedImport; table: TableData | null }
  | { kind: 'mapping'; adapter: TableAdapter | null; brokerLabel: string; table: TableData; mapping: ColumnMapping }
  | { kind: 'error'; message: string }

export const GENERIC_LABEL = 'Outra corretora'

const NO_TRADES_MSG = 'Não foi possível extrair compras/vendas com este mapeamento. Verifique as colunas.'

function failedWarning(n: number): string[] {
  return n > 0 ? [`${n} ${n === 1 ? 'linha não foi reconhecida' : 'linhas não foram reconhecidas'}.`] : []
}

const hasAny = (d: NormalizedImport) => d.trades.length + d.deposits.length + d.dividends.length > 0

/**
 * Constrói a importação a partir de uma tabela + mapeamento de colunas. Os negócios vêm SEMPRE de
 * `buildTrades` com `profileKeyFor(cabeçalho)` (externalIds compatíveis com importações anteriores);
 * com um adaptador de tabela, acrescenta os extras dele (depósitos, dividendos, taxa).
 */
export function importWithMapping(table: TableData, mapping: ColumnMapping, adapter: TableAdapter | null): NormalizedImport {
  const built = buildTrades(table.rows, mapping, profileKeyFor(table.headers))
  const extras = adapter ? adapter.extras(table) : {}
  return {
    broker: adapter?.id ?? 'generic',
    brokerLabel: adapter?.label ?? GENERIC_LABEL,
    trades: built.items,
    deposits: extras.deposits ?? [],
    dividends: extras.dividends ?? [],
    fxFee: extras.fxFee,
    fxSamples: extras.fxSamples ?? [],
    warnings: [...failedWarning(built.failed), ...(extras.warnings ?? [])],
    hasUnparsedRows: built.failed > 0,
  }
}

function runTableAdapter(adapter: TableAdapter | null, table: TableData): ParseOutcome {
  if (adapter?.noTrades?.(table)) {
    const extras = adapter.extras(table)
    const data: NormalizedImport = {
      broker: adapter.id,
      brokerLabel: adapter.label,
      trades: [],
      deposits: extras.deposits ?? [],
      dividends: extras.dividends ?? [],
      fxFee: extras.fxFee,
      fxSamples: extras.fxSamples ?? [],
      warnings: extras.warnings ?? [],
      hasUnparsedRows: false,
    }
    return hasAny(data) ? { kind: 'ready', data, table } : { kind: 'error', message: 'O ficheiro não tem movimentos reconhecíveis.' }
  }

  const mapping = resolveMapping(table.headers)
  if (!isMappingValid(mapping)) {
    return { kind: 'mapping', adapter, brokerLabel: adapter?.label ?? GENERIC_LABEL, table, mapping }
  }
  const data = importWithMapping(table, mapping, adapter)
  return hasAny(data) ? { kind: 'ready', data, table } : { kind: 'error', message: NO_TRADES_MSG }
}

/** Análise pura de um ficheiro já lido (testável sem File/SheetJS). */
export function analyzeStatement(ctx: StatementContext): ParseOutcome {
  const { adapter } = detectBroker(ctx)

  if (adapter?.kind === 'custom') {
    try {
      const data = adapter.parse(ctx)
      return hasAny(data) ? { kind: 'ready', data, table: ctx.table } : { kind: 'error', message: 'Não foram encontradas operações no ficheiro.' }
    } catch (e) {
      return { kind: 'error', message: e instanceof Error && e.message ? e.message : 'Não foi possível ler o ficheiro.' }
    }
  }

  const table = ctx.table
  if (!table) return { kind: 'error', message: 'Não foram encontradas colunas reconhecíveis.' }
  if (table.rows.length === 0) return { kind: 'error', message: 'O ficheiro não tem linhas de dados.' }
  return runTableAdapter((adapter as TableAdapter | null) ?? null, table)
}

export async function parseStatement(file: File): Promise<ParseOutcome> {
  try {
    return analyzeStatement(await readStatement(file))
  } catch (e) {
    if (e instanceof StatementReadError) return { kind: 'error', message: e.message }
    return { kind: 'error', message: 'Não foi possível ler o ficheiro. Tente novamente.' }
  }
}

export { detectBroker, ADAPTERS, MIN_CONFIDENCE } from './detect'
export { readStatement, tableFromRows } from './read'
export {
  autoMap, buildTrades, detectSideMode, saveMapping, loadSavedMapping, profileKeyFor, headerSignature,
  isMappingValid, resolveMapping, buildGenericImport, FIELD_DEFS,
} from './generic'
export type { ColumnMapping, FieldKey, FieldDef, BuildResult, SideInfo } from './generic'
export { parseNumber, parseDate } from './shared'
export { aggregateFxFee, explicitFeePercent, FX_FEE_RULES } from './fxFee'
export type { TableAdapter } from './tableAdapter'
export type { BrokerId, NormalizedImport, FxFeeEstimate, BrokerFxSample, TableData, StatementContext } from './types'
