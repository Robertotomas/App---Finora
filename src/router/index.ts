import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'entrar',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresAuth: false, guestOnly: true },
    },
    {
      path: '/register',
      name: 'registar',
      component: () => import('@/views/RegisterView.vue'),
      meta: { requiresAuth: false, guestOnly: true },
    },
    {
      path: '/reset-password',
      name: 'redefinir-password',
      component: () => import('@/views/ResetPasswordView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/confirm-email',
      name: 'confirmar-email',
      component: () => import('@/views/ConfirmEmailView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/subscription',
      name: 'subscricao',
      component: () => import('@/views/SubscriptionView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      children: [
        {
          path: 'overview',
          name: 'inicio',
          component: () => import('@/views/DashboardView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'monthly-plan',
          name: 'plano-mensal',
          component: () => import('@/views/MonthlyFinanceView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'household',
          name: 'agregado',
          component: () => import('@/views/HouseholdSettingsView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'accounts',
          name: 'contas',
          component: () => import('@/views/AccountsView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'assets',
          name: 'bens-valores',
          component: () => import('@/views/AssetsView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'assets/:id',
          name: 'bem-detalhe',
          component: () => import('@/views/AssetDetailView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'investments',
          name: 'investimentos',
          component: () => import('@/views/InvestmentsView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'investments/:id',
          name: 'investimento-detalhe',
          component: () => import('@/views/InvestmentDetailView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'transactions',
          name: 'movimentos',
          component: () => import('@/views/TransactionsView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'goals',
          name: 'objetivos',
          component: () => import('@/views/ObjectivesView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'reports',
          name: 'relatorios',
          component: () => import('@/views/ReportsView.vue'),
          meta: { requiresAuth: true },
        },
        {
          path: 'profile',
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

/** Título do separador por rota → "<Página> | FinoraFlow". */
const ROUTE_TITLES: Record<string, string> = {
  entrar: 'Entrar',
  registar: 'Registar',
  'redefinir-password': 'Redefinir palavra-passe',
  'confirmar-email': 'Confirmar email',
  subscricao: 'Subscrição',
  inicio: 'Visão Geral',
  'plano-mensal': 'Plano Mensal',
  agregado: 'Agregado',
  contas: 'Contas',
  'bens-valores': 'Bens e Valores',
  'bem-detalhe': 'Bens e Valores',
  investimentos: 'Investimentos',
  'investimento-detalhe': 'Investimentos',
  movimentos: 'Movimentos',
  objetivos: 'Objetivos',
  relatorios: 'Relatórios',
  perfil: 'Perfil',
}

router.afterEach((to) => {
  let title = typeof to.name === 'string' ? ROUTE_TITLES[to.name] : undefined
  // Movimentos: distingue a tab (Dashboard / Movimentos / Recorrentes) pelo ?tab=
  if (to.name === 'movimentos') {
    const tab = to.query.tab
    title = tab === 'recurring' ? 'Recorrentes' : tab === 'movements' ? 'Movimentos' : 'Dashboard'
  }
  document.title = title ? `${title} | FinoraFlow` : 'FinoraFlow'
})

export default router
