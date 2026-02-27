<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()

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
        <RouterLink v-if="authStore.isAuthenticated" to="/accounts">Contas</RouterLink>
        <RouterLink v-if="authStore.isAuthenticated" to="/household">Household</RouterLink>
        <template v-if="authStore.isAuthenticated">
          <span class="user">{{ authStore.user?.firstName }}</span>
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
  border-bottom: 1px solid #e2e8f0;
  background: white;
}
.logo {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
  text-decoration: none;
}
.nav {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}
.nav a {
  color: #64748b;
  text-decoration: none;
  font-size: 0.875rem;
}
.nav a:hover {
  color: #2563eb;
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
  color: #64748b;
}
.btn-logout {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  color: #64748b;
  background: transparent;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  cursor: pointer;
}
.btn-logout:hover {
  background: #f1f5f9;
  color: #334155;
}
.main {
  flex: 1;
  background: #f8fafc;
}
</style>
