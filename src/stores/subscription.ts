import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { subscriptionApi } from '@/api/subscription'
import type { SubscriptionLimits, SubscriptionMe, SubscriptionPlan } from '@/types/subscription'
import { useNotificationStore } from '@/stores/notifications'

export const useSubscriptionStore = defineStore('subscription', () => {
  const subscription = ref<SubscriptionMe | null>(null)
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

  const limits = computed<SubscriptionLimits>(() => subscription.value?.limits ?? {
    accountsRemaining: null,
    incomeRemainingThisMonth: null,
    expensesRemainingThisMonth: null,
    objectivesEnabled: false,
    monthlyReportsEnabled: false,
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
  const canInvite = computed(() => limits.value.canInvite)

  return {
    subscription,
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
    canInvite,
    fetchSubscription,
    upgrade,
  }
})

