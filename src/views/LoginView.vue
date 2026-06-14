<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { RouterLink } from 'vue-router'
import iconFinoraFlow from '@/assets/images/finoraflow-icon.png'
import AuthShowcase from '@/components/AuthShowcase.vue'
import ForgotPasswordModal from '@/components/ForgotPasswordModal.vue'
import TermsModal from '@/components/TermsModal.vue'
import PrivacyModal from '@/components/PrivacyModal.vue'
import { authApi } from '@/api/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const forgotPasswordOpen = ref(false)
const termsModalOpen = ref(false)
const privacyModalOpen = ref(false)

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
      error.value = err.rateLimitMessage || 'Demasiados pedidos. Tenta novamente dentro de 1 minuto.'
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
      ? (err.rateLimitMessage || 'Demasiados pedidos. Tenta novamente dentro de 1 minuto.')
      : 'Não foi possível reenviar agora. Tenta novamente daqui a pouco.'
  } finally {
    resending.value = false
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
          <div v-if="needsConfirmation" class="auth-confirm-hint">
            <button type="button" class="auth-resend-link" :disabled="resending" @click="resendConfirmation">
              {{ resending ? 'A reenviar...' : 'Reenviar email de confirmação' }}
            </button>
            <span v-if="resendNotice" class="auth-resend-notice">{{ resendNotice }}</span>
          </div>
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
        <p class="auth-legal">
          Ao entrar, aceita os
          <button type="button" class="auth-legal-link" @click="termsModalOpen = true">Termos e Condições</button>
          e a
          <button type="button" class="auth-legal-link" @click="privacyModalOpen = true">Política de Privacidade</button>
        </p>
      </div>
    </div>
    <AuthShowcase />

    <ForgotPasswordModal
      v-if="forgotPasswordOpen"
      :initial-email="email"
      @close="forgotPasswordOpen = false"
    />

    <TermsModal v-if="termsModalOpen" @close="termsModalOpen = false" />
    <PrivacyModal v-if="privacyModalOpen" @close="privacyModalOpen = false" />
  </div>
</template>

<style scoped>
.auth-legal {
  margin: 1.25rem 0 0;
  text-align: center;
  font-size: 0.75rem;
  line-height: 1.5;
  color: #94a3b8;
}
.auth-legal-link {
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  color: inherit;
  cursor: pointer;
  text-decoration: underline;
}
:global(html.dark) .auth-legal {
  color: #737373;
}

.auth-confirm-hint {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin: -0.25rem 0 1.125rem;
}
.auth-resend-link {
  align-self: flex-start;
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #166534;
  cursor: pointer;
  transition: color 0.15s;
}
.auth-resend-link:hover:not(:disabled) {
  color: #14532d;
  text-decoration: underline;
}
.auth-resend-link:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.auth-resend-notice {
  font-size: 0.8125rem;
  color: #166534;
}
:global(html.dark) .auth-resend-link {
  color: #4ade80;
}
:global(html.dark) .auth-resend-link:hover:not(:disabled) {
  color: #86efac;
}
:global(html.dark) .auth-resend-notice {
  color: #4ade80;
}

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
