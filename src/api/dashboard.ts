import api from './client'
import type { Dashboard } from '@/types/dashboard'

export interface DashboardParams {
  year?: number
  month?: number
  trendMonths?: number
}

export interface DailyBalancePoint {
  date: string
  balance: number
}

export interface DailyBalanceResponse {
  points: DailyBalancePoint[]
  currency: string
}

export const dashboardApi = {
    get: (params?: DashboardParams) => {
    const searchParams = new URLSearchParams()
    if (params?.year != null) searchParams.set('year', String(params.year))
    if (params?.month != null) searchParams.set('month', String(params.month))
    searchParams.set('trendMonths', String(params?.trendMonths ?? 6))
    const query = searchParams.toString()
    return api.get<Dashboard>(`/api/dashboard${query ? `?${query}` : ''}`, { timeout: 15000 })
  },
  getDailyBalance: (days: number = 180) =>
    api.get<DailyBalanceResponse>('/api/dashboard/daily-balance', { params: { days }, timeout: 15000 }),
}
