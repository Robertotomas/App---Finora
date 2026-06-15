<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useHouseholdStore } from '@/stores/household'
import { useAuthStore } from '@/stores/auth'
import { coupleInvitationsApi } from '@/api/coupleInvitations'
import { useSubscriptionStore } from '@/stores/subscription'
import type { HouseholdMember } from '@/types/household'

const router = useRouter()
const householdStore = useHouseholdStore()
const authStore = useAuthStore()
const subscriptionStore = useSubscriptionStore()

const editingName = ref(false)
const editName = ref('')
const savingName = ref(false)
const nameError = ref('')

const inviteEmail = ref('')
const inviteLoading = ref(false)
const inviteError = ref('')
const leaveModalOpen = ref(false)
const leaveAcknowledged = ref(false)
const leaveLoading = ref(false)
const leaveError = ref('')

const invitations = ref<{ email: string; status: string }[]>([])

function memberLabel(m: HouseholdMember) {
  const name = `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim()
  return name || m.email
}

function isCurrentUser(m: HouseholdMember) {
  return authStore.user?.id === m.id
}

function startEditName() {
  editName.value = householdStore.household?.name ?? ''
  nameError.value = ''
  editingName.value = true
}

function cancelEditName() {
  editingName.value = false
  nameError.value = ''
}

async function saveHouseholdName() {
  const trimmed = editName.value.trim()
  if (!trimmed) {
    nameError.value = 'O nome não pode estar vazio.'
    return
  }
  if (!householdStore.household) return
  savingName.value = true
  nameError.value = ''
  try {
    await householdStore.updateHousehold(householdStore.household.type, trimmed)
    editingName.value = false
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } }
    nameError.value = e.response?.data?.message ?? 'Não foi possível guardar o nome.'
  } finally {
    savingName.value = false
  }
}

onMounted(async () => {
  try {
    await householdStore.fetchHousehold()
  } catch {
    // Handled in store
  }
})

async function handleInvite(e: Event) {
  e.preventDefault()
  if (!inviteEmail.value.trim()) return

  inviteLoading.value = true
  inviteError.value = ''
  try {
    await coupleInvitationsApi.create(inviteEmail.value.trim())
    inviteEmail.value = ''
    await subscriptionStore.fetchSubscription()
    await householdStore.fetchHousehold()
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } }
    inviteError.value = e.response?.data?.message ?? 'Não foi possível enviar o convite.'
  } finally {
    inviteLoading.value = false
  }
}

function openLeaveModal() {
  leaveAcknowledged.value = false
  leaveModalOpen.value = true
}

function closeLeaveModal() {
  leaveModalOpen.value = false
  leaveError.value = ''
  leaveAcknowledged.value = false
}

async function handleLeave() {
  leaveLoading.value = true
  leaveError.value = ''
  try {
    await householdStore.leaveCoupleHousehold()
    closeLeaveModal()
    await subscriptionStore.fetchSubscription()
    await router.push({ name: 'subscricao' })
  } catch {
    leaveError.value = householdStore.error ?? 'Não foi possível sair.'
  } finally {
    leaveLoading.value = false
  }
}
</script>

<template>
  <div class="household-page">
    <div class="page-header">
      <div class="page-header-text">
        <h1 class="page-title">Agregado</h1>
        <p class="page-subtitle">Gerir o seu plano e membros.</p>
      </div>
    </div>

    <div v-if="householdStore.loading && !householdStore.household" class="loading-state">
      <div class="spinner"></div>
      <p>A carregar...</p>
    </div>

    <div v-else-if="householdStore.error && !householdStore.household" class="loading-state">
      <p style="color:var(--color-error)">{{ householdStore.error }}</p>
    </div>

    <template v-else-if="householdStore.household">
      <div class="card">
        <!-- Plano atual -->
        <div class="section-label">Plano atual</div>
        <div v-if="nameError" class="form-error">{{ nameError }}</div>
        <div class="plan-row">
          <div class="plan-info">
            <div v-if="editingName" class="name-edit-row">
              <input
                v-model="editName"
                class="field-input name-input"
                type="text"
                maxlength="13"
                @keydown.enter="saveHouseholdName"
                @keydown.escape="cancelEditName"
              />
              <button type="button" class="btn-icon btn-icon--save" :disabled="savingName" @click="saveHouseholdName" title="Guardar">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
              <button type="button" class="btn-icon btn-icon--cancel" @click="cancelEditName" title="Cancelar">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div v-else class="name-display-row">
              <span class="plan-name">{{ householdStore.household.name }}</span>
              <button type="button" class="btn-icon btn-icon--edit" @click="startEditName" title="Editar nome">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
              </button>
            </div>
            <span class="plan-type">{{ householdStore.isIndividual ? 'Individual' : 'Plano para casal' }}</span>
          </div>
          <span :class="['badge', householdStore.isIndividual ? 'badge-free' : 'badge-couple']">
            {{ householdStore.isIndividual ? 'Free' : 'Couple' }}
          </span>
        </div>

        <div class="section-divider"></div>

        <!-- Membros -->
        <div class="section-label">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Membros
        </div>

        <p v-if="householdStore.membersLoading" class="hint-text">A carregar membros…</p>

        <div v-if="householdStore.members.length > 0" class="members-list">
          <div v-for="m in householdStore.members" :key="m.id" class="member-item">
            <div class="member-avatar">{{ (m.firstName ?? m.email).charAt(0).toUpperCase() }}</div>
            <div class="member-info">
              <span class="member-name">{{ memberLabel(m) }}</span>
              <span class="member-email">{{ m.email }}</span>
            </div>
            <span class="member-badge" :class="isCurrentUser(m) ? 'member-badge--you' : ''">{{ isCurrentUser(m) ? 'Tu' : 'Ativo' }}</span>
          </div>
        </div>

        <div v-else-if="!householdStore.membersLoading" class="empty-hint">
          Ainda não há membros listados. Convida alguém abaixo.
        </div>

        <!-- Convites pendentes -->
        <template v-if="invitations.length > 0">
          <div class="section-divider"></div>
          <div class="section-label">Convites pendentes</div>
          <div class="members-list">
            <div v-for="i in invitations" :key="i.email" class="member-item">
              <div class="member-avatar">{{ i.email.charAt(0).toUpperCase() }}</div>
              <div class="member-info">
                <span class="member-email">{{ i.email }}</span>
              </div>
              <span class="member-badge">{{ i.status }}</span>
            </div>
          </div>
        </template>

        <!-- Convidar -->
        <template v-if="!householdStore.membersLoading && householdStore.members.length < 2">
          <div class="section-divider"></div>
          <div class="section-label">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
            Convidar membro
          </div>
          <p class="hint-text">Envie um convite para ativar o plano Couple.</p>
          <div v-if="inviteError" class="form-error">{{ inviteError }}</div>
          <form class="invite-form" @submit="handleInvite">
            <input
              v-model="inviteEmail"
              type="email"
              placeholder="email@exemplo.pt"
              class="field-input"
              required
            />
            <button type="submit" class="btn-primary" :disabled="inviteLoading">
              {{ inviteLoading ? 'A enviar...' : 'Convidar' }}
            </button>
          </form>
        </template>
      </div>

      <!-- Zona de perigo -->
      <div v-if="householdStore.isCouple" class="card card--danger">
        <div class="section-label section-label--danger">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
          Zona de perigo
        </div>
        <p class="hint-text">
          Sair cancela a subscrição partilhada. Ambos passam ao plano Free. Quem sai fica com um agregado vazio.
        </p>
        <button type="button" class="btn-danger" @click="openLeaveModal">
          Sair do agregado
        </button>
      </div>
    </template>

    <!-- Modal sair -->
    <Teleport to="body">
      <div v-if="leaveModalOpen" class="modal-backdrop" @click.self="closeLeaveModal">
        <div class="modal" role="dialog" aria-modal="true">
          <h3 class="modal-title">Sair do plano casal?</h3>
          <ul class="leave-summary">
            <li>A subscrição partilhada é cancelada e ambos passam ao plano Free.</li>
            <li>
              <strong>Se estiver outra pessoa no agregado:</strong> tu passas para um
              <strong>novo agregado individual vazio</strong> (sem contas nem movimentos). A outra pessoa
              <strong>mantém</strong> todo o histórico no agregado onde ficou.
            </li>
            <li>Quem fica vê um aviso ao iniciar sessão para manter os dados ou apagar tudo e recomeçar.</li>
          </ul>
          <label class="leave-ack">
            <input v-model="leaveAcknowledged" type="checkbox" />
            <span>Li e compreendo as consequências acima.</span>
          </label>
          <p v-if="leaveError" class="form-error" style="margin-top:0">{{ leaveError }}</p>
          <div class="modal-actions">
            <button type="button" class="btn-secondary" @click="closeLeaveModal">Cancelar</button>
            <button
              type="button"
              class="btn-danger"
              :disabled="leaveLoading || !leaveAcknowledged"
              @click="handleLeave"
            >
              {{ leaveLoading ? 'A processar...' : 'Confirmar saída' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.household-page {
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

/* ── Card ── */
.card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 1.5rem;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
  margin-bottom: 1.25rem;
}

.card--danger {
  border-color: #fecaca;
}

html.dark .card--danger {
  border-color: rgba(239, 68, 68, 0.25);
}

/* ── Sections ── */
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

.section-label--danger {
  color: #dc2626;
}

html.dark .section-label--danger {
  color: #f87171;
}

.section-divider {
  height: 1px;
  background: var(--color-border);
  margin: 1.25rem 0;
}

/* ── Plan row ── */
.plan-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.plan-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.name-display-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.name-edit-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.name-input {
  flex: unset;
  width: 220px;
  padding: 0.4rem 0.75rem;
  font-size: 0.9375rem;
  font-weight: 600;
}

.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  background: transparent;
  transition: background 0.15s;
  flex-shrink: 0;
}

.btn-icon--edit {
  color: var(--color-text-muted);
}

.btn-icon--edit:hover {
  background: var(--color-table-row-hover);
  color: var(--color-text);
}

.btn-icon--save {
  color: #166534;
}

.btn-icon--save:hover:not(:disabled) {
  background: #ecfdf5;
}

html.dark .btn-icon--save:hover:not(:disabled) {
  background: rgba(22, 101, 52, 0.2);
}

.btn-icon--save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-icon--cancel {
  color: var(--color-text-muted);
}

.btn-icon--cancel:hover {
  background: var(--color-table-row-hover);
  color: var(--color-text);
}

.plan-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.plan-type {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  flex-shrink: 0;
}

.badge-free {
  background: var(--color-table-row-hover);
  color: var(--color-text-muted);
}

.badge-couple {
  background: var(--color-type-income-bg);
  color: var(--color-type-income-text);
}

/* ── Members ── */
.members-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--color-table-row-hover);
  border-radius: 10px;
}

.member-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #ecfdf5;
  color: #166534;
  font-size: 0.8125rem;
  font-weight: 700;
  flex-shrink: 0;
}

html.dark .member-avatar {
  background: rgba(22, 101, 52, 0.2);
  color: #4ade80;
}

.member-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
  flex: 1;
}

.member-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
}

.member-email {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-badge {
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.2rem 0.625rem;
  border-radius: 999px;
  background: var(--color-table-header-bg);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.member-badge--you {
  background: var(--color-type-income-bg);
  color: var(--color-type-income-text);
}

.empty-hint {
  text-align: center;
  padding: 1.5rem;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.hint-text {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0 0 0.75rem;
  line-height: 1.5;
}

/* ── Invite form ── */
.invite-form {
  display: flex;
  gap: 0.75rem;
}

.field-input {
  flex: 1;
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
  box-shadow: 0 0 0 2px rgba(22, 101, 52, 0.15);
}

/* ── Error ── */
.form-error {
  padding: 0.75rem 1rem;
  border-radius: 10px;
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
  font-size: 0.8125rem;
  font-weight: 500;
  margin-bottom: 0.75rem;
}

html.dark .form-error {
  background: rgba(220, 38, 38, 0.1);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.25);
}

/* ── Buttons ── */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.625rem 1.25rem;
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

.btn-primary:hover:not(:disabled) {
  background: #15803d;
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  color: var(--color-text-muted);
  background: var(--color-table-row-hover);
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-secondary:hover {
  background: var(--color-border);
}

.btn-danger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  color: #dc2626;
  background: transparent;
  border: 1px solid #fecaca;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-danger:hover:not(:disabled) {
  background: #fef2f2;
}

html.dark .btn-danger {
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.25);
}

html.dark .btn-danger:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.1);
}

.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Modal ── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
}

.modal {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 1.5rem;
  max-width: min(520px, 100%);
  width: 100%;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 1rem;
}

.leave-summary {
  margin: 0 0 1rem 1.1rem;
  padding: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  line-height: 1.6;
}

.leave-summary li {
  margin-bottom: 0.5rem;
}

.leave-summary li:last-child {
  margin-bottom: 0;
}

.leave-ack {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--color-text);
  cursor: pointer;
  margin-bottom: 1rem;
  line-height: 1.4;
}

.leave-ack input {
  margin-top: 0.2rem;
  flex-shrink: 0;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

/* ── Responsive ── */
@media (max-width: 600px) {
  .invite-form {
    flex-direction: column;
  }

  .plan-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
