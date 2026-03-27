export type SubscriptionPlan = 'Free' | 'Pro' | 'Couple'

export interface SubscriptionLimits {
  accountsRemaining: number | null
  incomeRemainingThisMonth: number | null
  expensesRemainingThisMonth: number | null
  objectivesEnabled: boolean
  canInvite: boolean
  /** Free + mais do que uma conta e ainda não foi escolhida conta principal */
  needsPrimaryAccountSelection?: boolean
  /** Só preenchido em Free multi-conta depois de escolher principal */
  primaryAccountId?: string | null
}

export interface SubscriptionMe {
  plan: SubscriptionPlan
  limits: SubscriptionLimits
}

export interface UpgradeSubscriptionRequest {
  plan: SubscriptionPlan
}

