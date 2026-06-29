import api from './client'
import type {
  InvestmentHolding,
  InvestmentHistory,
  InstrumentPriceHistory,
  InvestmentImportResult,
  BrokerTrade,
  InstrumentSearchResult,
  AddTransactionRequest,
  UpdateTransactionRequest,
} from '@/types/investment'

/** Intervalo opcional para as séries (yyyy-MM-dd). Vazio = desde a 1ª compra / até hoje. */
export interface HistoryRange {
  from?: string
  to?: string
}

export const investmentsApi = {
  getAll: () => api.get<InvestmentHolding[]>('/api/investments'),

  getById: (id: string) => api.get<InvestmentHolding>(`/api/investments/${id}`),

  delete: (id: string) => api.delete(`/api/investments/${id}`),

  addTransaction: (data: AddTransactionRequest) =>
    api.post<InvestmentHolding>('/api/investments/transactions', data),

  updateTransaction: (txId: string, data: UpdateTransactionRequest) =>
    api.put<InvestmentHolding>(`/api/investments/transactions/${txId}`, data),

  // Devolve a posição atualizada (200) ou vazio (204) se a posição ficou sem transações.
  deleteTransaction: (txId: string) =>
    api.delete<InvestmentHolding | ''>(`/api/investments/transactions/${txId}`),

  search: (q: string) =>
    api.get<InstrumentSearchResult[]>('/api/investments/search', { params: { q } }),

  refresh: () => api.post<InvestmentHolding[]>('/api/investments/refresh'),

  history: (range: HistoryRange = {}) =>
    api.get<InvestmentHistory>('/api/investments/history', {
      params: { from: range.from || undefined, to: range.to || undefined },
    }),

  holdingHistory: (id: string, range: HistoryRange = {}) =>
    api.get<InvestmentHistory>(`/api/investments/${id}/history`, {
      params: { from: range.from || undefined, to: range.to || undefined },
    }),

  // Importa transações já parseadas no cliente (Excel/CSV). dryRun=true → só pré-visualização.
  import: (items: BrokerTrade[], hasUnparsedRows: boolean, dryRun: boolean) =>
    api.post<InvestmentImportResult>('/api/investments/import', { items, hasUnparsedRows }, { params: { dryRun } }),

  // Cotação histórica de um ticker (preço real), para a pré-visualização no modal.
  quoteHistory: (symbol: string, range: HistoryRange = {}) =>
    api.get<InstrumentPriceHistory>('/api/investments/quote-history', {
      params: { symbol, from: range.from || undefined, to: range.to || undefined },
    }),
}
