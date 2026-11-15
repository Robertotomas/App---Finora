import type { BrokerAdapter, BrokerDeposit, BrokerDividend, BrokerFxSample, FxFeeEstimate, NormalizedImport, StatementContext, TableData } from './types'

/** O que um adaptador de tabela plana acrescenta aos negócios do caminho genérico. */
export interface TableExtras {
  deposits?: BrokerDeposit[]
  dividends?: BrokerDividend[]
  fxFee?: FxFeeEstimate
  fxSamples?: BrokerFxSample[]
  warnings?: string[]
}

/**
 * Adaptador de tabela plana (Trading 212, DEGIRO, IBKR Flex, Revolut, Trade Republic).
 * Os NEGÓCIOS vêm sempre do caminho genérico (`buildTrades` + `profileKeyFor`) para manter os
 * externalIds de quem já importou estes ficheiros antes de haver adaptadores dedicados.
 */
export interface TableAdapter extends BrokerAdapter {
  kind: 'table'
  extras(table: TableData): TableExtras
  /** Variante do ficheiro sem negócios (ex.: extrato de conta da DEGIRO) → só extras. */
  noTrades?(table: TableData): boolean
}

/** Adaptador com parser próprio (XTB multi-folha, IBKR Activity multi-secção). */
export interface CustomAdapter extends BrokerAdapter {
  kind: 'custom'
  parse(ctx: StatementContext): NormalizedImport
}

export type AnyAdapter = TableAdapter | CustomAdapter
