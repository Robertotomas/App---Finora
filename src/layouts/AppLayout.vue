<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { useHouseholdStore } from '@/stores/household'
import iconMale from '@/assets/images/icon-male.png'
import iconDashboard from '@/assets/images/icon-dashboard.png'
import iconCreditCard from '@/assets/images/icon-credit-card.png'
import iconMonthly from '@/assets/images/icon-monthly.png'
import iconTransactions from '@/assets/images/icon-transactions.png'

const authStore = useAuthStore()
const themeStore = useThemeStore()
const householdStore = useHouseholdStore()
const route = useRoute()
const userMenuOpen = ref(false)

function logout() {
  userMenuOpen.value = false
  authStore.logout()
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
      await householdStore.fetchHousehold()
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
  if (!householdStore.household) return 'Free'
  return householdStore.isCouple ? 'Couple' : 'Free'
})

const navItems = [
  { to: '/dashboard', label: 'Dashboard', iconImg: iconDashboard },
  { to: '/monthly', label: 'Plano Mensal', iconImg: iconMonthly, iconClass: 'sidebar-nav-icon-lg' },
  { to: '/accounts', label: 'Contas', iconImg: iconCreditCard, iconClass: 'sidebar-nav-icon-sm' },
  { to: '/transactions', label: 'Transações', iconImg: iconTransactions, iconClass: 'sidebar-nav-icon-lg' },
  { to: '/household', label: 'Household', icon: '👥' },
]

function isActive(path: string) {
  if (path === '/dashboard') return route.path === '/dashboard'
  return route.path.startsWith(path)
}

</script>

<template>
  <div class="app-layout">
    <!-- Barra superior - largura total -->
    <header class="top-header">
      <RouterLink to="/dashboard" class="header-brand">
        <span class="brand-bold">Finora</span>Flow
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
      <aside class="sidebar">
        <div v-if="authStore.isAuthenticated" class="sidebar-plan">
          <span class="sidebar-plan-value">{{ planLabel }}</span>
        </div>
        <nav v-if="authStore.isAuthenticated" class="sidebar-nav">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="sidebar-link"
            :class="{ active: isActive(item.to) }"
          >
            <span class="sidebar-icon">
              <img v-if="item.iconImg" :src="item.iconImg" alt="" class="sidebar-nav-icon" :class="item.iconClass" />
              <template v-else>{{ item.icon }}</template>
            </span>
            <span class="sidebar-label">{{ item.label }}</span>
          </RouterLink>
        </nav>
        <div v-if="authStore.isAuthenticated" class="sidebar-footer">
          <button type="button" class="btn-sidebar btn-logout" @click="logout">Sair</button>
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

/* Sidebar lateral - verde no light mode, cinza no dark mode (via variáveis) */
.sidebar {
  width: 240px;
  min-width: 240px;
  background: var(--color-sidebar-bg);
  color: var(--color-sidebar-text);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-sidebar-border);
}

.sidebar-plan {
  padding: 1rem 1.5rem 0.75rem;
  border-bottom: 1px solid var(--color-sidebar-border);
}

.sidebar-plan-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-sidebar-text);
}

.sidebar-nav {
  flex: 1;
  padding: 0.75rem 0 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sidebar-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 1.5rem;
  color: var(--color-sidebar-text);
  text-decoration: none;
  font-size: 0.9375rem;
  font-weight: 650;
  transition: background 0.15s, color 0.15s;
}

.sidebar-link:hover {
  background: var(--color-sidebar-hover);
  color: var(--color-sidebar-text);
}

.sidebar-link.active {
  background: var(--color-sidebar-active);
  color: var(--color-sidebar-text);
  font-weight: 650;
}

.sidebar-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
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

.sidebar-label {
  flex: 1;
}

.sidebar-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--color-sidebar-border);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.btn-sidebar {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 650;
  background: transparent;
  border: 1px solid var(--color-sidebar-border);
  border-radius: 6px;
  color: var(--color-sidebar-text);
  cursor: pointer;
  transition: background 0.15s;
}

.btn-sidebar:hover {
  background: var(--color-sidebar-hover);
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

/* Barra superior - largura total */
.top-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1rem 1.5rem;
  min-height: 56px;
  background: var(--color-header-bg);
  border-bottom: 2px solid var(--color-header-border);
  flex-shrink: 0;
}

.header-brand {
  font-size: 1.25rem;
  color: var(--color-logo);
  flex-shrink: 0;
  text-decoration: none;
  cursor: pointer;
}

.header-brand:hover {
  opacity: 0.85;
}

.header-brand .brand-bold {
  font-weight: 700;
}

.header-search {
  max-width: 200px;
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
  width: 36px;
  height: 36px;
  object-fit: contain;
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  min-width: 200px;
  padding: 0.5rem 0;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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
  background: rgba(37, 99, 235, 0.1);
  border-color: var(--color-link-hover);
}

.dropdown-divider {
  height: 1px;
  background: var(--color-border);
  margin: 0.5rem 0;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.625rem 1rem;
  font-size: 0.875rem;
  color: var(--color-text);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
  text-align: left;
}

.dropdown-item:hover {
  background: var(--color-btn-secondary-hover);
}

.dropdown-logout {
  color: var(--color-expense);
}

.dropdown-logout:hover {
  background: rgba(220, 38, 38, 0.08);
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

/* Conteúdo principal */
.main-content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 0 1.5rem 1.5rem;
}
</style>
