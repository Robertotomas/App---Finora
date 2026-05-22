import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/entrar',
      name: 'entrar',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresAuth: false, guestOnly: true },
    },
    {
      path: '/registar',
      name: 'registar',
      component: () => import('@/views/RegisterView.vue'),
      meta: { requiresAuth: false, guestOnly: true },
    },
    {
      path: '/subscricao',
      name: 'subscricao',
      component: () => import('@/views/SubscriptionView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        {
          path: 'inicio',
          name: 'inicio',
          component: () => import('@/views/DashboardView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'plano-mensal',
          name: 'plano-mensal',
          component: () => import('@/views/MonthlyFinanceView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'agregado',
          name: 'agregado',
          component: () => import('@/views/HouseholdSettingsView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'contas',
          name: 'contas',
          component: () => import('@/views/AccountsView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'movimentos',
          name: 'movimentos',
          component: () => import('@/views/TransactionsView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'objetivos',
          name: 'objetivos',
          component: () => import('@/views/ObjectivesView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'relatorios',
          name: 'relatorios',
          component: () => import('@/views/ReportsView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'perfil',
          name: 'perfil',
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
    if (isAuthenticated) next({ name: 'inicio' })
    else next({ name: 'entrar' })
    return
  }

  if (to.meta.requiresAuth && !isAuthenticated) {
    next({ name: 'entrar', query: { redirect: to.fullPath } })
    return
  }
  if (to.meta.guestOnly && isAuthenticated) {
    next({ name: 'inicio' })
    return
  }

  next()
})

export default router
