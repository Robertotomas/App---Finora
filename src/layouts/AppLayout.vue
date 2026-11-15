<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useHouseholdStore } from '@/stores/household'
import { useSubscriptionStore } from '@/stores/subscription'
import AppLogo from '@/components/AppLogo.vue'
import PartnerLeftModal from '@/components/PartnerLeftModal.vue'
import NotificationBell from '@/components/NotificationBell.vue'
import GlobalSearch from '@/components/GlobalSearch.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import ShellIcon, { type ShellIconName } from '@/components/shell/ShellIcon.vue'
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

/* ── Mobile: sidebar como gaveta (overlay) ── */
const MOBILE_QUERY = '(max-width: 768px)'
const mobileMq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null
const isMobile = ref(mobileMq?.matches ?? false)
const drawerOpen = ref(false)

/** No mobile a gaveta mostra sempre os rótulos, mesmo que o desktop esteja recolhido. */
const collapsed = computed(() => sidebarCollapsed.value && !isMobile.value)

function onMqChange(e: MediaQueryListEvent) {
  isMobile.value = e.matches
  if (!e.matches) drawerOpen.value = false
}

function closeDrawer() {
  drawerOpen.value = false
}

watch(() => route.fullPath, closeDrawer)

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (drawerOpen.value) drawerOpen.value = false
  userMenuOpen.value = false
  quickActionOpen.value = false
}

function logout() {
  userMenuOpen.value = false
  authStore.logout()
  router.replace({ name: 'entrar' })
}

function toggleMenu() {
  userMenuOpen.value = !userMenuOpen.value
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as Element
  if (userMenuOpen.value && !target.closest('.user-menu')) {
    userMenuOpen.value = false
  }
  if (quickActionOpen.value && !target.closest('.quick-action-menu')) {
    quickActionOpen.value = false
  }
}

onMounted(async () => {
  mobileMq?.addEventListener('change', onMqChange)
  document.addEventListener('keydown', onKeydown)

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
  document.addEventListener('click', handleClickOutside)

  if (authStore.isAuthenticated) {
    notificationStore.startPolling()
  }
})

