<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { RouterLink } from 'vue-router'
import iconFinoraFlow from '@/assets/images/finoraflow-icon.png'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    await authStore.login({ email: email.value, password: password.value })
    const redirect = (route.query.redirect as string) || '/inicio'
    router.push(redirect)
  } catch (e: unknown) {
    const err = e as { rateLimited?: boolean; rateLimitMessage?: string; response?: { data?: { message?: string } } }
    if (err.rateLimited) {
      error.value = err.rateLimitMessage || 'Demasiados pedidos. Tenta novamente dentro de 1 minuto.'
    } else {
      error.value = err.response?.data?.message || 'Email ou password incorretos.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-brand auth-brand-hero">
      <img :src="iconFinoraFlow" alt="FinoraFlow" class="auth-brand-hero-img" width="800" height="200" />
    </div>
    <div class="auth-body">
    <div class="auth-card">
      <div class="auth-intro">
        <p class="auth-intro-title">Log In</p>
        <p class="auth-intro-welcome">Welcome! Let's start!</p>
      </div>
      <form @submit.prevent="handleSubmit">
        <div v-if="error" class="auth-error">{{ error }}</div>
        <div class="auth-field">
          <label for="email">Email</label>
          <input id="email" v-model="email" type="email" required placeholder="email@exemplo.pt" />
        </div>
        <div class="auth-field">
          <label for="password">Password</label>
          <input id="password" v-model="password" type="password" required placeholder="••••••••" />
        </div>
        <button type="submit" class="auth-btn" :disabled="loading">
          {{ loading ? 'A entrar...' : 'Entrar' }}
        </button>
      </form>
      <p class="auth-footer">
        Não tens conta? <RouterLink to="/registar">Regista-te</RouterLink>
      </p>
    </div>
    </div>
  </div>
</template>
