import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { subscriptionApi } from '@/api/subscription'
import type {
  BillingInterval,
  PaidPlan,
  PlansResponse,
  SubscriptionLimits,
  SubscriptionMe,
  SubscriptionPlan,
} from '@/types/subscription'
import { useNotificationStore } from '@/stores/notifications'

export const useSubscriptionStore = defineStore('subscription', () => {
  const subscription = ref<SubscriptionMe | null>(null)
  const plans = ref<PlansResponse | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchSubscription() {
    loading.value = true
    error.value = null
    try {
      const { data } = await subscriptionApi.getMySubscription()
      subscription.value = data
      return data
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'Erro ao carregar subscrição.'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function upgrade(plan: SubscriptionPlan) {
    loading.value = true
    error.value = null
    try {
      const { data } = await subscriptionApi.upgrade(plan)
      subscription.value = data
      useNotificationStore().fetchUnreadCount()
      return data
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'Erro ao atualizar plano.'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchPlans() {
    if (plans.value) return plans.value
    try {
      const { data } = await subscriptionApi.getPlans()
      plans.value = data
      return data
    } catch {
      return null
    }
  }

  /** Start hosted Stripe Checkout and redirect the browser to it. */
  async function startCheckout(plan: PaidPlan, interval: BillingInterval) {
    error.value = null
    try {
      const { data } = await subscriptionApi.checkout(plan, interval)
      window.location.href = data.url
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'Não foi possível iniciar o pagamento.'
      throw e
    }
  }

  /** Open the Stripe Customer Portal (manage/cancel) and redirect to it. */
  async function openPortal() {
    error.value = null
    try {
      const { data } = await subscriptionApi.portal()
      window.location.href = data.url
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'Não foi possível abrir o portal de subscrição.'
      throw e
    }
  }

  /** Reconcile the local plan with Stripe after returning from Checkout. */
  async function syncFromStripe() {
    try {
      const { data } = await subscriptionApi.sync()
      subscription.value = data
      useNotificationStore().fetchUnreadCount()
      return data
    } catch {
      return null
    }
  }

  const limits = computed<SubscriptionLimits>(() => subscription.value?.limits ?? {
    accountsRemaining: null,
    incomeRemainingThisMonth: null,
    expensesRemainingThisMonth: null,
    objectivesEnabled: false,
    monthlyReportsEnabled: false,
    recurringEnabled: false,
    canInvite: false,
    needsPrimaryAccountSelection: false,
    primaryAccountId: null,
  })

  const plan = computed<SubscriptionPlan>(() => (subscription.value?.plan ?? 'Free') as SubscriptionPlan)

  const isFree = computed(() => plan.value === 'Free')

  const canAddAccount = computed(() => {
    if (plan.value !== 'Free') return true
    return (limits.value.accountsRemaining ?? 0) > 0
  })

  const canAddIncome = computed(() => {
    if (plan.value !== 'Free') return true
    return (limits.value.incomeRemainingThisMonth ?? 0) > 0
  })

  const canAddExpense = computed(() => {
    if (plan.value !== 'Free') return true
    return (limits.value.expensesRemainingThisMonth ?? 0) > 0
  })

  const canAccessObjectives = computed(() => limits.value.objectivesEnabled)
  const canAccessMonthlyReports = computed(
    () => limits.value.monthlyReportsEnabled ?? limits.value.objectivesEnabled,
  )
  const canAccessRecurring = computed(
    () => limits.value.recurringEnabled ?? limits.value.objectivesEnabled,
  )
  const canInvite = computed(() => limits.value.canInvite)

  return {
    subscription,
    plans,
    loading,
    error,
    plan,
    limits,
    isFree,
    canAddAccount,
    canAddIncome,
    canAddExpense,
    canAccessObjectives,
    canAccessMonthlyReports,
    canAccessRecurring,
    canInvite,
    fetchSubscription,
    upgrade,
    fetchPlans,
    startCheckout,
    openPortal,
    syncFromStripe,
  }
})

