<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
</script>

<template>
  <div class="home">
    <h1>Bem-vindo à Finora</h1>
    <p>Gerir as tuas finanças de forma simples e eficaz.</p>
    <div class="actions">
      <RouterLink v-if="!authStore.isAuthenticated" to="/login" class="btn btn-secondary">Entrar</RouterLink>
      <RouterLink v-if="!authStore.isAuthenticated" to="/register" class="btn btn-primary">Registar</RouterLink>
      <RouterLink v-else to="/dashboard" class="btn btn-primary">Dashboard</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.home {
  text-align: center;
  padding: 3rem 1rem;
}
.home h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}
.home p {
  color: #64748b;
  margin-bottom: 2rem;
}
.actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}
.btn {
  padding: 0.5rem 1.5rem;
  border-radius: 0.375rem;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.2s;
}
.btn-primary {
  background: #2563eb;
  color: white;
}
.btn-primary:hover {
  background: #1d4ed8;
}
.btn-secondary {
  background: #e2e8f0;
  color: #334155;
}
.btn-secondary:hover {
  background: #cbd5e1;
}
</style>