onUnmounted(() => {
  mobileMq?.removeEventListener('change', onMqChange)
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('click', handleClickOutside)
  notificationStore.stopPolling()
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

/** Household: plano Couple OU agregado ainda tipo casal (ex.: após mudar para Free/Pro — precisa disto para sair do casal). */
const showHouseholdInUserMenu = computed(
  () =>
    subscriptionStore.plan === 'Couple' ||
    householdStore.isCouple ||
    householdStore.hasPartnerLeftNotice,
)

const fullName = computed(() =>
  [authStore.user?.firstName, authStore.user?.lastName].filter(Boolean).join(' '),
)

interface NavItem {
  to: string
  label: string
  icon: ShellIconName
}

const quickActions: NavItem[] = [
  { to: '/transactions?tab=movements&action=new', label: 'Movimento', icon: 'swap' },
  { to: '/transactions?tab=recurring&action=new', label: 'Recorrente', icon: 'clock' },
  { to: '/accounts?action=new', label: 'Conta', icon: 'wallet' },
  { to: '/assets?action=new', label: 'Bem e valor', icon: 'gem' },
  { to: '/investments?action=new', label: 'Investimento', icon: 'trending' },
  { to: '/goals?tab=active&action=new', label: 'Objetivo', icon: 'target' },
  { to: '/monthly-plan', label: 'Plano Mensal', icon: 'calendar-check' },
]

const themeOptions: { mode: 'light' | 'dark' | 'system'; label: string; icon: ShellIconName }[] = [
  { mode: 'light', label: 'Claro', icon: 'sun' },
  { mode: 'dark', label: 'Escuro', icon: 'moon' },
  { mode: 'system', label: 'Sistema', icon: 'monitor' },
]

const planningItems: NavItem[] = [
  { to: '/monthly-plan', label: 'Plano Mensal', icon: 'calendar-check' },
  { to: '/goals', label: 'Objetivos', icon: 'target' },
]

const movimentsSubItems: (NavItem & { tabKey: string })[] = [
  { to: '/transactions?tab=dashboard', label: 'Resumo', tabKey: 'dashboard', icon: 'grid' },
  { to: '/transactions?tab=movements', label: 'Movimentos', tabKey: 'movements', icon: 'swap' },
  { to: '/transactions?tab=recurring', label: 'Recorrentes', tabKey: 'recurring', icon: 'clock' },
]

const patrimonioItems: NavItem[] = [
  { to: '/accounts', label: 'Contas', icon: 'wallet' },
  { to: '/investments', label: 'Investimentos', icon: 'trending' },
  { to: '/assets', label: 'Bens e Valores', icon: 'gem' },
]

const toolsItems: NavItem[] = [
  { to: '/reports', label: 'Relatórios', icon: 'report' },
]

const navSections = computed(() => [
  { title: 'Planeamento', items: planningItems.map((i) => ({ ...i, active: isActive(i.to) })) },
  { title: 'Atividade', items: movimentsSubItems.map((i) => ({ ...i, active: isMovimentsSubActive(i.tabKey) })) },
  { title: 'Património', items: patrimonioItems.map((i) => ({ ...i, active: isActive(i.to) })) },
  { title: 'Ferramentas', items: toolsItems.map((i) => ({ ...i, active: isActive(i.to) })) },
])

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
      <button
        v-if="authStore.isAuthenticated"
        type="button"
        class="shell-icon-btn header-menu-btn"
        aria-label="Abrir menu"
        :aria-expanded="drawerOpen"
        @click="drawerOpen = true"
      >
        <ShellIcon name="menu" :size="20" />
      </button>

      <RouterLink to="/overview" class="header-brand" aria-label="FinoraFlow — ir para o painel">
        <AppLogo :size="28" class="header-brand-img" />
      </RouterLink>

      <div class="header-actions">
        <GlobalSearch v-if="authStore.isAuthenticated" class="header-search" />

        <!-- Ação rápida "+" -->
        <div v-if="authStore.isAuthenticated" class="quick-action-menu">
          <UiButton
            variant="secondary"
            icon-only
            class="quick-action-btn"
            aria-label="Adicionar"
            title="Adicionar"
            :aria-expanded="quickActionOpen"
            @click.stop="toggleQuickAction"
          >
            <template #icon><ShellIcon name="plus" :size="16" /></template>
          </UiButton>
          <Transition name="dropdown">
            <div v-show="quickActionOpen" class="shell-menu quick-action-dropdown" role="menu">
              <span class="shell-menu-label">Adicionar</span>
              <button
                v-for="qa in quickActions"
                :key="qa.to"
                type="button"
                role="menuitem"
                class="shell-menu-item"
                @click="quickAction(qa.to)"
              >
                <ShellIcon :name="qa.icon" :size="16" />
                {{ qa.label }}
              </button>
            </div>
          </Transition>
        </div>

        <NotificationBell v-if="authStore.isAuthenticated" />

        <div class="user-menu">
          <button
            type="button"
            class="user-trigger"
            :class="{ 'is-open': userMenuOpen }"
            :aria-expanded="userMenuOpen"
            aria-haspopup="menu"
            @click.stop="toggleMenu"
          >
            <UserAvatar
              v-if="authStore.isAuthenticated"
              :first-name="authStore.user?.firstName"
              :last-name="authStore.user?.lastName"
              :size="32"
            />
            <span v-if="authStore.isAuthenticated" class="user-name">{{ fullName }}</span>
            <span v-else class="user-name user-name--guest">Visitante</span>
            <ShellIcon name="chevron-down" :size="16" class="user-chevron" />
          </button>
          <Transition name="dropdown">
            <div v-show="userMenuOpen" class="shell-menu user-dropdown" role="menu">
              <template v-if="authStore.isAuthenticated">
                <!-- Cabeçalho de perfil -->
                <div class="dropdown-profile">
                  <UserAvatar :first-name="authStore.user?.firstName" :last-name="authStore.user?.lastName" :size="36" />
                  <div class="dropdown-profile-info">
                    <span class="dropdown-profile-name">{{ fullName }}</span>
                    <span class="dropdown-profile-email">{{ authStore.user?.email }}</span>
                  </div>
                </div>

                <div class="shell-menu-divider" />

                <button type="button" role="menuitem" class="shell-menu-item" @click="goToSubscription">
                  <ShellIcon name="upgrade" :size="16" />
                  <span class="dropdown-item-label">{{ planManageLabel }}</span>
                </button>
                <button type="button" role="menuitem" class="shell-menu-item" @click="goToProfile">
                  <ShellIcon name="user" :size="16" />
                  <span class="dropdown-item-label">Perfil</span>
                </button>
                <button v-if="showHouseholdInUserMenu" type="button" role="menuitem" class="shell-menu-item" @click="goToHousehold">
                  <ShellIcon name="users" :size="16" />
                  <span class="dropdown-item-label">Agregado</span>
                </button>

                <div class="shell-menu-divider" />
              </template>

              <!-- Aparência (tema sempre visível, também para visitantes) -->
              <span class="shell-menu-label">Aparência</span>
              <button
                v-for="opt in themeOptions"
                :key="opt.mode"
                type="button"
                role="menuitemradio"
                class="shell-menu-item"
                :class="{ active: themeStore.mode === opt.mode }"
                :aria-checked="themeStore.mode === opt.mode"
                @click="themeStore.setMode(opt.mode)"
              >
                <ShellIcon :name="opt.icon" :size="16" />
                <span class="dropdown-item-label">{{ opt.label }}</span>
                <ShellIcon v-if="themeStore.mode === opt.mode" name="check" :size="16" class="dropdown-check" />
              </button>

              <template v-if="authStore.isAuthenticated">
                <div class="shell-menu-divider" />
                <button type="button" role="menuitem" class="shell-menu-item shell-menu-item--danger" @click="logout">
                  <ShellIcon name="logout" :size="16" />
                  <span class="dropdown-item-label">Terminar sessão</span>
                </button>
              </template>
            </div>
          </Transition>
        </div>
      </div>
    </header>

    <!-- Sidebar + conteúdo (abaixo da barra superior) -->
    <div class="content-row">
      <Transition name="backdrop">
        <div v-if="drawerOpen" class="drawer-backdrop" aria-hidden="true" @click="closeDrawer" />
      </Transition>

      <aside
        class="sidebar"
        :class="{ collapsed, open: drawerOpen }"
        :aria-hidden="isMobile && !drawerOpen ? 'true' : undefined"
      >
        <!-- Cabeçalho da gaveta (só mobile) -->
        <div class="drawer-head">
          <AppLogo :size="28" class="header-brand-img" />
          <button type="button" class="shell-icon-btn" aria-label="Fechar menu" @click="closeDrawer">
            <ShellIcon name="x" :size="20" />
          </button>
        </div>

        <div v-if="authStore.isAuthenticated" class="sidebar-plan">
          <RouterLink
            v-if="subscriptionStore.planKnown"
            :to="{ name: 'subscricao' }"
            class="sidebar-plan-badge"
            aria-label="Ver planos e subscrição"
          >
            {{ planLabel }}
          </RouterLink>
          <!-- Plano ainda por saber (1.º login neste browser): marcador neutro em vez de "Free" -->
          <span v-else class="sidebar-plan-badge sidebar-plan-badge--loading" aria-hidden="true"></span>
          <span
            v-if="!collapsed && subscriptionStore.plan === 'Couple' && householdStore.household?.name"
            class="sidebar-household-name"
          >
            {{ householdStore.household.name }}
          </span>
        </div>

        <nav v-if="authStore.isAuthenticated" class="sidebar-nav" aria-label="Navegação principal">
          <RouterLink
            to="/overview"
            class="sidebar-link"
            :class="{ active: isActive('/overview') }"
            :title="collapsed ? 'Início' : undefined"
          >
            <ShellIcon name="home" class="sidebar-icon" />
            <span class="sidebar-label">Início</span>
          </RouterLink>

          <div v-for="section in navSections" :key="section.title" class="sidebar-section">
            <span class="ui-label sidebar-section-title">{{ section.title }}</span>
            <RouterLink
              v-for="item in section.items"
              :key="item.to"
              :to="item.to"
              class="sidebar-link"
              :class="{ active: item.active }"
              :title="collapsed ? item.label : undefined"
            >
              <ShellIcon :name="item.icon" class="sidebar-icon" />
              <span class="sidebar-label">{{ item.label }}</span>
            </RouterLink>
          </div>
        </nav>
        <div v-else class="sidebar-guest">
          <RouterLink to="/login" class="sidebar-link">Entrar</RouterLink>
          <RouterLink to="/register" class="sidebar-link sidebar-link--register">Registar</RouterLink>
        </div>

        <div v-if="authStore.isAuthenticated" class="sidebar-foot">
          <button
            type="button"
            class="sidebar-collapse-btn"
            :title="collapsed ? 'Expandir menu' : 'Recolher menu'"
            :aria-label="collapsed ? 'Expandir menu' : 'Recolher menu'"
            @click="toggleSidebar"
          >
            <ShellIcon :name="collapsed ? 'panel-open' : 'panel-close'" :size="16" />
            <span class="sidebar-label">Recolher menu</span>
          </button>
        </div>
      </aside>

      <main class="main-content">
        <div class="main-inner">
          <RouterView />
        </div>
      </main>
    </div>

    <PartnerLeftModal v-if="authStore.isAuthenticated" />
  </div>
</template>

<style scoped>
.app-layout {
  --top-bar-height: 60px;
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--color-bg);
}

.content-row {
  display: flex;
  flex: 1;
  min-height: 0;
}


/* ═══ Barra superior ═══ */
.top-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  height: var(--top-bar-height);
  flex-shrink: 0;
  padding: 0 var(--space-5) 0 var(--space-4);
  background: var(--color-header-bg);
  border-bottom: 1px solid var(--color-header-border);
  position: relative;
  z-index: 100; /* menus suspensos acima do conteúdo das páginas */
}

