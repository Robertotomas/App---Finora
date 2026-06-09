import type { TransactionType, TransactionCategory, TransactionEntityType } from '@/types/transaction'

export enum RecurringFrequency {
  Monthly = 0,
  Annual = 1,
  Quarterly = 2,
  SemiAnnual = 3
}

export const RECURRING_FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  [RecurringFrequency.Monthly]: 'Mensal',
  [RecurringFrequency.Quarterly]: 'Trimestral',
  [RecurringFrequency.SemiAnnual]: 'Semestral',
  [RecurringFrequency.Annual]: 'Anual'
}

export const MONTH_LABELS: Record<number, string> = {
  1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril',
  5: 'Maio', 6: 'Junho', 7: 'Julho', 8: 'Agosto',
  9: 'Setembro', 10: 'Outubro', 11: 'Novembro', 12: 'Dezembro'
}

const MONTH_LABELS_SHORT: Record<number, string> = {
  1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr', 5: 'Mai', 6: 'Jun',
  7: 'Jul', 8: 'Ago', 9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez'
}

/** Nº de pagamentos por ano implícito na frequência (12 / 4 / 2 / 1). */
export function recurringOccurrencesPerYear(freq: RecurringFrequency): number {
  switch (freq) {
    case RecurringFrequency.Quarterly: return 4
    case RecurringFrequency.SemiAnnual: return 2
    case RecurringFrequency.Annual: return 1
    default: return 12
  }
}

/** Meses de pagamento (1-12) para uma recorrente não-mensal, dado o mês de referência. */
export function recurringPaymentMonths(freq: RecurringFrequency, referenceMonth: number): number[] {
  const occ = recurringOccurrencesPerYear(freq)
  if (occ >= 12) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  const interval = 12 / occ
  const months: number[] = []
  for (let k = 0; k < occ; k++) {
    months.push(((referenceMonth - 1 + k * interval) % 12) + 1)
  }
  return months.sort((a, b) => a - b)
}

export function shortMonthLabel(month: number): string {
  return MONTH_LABELS_SHORT[month] ?? ''
}

/**
 * Montante que a recorrente contribui para um dado mês de calendário (1-12),
 * assumindo que está ativa nesse mês. Espelha `RecurringTransaction.AmountForMonth` no backend.
 */
export function recurringAmountForMonth(
  r: { frequency: RecurringFrequency; amount: number; annualMonth?: number | null },
  month: number
): number {
  if (r.frequency === RecurringFrequency.Monthly) return r.amount
  const occ = recurringOccurrencesPerYear(r.frequency)
  if (r.annualMonth == null) return Math.round((r.amount * occ / 12) * 100) / 100
  const interval = 12 / occ
  const diff = (((month - r.annualMonth) % interval) + interval) % interval
  return diff === 0 ? r.amount : 0
}

/** Descrição curta da frequência para listas (ex.: "Trimestral · Mar" ou "Anual"). */
export function recurringFrequencyDescription(
  r: { frequency: RecurringFrequency; annualMonth?: number | null }
): string {
  const label = RECURRING_FREQUENCY_LABELS[r.frequency]
  if (r.frequency === RecurringFrequency.Monthly || r.annualMonth == null) return label
  return `${label} · ${shortMonthLabel(r.annualMonth)}`
}

export interface RecurringTransaction {
  id: string
  accountId: string
  householdId: string
  type: TransactionType
  category: TransactionCategory
  amount: number
  description?: string
  entityType?: TransactionEntityType
  entityName?: string | null
  destinationAccountId?: string
  responsibleUserId?: string | null
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
  entityType?: TransactionEntityType
  entityName?: string | null
  destinationAccountId?: string
  responsibleUserId?: string | null
  frequency: RecurringFrequency
  annualMonth?: number
}

export interface UpdateRecurringTransactionRequest {
  accountId: string
  type: TransactionType
  category: TransactionCategory
  amount: number
  description?: string
  entityType?: TransactionEntityType
  entityName?: string | null
  destinationAccountId?: string
  responsibleUserId?: string | null
  frequency: RecurringFrequency
  annualMonth?: number
}
