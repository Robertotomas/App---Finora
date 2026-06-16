export type SubscriptionPlan = 'Free' | 'Pro' | 'Couple'

export type BillingInterval = 'monthly' | 'annual'

/** Paid plans only — checkout/portal apply to these. */
export type PaidPlan = Exclude<SubscriptionPlan, 'Free'>

export interface SubscriptionLimits {
  accountsRemaining: number | null
  incomeRemainingThisMonth: number | null
  expensesRemainingThisMonth: number | null
  objectivesEnabled: boolean
  /** Pro/Couple; falls back to objectivesEnabled if omitted (older API responses). */
  monthlyReportsEnabled?: boolean
  /** Pro/Couple; falls back to objectivesEnabled if omitted (older API responses). */
  recurringEnabled?: boolean
  /** Pro/Couple; falls back to objectivesEnabled if omitted (older API responses). */
  assetsEnabled?: boolean
  /** Pro/Couple; falls back to objectivesEnabled if omitted (older API responses). */
  investmentsEnabled?: boolean
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

export interface CheckoutRequest {
  plan: PaidPlan
  interval: BillingInterval
}

export interface CheckoutUrlResponse {
  url: string
}

/** Amounts are in cents (minor unit), as configured server-side. */
export interface PlanPrice {
  monthly: number
  annual: number
}

export interface PlansResponse {
  currency: string
  pro: PlanPrice
  couple: PlanPrice
}