.header-menu-btn {
  display: none;
}

.header-brand {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  line-height: 0;
  text-decoration: none;
  border-radius: var(--radius-sm);
  transition: opacity var(--transition-fast);
}

.header-brand:hover {
  opacity: 0.85;
}

.header-brand:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.header-brand-img {
  display: inline-flex;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-left: auto;
  min-width: 0;
}

.header-search {
  margin-right: var(--space-2);
}

/* Ação rápida */
.quick-action-menu {
  position: relative;
}

.quick-action-dropdown {
  min-width: 208px;
}

/* Menu do utilizador */
.user-menu {
  position: relative;
  margin-left: var(--space-1);
}

.user-trigger {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: var(--control-h);
  padding: 0 var(--space-2) 0 2px;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-text-strong);
  font-family: inherit;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.user-trigger:hover,
.user-trigger.is-open {
  background: var(--color-surface-muted);
}

.user-trigger:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.user-name {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  white-space: nowrap;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-name--guest {
  padding-left: var(--space-2);
}

.user-chevron {
  color: var(--color-text-muted);
  transition: transform var(--transition-fast);
}

.user-trigger.is-open .user-chevron {
  transform: rotate(180deg);
}

.user-dropdown {
  min-width: 248px;
  max-width: 288px;
}

.dropdown-profile {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) 10px;
}

