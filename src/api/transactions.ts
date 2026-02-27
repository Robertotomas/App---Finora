import api from './client'
import type { Transaction, CreateTransactionRequest, UpdateTransactionRequest } from '@/types/transaction'

export interface GetTransactionsParams {
  accountId?: string
  from?: string
  to?: string
}

export const transactionsApi = {
  getAll: (params?: GetTransactionsParams) =>
    api.get<Transaction[]>('/api/transactions', { params }),

  getById: (id: string) =>
    api.get<Transaction>(`/api/transactions/${id}`),

  create: (data: CreateTransactionRequest) =>
    api.post<Transaction>('/api/transactions', data),

  update: (id: string, data: UpdateTransactionRequest) =>
    api.put<Transaction>(`/api/transactions/${id}`, data),

  delete: (id: string) =>
    api.delete(`/api/transactions/${id}`),
}
