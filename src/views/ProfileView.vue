<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/api/auth'
import type { User } from '@/types/auth'
import { userFromProfileResponse } from '@/types/auth'

const authStore = useAuthStore()

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
  border-radius: var(--app-radius-md, 12px);
  padding: 1.5rem;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-error {
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
  font-size: 0.875rem;
}

.form-success {
  padding: 0.65rem 0.75rem;
  border-radius: 8px;
  background: #ecfdf5;
  color: #166534;
  border: 1px solid #a7f3d0;
  font-size: 0.875rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.field-input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-input-border);
  border-radius: 8px;
  font-size: 0.9375rem;
  background: var(--color-input-bg);
  color: var(--color-text);
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
  padding: 0.55rem 1.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #fff;
  background: #166534;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.btn-save:hover:not(:disabled) {
  background: #15803d;
}

.btn-save:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
