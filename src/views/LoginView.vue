<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { RouterLink } from 'vue-router'
import iconFinoraFlow from '@/assets/images/finoraflow-icon.png'
import AuthShowcase from '@/components/AuthShowcase.vue'
import ForgotPasswordModal from '@/components/ForgotPasswordModal.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const forgotPasswordOpen = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    const timeZoneId = Intl.DateTimeFormat().resolvedOptions().timeZone
    await authStore.login({ email: email.value, password: password.value, timeZoneId })
    const redirect = (route.query.redirect as string) || '/overview'
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
    <div class="auth-left">
      <div class="auth-brand">
        <img :src="iconFinoraFlow" alt="FinoraFlow" class="auth-brand-img" />
      </div>
      <div class="auth-left-inner">
        <div class="auth-intro">
          <p class="auth-intro-title">Iniciar Sessão</p>
          <p class="auth-intro-welcome">Bem-vindo! Vamos começar!</p>
        </div>
        <form @submit.prevent="handleSubmit">
          <div v-if="error" class="auth-error">{{ error }}</div>
          <div class="auth-field">
            <label for="email">Email</label>
            <input id="email" v-model="email" type="email" required placeholder="Introduza o e-mail" />
          </div>
          <div class="auth-field">
            <label for="password">Password</label>
            <input id="password" v-model="password" type="password" required placeholder="Introduza a palavra-passe" />
          </div>
          <div class="auth-forgot">
            <button type="button" class="auth-forgot-link" @click="forgotPasswordOpen = true">
              Esqueceste-te da palavra-passe?
            </button>
          </div>
          <button type="submit" class="auth-btn" :disabled="loading">
            {{ loading ? 'A entrar...' : 'Entrar' }}
          </button>
        </form>
        <p class="auth-footer">
          Não tens conta? <RouterLink to="/register">Criar conta</RouterLink>
        </p>
      </div>
    </div>
    <AuthShowcase />

    <ForgotPasswordModal
      v-if="forgotPasswordOpen"
      :initial-email="email"
      @close="forgotPasswordOpen = false"
    />
  </div>
</template>

<style scoped>
.auth-forgot {
  display: flex;
  justify-content: flex-end;
  margin: -0.5rem 0 1rem;
}

.auth-forgot-link {
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #166534;
  cursor: pointer;
  transition: color 0.15s;
}

.auth-forgot-link:hover {
  color: #14532d;
  text-decoration: underline;
}

:global(html.dark) .auth-forgot-link {
  color: #4ade80;
}

:global(html.dark) .auth-forgot-link:hover {
  color: #86efac;
}
</style>
