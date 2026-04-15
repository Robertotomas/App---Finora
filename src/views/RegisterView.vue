<script setup lang="ts">
import { onMounted, ref } from 'vue'
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
const gender = ref<'Male' | 'Female' | ''>('')
const error = ref('')
const loading = ref(false)

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
      ...(gender.value === 'Male' && { gender: 0 }),
      ...(gender.value === 'Female' && { gender: 1 }),
      ...(inviteToken.value && { inviteToken: inviteToken.value }),
    })
    router.push('/dashboard')
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
    const data = err.response?.data
    if (data?.errors) {
      error.value = Object.values(data.errors).flat().join(' ')
    } else {
      error.value = data?.message || 'Erro ao registar. Tenta novamente.'
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
        <p class="auth-intro-title">Sign-up</p>
        <p class="auth-intro-welcome">Welcome! Let's Start!</p>
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
          <input id="firstName" v-model="firstName" type="text" required placeholder="João" />
        </div>
        <div class="auth-field">
          <label for="lastName">Apelido</label>
          <input id="lastName" v-model="lastName" type="text" required placeholder="Silva" />
        </div>
        <div class="auth-field">
          <label for="gender">Género</label>
          <select id="gender" v-model="gender">
            <option value="">—</option>
            <option value="Male">Masculino</option>
            <option value="Female">Feminino</option>
          </select>
        </div>
        <div class="auth-field">
          <label for="email">Email</label>
          <input id="email" v-model="email" type="email" required placeholder="email@exemplo.pt" />
        </div>
        <div class="auth-field">
          <label for="password">Password</label>
          <input id="password" v-model="password" type="password" required placeholder="Mín. 8 caracteres, maiúscula, minúscula e número" />
        </div>
        <button type="submit" class="auth-btn" :disabled="loading">
          {{ loading ? 'A registar...' : 'Registar' }}
        </button>
      </form>
      <p class="auth-footer">
        Já tens conta? <RouterLink to="/login">Entrar</RouterLink>
      </p>
    </div>
    </div>
  </div>
</template>

<style scoped>
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
