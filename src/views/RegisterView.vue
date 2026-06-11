<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { RouterLink } from 'vue-router'
import iconFinoraFlow from '@/assets/images/finoraflow-icon.png'
import AuthShowcase from '@/components/AuthShowcase.vue'
import { coupleInvitationsApi } from '@/api/coupleInvitations'
import { authApi } from '@/api/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const inviteToken = ref<string | null>(null)
const inviteValidating = ref(false)
const inviteInfo = ref<{ inviterName?: string; householdName?: string; inviteeEmailMasked?: string } | null>(null)

const email = ref('')
const password = ref('')
const firstName = ref('')
const lastName = ref('')
const error = ref('')
const loading = ref(false)

// Ecrã "confirma o teu email" depois de registar (fluxo normal).
const pendingEmail = ref('')
const resending = ref(false)
const resendNotice = ref('')

const passwordRules = computed(() => ({
  minLength: password.value.length >= 8,
  hasUpper: /[A-Z]/.test(password.value),
  hasLower: /[a-z]/.test(password.value),
  hasNumber: /\d/.test(password.value),
}))
const passwordValid = computed(() =>
  passwordRules.value.minLength && passwordRules.value.hasUpper && passwordRules.value.hasLower && passwordRules.value.hasNumber
)

onMounted(async () => {
  const t = route.query.invite
  if (typeof t === 'string' && t.length > 0) {
    inviteToken.value = t
    inviteValidating.value = true
    try {
      const { data } = await coupleInvitationsApi.validate(t)
      if (data.valid) {
        inviteInfo.value = {
          inviterName: data.inviterName,
          householdName: data.householdName,
          inviteeEmailMasked: data.inviteeEmailMasked,
        }
      } else {
        error.value = 'Este link de convite não é válido ou expirou.'
      }
    } catch {
      error.value = 'Não foi possível validar o convite.'
    } finally {
      inviteValidating.value = false
    }
  }
})

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    const result = await authStore.register({
      email: email.value,
      password: password.value,
      firstName: firstName.value,
      lastName: lastName.value,
      ...(inviteToken.value && { inviteToken: inviteToken.value }),
      timeZoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
    // Fluxo normal: falta confirmar o email → mostra o ecrã de confirmação.
    if (result.requiresEmailConfirmation) {
      pendingEmail.value = result.email
      return
    }
    // Convite de casal: sessão iniciada.
    router.push('/overview')
  } catch (e: unknown) {
    const err = e as { rateLimited?: boolean; rateLimitMessage?: string; response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
    if (err.rateLimited) {
      error.value = err.rateLimitMessage || 'Demasiados pedidos. Tenta novamente dentro de 1 minuto.'
    } else {
      const data = err.response?.data
      if (data?.errors) {
        error.value = Object.values(data.errors).flat().join(' ')
      } else {
        error.value = data?.message || 'Erro ao registar. Tenta novamente.'
      }
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
    await authApi.resendEmailConfirmation(pendingEmail.value)
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
      <!-- Conta criada: falta confirmar o email -->
      <div v-if="pendingEmail" class="auth-left-inner">
        <div class="confirm-pending">
          <div class="confirm-pending-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          </div>
          <p class="confirm-pending-title">Confirma o teu email</p>
          <p class="confirm-pending-text">
            Enviámos um link de confirmação para <strong>{{ pendingEmail }}</strong>.
            Abre-o para ativar a conta e poder iniciar sessão.
          </p>
        </div>
        <button type="button" class="auth-btn" :disabled="resending" @click="resendConfirmation">
          {{ resending ? 'A reenviar...' : 'Reenviar email de confirmação' }}
        </button>
        <p v-if="resendNotice" class="confirm-resend-notice">{{ resendNotice }}</p>
        <p class="auth-footer">
          Já confirmaste? <RouterLink to="/login">Iniciar sessão</RouterLink>
        </p>
      </div>

      <div v-else class="auth-left-inner">
        <div class="auth-intro">
          <p class="auth-intro-title">Criar conta</p>
          <p class="auth-intro-welcome">Bem-vindo! Vamos começar!</p>
          <p v-if="inviteValidating" class="auth-intro-welcome">A validar convite…</p>
          <p v-else-if="inviteInfo" class="auth-invite-banner">
            Convite de <strong>{{ inviteInfo.inviterName || 'alguém' }}</strong>
            <span v-if="inviteInfo.householdName"> · {{ inviteInfo.householdName }}</span>
            <br />
            <span class="auth-invite-email-hint">Usa o email convidado: {{ inviteInfo.inviteeEmailMasked }}</span>
          </p>
        </div>
        <form @submit.prevent="handleSubmit">
          <div v-if="error" class="auth-error">{{ error }}</div>
          <div class="auth-field">
            <label for="firstName">Nome</label>
            <input id="firstName" v-model="firstName" type="text" required placeholder="Introduza o nome" />
          </div>
          <div class="auth-field">
            <label for="lastName">Apelido</label>
            <input id="lastName" v-model="lastName" type="text" required placeholder="Introduza o apelido" />
          </div>
          <div class="auth-field">
            <label for="email">Email</label>
            <input id="email" v-model="email" type="email" required placeholder="Introduza o e-mail" />
          </div>
          <div class="auth-field">
            <label for="password">Password</label>
            <input id="password" v-model="password" type="password" required placeholder="Introduza a palavra-passe" />
            <ul v-if="password.length > 0" class="pw-rules">
              <li :class="{ ok: passwordRules.minLength }">Mínimo 8 caracteres</li>
              <li :class="{ ok: passwordRules.hasUpper }">Uma letra maiúscula</li>
              <li :class="{ ok: passwordRules.hasLower }">Uma letra minúscula</li>
              <li :class="{ ok: passwordRules.hasNumber }">Um número</li>
            </ul>
          </div>
          <button type="submit" class="auth-btn" :disabled="loading || !passwordValid">
            {{ loading ? 'A registar...' : 'Registar' }}
          </button>
        </form>
        <p class="auth-footer">
          Já tens conta? <RouterLink to="/login">Entrar</RouterLink>
        </p>
      </div>
    </div>
    <AuthShowcase />
  </div>
</template>

<style scoped>
/* Registo tem mais campos (mais alto) — fica mais perto do topo que o login */
.auth-left-inner {
  margin: clamp(3.5rem, 12vh, 7rem) 0 auto;
}

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
.auth-invite-banner {
  margin-top: 0.75rem;
  font-size: 0.9rem;
  color: #cbd5e1;
  line-height: 1.45;
}
.auth-invite-email-hint {
  font-size: 0.85rem;
  color: #94a3b8;
}

/* Ecrã "confirma o teu email" */
.confirm-pending {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 1.25rem;
}
.confirm-pending-icon {
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
:global(html.dark) .confirm-pending-icon {
  background: rgba(22, 101, 52, 0.2);
  color: #4ade80;
}
.confirm-pending-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 0.4rem;
}
:global(html.dark) .confirm-pending-title {
  color: #ffffff;
}
.confirm-pending-text {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0;
  line-height: 1.5;
}
:global(html.dark) .confirm-pending-text {
  color: #a3a3a3;
}
.confirm-resend-notice {
  margin: 0.75rem 0 0;
  font-size: 0.8125rem;
  color: #166534;
  text-align: center;
}
:global(html.dark) .confirm-resend-notice {
  color: #4ade80;
}
</style>
