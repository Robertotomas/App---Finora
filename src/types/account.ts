export enum AccountType {
  Bank = 0,
  Cash = 1,
  CreditCard = 2,
  Savings = 3,
  Investment = 4,
  Other = 5
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  [AccountType.Bank]: 'Banco',
  [AccountType.Cash]: 'Dinheiro',
  [AccountType.CreditCard]: 'Cartão de Crédito',
  [AccountType.Savings]: 'Poupança',
  [AccountType.Investment]: 'Investimento',
  [AccountType.Other]: 'Outro'
}

export interface Account {
  id: string
  name: string
  type: AccountType
  balance: number
  currency: string
  householdId: string
}

export interface CreateAccountRequest {
  name: string
  type: AccountType
  balance: number
  currency: string
}

export interface UpdateAccountRequest {
  name: string
  type: AccountType
  balance: number
  currency: string
}
