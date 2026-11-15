<script setup lang="ts">
import PasswordInput from '@/components/PasswordInput.vue'
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { RouterLink } from 'vue-router'
import AppLogo from '@/components/AppLogo.vue'
import AuthShowcase from '@/components/AuthShowcase.vue'
import ForgotPasswordModal from '@/components/ForgotPasswordModal.vue'
import { authApi } from '@/api/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const forgotPasswordOpen = ref(false)

// Email por confirmar (resposta 403 EMAIL_NOT_CONFIRMED): mostra opção de reenvio.
const needsConfirmation = ref(false)
const resending = ref(false)
const resendNotice = ref('')

async function handleSubmit() {
  error.value = ''
  needsConfirmation.value = false
  resendNotice.value = ''
  loading.value = true
  try {
    const timeZoneId = Intl.DateTimeFormat().resolvedOptions().timeZone
    await authStore.login({ email: email.value, password: password.value, timeZoneId })
    const redirect = (route.query.redirect as string) || '/overview'
    router.push(redirect)
  } catch (e: unknown) {
    const err = e as { rateLimited?: boolean; rateLimitMessage?: string; response?: { data?: { message?: string; code?: string } } }
    if (err.rateLimited) {
      error.value = err.rateLimitMessage || 'Demasiados pedidos. Tente novamente dentro de 1 minuto.'
    } else if (err.response?.data?.code === 'EMAIL_NOT_CONFIRMED') {
      needsConfirmation.value = true
      error.value = err.response.data.message || 'Confirme o seu email antes de iniciar sessão.'
    } else {
      error.value = err.response?.data?.message || 'Email ou palavra-passe incorretos.'
    }
  } finally {
    loading.value = false
  }
}

async function resendConfirmation() {
  if (resending.value) return
  resending.value = true
  resendNotice.value = ''
  try {
    await authApi.resendEmailConfirmation(email.value)
    resendNotice.value = 'Enviámos um novo email de confirmação.'
  } catch (e: unknown) {
    const err = e as { rateLimited?: boolean; rateLimitMessage?: string }
    resendNotice.value = err.rateLimited
      ? (err.rateLimitMessage || 'Demasiados pedidos. Tente novamente dentro de 1 minuto.')
      : 'Não foi possível reenviar agora. Tente novamente daqui a pouco.'
  } finally {
    resending.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-left">
      <div class="auth-brand">
        <AppLogo :size="36" class="auth-brand-img" />
      </div>
      <div class="auth-left-inner">
        <div class="auth-intro">
          <h1 class="auth-intro-title">Iniciar sessão</h1>
          <p class="auth-intro-welcome">Entre na sua conta para continuar.</p>
        </div>
        <form @submit.prevent="handleSubmit">
          <div v-if="error" class="auth-error" role="alert">{{ error }}</div>
          <div v-if="needsConfirmation" class="auth-confirm-hint">
            <button type="button" class="auth-link-btn" :disabled="resending" @click="resendConfirmation">
              {{ resending ? 'A reenviar...' : 'Reenviar email de confirmação' }}
            </button>
            <span v-if="resendNotice" class="auth-notice" role="status">{{ resendNotice }}</span>
          </div>
          <div class="auth-field">
            <label for="email">Email</label>
            <input id="email" v-model="email" type="email" required autocomplete="email" placeholder="Introduza o e-mail" />
          </div>
          <div class="auth-field">
            <label for="password">Palavra-passe</label>
            <PasswordInput id="password" v-model="password" autocomplete="current-password" placeholder="Introduza a palavra-passe" />
          </div>
          <div class="auth-forgot">
            <button type="button" class="auth-link-btn" @click="forgotPasswordOpen = true">
              Esqueceu-se da palavra-passe?
            </button>
          </div>
          <button type="submit" class="auth-btn" :disabled="loading">
            {{ loading ? 'A entrar...' : 'Entrar' }}
          </button>
        </form>
        <p class="auth-footer">
          Não tem conta? <RouterLink to="/register">Criar conta</RouterLink>
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
.auth-confirm-hint {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  margin: calc(-1 * var(--space-1)) 0 var(--space-4);
}

.auth-forgot {
  display: flex;
  justify-content: flex-end;
  margin: calc(-1 * var(--space-2)) 0 var(--space-4);
}
</style>
