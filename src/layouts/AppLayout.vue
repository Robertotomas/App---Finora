<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useHouseholdStore } from '@/stores/household'
import { useSubscriptionStore } from '@/stores/subscription'
import iconMale from '@/assets/images/icon-male.png'
import iconFinoraFlow from '@/assets/images/finoraflow-icon.png'
import PartnerLeftModal from '@/components/PartnerLeftModal.vue'
import NotificationBell from '@/components/NotificationBell.vue'
import GlobalSearch from '@/components/GlobalSearch.vue'
import { useNotificationStore } from '@/stores/notifications'

const authStore = useAuthStore()
const themeStore = useThemeStore()
const householdStore = useHouseholdStore()
const subscriptionStore = useSubscriptionStore()
const notificationStore = useNotificationStore()
const route = useRoute()
const router = useRouter()
const userMenuOpen = ref(false)
const quickActionOpen = ref(false)

function toggleQuickAction() {
  quickActionOpen.value = !quickActionOpen.value
}

function quickAction(path: string) {
  quickActionOpen.value = false
  router.push(path)
}

const SIDEBAR_KEY = 'finora-sidebar-collapsed'
const sidebarCollapsed = ref(localStorage.getItem(SIDEBAR_KEY) === 'true')

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  localStorage.setItem(SIDEBAR_KEY, String(sidebarCollapsed.value))
}


function logout() {
  userMenuOpen.value = false
  authStore.logout()
  router.replace({ name: 'entrar' })
}

function toggleMenu() {
  userMenuOpen.value = !userMenuOpen.value
}

onMounted(async () => {
  if (authStore.isAuthenticated) {
    try {
      await Promise.all([
        householdStore.fetchHousehold(),
        subscriptionStore.fetchSubscription(),
      ])
    } catch {
      /* handled in store */
    }
  }
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as Element
    if (userMenuOpen.value && !target.closest('.user-menu')) {
      userMenuOpen.value = false
    }
    if (quickActionOpen.value && !target.closest('.quick-action-menu')) {
      quickActionOpen.value = false
    }
  }
  document.addEventListener('click', handleClickOutside)

  if (authStore.isAuthenticated) {
    notificationStore.startPolling()
  }

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
    notificationStore.stopPolling()
  })
})

const planLabel = computed(() => {
  return subscriptionStore.plan
})

const planManageLabel = computed(() =>
  subscriptionStore.plan === 'Free' ? 'Atualizar plano' : 'Gerir plano',
)

function goToSubscription() {
  userMenuOpen.value = false
  router.push({ name: 'subscricao' })
}

function goToProfile() {
  userMenuOpen.value = false
  router.push({ name: 'perfil' })
}

function goToHousehold() {
  userMenuOpen.value = false
  router.push({ name: 'agregado' })
}

/** Household: plano Couple OU agregado ainda tipo casal (ex.: após mudar para Free/Pro — precisas disto para sair do casal). */
const showHouseholdInUserMenu = computed(
  () =>
    subscriptionStore.plan === 'Couple' ||
    householdStore.isCouple ||
    householdStore.hasPartnerLeftNotice,
)

const movimentsSubItems = [
  { to: '/transactions?tab=dashboard', label: 'Dashboard', tabKey: 'dashboard' },
  { to: '/transactions?tab=movements', label: 'Movimentos', tabKey: 'movements' },
  { to: '/transactions?tab=recurring', label: 'Recorrentes', tabKey: 'recurring' },
]

const patrimonioItems = [
  { to: '/accounts', label: 'Contas', icon: 'wallet', comingSoon: false },
  { to: '/investments', label: 'Investimentos', icon: 'trending', comingSoon: false },
  { to: '/assets', label: 'Bens e Valores', icon: 'gem', comingSoon: false },
]

const toolsItems = [
  { to: '/reports', label: 'Relatórios' },
]

function isMovimentsSubActive(tabKey: string) {
  if (!route.path.startsWith('/transactions')) return false
  const tab = route.query.tab as string | undefined
  if (tabKey === 'dashboard') return !tab || tab === 'dashboard'
  return tab === tabKey
}

function isActive(path: string) {
  if (path === '/overview') return route.path === '/overview'
  return route.path.startsWith(path)
}

