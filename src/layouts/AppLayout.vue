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

const authStore = useAuthStore()
const themeStore = useThemeStore()
const householdStore = useHouseholdStore()
const subscriptionStore = useSubscriptionStore()
const route = useRoute()
const router = useRouter()
const userMenuOpen = ref(false)

const SIDEBAR_KEY = 'finora-sidebar-collapsed'
const sidebarCollapsed = ref(localStorage.getItem(SIDEBAR_KEY) === 'true')

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  localStorage.setItem(SIDEBAR_KEY, String(sidebarCollapsed.value))
}

function openMoviments() {
  if (sidebarCollapsed.value) {
    sidebarCollapsed.value = false
    localStorage.setItem(SIDEBAR_KEY, 'false')
  }
  movimentsOpen.value = true
}

function logout() {
  userMenuOpen.value = false
  authStore.logout()
  router.replace({ name: 'login' })
}

function setTheme(dark: boolean) {
  if (themeStore.isDark !== dark) {
    themeStore.toggle()
  }
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
  }
  document.addEventListener('click', handleClickOutside)
  onUnmounted(() => document.removeEventListener('click', handleClickOutside))
})

const planLabel = computed(() => {
  return subscriptionStore.plan
})

const planManageLabel = computed(() =>
  subscriptionStore.plan === 'Free' ? 'Atualizar plano' : 'Gerir plano',
)

function goToSubscription() {
  userMenuOpen.value = false
  router.push({ name: 'subscription' })
}

function goToProfile() {
  userMenuOpen.value = false
  router.push({ name: 'profile' })
}

function goToHousehold() {
  userMenuOpen.value = false
  router.push({ name: 'household-settings' })
}

/** Household: plano Couple OU agregado ainda tipo casal (ex.: após mudar para Free/Pro — precisas disto para sair do casal). */
const showHouseholdInUserMenu = computed(
  () =>
    subscriptionStore.plan === 'Couple' ||
    householdStore.isCouple ||
    householdStore.hasPartnerLeftNotice,
)

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/monthly', label: 'Plano Mensal' },
  { to: '/accounts', label: 'Contas' },
  { to: '/objectives', label: 'Objetivos' },
  { to: '/reports', label: 'Relatórios' },
]

const movimentsOpen = ref(false)
const isMovimentsActive = computed(() => route.path.startsWith('/transactions'))

const movimentsSubItems = [
  { to: '/transactions?tab=summary', label: 'Resumo', tabKey: 'summary' },
  { to: '/transactions?tab=transactions', label: 'Transações', tabKey: 'transactions' },
  { to: '/transactions?tab=recurring', label: 'Recorrentes', tabKey: 'recurring' },
]


function isMovimentsSubActive(tabKey: string) {
  if (!route.path.startsWith('/transactions')) return false
  const tab = route.query.tab as string | undefined
  if (tabKey === 'summary') return !tab || tab === 'summary'
  return tab === tabKey
}

