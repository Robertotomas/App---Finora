import api from './client'

export interface SearchTransaction {
  id: string
  description?: string | null
  entityName?: string | null
  amount: number
  type: number
  category: number
  date: string
}

export interface SearchAccount {
  id: string
  name: string
  balance: number
}

export interface SearchObjective {
  id: string
  name: string
  completed: boolean
}

export interface GlobalSearchResult {
  transactions: SearchTransaction[]
  accounts: SearchAccount[]
  objectives: SearchObjective[]
}

export const searchApi = {
  global: (q: string) => api.get<GlobalSearchResult>('/api/search', { params: { q } }),
}
