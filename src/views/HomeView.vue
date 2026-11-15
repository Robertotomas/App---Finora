<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
</script>

<template>
  <div class="home">
    <h1 class="home-title">Bem-vindo ao FinoraFlow</h1>
    <p class="home-sub">Gerir as suas finanças de forma simples e eficaz.</p>
    <div class="actions">
      <RouterLink v-if="!authStore.isAuthenticated" to="/login" class="btn btn-secondary">Entrar</RouterLink>
      <RouterLink v-if="!authStore.isAuthenticated" to="/register" class="btn btn-primary">Registar</RouterLink>
      <RouterLink v-else to="/overview" class="btn btn-primary">Início</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.home {
  text-align: center;
  padding: var(--space-12) var(--space-4);
}

.home-title {
  margin: 0 0 var(--space-2);
  font-size: var(--text-2xl);
  font-weight: var(--weight-bold);
  letter-spacing: var(--tracking-tight);
  color: var(--color-text-strong);
}

.home-sub {
  margin: 0 0 var(--space-8);
  font-size: var(--text-md);
  color: var(--color-text-muted);
}

.actions {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
  flex-wrap: wrap;
}

/* Links com o aspeto do UiButton */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: var(--control-h);
  padding: 0 var(--space-5);
  border-radius: var(--radius-sm);
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  text-decoration: none;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}

.btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.btn-primary {
  background: var(--color-primary);
  color: var(--color-on-primary);
}

.btn-primary:hover {
  background: var(--color-primary-hover);
}

.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text-strong);
  border: 1px solid var(--color-border);
}

.btn-secondary:hover {
  background: var(--color-surface-muted);
}
</style>
