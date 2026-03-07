<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'

const authStore = useAuthStore()
const themeStore = useThemeStore()

function logout() {
  authStore.logout()
}
</script>

<template>
  <div class="layout">
    <header class="header">
      <RouterLink to="/" class="logo">Finora</RouterLink>
      <nav class="nav">
        <RouterLink v-if="authStore.isAuthenticated" to="/dashboard">Dashboard</RouterLink>
        <RouterLink v-if="authStore.isAuthenticated" to="/monthly">Plano Mensal</RouterLink>
        <RouterLink v-if="authStore.isAuthenticated" to="/accounts">Contas</RouterLink>
        <RouterLink v-if="authStore.isAuthenticated" to="/transactions">Transações</RouterLink>
        <RouterLink v-if="authStore.isAuthenticated" to="/household">Household</RouterLink>
        <template v-if="authStore.isAuthenticated">
          <span class="user">{{ authStore.user?.firstName }}</span>
          <button
            type="button"
            class="btn-theme"
            :title="themeStore.isDark ? 'Modo claro' : 'Modo escuro'"
            @click="themeStore.toggle"
          >
            {{ themeStore.isDark ? '☀️' : '🌙' }}
          </button>
          <button type="button" class="btn-logout" @click="logout">Sair</button>
        </template>
        <template v-else>
          <RouterLink to="/login">Entrar</RouterLink>
          <RouterLink to="/register" class="btn-register">Registar</RouterLink>
        </template>
      </nav>
    </header>
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  border-bottom: 1px solid var(--color-header-border);
  background: var(--color-header-bg);
}
.logo {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-logo);
  text-decoration: none;
}
.nav {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}
.nav a {
  color: var(--color-link);
  text-decoration: none;
  font-size: 0.875rem;
}
.nav a:hover {
  color: var(--color-link-hover);
}
.btn-theme {
  padding: 0.375rem 0.5rem;
  font-size: 1rem;
  background: transparent;
  border: 1px solid var(--color-btn-secondary-border);
  border-radius: 0.375rem;
  cursor: pointer;
}
.btn-theme:hover {
  background: var(--color-btn-secondary-hover);
}
.btn-register {
  background: #2563eb !important;
  color: white !important;
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
}
.btn-register:hover {
  background: #1d4ed8 !important;
}
.user {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}
.btn-logout {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  color: var(--color-link);
  background: var(--color-btn-secondary-bg);
  border: 1px solid var(--color-btn-secondary-border);
  border-radius: 0.375rem;
  cursor: pointer;
}
.btn-logout:hover {
  background: var(--color-btn-secondary-hover);
  color: var(--color-text);
}
.main {
  flex: 1;
  min-height: 200px;
  overflow-y: auto;
  background: var(--color-bg);
  padding: 0 1rem;
}
</style>
