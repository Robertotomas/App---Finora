import type { BrokerTrade, BrokerDeposit, BrokerDividend, BrokerCashMovement, InvestmentOperation } from '@/types/investment'

/** Corretoras com adaptador dedicado ('generic' = mapeamento de colunas). */
export type BrokerId = 'xtb' | 'trading212' | 'degiro' | 'ibkr' | 'revolut' | 'tradeRepublic' | 'generic'

/** Estimativa da taxa de conversão de moeda da corretora (%). */
export interface FxFeeEstimate {
  /** Percentagem (ex.: 0.5 = 0,5%), arredondada a 0,05 e limitada a 0–5. */
  percent: number
  /** 'explicit' = indicada no extrato; 'inferred' = deduzida do montante em € vs. câmbio do BCE. */
  source: 'explicit' | 'inferred'
  /** Nº de operações (não-EUR) usadas no cálculo. */
  sampleSize: number
}

/**
 * Amostra para inferir a taxa no servidor (dry-run): operação em moeda estrangeira com o montante
 * em € efetivamente debitado/creditado. O servidor compara com o câmbio de referência (BCE) da data.
 */
export interface BrokerFxSample {
  currency: string
  date: string
  operation: InvestmentOperation
  quantity: number
  unitPrice: number
  /** Montante em € (sem sinal) efetivamente pago (compra) ou recebido (venda). */
  amountEur: number
}

/** Resultado normalizado de qualquer adaptador — o que segue para o backend. */
export interface NormalizedImport {
  broker: BrokerId
  brokerLabel: string
  trades: BrokerTrade[]
  deposits: BrokerDeposit[]
  dividends: BrokerDividend[]
  /** Outros movimentos de caixa (juros, taxas, spinoffs) — só para os Fundos livres. Só a XTB por agora. */
  cashMovements?: BrokerCashMovement[]
  /** Taxa explícita (calculada no cliente a partir do extrato). */
  fxFee?: FxFeeEstimate
  /** Amostras para a taxa inferida (calculada no servidor, no dry-run). */
  fxSamples: BrokerFxSample[]
  /** Avisos para o utilizador (PT-PT, «você»). */
  warnings: string[]
  hasUnparsedRows: boolean
}

/** Tabela plana (cabeçalho + linhas em texto) lida de um CSV/Excel. */
export interface TableData {
  headers: string[]
  rows: string[][]
}

/** Contexto de deteção/parse: o ficheiro já lido. */
export interface StatementContext {
  fileName: string
  sheetNames: string[]
  /** Folha "CASH OPERATION HISTORY" da XTB (valores crus, datas como Date), se existir. */
  xtbRows: unknown[][] | null
  /** Todas as linhas cruas (texto) da folha principal — para formatos multi-secção (IBKR Activity). */
  rawRows: string[][]
  /** Tabela plana da folha principal (cabeçalho = 1.ª linha com ≥ 3 células). */
  table: TableData | null
}

export interface BrokerAdapter {
  id: BrokerId
  label: string
  /** Confiança 0..1 de que o ficheiro é desta corretora. */
  detect(ctx: StatementContext): number
}

export type { BrokerTrade, BrokerDeposit, BrokerDividend, BrokerCashMovement }
