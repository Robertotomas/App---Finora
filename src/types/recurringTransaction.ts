import type { TransactionType, TransactionCategory } from '@/types/transaction'

export interface RecurringTransaction {
  id: string
  accountId: string
  householdId: string
  type: TransactionType
  category: TransactionCategory
  amount: number
  description?: string
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
}

export interface UpdateRecurringTransactionRequest {
  accountId: string
  type: TransactionType
  category: TransactionCategory
  amount: number
  description?: string
}
