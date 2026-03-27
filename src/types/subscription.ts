export type SubscriptionPlan = 'Free' | 'Pro' | 'Couple'

export interface SubscriptionLimits {
  accountsRemaining: number | null
  incomeRemainingThisMonth: number | null
  expensesRemainingThisMonth: number | null
  objectivesEnabled: boolean
  canInvite: boolean
}

export interface SubscriptionMe {
  plan: SubscriptionPlan
  limits: SubscriptionLimits
}

export interface UpgradeSubscriptionRequest {
  plan: SubscriptionPlan
}

