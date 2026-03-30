import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSubscriptionStore } from '@/stores/subscription'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresAuth: false, guestOnly: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/RegisterView.vue'),
      meta: { requiresAuth: false, guestOnly: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'monthly',
          name: 'monthly-finance',
          component: () => import('@/views/MonthlyFinanceView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'household',
          name: 'household-settings',
          component: () => import('@/views/HouseholdSettingsView.vue'),
          meta: { requiresAuth: true, requiresCouplePlan: true },
        },
        {
          path: 'accounts',
          name: 'accounts',
          component: () => import('@/views/AccountsView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'transactions',
          name: 'transactions',
          component: () => import('@/views/TransactionsView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'objectives',
          name: 'objectives',
          component: () => import('@/views/ObjectivesView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'reports',
          name: 'reports',
          component: () => import('@/views/ReportsView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'subscription',
          name: 'subscription',
          component: () => import('@/views/SubscriptionView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/views/ProfileView.vue'),
          meta: { requiresAuth: true },
        },
      ],
    },
  ],
})

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()
  authStore.loadFromStorage()

  const isAuthenticated = authStore.isAuthenticated

  // Landing "/" não deve existir: encaminha sempre para o destino correto.
  if (to.path === '/') {
    if (isAuthenticated) next({ name: 'dashboard' })
    else next({ name: 'login' })
    return
  }

  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: 'login', query: { redirect: to.fullPath } })
    return
  }
  if (to.meta.guestOnly && isAuthenticated) {
    next({ name: 'dashboard' })
    return
  }

  if (to.meta.requiresCouplePlan && isAuthenticated) {
    const subscriptionStore = useSubscriptionStore()
    if (!subscriptionStore.subscription) {
      try {
        await subscriptionStore.fetchSubscription()
      } catch {
        /* ignore */
      }
    }
    if (subscriptionStore.plan !== 'Couple') {
      next({ name: 'dashboard' })
      return
    }
  }

  next()
})

export default router