</script>

<template>
  <div class="app-layout">
    <!-- Barra superior - largura total -->
    <header class="top-header">
      <button v-if="sidebarCollapsed && authStore.isAuthenticated" type="button" class="sidebar-expand-btn" @click="toggleSidebar" title="Expandir">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="6" y2="6"/><line x1="3" x2="21" y1="12" y2="12"/><line x1="3" x2="21" y1="18" y2="18"/></svg>
      </button>
      <RouterLink to="/overview" class="header-brand" aria-label="FinoraFlow — ir para o painel">
        <img
          :src="iconFinoraFlow"
          alt="FinoraFlow"
          class="header-brand-img"
          width="800"
          height="200"
        />
      </RouterLink>
      <div class="header-actions">
          <!-- Quick action + button -->
          <div v-if="authStore.isAuthenticated" class="quick-action-menu">
            <button type="button" class="quick-action-btn" title="Ação rápida" @click.stop="toggleQuickAction">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
            </button>
            <Transition name="dropdown">
              <div v-show="quickActionOpen" class="quick-action-dropdown">
                <button type="button" class="quick-action-item" @click="quickAction('/transactions?tab=movements&action=new')">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="7" x2="7" y1="18" y2="6"/><polyline points="3 10 7 6 11 10"/><line x1="17" x2="17" y1="6" y2="18"/><polyline points="13 14 17 18 21 14"/></svg>
                  Movimento
                </button>
                <button type="button" class="quick-action-item" @click="quickAction('/transactions?tab=recurring&action=new')">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Recorrente
                </button>
                <button type="button" class="quick-action-item" @click="quickAction('/accounts?action=new')">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/><circle cx="17" cy="15" r="1.5"/></svg>
                  Conta
                </button>
                <button type="button" class="quick-action-item" @click="quickAction('/assets?action=new')">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/></svg>
                  Bem e valor
                </button>
                <button type="button" class="quick-action-item" @click="quickAction('/investments?action=new')">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                  Investimento
                </button>
                <button type="button" class="quick-action-item" @click="quickAction('/goals?tab=active&action=new')">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><line x1="22" x2="12" y1="2" y2="12"/></svg>
                  Objetivo
                </button>
                <button type="button" class="quick-action-item" @click="quickAction('/monthly-plan')">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
                  Plano Mensal
                </button>
              </div>
            </Transition>
          </div>

          <!-- Notification bell -->
          <NotificationBell v-if="authStore.isAuthenticated" />

        <GlobalSearch v-if="authStore.isAuthenticated" class="header-search" />

          <div class="user-menu">
            <button
              type="button"
              class="user-trigger"
              @click.stop="toggleMenu"
            >
              <img
                v-if="authStore.isAuthenticated"
                :src="iconMale"
                alt=""
                class="user-avatar"
              />
              <span v-if="authStore.isAuthenticated" class="user-name">
                {{ authStore.user?.firstName }} {{ authStore.user?.lastName }}
              </span>
              <span v-else class="user-name">Visitante</span>
            </button>
            <Transition name="dropdown">
              <div v-show="userMenuOpen" class="user-dropdown">
                <!-- Cabeçalho de perfil -->
                <div v-if="authStore.isAuthenticated" class="dropdown-profile">
                  <img :src="iconMale" alt="" class="dropdown-profile-avatar" />
                  <div class="dropdown-profile-info">
                    <span class="dropdown-profile-name">{{ authStore.user?.firstName }} {{ authStore.user?.lastName }}</span>
                    <span class="dropdown-profile-email">{{ authStore.user?.email }}</span>
                  </div>
                </div>

                <template v-if="authStore.isAuthenticated">
                  <div class="dropdown-divider" />

                  <!-- Gerir / atualizar plano -->
                  <button type="button" class="dropdown-item" @click="goToSubscription">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m16 12-4-4-4 4"/><path d="M12 16V8"/></svg>
                    <span class="dropdown-item-label">{{ planManageLabel }}</span>
                  </button>

                  <!-- Perfil -->
                  <button type="button" class="dropdown-item" @click="goToProfile">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <span class="dropdown-item-label">Perfil</span>
                  </button>

                  <!-- Agregado -->
                  <button v-if="showHouseholdInUserMenu" type="button" class="dropdown-item" @click="goToHousehold">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    <span class="dropdown-item-label">Agregado</span>
                  </button>

                  <div class="dropdown-divider" />

                  <!-- Aparência (tema sempre visível) -->
                  <span class="dropdown-section-label">Aparência</span>
                  <button type="button" class="dropdown-item" :class="{ active: themeStore.mode === 'light' }" @click="themeStore.setMode('light')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                    <span class="dropdown-item-label">Claro</span>
                    <svg v-if="themeStore.mode === 'light'" class="dropdown-check" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
                  <button type="button" class="dropdown-item" :class="{ active: themeStore.mode === 'dark' }" @click="themeStore.setMode('dark')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                    <span class="dropdown-item-label">Escuro</span>
                    <svg v-if="themeStore.mode === 'dark'" class="dropdown-check" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
                  <button type="button" class="dropdown-item" :class="{ active: themeStore.mode === 'system' }" @click="themeStore.setMode('system')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
                    <span class="dropdown-item-label">Sistema</span>
                    <svg v-if="themeStore.mode === 'system'" class="dropdown-check" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>

                  <div class="dropdown-divider" />

                  <!-- Terminar sessão -->
                  <button type="button" class="dropdown-item dropdown-logout" @click="logout">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                    <span class="dropdown-item-label">Terminar sessão</span>
                  </button>
                </template>

                <!-- Visitante: apenas tema -->
                <template v-else>
                  <span class="dropdown-section-label">Aparência</span>
                  <button type="button" class="dropdown-item" :class="{ active: themeStore.mode === 'light' }" @click="themeStore.setMode('light')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                    <span class="dropdown-item-label">Claro</span>
                    <svg v-if="themeStore.mode === 'light'" class="dropdown-check" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
                  <button type="button" class="dropdown-item" :class="{ active: themeStore.mode === 'dark' }" @click="themeStore.setMode('dark')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                    <span class="dropdown-item-label">Escuro</span>
                    <svg v-if="themeStore.mode === 'dark'" class="dropdown-check" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
                  <button type="button" class="dropdown-item" :class="{ active: themeStore.mode === 'system' }" @click="themeStore.setMode('system')">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
                    <span class="dropdown-item-label">Sistema</span>
                    <svg v-if="themeStore.mode === 'system'" class="dropdown-check" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
                </template>
              </div>
            </Transition>
          </div>
        </div>
      </header>

    <!-- Sidebar + conteúdo (abaixo da barra superior) -->
    <div class="content-row">
      <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
        <div v-if="authStore.isAuthenticated" class="sidebar-plan">
          <RouterLink
            :to="{ name: 'subscricao' }"
            class="sidebar-plan-link"
            aria-label="Ver planos e subscrição"
          >
            {{ planLabel }}
          </RouterLink>
          <span v-if="!sidebarCollapsed && subscriptionStore.plan === 'Couple' && householdStore.household?.name" class="sidebar-household-name">
            {{ householdStore.household.name }}
          </span>
          <button v-if="!sidebarCollapsed" type="button" class="sidebar-collapse-btn" @click="toggleSidebar" title="Minimizar">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
          </button>
        </div>
        <nav v-if="authStore.isAuthenticated" class="sidebar-nav">
          <!-- Top items (Dashboard, Plano Mensal) -->
          <RouterLink
            to="/overview"
            class="sidebar-link"
            :class="{ active: isActive('/overview') }"
          >
            <span class="sidebar-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </span>
            <span class="sidebar-label">Início</span>
          </RouterLink>

          <!-- Section: Planeamento -->
          <div class="sidebar-section">
            <span class="sidebar-section-title">Planeamento</span>
            <RouterLink
              to="/monthly-plan"
              class="sidebar-link"
              :class="{ active: isActive('/monthly-plan') }"
            >
              <span class="sidebar-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
              </span>
              <span class="sidebar-label">Plano Mensal</span>
            </RouterLink>
            <RouterLink
              to="/goals"
              class="sidebar-link"
              :class="{ active: isActive('/goals') }"
            >
              <span class="sidebar-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><line x1="22" x2="12" y1="2" y2="12"/></svg>
              </span>
              <span class="sidebar-label">Objetivos</span>
            </RouterLink>
          </div>

          <!-- Section: Movimentos -->
          <div class="sidebar-section">
            <span class="sidebar-section-title">Atividade</span>
            <RouterLink
              v-for="sub in movimentsSubItems"
              :key="sub.tabKey"
              :to="sub.to"
              class="sidebar-link"
              :class="{ active: isMovimentsSubActive(sub.tabKey) }"
            >
              <span class="sidebar-icon">
                <svg v-if="sub.tabKey === 'dashboard'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
                <svg v-else-if="sub.tabKey === 'movements'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="7" x2="7" y1="18" y2="6"/><polyline points="3 10 7 6 11 10"/><line x1="17" x2="17" y1="6" y2="18"/><polyline points="13 14 17 18 21 14"/></svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </span>
              <span class="sidebar-label">{{ sub.label }}</span>
            </RouterLink>
          </div>

          <!-- Section: Património -->
          <div class="sidebar-section">
            <span class="sidebar-section-title">Património</span>
            <template v-for="item in patrimonioItems" :key="item.label">
              <RouterLink
                v-if="!item.comingSoon"
                :to="item.to"
                class="sidebar-link"
                :class="{ active: isActive(item.to) }"
              >
                <span class="sidebar-icon">
                  <svg v-if="item.icon === 'wallet'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/><circle cx="17" cy="15" r="1.5"/></svg>
                  <svg v-else-if="item.icon === 'trending'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                  <svg v-else-if="item.icon === 'gem'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M2 9h20"/><path d="m10 3 2 6"/><path d="m14 3-2 6"/><path d="m6.5 9 5.5 13"/><path d="m17.5 9-5.5 13"/></svg>
                </span>
                <span class="sidebar-label">{{ item.label }}</span>
              </RouterLink>
              <span v-else class="sidebar-link sidebar-link--disabled">
                <span class="sidebar-icon">
                  <svg v-if="item.icon === 'trending'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                  <svg v-else-if="item.icon === 'gem'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M2 9h20"/><path d="m10 3 2 6"/><path d="m14 3-2 6"/><path d="m6.5 9 5.5 13"/><path d="m17.5 9-5.5 13"/></svg>
                </span>
                <span class="sidebar-label">{{ item.label }}</span>
                <span class="coming-soon-badge">Em breve</span>
              </span>
            </template>
          </div>

          <!-- Section: Ferramentas -->
          <div class="sidebar-section">
            <span class="sidebar-section-title">Ferramentas</span>
            <RouterLink
              v-for="item in toolsItems"
              :key="item.to"
              :to="item.to"
              class="sidebar-link"
              :class="{ active: isActive(item.to) }"
            >
              <span class="sidebar-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
              </span>
              <span class="sidebar-label">{{ item.label }}</span>
            </RouterLink>
          </div>
        </nav>
        <div v-else class="sidebar-guest">
          <RouterLink to="/login" class="sidebar-link">Entrar</RouterLink>
          <RouterLink to="/register" class="sidebar-link btn-register">Registar</RouterLink>
        </div>
      </aside>

      <main class="main-content">
        <RouterView />
      </main>
    </div>

    <PartnerLeftModal v-if="authStore.isAuthenticated" />
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--color-bg);
}

