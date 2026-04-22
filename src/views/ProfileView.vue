<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/api/auth'
import type { User } from '@/types/auth'
import { userFromProfileResponse } from '@/types/auth'

const authStore = useAuthStore()

const coupleProfileHint = computed(() => {
  const u = authStore.user
  if (!u?.isCoupleGuest) return ''
  if (u.coupleJoinDataMigrated === null || u.coupleJoinDataMigrated === undefined)
    return 'Conta de parceiro convidado (registada por convite).'
  if (u.coupleJoinDataMigrated === true)
    return 'Os teus dados do agregado anterior foram integrados neste household.'
  return 'Entraste no agregado do convite sem migrar dados anteriores (ou não tinhas dados a migrar).'
})

const firstName = ref('')
const lastName = ref('')
const email = ref('')
const gender = ref<'Male' | 'Female' | ''>('')
const timeZoneId = ref('')

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref(false)

function genderToSelect(g: User['gender']): 'Male' | 'Female' | '' {
  if (g === 0 || g === 'Male') return 'Male'
  if (g === 1 || g === 'Female') return 'Female'
  return ''
}

function fillFromUser(u: User | null) {
  if (!u) return
  firstName.value = u.firstName
  lastName.value = u.lastName
  email.value = u.email
  gender.value = genderToSelect(u.gender)
  timeZoneId.value = u.timeZoneId ?? ''
}

onMounted(async () => {
  fillFromUser(authStore.user)
  loading.value = true
  error.value = ''
  success.value = false
  try {
    const { data } = await authApi.getProfile()
    const u = userFromProfileResponse(data)
    fillFromUser(u)
  } catch {
    error.value = 'Não foi possível carregar o perfil. Tenta novamente.'
    fillFromUser(authStore.user)
  } finally {
    loading.value = false
  }
})

async function handleSubmit() {
  error.value = ''
  success.value = false
  if (!firstName.value.trim() || !lastName.value.trim()) {
    error.value = 'Preenche nome e apelido.'
    return
  }
  saving.value = true
  try {
    const { data } = await authApi.updateProfile({
      firstName: firstName.value.trim(),
      lastName: lastName.value.trim(),
      gender: gender.value === 'Male' ? 0 : gender.value === 'Female' ? 1 : null,
      timeZoneId: timeZoneId.value.trim() || null,
    })
    authStore.applyUserFromProfileResponse(data)
    fillFromUser(authStore.user)
    success.value = true
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
    const d = err.response?.data
    if (d?.errors) {
      error.value = Object.values(d.errors).flat().join(' ')
    } else {
      error.value = d?.message || 'Não foi possível guardar. Tenta novamente.'
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="profile-view">
    <div class="page-header">
      <h1>Perfil</h1>
      <p class="subtitle">Edita os teus dados pessoais</p>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>A carregar perfil…</p>
    </div>

    <div v-else class="content">
      <p v-if="coupleProfileHint" class="couple-profile-hint">{{ coupleProfileHint }}</p>
      <form class="profile-card" @submit.prevent="handleSubmit">
        <div v-if="error" class="form-error">{{ error }}</div>
        <div v-if="success" class="form-success">Alterações guardadas.</div>

        <label class="field">
          <span class="field-label">Nome</span>
          <input v-model="firstName" class="field-input" type="text" maxlength="100" required autocomplete="given-name" />
        </label>

        <label class="field">
          <span class="field-label">Apelido</span>
          <input v-model="lastName" class="field-input" type="text" maxlength="100" required autocomplete="family-name" />
        </label>

        <label class="field">
          <span class="field-label">Género</span>
          <select v-model="gender" class="field-input">
            <option value="">—</option>
            <option value="Male">Masculino</option>
            <option value="Female">Feminino</option>
          </select>
        </label>

        <label class="field field-readonly">
          <span class="field-label">Email</span>
          <input :value="email" class="field-input" type="email" disabled readonly />
          <span class="field-hint">O email não pode ser alterado aqui.</span>
        </label>

        <label class="field">
          <span class="field-label">Fuso horário (IANA)</span>
          <input
            v-model="timeZoneId"
            class="field-input"
            type="text"
            maxlength="100"
            placeholder="Europe/Lisbon"
            autocomplete="off"
          />
          <span class="field-hint">Usado para gerar o relatório mensal no dia 1 (mês anterior). Vazio = UTC.</span>
        </label>

        <div class="form-actions">
          <button type="submit" class="btn-save" :disabled="saving">
            {{ saving ? 'A guardar…' : 'Guardar alterações' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.profile-view {
  max-width: min(520px, 100%);
  margin: 0 auto;
  padding: 0 0 2.5rem;
}

.page-header {
  margin-bottom: 1.5rem;
}

.page-header h1 {
  margin: 0 0 0.35rem;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
}

.subtitle {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--color-text-muted);
}

.couple-profile-hint {
  margin: 0 0 1rem 0;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  line-height: 1.45;
  color: var(--color-text);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--app-radius-md, 12px);
}

.loading-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--color-text-muted);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border);
  border-top-color: #166534;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.profile-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 1.75rem;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
  display: flex;
  flex-direction: column;
  gap: 1.125rem;
}

.form-error {
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
  font-size: 0.8125rem;
  font-weight: 500;
}

.form-success {
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: #ecfdf5;
  color: #166534;
  border: 1px solid #a7f3d0;
  font-size: 0.8125rem;
  font-weight: 600;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-label {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.field-input {
  padding: 0.5625rem 0.875rem;
  border: 1.5px solid var(--color-input-border);
  border-radius: 10px;
  font-size: 0.9375rem;
  background: var(--color-input-bg);
  color: var(--color-text);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.field-input:focus {
  outline: none;
  border-color: #166534;
  box-shadow: 0 0 0 3px rgba(22, 101, 52, 0.08);
}

.field-readonly .field-input:disabled {
  opacity: 0.85;
  cursor: not-allowed;
}

.field-hint {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.form-actions {
  margin-top: 0.5rem;
}

.btn-save {
  padding: 0.625rem 1.5rem;
  font-size: 0.875rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #166534 0%, #15803d 100%);
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
  box-shadow: 0 1px 3px rgba(22, 101, 52, 0.2);
}

.btn-save:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(22, 101, 52, 0.25);
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
