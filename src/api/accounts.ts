import api from './client'
import type { Account, CreateAccountRequest, UpdateAccountRequest } from '@/types/account'

export const accountsApi = {
  getAll: () =>
    api.get<Account[]>('/api/accounts'),

  getById: (id: string) =>
    api.get<Account>(`/api/accounts/${id}`),

  create: (data: CreateAccountRequest) =>
    api.post<Account>('/api/accounts', data),

  update: (id: string, data: UpdateAccountRequest) =>
    api.put<Account>(`/api/accounts/${id}`, data),

  delete: (id: string) =>
    api.delete(`/api/accounts/${id}`),
}
