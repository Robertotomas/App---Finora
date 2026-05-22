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
const timeZoneId = ref('')

const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

const timezoneOptions = [
  { value: '', label: '— Nenhum (UTC)' },
  { value: '__auto__', label: `Detetar automaticamente (${browserTimezone})` },
  { value: 'Europe/Lisbon', label: 'Europe/Lisbon' },
  { value: 'Europe/London', label: 'Europe/London' },
  { value: 'Europe/Madrid', label: 'Europe/Madrid' },
  { value: 'Europe/Paris', label: 'Europe/Paris' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin' },
  { value: 'Europe/Rome', label: 'Europe/Rome' },
  { value: 'Europe/Amsterdam', label: 'Europe/Amsterdam' },
  { value: 'Europe/Brussels', label: 'Europe/Brussels' },
  { value: 'Europe/Zurich', label: 'Europe/Zurich' },
  { value: 'Europe/Warsaw', label: 'Europe/Warsaw' },
  { value: 'Europe/Athens', label: 'Europe/Athens' },
  { value: 'Europe/Helsinki', label: 'Europe/Helsinki' },
  { value: 'Europe/Moscow', label: 'Europe/Moscow' },
  { value: 'Atlantic/Azores', label: 'Atlantic/Azores' },
  { value: 'America/New_York', label: 'America/New_York' },
  { value: 'America/Chicago', label: 'America/Chicago' },
  { value: 'America/Denver', label: 'America/Denver' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles' },
  { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo' },
  { value: 'America/Argentina/Buenos_Aires', label: 'America/Argentina/Buenos_Aires' },
  { value: 'America/Mexico_City', label: 'America/Mexico_City' },
  { value: 'America/Toronto', label: 'America/Toronto' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland' },
  { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg' },
]

const ensuredOptions = computed(() => {
  const current = timeZoneId.value
  if (!current || current === '__auto__' || timezoneOptions.some(o => o.value === current)) {
    return timezoneOptions
  }
  const copy = [...timezoneOptions]
  copy.splice(2, 0, { value: current, label: current })
  return copy
})

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const success = ref(false)

function fillFromUser(u: User | null) {
  if (!u) return
  firstName.value = u.firstName
  lastName.value = u.lastName
  email.value = u.email
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
      gender: null,
      timeZoneId: timeZoneId.value === '__auto__' ? browserTimezone : (timeZoneId.value.trim() || null),
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
  <div class="profile-page">
    <div class="page-header">
      <div class="page-header-text">
        <h1 class="page-title">Perfil</h1>
        <p class="page-subtitle">Edita os teus dados pessoais</p>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>A carregar perfil…</p>
    </div>

    <template v-else>
      <p v-if="coupleProfileHint" class="couple-hint">{{ coupleProfileHint }}</p>

      <form class="card" @submit.prevent="handleSubmit">
        <div v-if="error" class="form-error">{{ error }}</div>
        <div v-if="success" class="form-success">Alterações guardadas.</div>

        <div class="section-label">Dados pessoais</div>
        <div class="form-grid">
          <label class="field">
            <span class="field-label">Nome</span>
            <input v-model="firstName" class="field-input" type="text" maxlength="100" required autocomplete="given-name" />
          </label>
          <label class="field">
            <span class="field-label">Apelido</span>
            <input v-model="lastName" class="field-input" type="text" maxlength="100" required autocomplete="family-name" />
          </label>
        </div>

        <div class="section-divider"></div>

        <div class="section-label">Conta</div>
        <div class="form-grid">
          <label class="field field-readonly">
            <span class="field-label">Email</span>
            <input :value="email" class="field-input" type="email" disabled readonly />
            <span class="field-hint">O email não pode ser alterado.</span>
          </label>
          <label class="field">
            <span class="field-label">Fuso horário</span>
            <select v-model="timeZoneId" class="field-input">
              <option v-for="tz in ensuredOptions" :key="tz.value" :value="tz.value">{{ tz.label }}</option>
            </select>
          </label>
        </div>

        <div class="section-divider"></div>

        <div class="form-actions">
          <button type="submit" class="btn-save" :disabled="saving">
{{ saving ? 'A guardar…' : 'Guardar alterações' }}
          </button>
        </div>
      </form>
    </template>
  </div>
</template>

<style scoped>
.profile-page {
  max-width: min(860px, 100%);
  margin: 0 auto;
  padding: 0 0 3rem;
}

/* ── Page header ── */
.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
  letter-spacing: -0.02em;
}

.page-subtitle {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0.25rem 0 0;
}

/* ── Couple hint ── */
.couple-hint {
  margin: 0 0 1rem;
  padding: 0.75rem 1rem;
  font-size: 0.8125rem;
  line-height: 1.45;
  color: var(--color-text);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
}

/* ── Loading ── */
.loading-state {
  text-align: center;
  padding: 3rem;
  color: var(--color-text-muted);
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--color-border);
  border-top-color: #166534;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Feedback banners ── */
.form-error {
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
  font-size: 0.8125rem;
  font-weight: 500;
  margin-bottom: 1rem;
}

.form-success {
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: #ecfdf5;
  color: #166534;
  border: 1px solid #a7f3d0;
  font-size: 0.8125rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

/* ── Card ── */
.card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 1.5rem;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
}

/* ── Sections inside card ── */
.section-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 0.75rem;
}

.section-divider {
  height: 1px;
  background: var(--color-border);
  margin: 1.25rem 0;
}

/* ── Form grid ── */
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.875rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text-muted);
}

.field-input {
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--color-input-border);
  border-radius: 10px;
  font-size: 0.875rem;
  font-family: inherit;
  background: var(--color-input-bg);
  color: var(--color-text);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.field-input:focus {
  outline: none;
  border-color: #166534;
  box-shadow: 0 0 0 3px rgba(22, 101, 52, 0.12);
}

.field-readonly .field-input:disabled {
  opacity: 0.85;
  cursor: not-allowed;
}

.field-hint {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

/* ── Actions ── */
.form-actions {
  display: flex;
  justify-content: flex-end;
}

.btn-save {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  color: #fff;
  background: #166534;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
  white-space: nowrap;
}

.btn-save:hover:not(:disabled) {
  background: #15803d;
  transform: translateY(-1px);
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 600px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .card {
    padding: 1.125rem;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