.content-row {
  display: flex;
  flex: 1;
  min-height: 0;
}

/* Sidebar lateral - premium gradient */
.sidebar {
  width: 240px;
  min-width: 240px;
  background: #166534;
  color: var(--color-sidebar-text);
  display: flex;
  flex-direction: column;
  border-right: none;
  box-shadow: var(--color-sidebar-edge-shadow);
  position: relative;
  z-index: 1;
}

html.dark .sidebar {
  background: linear-gradient(180deg, #161616 0%, #0d0d0d 100%);
}

.sidebar-plan {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 0.875rem 0.875rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.sidebar-plan-link {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #ffffff;
  text-decoration: none;
  cursor: pointer;
  outline: none;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 999px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  transition: background 0.15s;
}

.sidebar-plan-link:hover,
.sidebar-plan-link:focus-visible {
  background: rgba(255, 255, 255, 0.25);
  text-decoration: none;
}

.sidebar-household-name {
  font-size: 0.6875rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.45);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.02em;
  flex: 1;
  min-width: 0;
}

.sidebar-nav {
  flex: 1;
  padding: 1rem 0.75rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  overflow: hidden;
  position: relative;
}

.sidebar-link {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 0.875rem;
  border-left: none;
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.75);
  text-decoration: none;
  font-size: 0.8125rem;
  font-weight: 500;
  transition: background 0.15s ease, color 0.15s ease;
  letter-spacing: 0.01em;
}

