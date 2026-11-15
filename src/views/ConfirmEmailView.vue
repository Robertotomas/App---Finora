<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import AppLogo from '@/components/AppLogo.vue'
import AuthShowcase from '@/components/AuthShowcase.vue'
import { authApi } from '@/api/auth'

const route = useRoute()
const router = useRouter()

const token = computed(() => {
  const t = route.query.token
  return typeof t === 'string' ? t : ''
})

type State = 'loading' | 'success' | 'error'
const state = ref<State>('loading')
const errorMessage = ref('')

onMounted(async () => {
  if (!token.value) {
    state.value = 'error'
    errorMessage.value = 'Link inválido. Abra o link mais recente que recebeu por email.'
    return
  }
  try {
    await authApi.confirmEmail(token.value)
    state.value = 'success'
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } }
    state.value = 'error'
    errorMessage.value =
      err.response?.data?.message ||
      'O link é inválido ou expirou. Tente iniciar sessão para receber um novo email de confirmação.'
  }
})

function goToLogin() {
  router.push('/login')
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
          <h1 class="auth-intro-title">Confirmar email</h1>
        </div>

        <!-- A confirmar -->
        <div v-if="state === 'loading'" class="auth-state confirm-loading" role="status">
          <span class="confirm-spinner" aria-hidden="true"></span>
          <p class="auth-state-text">A confirmar o seu email…</p>
        </div>

        <!-- Sucesso -->
        <template v-else-if="state === 'success'">
          <div class="auth-state">
            <div class="auth-state-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            </div>
            <p class="auth-state-title">Email confirmado</p>
            <p class="auth-state-text">A sua conta está ativa. Já pode iniciar sessão.</p>
          </div>
          <button type="button" class="auth-btn" @click="goToLogin">Iniciar sessão</button>
        </template>

        <!-- Erro -->
        <template v-else>
          <div class="auth-state">
            <div class="auth-state-icon auth-state-icon--err" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
            </div>
            <p class="auth-state-title">Não foi possível confirmar</p>
            <p class="auth-state-text">{{ errorMessage }}</p>
          </div>
          <button type="button" class="auth-btn" @click="goToLogin">Ir para o início de sessão</button>
        </template>

        <p class="auth-footer">
          <RouterLink to="/login">Voltar ao início de sessão</RouterLink>
        </p>
      </div>
    </div>
    <AuthShowcase />
  </div>
</template>

<style scoped>
.confirm-loading {
  margin-top: var(--space-6);
}

.confirm-spinner {
  width: 32px;
  height: 32px;
  margin-bottom: var(--space-4);
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: confirm-spin 0.8s linear infinite;
}

@keyframes confirm-spin {
  to { transform: rotate(360deg); }
}
</style>
