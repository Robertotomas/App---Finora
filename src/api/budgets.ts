import api from './client'

export interface MonthlyBudgetDto {
  id: string
  year: number
  month: number
  expectedIncome: number
  expectedExpenses: number
}

export interface UpsertBudgetRequest {
  year: number
  month: number
  expectedIncome: number
  expectedExpenses: number
}

export const budgetsApi = {
  list: (year?: number) =>
    api.get<MonthlyBudgetDto[]>('/api/budgets', { params: year ? { year } : undefined }),

  upsert: (data: UpsertBudgetRequest) =>
    api.put<MonthlyBudgetDto>('/api/budgets', data),

  remove: (year: number, month: number) =>
    api.delete(`/api/budgets/${year}/${month}`),
}
