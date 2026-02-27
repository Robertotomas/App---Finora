export interface ExpenseByCategory {
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

export interface Dashboard {
  totalBalance: number
  currency: string
  year: number
  month: number
  monthlyIncome: number
  monthlyExpenses: number
  monthlySavings: number
  expensesByCategory: ExpenseByCategory[]
  monthlyTrend: MonthlyTrend[]
}