function isActive(path: string) {
  if (path === '/dashboard') return route.path === '/dashboard'
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
      <RouterLink to="/dashboard" class="header-brand" aria-label="FinoraFlow — ir para o painel">
        <img
          :src="iconFinoraFlow"
          alt="FinoraFlow"
          class="header-brand-img"
          width="800"
          height="200"
        />
      </RouterLink>
      <div class="header-actions">
        <div class="header-search">
          <input type="text" placeholder="Pesquisar..." class="search-input" />
        </div>
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
                <div class="dropdown-section">
                  <span class="dropdown-label">Tema</span>
                  <div class="theme-options">
                    <button
                      type="button"
                      class="theme-btn"
                      :class="{ active: !themeStore.isDark }"
                      title="Modo claro"
                      @click="setTheme(false)"
                    >
                      ☀️
                    </button>
                    <button
                      type="button"
                      class="theme-btn"
                      :class="{ active: themeStore.isDark }"
                      title="Modo escuro"
                      @click="setTheme(true)"
                    >
                      🌙
                    </button>
                  </div>
                </div>
                <template v-if="authStore.isAuthenticated">
                  <div class="dropdown-divider" />
                  <button
                    type="button"
                    class="dropdown-item"
                    @click="goToProfile"
                  >
                    Perfil
                  </button>
                  <button
                    v-if="showHouseholdInUserMenu"
                    type="button"
                    class="dropdown-item"
                    @click="goToHousehold"
                  >
                    Household
                  </button>
                  <button
                    type="button"
                    class="dropdown-item"
                    @click="goToSubscription"
                  >
                    {{ planManageLabel }}
                  </button>
                  <button
                    type="button"
                    class="dropdown-item dropdown-logout"
                    @click="logout"
                  >
                    Sair
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
            :to="{ name: 'subscription' }"
            class="sidebar-plan-link"
            aria-label="Ver planos e subscrição"
          >
            {{ planLabel }}
          </RouterLink>
          <button v-if="!sidebarCollapsed" type="button" class="sidebar-collapse-btn" @click="toggleSidebar" title="Minimizar">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
          </button>
        </div>
        <nav v-if="authStore.isAuthenticated" class="sidebar-nav">
          <!-- Main nav panel -->
          <div class="sidebar-panel" :class="{ 'sidebar-panel--hidden': movimentsOpen }">
            <template v-for="item in navItems" :key="item.to">
              <RouterLink
                :to="item.to"
                class="sidebar-link"
                :class="{ active: isActive(item.to) }"
              >
                <span class="sidebar-icon">
                  <!-- Dashboard -->
                  <svg v-if="item.to === '/dashboard'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
                  <!-- Plano Mensal -->
                  <svg v-else-if="item.to === '/monthly'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
                  <!-- Contas -->
                  <svg v-else-if="item.to === '/accounts'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/><circle cx="17" cy="15" r="1.5"/></svg>
                  <!-- Objetivos -->
                  <svg v-else-if="item.to === '/objectives'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><line x1="22" x2="12" y1="2" y2="12"/></svg>
                  <!-- Relatórios -->
                  <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/></svg>
                </span>
                <span class="sidebar-label">{{ item.label }}</span>
              </RouterLink>

              <template v-if="item.to === '/accounts'">
                <button
                  type="button"
                  class="sidebar-link sidebar-link-expandable"
                  :class="{ active: isMovimentsActive }"
                  @click="openMoviments"
                >
                  <span class="sidebar-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/><polyline points="21 3 21 9 15 9"/></svg>
                  </span>
                  <span class="sidebar-label">Movimentos</span>
                  <svg class="sidebar-expand-arrow" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </template>
            </template>
          </div>

          <!-- Movimentos sub-panel (slides in) -->
          <div class="sidebar-panel sidebar-panel-sub" :class="{ 'sidebar-panel-sub--visible': movimentsOpen }">
            <button type="button" class="sidebar-back-btn" @click="movimentsOpen = false">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              <span>Movimentos</span>
            </button>
            <div class="sidebar-sub-items">
              <RouterLink
                v-for="sub in movimentsSubItems"
                :key="sub.tabKey"
                :to="sub.to"
                class="sidebar-link sidebar-sub-item"
                :class="{ active: isMovimentsSubActive(sub.tabKey) }"
              >
                <span v-if="sub.tabKey === 'summary'" class="sidebar-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
                </span>
                <span v-if="sub.tabKey === 'transactions'" class="sidebar-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 7 17 7"/><polyline points="4 12 20 12"/><polyline points="7 17 17 17"/><polyline points="3 7 5 5 3 3"/><polyline points="21 17 19 19 21 21"/></svg>
                </span>
                <span v-if="sub.tabKey === 'recurring'" class="sidebar-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </span>
                <span class="sidebar-label">{{ sub.label }}</span>
              </RouterLink>
            </div>
          </div>
        </nav>
        <div v-if="authStore.isAuthenticated" class="sidebar-footer">
          <button type="button" class="btn-sidebar btn-logout" @click="logout">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
            <span class="sidebar-label">Sair</span>
          </button>
        </div>
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
  min-height: 100vh;
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
  background: linear-gradient(180deg, #14532d 0%, #166534 40%, #15803d 100%);
  color: var(--color-sidebar-text);
  display: flex;
  flex-direction: column;
  border-right: none;
  box-shadow: var(--color-sidebar-edge-shadow);
  position: relative;
  z-index: 1;
}

html.dark .sidebar {
  background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
}

.sidebar-plan {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1.125rem 0.875rem 0.875rem;
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
  font-size: 0.875rem;
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

.sidebar-link-expandable {
  border: none;
  cursor: pointer;
  font-family: inherit;
  width: 100%;
  text-align: left;
  background: transparent;
}

.sidebar-expand-arrow {
  margin-left: auto;
  opacity: 0.4;
  flex-shrink: 0;
}

/* Sliding panels */
.sidebar-panel {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.sidebar-panel--hidden {
  transform: translateX(-100%);
  opacity: 0;
  pointer-events: none;
  position: absolute;
  inset: 0;
}

.sidebar-panel-sub {
  position: absolute;
  inset: 0;
  transform: translateX(100%);
  opacity: 0;
  pointer-events: none;
  padding: 0;
}

.sidebar-panel-sub--visible {
  transform: translateX(0);
  opacity: 1;
  pointer-events: auto;
  position: relative;
}

.sidebar-back-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.875rem;
  margin-bottom: 0.5rem;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  width: 100%;
  text-align: left;
  padding-bottom: 0.75rem;
  transition: color 0.15s ease;
}

.sidebar-back-btn:hover {
  color: #ffffff;
}

.sidebar-sub-items {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.sidebar-sub-item {
  padding: 0.7rem 1rem;
  font-size: 0.9375rem;
}

.sidebar-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  font-size: 1.125rem;
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
  margin-left: 1rem;
}

.header-brand:hover {
  opacity: 0.88;
}

.header-brand-img {
  display: block;
  width: auto;
  height: auto;
  /* Logo completo (ícone + FinoraFlow) — PNG verde, mesmo ficheiro claro/escuro */
  max-height: 30px;
  max-width: min(158px, 54vw);
  object-fit: contain;
  object-position: left center;
  background: transparent;
}

/* Modo escuro: texto verde escuro → branco; ícones FF em verde repostos após invert */
html.dark .header-brand-img {
  filter: invert(1) hue-rotate(156deg) saturate(1.2) brightness(1.07);
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
  min-width: 220px;
  padding: 0.375rem;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 8px 30px -4px rgba(15, 23, 42, 0.15), 0 4px 12px -2px rgba(15, 23, 42, 0.08);
  z-index: 100;
}

.dropdown-section {
  padding: 0.5rem 1rem;
}

.dropdown-label {
  display: block;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  margin-bottom: 0.5rem;
}

.theme-options {
  display: flex;
  gap: 0.5rem;
}

.theme-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.125rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.theme-btn:hover {
  background: var(--color-btn-secondary-hover);
}

.theme-btn.active {
  background: rgba(22, 101, 52, 0.14);
  border-color: #166534;
}

html.dark .theme-btn.active {
  background: rgba(74, 222, 128, 0.12);
  border-color: #4ade80;
}

.dropdown-divider {
  height: 1px;
  background: var(--color-border);
  margin: 0.25rem 0.5rem;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  color: var(--color-text);
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  text-align: left;
  font-weight: 500;
}

.dropdown-item:hover {
  background: var(--color-table-row-hover);
}

.dropdown-logout:hover {
  background: rgba(220, 38, 38, 0.06);
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

.sidebar.collapsed .sidebar-expand-arrow {
  display: none;
}

.sidebar.collapsed .sidebar-plan {
  padding: 0.75rem 0.5rem;
  justify-content: center;
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

.sidebar.collapsed .sidebar-back-btn {
  justify-content: center;
  font-size: 0;
  padding: 0.6rem;
}

.sidebar.collapsed .sidebar-back-btn svg {
  font-size: initial;
}

.sidebar.collapsed .sidebar-sub-item {
  justify-content: center;
  padding: 0.6rem;
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

  .sidebar-nav {
    flex-direction: row;
    padding: 0.5rem 0.75rem;
    gap: 0.125rem;
    overflow-x: auto;
    flex: unset;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
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
    max-height: 26px;
    max-width: min(130px, 40vw);
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
    font-size: 0.875rem;
  }
}
</style>
