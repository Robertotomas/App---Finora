import api from './client'
import type {
  RecurringTransaction,
  CreateRecurringTransactionRequest,
  UpdateRecurringTransactionRequest
} from '@/types/recurringTransaction'

export const recurringTransactionsApi = {
  getAll: () =>
    api.get<RecurringTransaction[]>('/api/recurringtransactions'),

  getById: (id: string) =>
    api.get<RecurringTransaction>(`/api/recurringtransactions/${id}`),

  create: (data: CreateRecurringTransactionRequest) =>
    api.post<RecurringTransaction>('/api/recurringtransactions', data),

  update: (id: string, data: UpdateRecurringTransactionRequest) =>
    api.put<RecurringTransaction>(`/api/recurringtransactions/${id}`, data),

  remove: (id: string, year: number, month: number) =>
    api.delete(`/api/recurringtransactions/${id}`, { params: { year, month } })
}
