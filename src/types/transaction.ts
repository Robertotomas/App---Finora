export enum TransactionType {
  Income = 0,
  Expense = 1,
  Transfer = 2
}

export enum TransactionEntityType {
  Entity = 0,
  Person = 1
}

export enum TransactionCategory {
  // ── Rendimentos (receita) ──
  Salary = 0,
  Investments = 1,
  PurchaseRefunds = 2,
  TaxRefund = 3,
  BenefitsPensions = 4,
  SelfEmployment = 5,
  OtherIncome = 9,
  // ── Alimentação ──
  Groceries = 10,
  Restaurants = 11,
  Cafes = 12,
  // ── Habitação ──
  Rent = 20,
  HouseholdBills = 21,
  // ── Transportes ──
  Fuel = 30,
  PublicTransport = 31,
  Parking = 32,
  CarMaintenance = 33,
  TaxiRideshare = 34,
  // ── Saúde ──
  Pharmacy = 40,
  Health = 41,
  GymSports = 42,
  // ── Lazer ──
  PersonalCare = 50,
  Gifts = 51,
  Leisure = 52,
  Travel = 53,
  Donations = 54,
  Pets = 55,
  Subscriptions = 56,
  // ── Compras ──
  Shopping = 60,
  Clothing = 61,
  HomeFurniture = 62,
  Electronics = 63,
  CreditCard = 64,
  // ── Educação e família ──
  Education = 70,
  Childcare = 71,
  // ── Encargos ──
  Taxes = 80,
  FeesCommissions = 81,
  ProfessionalServices = 82,
  Insurance = 83,
  // ── Outros (despesa) ──
  OtherExpense = 98,
  // ── Transferência ──
  Transfer = 100
}

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  [TransactionType.Income]: 'Receita',
  [TransactionType.Expense]: 'Despesa',
  [TransactionType.Transfer]: 'Transferência'
}

export const TRANSACTION_CATEGORY_LABELS: Record<TransactionCategory, string> = {
  [TransactionCategory.Salary]: 'Salário',
  [TransactionCategory.Investments]: 'Investimentos',
  [TransactionCategory.PurchaseRefunds]: 'Reembolsos de compras',
  [TransactionCategory.TaxRefund]: 'Reembolso de impostos',
  [TransactionCategory.BenefitsPensions]: 'Subsídios e pensões',
  [TransactionCategory.SelfEmployment]: 'Rendimento independente',
  [TransactionCategory.OtherIncome]: 'Outros rendimentos',
  [TransactionCategory.Groceries]: 'Supermercado',
  [TransactionCategory.Restaurants]: 'Restaurantes',
  [TransactionCategory.Cafes]: 'Cafés',
  [TransactionCategory.Rent]: 'Renda',
  [TransactionCategory.HouseholdBills]: 'Contas da casa',
  [TransactionCategory.Fuel]: 'Combustível',
  [TransactionCategory.PublicTransport]: 'Transportes públicos',
  [TransactionCategory.Parking]: 'Estacionamento',
  [TransactionCategory.CarMaintenance]: 'Manutenção auto',
  [TransactionCategory.TaxiRideshare]: 'Táxis e TVDE',
  [TransactionCategory.Pharmacy]: 'Farmácia',
  [TransactionCategory.Health]: 'Saúde',
  [TransactionCategory.GymSports]: 'Ginásio e desporto',
  [TransactionCategory.PersonalCare]: 'Cuidados pessoais',
  [TransactionCategory.Gifts]: 'Prendas',
  [TransactionCategory.Leisure]: 'Lazer',
  [TransactionCategory.Travel]: 'Viagens',
  [TransactionCategory.Donations]: 'Donativos',
  [TransactionCategory.Pets]: 'Animais de estimação',
  [TransactionCategory.Subscriptions]: 'Subscrições',
  [TransactionCategory.Shopping]: 'Compras',
  [TransactionCategory.Clothing]: 'Roupa e calçado',
  [TransactionCategory.HomeFurniture]: 'Casa e mobiliário',
  [TransactionCategory.Electronics]: 'Eletrónica e tecnologia',
  [TransactionCategory.CreditCard]: 'Cartão de crédito',
  [TransactionCategory.Education]: 'Educação',
  [TransactionCategory.Childcare]: 'Cuidados infantis',
  [TransactionCategory.Taxes]: 'Impostos',
  [TransactionCategory.FeesCommissions]: 'Taxas e comissões',
  [TransactionCategory.ProfessionalServices]: 'Serviços profissionais',
  [TransactionCategory.Insurance]: 'Seguros',
  [TransactionCategory.OtherExpense]: 'Outras despesas',
  [TransactionCategory.Transfer]: 'Transferências'
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
  entityType?: TransactionEntityType
  entityName?: string | null
  destinationAccountId?: string
  splits: TransactionSplit[]
}

export interface CreateTransactionRequest {
  accountId: string
  type: TransactionType
  category: TransactionCategory
  amount: number
  date: string
  description?: string
  entityType?: TransactionEntityType
  entityName?: string | null
  destinationAccountId?: string
  splits?: TransactionSplitInput[]
}

export interface UpdateTransactionRequest {
  accountId: string
  type: TransactionType
  category: TransactionCategory
  amount: number
  date: string
  description?: string
  entityType?: TransactionEntityType
  entityName?: string | null
  destinationAccountId?: string
  splits?: TransactionSplitInput[]
}

export interface TransactionSplitInput {
  userId: string
  percentage: number
}
