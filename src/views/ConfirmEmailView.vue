<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import iconFinoraFlow from '@/assets/images/finoraflow-icon.png'
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
        <img :src="iconFinoraFlow" alt="FinoraFlow" class="auth-brand-img" />
      </div>
      <div class="auth-left-inner">
        <div class="auth-intro">
          <p class="auth-intro-title">Confirmar email</p>
        </div>

        <!-- A confirmar -->
        <div v-if="state === 'loading'" class="confirm-state">
          <p class="confirm-state-text">A confirmar o seu email…</p>
        </div>

        <!-- Sucesso -->
        <template v-else-if="state === 'success'">
          <div class="confirm-state">
            <div class="confirm-state-icon confirm-state-icon--ok">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            </div>
            <p class="confirm-state-title">Email confirmado</p>
            <p class="confirm-state-text">A sua conta está ativa. Já pode iniciar sessão.</p>
          </div>
          <button type="button" class="auth-btn" @click="goToLogin">Iniciar sessão</button>
        </template>

        <!-- Erro -->
        <template v-else>
          <div class="confirm-state">
            <div class="confirm-state-icon confirm-state-icon--err">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
            </div>
            <p class="confirm-state-title">Não foi possível confirmar</p>
            <p class="confirm-state-text">{{ errorMessage }}</p>
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
.confirm-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 1.25rem;
}
.confirm-state-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  margin-bottom: 1rem;
}
.confirm-state-icon--ok {
  background: #ecfdf5;
  color: #166534;
}
.confirm-state-icon--err {
  background: #fef2f2;
  color: #b91c1c;
}
:global(html.dark) .confirm-state-icon--ok {
  background: rgba(22, 101, 52, 0.2);
  color: #4ade80;
}
:global(html.dark) .confirm-state-icon--err {
  background: rgba(127, 29, 29, 0.25);
  color: #fca5a5;
}
.confirm-state-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 0.4rem;
}
:global(html.dark) .confirm-state-title {
  color: #ffffff;
}
.confirm-state-text {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
}
:global(html.dark) .confirm-state-text {
  color: #a3a3a3;
}
</style>
