<script setup lang="ts">
import PasswordInput from '@/components/PasswordInput.vue'
import { computed, ref } from 'vue'
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

const password = ref('')
const confirm = ref('')
const error = ref('')
const loading = ref(false)
const done = ref(false)

const passwordRules = computed(() => ({
  minLength: password.value.length >= 8,
  hasUpper: /[A-Z]/.test(password.value),
  hasLower: /[a-z]/.test(password.value),
  hasNumber: /\d/.test(password.value),
}))
const passwordValid = computed(() =>
  passwordRules.value.minLength && passwordRules.value.hasUpper && passwordRules.value.hasLower && passwordRules.value.hasNumber
)
const matches = computed(() => confirm.value.length > 0 && confirm.value === password.value)

async function handleSubmit() {
  error.value = ''
  if (!passwordValid.value) {
    error.value = 'A palavra-passe não cumpre os requisitos.'
    return
  }
  if (!matches.value) {
    error.value = 'As palavras-passe não coincidem.'
    return
  }
  loading.value = true
  try {
    await authApi.resetPassword(token.value, password.value)
    done.value = true
  } catch (e: unknown) {
    const err = e as { rateLimited?: boolean; rateLimitMessage?: string; response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
    if (err.rateLimited) {
      error.value = err.rateLimitMessage || 'Demasiados pedidos. Tente novamente dentro de 1 minuto.'
    } else {
      const data = err.response?.data
      if (data?.errors) {
        error.value = Object.values(data.errors).flat().join(' ')
      } else {
        error.value = data?.message || 'O link é inválido ou expirou. Peça um novo a partir do ecrã de início de sessão.'
      }
    }
  } finally {
    loading.value = false
  }
}

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
          <h1 class="auth-intro-title">Nova palavra-passe</h1>
          <p class="auth-intro-welcome">Defina uma nova palavra-passe para a sua conta.</p>
        </div>

        <!-- Sem token -->
        <div v-if="!token" class="auth-error" role="alert">
          Link inválido. Abra o link mais recente que recebeu por email ou peça um novo no
          <RouterLink to="/login">início de sessão</RouterLink>.
        </div>

        <!-- Sucesso -->
        <template v-else-if="done">
          <div class="auth-state">
            <div class="auth-state-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            </div>
            <p class="auth-state-title">Palavra-passe alterada</p>
            <p class="auth-state-text">Já pode iniciar sessão com a nova palavra-passe.</p>
          </div>
          <button type="button" class="auth-btn" @click="goToLogin">Iniciar sessão</button>
        </template>

        <!-- Formulário -->
        <form v-else @submit.prevent="handleSubmit">
          <div v-if="error" class="auth-error" role="alert">{{ error }}</div>
          <div class="auth-field">
            <label for="password">Nova palavra-passe</label>
            <PasswordInput id="password" v-model="password" autocomplete="new-password" placeholder="Introduza a nova palavra-passe" />
            <ul v-if="password.length > 0" class="pw-rules">
              <li :class="{ ok: passwordRules.minLength }">Mínimo 8 caracteres</li>
              <li :class="{ ok: passwordRules.hasUpper }">Uma letra maiúscula</li>
              <li :class="{ ok: passwordRules.hasLower }">Uma letra minúscula</li>
              <li :class="{ ok: passwordRules.hasNumber }">Um número</li>
            </ul>
          </div>
          <div class="auth-field">
            <label for="confirm">Confirmar palavra-passe</label>
            <PasswordInput id="confirm" v-model="confirm" autocomplete="new-password" placeholder="Repita a palavra-passe" />
            <p v-if="confirm.length > 0 && !matches" class="pw-mismatch">As palavras-passe não coincidem.</p>
          </div>
          <button type="submit" class="auth-btn" :disabled="loading || !passwordValid || !matches">
            {{ loading ? 'A guardar...' : 'Guardar palavra-passe' }}
          </button>
        </form>

        <p class="auth-footer">
          Lembrou-se? <RouterLink to="/login">Iniciar sessão</RouterLink>
        </p>
      </div>
    </div>
    <AuthShowcase />
  </div>
</template>
