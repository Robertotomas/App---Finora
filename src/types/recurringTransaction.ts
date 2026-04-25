import type { TransactionType, TransactionCategory } from '@/types/transaction'

export enum RecurringFrequency {
  Monthly = 0,
  Annual = 1
}

export const RECURRING_FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  [RecurringFrequency.Monthly]: 'Mensal',
  [RecurringFrequency.Annual]: 'Anual'
}

export const MONTH_LABELS: Record<number, string> = {
  1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril',
  5: 'Maio', 6: 'Junho', 7: 'Julho', 8: 'Agosto',
  9: 'Setembro', 10: 'Outubro', 11: 'Novembro', 12: 'Dezembro'
}

export interface RecurringTransaction {
  id: string
  accountId: string
  householdId: string
  type: TransactionType
  category: TransactionCategory
  amount: number
  description?: string
  destinationAccountId?: string
  frequency: RecurringFrequency
  annualMonth?: number
  startMonth: number
  startYear: number
  endMonth?: number
  endYear?: number
}

export interface CreateRecurringTransactionRequest {
  accountId: string
  type: TransactionType
  category: TransactionCategory
  amount: number
  description?: string
  destinationAccountId?: string
  frequency: RecurringFrequency
  annualMonth?: number
}

export interface UpdateRecurringTransactionRequest {
  accountId: string
  type: TransactionType
  category: TransactionCategory
  amount: number
  description?: string
  destinationAccountId?: string
  frequency: RecurringFrequency
  annualMonth?: number
}
