export interface ExpenseByCategory {
  category: number
  categoryName: string
  amount: number
  percentage: number
}

export interface IncomeByCategory {
  category: number
  categoryName: string
  amount: number
  percentage: number
}

export interface MonthlyTrend {
  year: number
  month: number
  label: string
  income: number
  expenses: number
  savings: number
}

export interface AccountBalanceAtPeriod {
  accountId: string
  name: string
  type: number
  currency: string
  balance: number
}

export interface Dashboard {
  totalBalance: number
  currency: string
  year: number
  month: number
  monthlyIncome: number
  monthlyExpenses: number
  monthlySavings: number
  expensesByCategory: ExpenseByCategory[]
  incomeByCategory: IncomeByCategory[]
  monthlyTrend: MonthlyTrend[]
  accountBalancesAtPeriod: AccountBalanceAtPeriod[]
}
