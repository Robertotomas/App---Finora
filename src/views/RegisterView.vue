<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { RouterLink } from 'vue-router'
import iconFinoraFlow from '@/assets/images/finoraflow-icon.png'
import AuthShowcase from '@/components/AuthShowcase.vue'
import TermsModal from '@/components/TermsModal.vue'
import PrivacyModal from '@/components/PrivacyModal.vue'
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

// Ecrã "confirme o seu email" depois de registar (fluxo normal).
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

// Termos + Política: a checkbox só é pressionável depois de ler AMBOS até ao fim.
const termsModalOpen = ref(false)
const privacyModalOpen = ref(false)
const termsRead = ref(false)
const privacyRead = ref(false)
const acceptedTerms = ref(false)

const bothRead = computed(() => termsRead.value && privacyRead.value)

// Assim que os dois documentos são lidos até ao fim, marca a checkbox automaticamente.
watch(bothRead, (read) => {
  if (read) acceptedTerms.value = true
})

function onTermsCheckboxClick() {
  // Enquanto faltar ler algum documento, clicar na checkbox abre o que falta.
  if (!termsRead.value) {
    termsModalOpen.value = true
    return
  }
  if (!privacyRead.value) {
    privacyModalOpen.value = true
    return
  }
  acceptedTerms.value = !acceptedTerms.value
}

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
          <p class="confirm-pending-title">Confirme o seu email</p>
          <p class="confirm-pending-text">
            Enviámos um link de confirmação para <strong>{{ pendingEmail }}</strong>.
            Abra-o para ativar a conta e poder iniciar sessão.
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
          <div class="terms-row">
            <button
              type="button"
              class="terms-check"
              :class="{ checked: acceptedTerms }"
              role="checkbox"
              :aria-checked="acceptedTerms"
              aria-label="Li e aceito os Termos e Condições"
              @click="onTermsCheckboxClick"
            >
              <svg v-if="acceptedTerms" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            </button>
            <span class="terms-text">
              Li e aceito os
              <button type="button" class="terms-link" @click="termsModalOpen = true">Termos e Condições</button>
              e a
              <button type="button" class="terms-link" @click="privacyModalOpen = true">Política de Privacidade</button>
            </span>
          </div>
          <p v-if="!bothRead" class="terms-help">Abra e leia os dois documentos até ao fim para poder aceitar.</p>
          <button type="submit" class="auth-btn" :disabled="loading || !passwordValid || !acceptedTerms">
            {{ loading ? 'A registar...' : 'Registar' }}
          </button>
        </form>
        <p class="auth-footer">
          Já tem conta? <RouterLink to="/login">Entrar</RouterLink>
        </p>
      </div>
    </div>
    <AuthShowcase />

    <TermsModal
      v-if="termsModalOpen"
      @close="termsModalOpen = false"
      @read="termsRead = true"
    />

    <PrivacyModal
      v-if="privacyModalOpen"
      @close="privacyModalOpen = false"
      @read="privacyRead = true"
    />
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
.terms-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0 0 1.25rem;
}
.terms-check {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1.5px solid #cbd5e1;
  border-radius: 6px;
  background: #ffffff;
  color: #ffffff;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.terms-check.checked {
  background: #166534;
  border-color: #166534;
}
.terms-check:hover {
  border-color: #166534;
}
.terms-text {
  font-size: 0.8125rem;
  color: #334155;
  line-height: 1.4;
}
.terms-link {
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #166534;
  cursor: pointer;
  text-decoration: underline;
}
.terms-link:hover {
  color: #14532d;
}
.terms-help {
  margin: -0.75rem 0 1.25rem;
  font-size: 0.75rem;
  color: #94a3b8;
  line-height: 1.4;
}
:global(html.dark) .terms-help {
  color: #737373;
}
:global(html.dark) .terms-check {
  background: #1f1f1f;
  border-color: #3a3a3a;
}
:global(html.dark) .terms-check.checked {
  background: #166534;
  border-color: #166534;
}
:global(html.dark) .terms-text {
  color: #d4d4d4;
}
:global(html.dark) .terms-link {
  color: #4ade80;
}
:global(html.dark) .terms-link:hover {
  color: #86efac;
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

/* Ecrã "confirme o seu email" */
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