.sidebar-link:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.sidebar-link.active {
  background: rgba(255, 255, 255, 0.18);
  color: #ffffff;
  font-weight: 600;
  border-left: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

html.dark .sidebar-link.active {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.sidebar-link--disabled {
  opacity: 0.5;
  cursor: default;
  pointer-events: none;
}

.sidebar-link--disabled .sidebar-label {
  white-space: nowrap;
}

.coming-soon-badge {
  margin-left: auto;
  font-size: 0.5rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  background: rgba(255, 255, 255, 0.15);
  color: rgba(255, 255, 255, 0.7);
  padding: 1px 4px;
  border-radius: 3px;
  line-height: 1.3;
  flex-shrink: 0;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  margin-top: 0.75rem;
}

.sidebar-section-title {
  display: block;
  padding: 0.25rem 0.875rem 0.375rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
  user-select: none;
}

.sidebar-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  font-size: 1rem;
}

.sidebar-icon svg {
  width: 17px;
  height: 17px;
}

.sidebar-nav-icon {
  width: 25px;
  height: 25px;
  object-fit: contain;
}

.sidebar-nav-icon-sm {
  width: 25px;
  height: 25px;
}

.sidebar-nav-icon-lg {
  width: 26px;
  height: 26px;
}

/* Ícone alvo em preto: no tema escuro inverter para contraste com a sidebar */
html.dark .sidebar-nav-icon-objectives {
  filter: brightness(0) invert(1);
  opacity: 0.95;
}

html.dark .sidebar-nav-icon-reports {
  filter: brightness(0) invert(1);
  opacity: 0.95;
}

.sidebar-label {
  flex: 1;
}

.sidebar-footer {
  padding: 0.875rem;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.btn-sidebar {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.btn-sidebar:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

.sidebar-guest .sidebar-link {
  color: var(--color-sidebar-text);
}

.sidebar-guest .sidebar-link:hover {
  background: var(--color-sidebar-hover);
}

.sidebar-guest {
  padding: 1rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sidebar-guest .btn-register {
  background: var(--color-sidebar-hover);
  text-align: center;
  border-radius: 6px;
}

.sidebar-guest .btn-register:hover {
  background: var(--color-sidebar-active);
}

/* Barra fixa — refinada */
.top-header {
  --top-bar-height: 60px;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0 1rem;
  height: var(--top-bar-height);
  min-height: var(--top-bar-height);
  max-height: var(--top-bar-height);
  box-sizing: border-box;
  background: var(--color-header-bg);
  border-bottom: 1px solid var(--color-header-border);
  box-shadow: none;
  flex-shrink: 0;
}

.header-brand {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  height: auto;
  line-height: 0;
  text-decoration: none;
  cursor: pointer;
  background: transparent;
  margin-left: 0.375rem;
}

.header-brand:hover {
  opacity: 0.88;
}

.header-brand-img {
  display: block;
  width: auto;
  height: auto;
  /* Logo completo (ícone + FinoraFlow) */
  max-height: 44px;
  max-width: min(210px, 54vw);
  object-fit: contain;
  object-position: left center;
  background: transparent;
}

/* Modo escuro: wordmark a branco sólido — limpo e legível no preto */
html.dark .header-brand-img {
  filter: brightness(0) invert(1);
}

.header-search {
  max-width: min(200px, 26vw);
  flex-shrink: 1;
}

.search-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  border: 1px solid var(--color-input-border);
  border-radius: 8px;
  background: var(--color-input-bg);
  color: var(--color-text);
  outline: none;
}

.search-input::placeholder {
  color: var(--color-text-muted);
}

.search-input:focus {
  border-color: var(--color-link-hover);
}

/* Pesquisa na barra superior */
.top-header .search-input {
  padding: 0.4rem 0.75rem 0.4rem 2rem;
  font-size: 0.8125rem;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.top-header .search-input::placeholder {
  color: var(--color-text-muted);
}

.top-header .search-input:focus {
  border-color: #166534;
  box-shadow: 0 0 0 3px rgba(22, 101, 52, 0.08);
}

.top-header .user-trigger {
  color: var(--color-text);
}

.top-header .user-trigger:hover {
  color: var(--color-text-muted);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-left: auto;
}

.header-actions .search-input {
  width: 100%;
}

/* ── Quick action button ── */
.quick-action-menu {
  position: relative;
}

.quick-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  padding: 0 8px;
  border: none;
  border-radius: 6px;
  background: #166534;
  color: #fff;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
}

.quick-action-btn:hover {
  background: #15803d;
  transform: scale(1.05);
}

.quick-action-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 200px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  padding: 0.5rem;
  z-index: 200;
}

.quick-action-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text);
  background: none;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.12s;
}

