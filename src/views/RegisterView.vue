<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { RouterLink } from 'vue-router'
import iconFinoraFlow from '@/assets/images/finoraflow-icon.png'
import { coupleInvitationsApi } from '@/api/coupleInvitations'

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
    await authStore.register({
      email: email.value,
      password: password.value,
      firstName: firstName.value,
      lastName: lastName.value,
      ...(inviteToken.value && { inviteToken: inviteToken.value }),
      timeZoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
    router.push('/inicio')
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
</script>

<template>
  <div class="auth-page">
    <div class="auth-brand auth-brand-hero">
      <img :src="iconFinoraFlow" alt="FinoraFlow" class="auth-brand-hero-img" width="800" height="200" />
    </div>
    <div class="auth-body">
    <div class="auth-card auth-card-wide">
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
        Já tens conta? <RouterLink to="/entrar">Entrar</RouterLink>
      </p>
    </div>
    </div>
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
</style>
