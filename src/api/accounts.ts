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

  archive: (id: string, targetAccountId?: string) =>
    api.post<Account>(`/api/accounts/${id}/archive`, targetAccountId ? { targetAccountId } : {}),

  reactivate: (id: string) =>
    api.post<Account>(`/api/accounts/${id}/reactivate`),

  deleteWithTransfer: (id: string, targetAccountId: string) =>
    api.delete(`/api/accounts/${id}/transfer`, { data: { targetAccountId } }),
}