.quick-action-item:hover {
  background: var(--color-table-row-hover);
}

.quick-action-item svg {
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.user-menu {
  position: relative;
}

.user-trigger {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.25rem 0;
  font-size: 0.9375rem;
  font-weight: 650;
  color: var(--color-text);
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.15s;
  font-family: inherit;
}

.user-trigger:hover {
  color: var(--color-text-muted);
}

.user-avatar {
  width: 34px;
  height: 34px;
  object-fit: contain;
  border-radius: 50%;
  border: none;
  padding: 0;
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  min-width: 244px;
  max-width: 280px;
  padding: 0.375rem;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 8px 30px -4px rgba(15, 23, 42, 0.15), 0 4px 12px -2px rgba(15, 23, 42, 0.08);
  z-index: 100;
}

/* Cabeçalho de perfil */
.dropdown-profile {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.625rem 0.75rem 0.5rem;
}

.dropdown-profile-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: contain;
  flex-shrink: 0;
}

html.dark .dropdown-profile-avatar {
  filter: invert(1);
}

.dropdown-profile-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dropdown-profile-name {
  font-size: 0.8125rem;
  font-weight: 650;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-profile-email {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Título de secção (Aparência) */
.dropdown-section-label {
  display: block;
  padding: 0.375rem 0.75rem 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

/* Check da opção ativa */
.dropdown-check {
  flex-shrink: 0;
  color: #166534;
}

html.dark .dropdown-check {
  color: #4ade80;
}

.dropdown-divider {
  height: 1px;
  background: var(--color-border);
  margin: 0.25rem 0.5rem;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  color: var(--color-text);
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  text-align: left;
  font-weight: 500;
  font-family: inherit;
}

.dropdown-item > svg {
  flex-shrink: 0;
  color: var(--color-text-muted);
  transition: color 0.15s;
}

.dropdown-item-label {
  flex: 1;
}

.dropdown-item:hover {
  background: var(--color-table-row-hover);
}

.dropdown-item:hover > svg {
  color: var(--color-text);
}

.dropdown-item.active {
  color: #166534;
  font-weight: 650;
}

.dropdown-item.active > svg {
  color: #166534;
}

html.dark .dropdown-item.active,
html.dark .dropdown-item.active > svg {
  color: #4ade80;
}

.dropdown-logout:hover {
  background: rgba(220, 38, 38, 0.06);
  color: var(--color-expense);
}

.dropdown-logout:hover > svg {
  color: var(--color-expense);
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.15s, transform 0.1s;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.user-name {
  font-size: 0.9375rem;
  font-weight: 700;
  color: inherit;
  font-family: inherit;
}

/* Conteúdo principal — padding / max-width em app-shell.css */
.main-content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.main-content::-webkit-scrollbar {
  display: none;
}

/* ─── Sidebar collapse toggle ─── */
.sidebar-collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  margin-left: auto;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: color 0.15s ease;
  flex-shrink: 0;
}

.sidebar-collapse-btn:hover {
  color: #fff;
}

.sidebar-expand-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color 0.15s ease, background 0.15s ease;
}

.sidebar-expand-btn:hover {
  color: var(--color-text);
  background: rgba(0, 0, 0, 0.06);
}

html.dark .sidebar-expand-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}

/* ─── Collapsed sidebar ─── */
.sidebar.collapsed {
  width: 68px;
  min-width: 68px;
  transition: width 0.25s ease, min-width 0.25s ease;
}

.sidebar:not(.collapsed) {
  transition: width 0.25s ease, min-width 0.25s ease;
}

.sidebar.collapsed .sidebar-label {
  display: none;
}

.sidebar.collapsed .sidebar-section-title {
  display: none;
}

.sidebar.collapsed .sidebar-plan {
  padding: 0.75rem 0.5rem;
  justify-content: center;
}

.sidebar.collapsed .coming-soon-badge {
  display: none;
}

.sidebar.collapsed .sidebar-household-name {
  display: none;
}

.sidebar.collapsed .sidebar-plan-link {
  padding: 0.2rem 0.5rem;
  font-size: 0.625rem;
}

.sidebar.collapsed .sidebar-nav {
  padding: 1rem 0.5rem 0.5rem;
  align-items: center;
}

.sidebar.collapsed .sidebar-link {
  justify-content: center;
  padding: 0.6rem;
  width: 44px;
  height: 44px;
}

.sidebar.collapsed .sidebar-icon {
  width: 24px;
  height: 24px;
}

.sidebar.collapsed .sidebar-footer {
  padding: 0.75rem 0.5rem;
}

.sidebar.collapsed .btn-sidebar {
  padding: 0.5rem;
  justify-content: center;
}

.sidebar.collapsed .sidebar-section {
  margin-top: 0.25rem;
}

/* ─── Mobile: sidebar collapses ─── */
@media (max-width: 768px) {
  .content-row {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    min-width: 100%;
    flex-direction: row;
    overflow-x: auto;
    box-shadow: none;
    border-right: none;
    border-bottom: 1px solid var(--color-sidebar-border);
    padding: 0;
  }

  .sidebar-plan {
    display: none;
  }

  .sidebar-collapse-btn,
  .sidebar-expand-btn {
    display: none;
  }

  .sidebar.collapsed {
    width: 100%;
    min-width: 100%;
  }

  .sidebar.collapsed .sidebar-label {
    display: inline;
  }

  .sidebar-section {
    flex-direction: row;
    margin-top: 0;
  }

  .sidebar-section-title {
    display: none;
  }

  .sidebar-nav {
    flex-direction: row;
    padding: 0.5rem 0.75rem;
    gap: 0.125rem;
    overflow-x: auto;
    flex: unset;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    flex-wrap: nowrap;
  }

  .sidebar-nav::-webkit-scrollbar {
    display: none;
  }

  .sidebar-link {
    padding: 0.5rem 0.75rem;
    border-left: none;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    white-space: nowrap;
    font-size: 0.8125rem;
    gap: 0.5rem;
  }

  .sidebar-link.active {
    border-bottom-color: rgba(255, 255, 255, 0.95);
    background: rgba(255, 255, 255, 0.1);
    box-shadow: none;
  }

  .sidebar-icon {
    width: 22px;
    height: 22px;
    background: none;
    border-radius: 0;
  }

  .sidebar-nav-icon {
    width: 20px;
    height: 20px;
  }

  .sidebar-nav-icon-lg {
    width: 21px;
    height: 21px;
  }

  .sidebar-footer {
    display: none;
  }

  .sidebar-guest {
    flex-direction: row;
    padding: 0.5rem 0.75rem;
  }

  .top-header {
    --top-bar-height: 56px;
    padding: 0 0.75rem;
  }

  .header-brand-img {
    max-height: 38px;
    max-width: min(175px, 40vw);
  }

  .header-search {
    display: none;
  }

  .user-name {
    display: none;
  }

  .user-dropdown {
    right: -0.5rem;
    min-width: 180px;
  }
}

/* ─── Tablet: slightly narrower sidebar ─── */
@media (min-width: 769px) and (max-width: 1024px) {
  .sidebar {
    width: 200px;
    min-width: 200px;
  }

  .sidebar-link {
    padding: 0.5rem 1.125rem;
    font-size: 0.8125rem;
  }
}
</style>