.dropdown-profile-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dropdown-profile-name {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-profile-email {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-item-label {
  flex: 1;
}

.shell-menu-item > .dropdown-check {
  color: var(--color-primary-text);
}

/* ═══ Sidebar ═══ */
.sidebar {
  width: 240px;
  min-width: 240px;
  display: flex;
  flex-direction: column;
  background: var(--color-sidebar-bg);
  border-right: 1px solid var(--color-sidebar-border);
  color: var(--color-sidebar-text);
  transition: width var(--transition-base), min-width var(--transition-base);
  position: relative;
  z-index: 1;
}

.drawer-head {
  display: none;
}

.sidebar-plan {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 52px;
  padding: var(--space-4) var(--space-4) var(--space-2);
}

.sidebar-plan-badge--loading {
  width: 52px;
  border-color: transparent;
  background: var(--color-surface-muted);
}

.sidebar-plan-badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 10px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-primary-soft-border);
  background: var(--color-primary-soft);
  color: var(--color-primary-text);
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
  letter-spacing: var(--tracking-caps);
  text-transform: uppercase;
  text-decoration: none;
  white-space: nowrap;
  flex-shrink: 0;
  transition: border-color var(--transition-fast);
}

.sidebar-plan-badge:hover {
  border-color: var(--color-primary-text);
}

