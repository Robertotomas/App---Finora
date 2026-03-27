import api from './client'
import type { SubscriptionMe, SubscriptionPlan, UpgradeSubscriptionRequest } from '@/types/subscription'

export const subscriptionApi = {
  getMySubscription: () =>
    api.get<SubscriptionMe>('/api/subscription/me'),

  upgrade: (plan: SubscriptionPlan) =>
    api.put<SubscriptionMe>('/api/subscription/upgrade', { plan } satisfies UpgradeSubscriptionRequest),
}

