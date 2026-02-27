export enum TransactionType {
  Income = 0,
  Expense = 1
}

export enum TransactionCategory {
  Salary = 0,
  Freelance = 1,
  Investment = 2,
  Gift = 3,
  Refund = 4,
  Food = 10,
  Transport = 11,
  Housing = 12,
  Utilities = 13,
  Health = 14,
  Entertainment = 15,
  Shopping = 16,
  Education = 17,
  Other = 99
}

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  [TransactionType.Income]: 'Receita',
  [TransactionType.Expense]: 'Despesa'
}

export const TRANSACTION_CATEGORY_LABELS: Record<TransactionCategory, string> = {
  [TransactionCategory.Salary]: 'Salário',
  [TransactionCategory.Freelance]: 'Freelance',
  [TransactionCategory.Investment]: 'Investimento',
  [TransactionCategory.Gift]: 'Presente',
  [TransactionCategory.Refund]: 'Reembolso',
  [TransactionCategory.Food]: 'Alimentação',
  [TransactionCategory.Transport]: 'Transportes',
  [TransactionCategory.Housing]: 'Habitação',
  [TransactionCategory.Utilities]: 'Utilidades',
  [TransactionCategory.Health]: 'Saúde',
  [TransactionCategory.Entertainment]: 'Entretenimento',
  [TransactionCategory.Shopping]: 'Compras',
  [TransactionCategory.Education]: 'Educação',
  [TransactionCategory.Other]: 'Outro'
}

export interface TransactionSplit {
  userId: string
  percentage: number
}

export interface Transaction {
  id: string
  accountId: string
  householdId: string
  type: TransactionType
  category: TransactionCategory
  amount: number
  date: string
  description?: string
  splits: TransactionSplit[]
}

export interface CreateTransactionRequest {
  accountId: string
  type: TransactionType
  category: TransactionCategory
  amount: number
  date: string
  description?: string
  splits?: TransactionSplitInput[]
}

export interface UpdateTransactionRequest {
  accountId: string
  type: TransactionType
  category: TransactionCategory
  amount: number
  date: string
  description?: string
  splits?: TransactionSplitInput[]
}

export interface TransactionSplitInput {
  userId: string
  percentage: number
}