.sidebar-plan-badge:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.sidebar-household-name {
  flex: 1;
  min-width: 0;
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-nav {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-2) var(--space-3) var(--space-4);
  overflow-y: auto;
  scrollbar-width: none;
}

.sidebar-nav::-webkit-scrollbar {
  display: none;
}

.sidebar-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: var(--space-5);
}

.sidebar-section-title {
  display: block;
  padding: 0 10px var(--space-2);
  color: var(--color-text-muted); /* contraste suficiente sobre o fundo esverdeado da sidebar */
  user-select: none;
}

.sidebar-link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  height: var(--control-h);
  padding: 0 10px;
  border-radius: var(--radius-sm);
  color: var(--color-sidebar-text);
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  text-decoration: none;
  white-space: nowrap;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.sidebar-icon {
  flex-shrink: 0;
  color: var(--color-text-muted);
  transition: color var(--transition-fast);
}

.sidebar-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-link:hover {
  background: var(--color-sidebar-hover);
  color: var(--color-text-strong);
}

.sidebar-link:hover .sidebar-icon {
  color: var(--color-text-strong);
}

.sidebar-link:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.sidebar-link.active {
  background: var(--color-sidebar-active);
  color: var(--color-selected-text);
  font-weight: var(--weight-semibold);
}

.sidebar-link.active .sidebar-icon {
  color: var(--color-primary-text);
}

/* Indicador do item ativo: barra fina verde encostada à borda da sidebar (fora do fundo cinza) */
.sidebar-link::before {
  content: '';
  position: absolute;
  left: calc(-1 * var(--space-3));
  top: 50%;
  width: 3px;
  height: 18px;
  border-radius: 0 3px 3px 0;
  background: var(--color-primary-text);
  transform: translateY(-50%) scaleY(0.4);
  opacity: 0;
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.sidebar-link.active::before {
  opacity: 1;
  transform: translateY(-50%) scaleY(1);
}

.sidebar-guest {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4) var(--space-3);
}

.sidebar-link--register {
  justify-content: center;
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-weight: var(--weight-semibold);
}

.sidebar-link--register:hover {
  background: var(--color-primary-hover);
  color: var(--color-on-primary);
}

.sidebar-foot {
  padding: var(--space-2) var(--space-3) var(--space-3);
  border-top: 1px solid var(--color-border-subtle);
}

.sidebar-collapse-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  text-align: left;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.sidebar-collapse-btn:hover {
  background: var(--color-sidebar-hover);
  color: var(--color-text-strong);
}

.sidebar-collapse-btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

/* Recolhida (desktop) */
.sidebar.collapsed {
  width: 64px;
  min-width: 64px;
}

.sidebar.collapsed .sidebar-label,
.sidebar.collapsed .sidebar-household-name {
  display: none;
}

