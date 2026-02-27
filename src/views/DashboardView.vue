<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
</script>

<template>
  <div class="dashboard">
    <h1>Dashboard</h1>
    <p v-if="authStore.user">
      Olá, {{ authStore.user.firstName }} {{ authStore.user.lastName }}!
    </p>
    <p class="email">{{ authStore.user?.email }}</p>
  </div>
</template>

<style scoped>
.dashboard {
  padding: 2rem;
}
.dashboard h1 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}
.dashboard .email {
  color: #64748b;
  font-size: 0.875rem;
}
</style>
