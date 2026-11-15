<script setup lang="ts">
import PasswordInput from '@/components/PasswordInput.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { RouterLink } from 'vue-router'
import AppLogo from '@/components/AppLogo.vue'
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
      error.value = err.rateLimitMessage || 'Demasiados pedidos. Tente novamente dentro de 1 minuto.'
    } else {
      const data = err.response?.data
      if (data?.errors) {
        error.value = Object.values(data.errors).flat().join(' ')
      } else {
        error.value = data?.message || 'Erro ao registar. Tente novamente.'
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
      <!-- Conta criada: falta confirmar o email -->
      <div v-if="pendingEmail" class="auth-left-inner">
        <div class="auth-state">
          <div class="auth-state-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          </div>
          <h1 class="auth-state-title">Confirme o seu email</h1>
          <p class="auth-state-text">
            Enviámos um link de confirmação para <strong>{{ pendingEmail }}</strong>.
            Abra-o para ativar a conta e poder iniciar sessão.
          </p>
        </div>
        <button type="button" class="auth-btn" :disabled="resending" @click="resendConfirmation">
          {{ resending ? 'A reenviar...' : 'Reenviar email de confirmação' }}
        </button>
        <p v-if="resendNotice" class="auth-notice confirm-resend-notice" role="status">{{ resendNotice }}</p>
        <p class="auth-footer">
          Já confirmou? <RouterLink to="/login">Iniciar sessão</RouterLink>
        </p>
      </div>

      <div v-else class="auth-left-inner">
        <div class="auth-intro">
          <h1 class="auth-intro-title">Criar conta</h1>
          <p class="auth-intro-welcome">Comece a organizar as suas finanças em poucos minutos.</p>
          <p v-if="inviteValidating" class="auth-intro-welcome">A validar convite…</p>
          <p v-else-if="inviteInfo" class="auth-invite-banner">
            Convite de <strong>{{ inviteInfo.inviterName || 'alguém' }}</strong>
            <span v-if="inviteInfo.householdName"> · {{ inviteInfo.householdName }}</span>
            <br />
            <span class="auth-invite-email-hint">Use o email convidado: {{ inviteInfo.inviteeEmailMasked }}</span>
          </p>
        </div>
        <form @submit.prevent="handleSubmit">
          <div v-if="error" class="auth-error" role="alert">{{ error }}</div>
          <div class="auth-field">
            <label for="firstName">Nome</label>
            <input id="firstName" v-model="firstName" type="text" required autocomplete="given-name" placeholder="Introduza o nome" />
          </div>
          <div class="auth-field">
            <label for="lastName">Apelido</label>
            <input id="lastName" v-model="lastName" type="text" required autocomplete="family-name" placeholder="Introduza o apelido" />
          </div>
          <div class="auth-field">
            <label for="email">Email</label>
            <input id="email" v-model="email" type="email" required autocomplete="email" placeholder="Introduza o e-mail" />
          </div>
          <div class="auth-field">
            <label for="password">Palavra-passe</label>
            <PasswordInput id="password" v-model="password" autocomplete="new-password" placeholder="Introduza a palavra-passe" />
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
              <button type="button" class="auth-link-btn terms-link" @click="termsModalOpen = true">Termos e Condições</button>
              e a
              <button type="button" class="auth-link-btn terms-link" @click="privacyModalOpen = true">Política de Privacidade</button>
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

.terms-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 var(--space-5);
}

.terms-check {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1.5px solid var(--color-border-strong);
  border-radius: 6px;
  background: var(--color-surface);
  color: var(--color-on-primary);
  cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast);
}

.terms-check:hover {
  border-color: var(--color-primary);
}

.terms-check:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.terms-check.checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.terms-text {
  font-size: var(--text-sm);
  line-height: 1.4;
  color: var(--color-text);
}

.terms-link {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.terms-help {
  margin: calc(-1 * var(--space-3)) 0 var(--space-5);
  font-size: var(--text-xs);
  line-height: 1.4;
  color: var(--color-text-muted);
}

.auth-invite-banner {
  margin: calc(-1 * var(--space-6)) 0 var(--space-6);
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--color-text);
  background: var(--color-primary-soft);
  border: 1px solid var(--color-primary-soft-border);
  border-radius: var(--radius-sm);
}

.auth-invite-banner strong {
  color: var(--color-text-strong);
}

.auth-invite-email-hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.confirm-resend-notice {
  margin: var(--space-3) 0 0;
  text-align: center;
}
</style>
