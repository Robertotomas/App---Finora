import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
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
import { useAuthStore } from '@/stores/auth'

/*
 * Último plano conhecido, por utilizador, em localStorage. Ao entrar na app a resposta da API demora
 * ~1 s; sem isto o plano caía no "Free" por omissão e o selo/avisos de upgrade piscavam.
 */
const PLAN_CACHE_PREFIX = 'finora_plan:'
const KNOWN_PLANS: SubscriptionPlan[] = ['Free', 'Pro', 'Couple']

function readCachedPlan(userId: string | undefined): SubscriptionPlan | null {
  if (!userId) return null
  try {
    const v = localStorage.getItem(PLAN_CACHE_PREFIX + userId) as SubscriptionPlan | null
    return v && KNOWN_PLANS.includes(v) ? v : null
  } catch {
    return null
  }
}
function writeCachedPlan(userId: string | undefined, plan: SubscriptionPlan) {
  if (!userId) return
  try {
    localStorage.setItem(PLAN_CACHE_PREFIX + userId, plan)
  } catch {
    /* privado/quota — ignora */
  }
}

export const useSubscriptionStore = defineStore('subscription', () => {
  const subscription = ref<SubscriptionMe | null>(null)
  const plans = ref<PlansResponse | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const authStore = useAuthStore()
  const userId = computed(() => authStore.user?.id)
  const cachedPlan = ref<SubscriptionPlan | null>(readCachedPlan(userId.value))
  // Outro utilizador (logout → login noutra conta): esquece a subscrição em memória e usa a cache dele.
  watch(userId, (id, old) => {
    if (id === old) return
    subscription.value = null
    cachedPlan.value = readCachedPlan(id)
  })
  // Sempre que a subscrição real chega/muda, memoriza o plano.
  watch(subscription, (s) => {
    if (!s?.plan) return
    cachedPlan.value = s.plan as SubscriptionPlan
    writeCachedPlan(userId.value, s.plan as SubscriptionPlan)
  })

  // Deduplica pedidos concorrentes (várias views montam e pedem a subscrição ao mesmo tempo).
  // Não altera quando é refrescada: cada chamada nova (após a anterior terminar) volta a ir à API.
  let inFlight: Promise<SubscriptionMe> | null = null

  function fetchSubscription() {
    if (inFlight) return inFlight
    loading.value = true
    error.value = null
    inFlight = (async () => {
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
        inFlight = null
      }
    })()
    return inFlight
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

  // Antes de a API responder, as permissões seguem o plano memorizado (Pro/Couple → funcionalidades
  // pagas visíveis), para não piscar o "Ver planos". O servidor continua a ser quem autoriza.
  const limits = computed<SubscriptionLimits>(() => {
    if (subscription.value?.limits) return subscription.value.limits
    const paid = cachedPlan.value === 'Pro' || cachedPlan.value === 'Couple'
    return {
      accountsRemaining: null,
      incomeRemainingThisMonth: null,
      expensesRemainingThisMonth: null,
      objectivesEnabled: paid,
      monthlyReportsEnabled: paid,
      recurringEnabled: paid,
      assetsEnabled: paid,
      investmentsEnabled: paid,
      canInvite: cachedPlan.value === 'Couple',
      needsPrimaryAccountSelection: false,
      primaryAccountId: null,
    }
  })

  const plan = computed<SubscriptionPlan>(
    () => (subscription.value?.plan ?? cachedPlan.value ?? 'Free') as SubscriptionPlan,
  )
  /** true quando já se sabe o plano (resposta da API ou plano memorizado deste utilizador). */
  const planKnown = computed(() => !!subscription.value?.plan || !!cachedPlan.value)

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
  const canAccessAssets = computed(
    () => limits.value.assetsEnabled ?? limits.value.objectivesEnabled,
  )
  const canAccessInvestments = computed(
    () => limits.value.investmentsEnabled ?? limits.value.objectivesEnabled,
  )
  const canInvite = computed(() => limits.value.canInvite)

  return {
    subscription,
    plans,
    loading,
    error,
    plan,
    planKnown,
    limits,
    isFree,
    canAddAccount,
    canAddIncome,
    canAddExpense,
    canAccessObjectives,
    canAccessMonthlyReports,
    canAccessRecurring,
    canAccessAssets,
    canAccessInvestments,
    canInvite,
    fetchSubscription,
    upgrade,
    fetchPlans,
    startCheckout,
    openPortal,
    syncFromStripe,
  }
})

