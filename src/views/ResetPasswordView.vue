<script setup lang="ts">
import { computed, ref } from 'vue'
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
      error.value = err.rateLimitMessage || 'Demasiados pedidos. Tenta novamente dentro de 1 minuto.'
    } else {
      const data = err.response?.data
      if (data?.errors) {
        error.value = Object.values(data.errors).flat().join(' ')
      } else {
        error.value = data?.message || 'O link é inválido ou expirou. Pede um novo a partir do ecrã de início de sessão.'
      }
    }
  } finally {
    loading.value = false
  }
}

function goToLogin() {
  router.push('/entrar')
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
          <p class="auth-intro-title">Nova palavra-passe</p>
          <p class="auth-intro-welcome">Define uma nova palavra-passe para a tua conta.</p>
        </div>

        <!-- Sem token -->
        <div v-if="!token" class="auth-error">
          Link inválido. Abre o link mais recente que recebeste por email ou pede um novo no
          <RouterLink to="/entrar">início de sessão</RouterLink>.
        </div>

        <!-- Sucesso -->
        <template v-else-if="done">
          <div class="reset-success">
            <div class="reset-success-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            </div>
            <p class="reset-success-title">Palavra-passe alterada</p>
            <p class="reset-success-text">Já podes iniciar sessão com a nova palavra-passe.</p>
          </div>
          <button type="button" class="auth-btn" @click="goToLogin">Iniciar sessão</button>
        </template>

        <!-- Formulário -->
        <form v-else @submit.prevent="handleSubmit">
          <div v-if="error" class="auth-error">{{ error }}</div>
          <div class="auth-field">
            <label for="password">Nova palavra-passe</label>
            <input id="password" v-model="password" type="password" required placeholder="Introduza a nova palavra-passe" />
            <ul v-if="password.length > 0" class="pw-rules">
              <li :class="{ ok: passwordRules.minLength }">Mínimo 8 caracteres</li>
              <li :class="{ ok: passwordRules.hasUpper }">Uma letra maiúscula</li>
              <li :class="{ ok: passwordRules.hasLower }">Uma letra minúscula</li>
              <li :class="{ ok: passwordRules.hasNumber }">Um número</li>
            </ul>
          </div>
          <div class="auth-field">
            <label for="confirm">Confirmar palavra-passe</label>
            <input id="confirm" v-model="confirm" type="password" required placeholder="Repita a palavra-passe" />
            <p v-if="confirm.length > 0 && !matches" class="pw-mismatch">As palavras-passe não coincidem.</p>
          </div>
          <button type="submit" class="auth-btn" :disabled="loading || !passwordValid || !matches">
            {{ loading ? 'A guardar...' : 'Guardar palavra-passe' }}
          </button>
        </form>

        <p class="auth-footer">
          Lembraste-te? <RouterLink to="/entrar">Iniciar sessão</RouterLink>
        </p>
      </div>
    </div>
    <AuthShowcase />
  </div>
</template>

<style scoped>
.pw-rules {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  font-size: 0.75rem;
  color: #ef4444;
}
.pw-rules li.ok {
  color: #22c55e;
}
.pw-rules li::before {
  content: '✕ ';
}
.pw-rules li.ok::before {
  content: '✓ ';
}
.pw-mismatch {
  margin: 0.4rem 0 0;
  font-size: 0.75rem;
  color: #ef4444;
}

.reset-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 1.25rem;
}
.reset-success-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #ecfdf5;
  color: #166534;
  margin-bottom: 1rem;
}
:global(html.dark) .reset-success-icon {
  background: rgba(22, 101, 52, 0.2);
  color: #4ade80;
}
.reset-success-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 0.4rem;
}
:global(html.dark) .reset-success-title {
  color: #ffffff;
}
.reset-success-text {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0;
  line-height: 1.45;
}
:global(html.dark) .reset-success-text {
  color: #a3a3a3;
}
</style>
