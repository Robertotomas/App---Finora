import api from './client'
import type {
  BillingInterval,
  CheckoutRequest,
  CheckoutUrlResponse,
  PaidPlan,
  PlansResponse,
  SubscriptionMe,
  SubscriptionPlan,
  UpgradeSubscriptionRequest,
} from '@/types/subscription'

export const subscriptionApi = {
  getMySubscription: () =>
    api.get<SubscriptionMe>('/api/subscription/me'),

  upgrade: (plan: SubscriptionPlan) =>
    api.put<SubscriptionMe>('/api/subscription/upgrade', { plan } satisfies UpgradeSubscriptionRequest),

  getPlans: () =>
    api.get<PlansResponse>('/api/subscription/plans'),

  // Server resolves the price from (plan, interval) — the client never sends an amount.
  checkout: (plan: PaidPlan, interval: BillingInterval) =>
    api.post<CheckoutUrlResponse>('/api/subscription/checkout', { plan, interval } satisfies CheckoutRequest),

  portal: () =>
    api.post<CheckoutUrlResponse>('/api/subscription/portal'),

  // Reconcile the local plan with Stripe (called on return from Checkout).
  sync: () =>
    api.post<SubscriptionMe>('/api/subscription/sync'),
}