.sidebar.collapsed .sidebar-plan {
  justify-content: center;
  padding-left: var(--space-2);
  padding-right: var(--space-2);
}

.sidebar.collapsed .sidebar-plan-badge {
  padding: 0 6px;
  font-size: 0.5625rem;
  letter-spacing: 0.02em;
}

.sidebar.collapsed .sidebar-nav,
.sidebar.collapsed .sidebar-foot {
  padding-left: var(--space-3);
  padding-right: var(--space-3);
}

.sidebar.collapsed .sidebar-link,
.sidebar.collapsed .sidebar-collapse-btn {
  justify-content: center;
  padding: 0;
}

/* Rótulos de secção dão lugar a um separador fino */
.sidebar.collapsed .sidebar-section-title {
  height: 1px;
  margin: 0 var(--space-2) var(--space-2);
  padding: 0;
  overflow: hidden;
  color: transparent;
  background: var(--color-border-subtle);
}

.sidebar.collapsed .sidebar-section {
  margin-top: var(--space-3);
}

/* ═══ Conteúdo principal ═══ */
.main-content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
  /* Reserva sempre o espaço da barra de scroll: o conteúdo centrado não "salta" 5px entre
     páginas curtas (sem barra) e compridas (com barra). */
  scrollbar-gutter: stable;
  padding: var(--space-8);
  background: var(--color-bg);
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
}

.main-inner {
  width: 100%;
  max-width: var(--page-max);
  margin: 0 auto;
  min-width: 0;
}

/* Fundo da gaveta (mobile) */
.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 110;
  background: var(--color-modal-overlay);
}

.backdrop-enter-active,
.backdrop-leave-active {
  transition: opacity var(--transition-base);
}

.backdrop-enter-from,
.backdrop-leave-to {
  opacity: 0;
}

/* ─── Tablet: sidebar ligeiramente mais estreita ─── */
@media (min-width: 769px) and (max-width: 1024px) {
  .sidebar:not(.collapsed) {
    width: 220px;
    min-width: 220px;
  }

  .main-content {
    padding: var(--space-6);
  }

  .user-name {
    max-width: 120px;
  }
}

/* ─── Mobile: sidebar como gaveta sobreposta ─── */
@media (max-width: 768px) {
  .app-layout {
    --top-bar-height: 56px;
  }

  .top-header {
    gap: var(--space-2);
    padding: 0 var(--space-2) 0 var(--space-2);
  }

  .header-menu-btn {
    display: inline-flex;
  }


  .header-actions {
    gap: 6px;
  }

  .header-search {
    margin-right: 0;
  }

  .user-menu {
    margin-left: 2px;
  }

  .user-trigger {
    padding: 0 2px;
  }

  .user-name,
  .user-chevron {
    display: none;
  }

  .user-name--guest {
    display: inline;
  }

  .user-dropdown {
    position: fixed;
    top: calc(var(--top-bar-height) + 4px);
    right: var(--space-2);
    left: auto;
    max-width: calc(100vw - 16px);
  }

  .quick-action-dropdown {
    position: fixed;
    top: calc(var(--top-bar-height) + 4px);
    right: var(--space-2);
  }

  .sidebar,
  .sidebar.collapsed {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: 120;
    width: min(288px, 85vw);
    min-width: 0;
    border-right: 1px solid var(--color-sidebar-border);
    box-shadow: var(--shadow-lg);
    transform: translateX(-100%);
    visibility: hidden;
    transition: transform var(--transition-slow), visibility 0s linear 300ms;
  }

  .sidebar.open {
    transform: translateX(0);
    visibility: visible;
    transition: transform var(--transition-slow), visibility 0s;
  }

  .drawer-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--top-bar-height);
    flex-shrink: 0;
    padding: 0 var(--space-2) 0 var(--space-4);
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .sidebar-foot {
    display: none;
  }

  .main-content {
    padding: var(--space-4);
  }
}
</style>
