<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/api/auth'
import type { User } from '@/types/auth'
import { userFromProfileResponse } from '@/types/auth'
import BaseSelect from '@/components/BaseSelect.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import { useToast } from '@/composables/useToast'

const authStore = useAuthStore()
const toast = useToast()

const coupleProfileHint = computed(() => {
  const u = authStore.user
  if (!u?.isCoupleGuest) return ''
  if (u.coupleJoinDataMigrated === null || u.coupleJoinDataMigrated === undefined)
    return 'Conta de parceiro convidado (registada por convite).'
  if (u.coupleJoinDataMigrated === true)
    return 'Os seus dados do agregado anterior foram integrados neste household.'
  return 'Entrou no agregado do convite sem migrar dados anteriores (ou não tinha dados a migrar).'
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
    error.value = 'Não foi possível carregar o perfil. Tente novamente.'
    fillFromUser(authStore.user)
  } finally {
    loading.value = false
  }
})

async function handleSubmit() {
  error.value = ''
  success.value = false
  if (!firstName.value.trim() || !lastName.value.trim()) {
    error.value = 'Preencha o nome e o apelido.'
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
    toast.success('Perfil atualizado')
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
    const d = err.response?.data
    if (d?.errors) {
      error.value = Object.values(d.errors).flat().join(' ')
    } else {
      error.value = d?.message || 'Não foi possível guardar. Tente novamente.'
    }
    toast.error(error.value)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="profile-page">
    <PageHeader title="Perfil" />

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>A carregar perfil…</p>
    </div>

    <form v-else class="ui-stack" @submit.prevent="handleSubmit">
      <div class="identity">
        <UserAvatar :first-name="firstName" :last-name="lastName" :size="56" />
        <div class="identity-text">
          <p class="identity-name">{{ [firstName, lastName].filter(Boolean).join(' ') || 'Sem nome' }}</p>
          <p class="identity-email">{{ email }}</p>
        </div>
      </div>

      <p v-if="coupleProfileHint" class="couple-hint">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
        <span>{{ coupleProfileHint }}</span>
      </p>

      <div v-if="error" class="form-error" role="alert">{{ error }}</div>

      <UiCard title="Dados pessoais" subtitle="O nome que aparece na aplicação e ao seu parceiro.">
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
      </UiCard>

      <UiCard title="Conta" subtitle="Email de acesso e fuso horário usado nas datas e relatórios.">
        <div class="form-grid">
          <label class="field">
            <span class="field-label">Email</span>
            <input :value="email" class="field-input" type="email" disabled readonly />
            <span class="field-hint">O email não pode ser alterado.</span>
          </label>
          <div class="field">
            <span class="field-label">Fuso horário</span>
            <BaseSelect
              :model-value="timeZoneId"
              :options="ensuredOptions"
              placeholder="Escolha um fuso horário"
              @update:model-value="(v) => (timeZoneId = String(v))"
            />
          </div>
        </div>
        <div class="form-actions">
          <UiButton type="submit" :loading="saving">
            {{ saving ? 'A guardar…' : 'Guardar alterações' }}
          </UiButton>
        </div>
      </UiCard>
    </form>
  </div>
</template>

<style scoped>
/* Mesma largura/alinhamento das outras páginas (título no mesmo sítio); o conteúdo, por ser
   formulário, fica com largura confortável e alinhado à esquerda. */
.profile-page {
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 0 0 var(--space-12);
}

.profile-page > :not(.page-head) {
  max-width: var(--page-max-narrow);
}

/* ── Identidade ── */
.identity {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.identity-text {
  min-width: 0;
}

.identity-name {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.identity-email {
  margin: 2px 0 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Couple hint ── */
.couple-hint {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin: 0;
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  line-height: 1.45;
  color: var(--color-text-secondary);
  background: var(--color-info-soft);
  border-radius: var(--radius-md);
}

.couple-hint svg {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--color-info);
}

/* ── Loading ── */
.loading-state {
  text-align: center;
  padding: var(--space-12);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto var(--space-4);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Erro ── */
.form-error {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-sm);
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

/* ── Campos ── */
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.field-label {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.field-input {
  height: 40px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  font-size: var(--text-base);
  font-family: inherit;
  background: var(--color-surface);
  color: var(--color-text);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.field-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--focus-ring);
}

.field-input:disabled {
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.field-hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border-subtle);
}

@media (max-width: 600px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
