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
    await router.push({ name: 'subscription' })
  } catch {
    leaveError.value = householdStore.error ?? 'Não foi possível sair.'
  } finally {
    leaveLoading.value = false
  }
}
</script>

<template>
  <div class="household-settings">
    <div class="page-header">
      <h1>Household</h1>
      <p class="subtitle">Gerir o teu plano e membros</p>
    </div>

    <div v-if="householdStore.loading && !householdStore.household" class="loading-state">
      <div class="spinner"></div>
      <p>A carregar...</p>
    </div>

    <div v-else-if="householdStore.error && !householdStore.household" class="error-state">
      <p>{{ householdStore.error }}</p>
    </div>

    <div v-else-if="householdStore.household" class="content">
      <div class="card plan-card">
        <div class="card-header">
          <h2>Plano atual</h2>
          <span
            :class="['badge', householdStore.isIndividual ? 'badge-free' : 'badge-couple']"
          >
            {{ householdStore.isIndividual ? 'Free' : 'Couple' }}
          </span>
        </div>
        <div class="plan-info">
          <p class="plan-name">{{ householdStore.household.name }}</p>
          <p class="plan-type">
            {{ householdStore.isIndividual ? 'Individual' : 'Plano para casal' }}
          </p>
        </div>
        <p v-if="householdStore.isIndividual" class="plan-hint">
          Para o plano Couple com convite, usa a secção abaixo ou a página Subscrição.
        </p>
      </div>

      <div v-if="householdStore.household" class="card members-card">
        <h2>Membros</h2>
        <p v-if="householdStore.membersLoading" class="members-hint">A carregar membros…</p>
        <ul class="members-list">
          <li
            v-for="m in householdStore.members"
            :key="m.id"
            class="member-item"
          >
            <div class="member-info">
              <span class="member-name">{{ memberLabel(m) }}</span>
              <span class="member-email">{{ m.email }}</span>
            </div>
            <span class="member-status">{{ isCurrentUser(m) ? 'Tu' : 'Ativo' }}</span>
          </li>
          <li
            v-if="!householdStore.membersLoading && householdStore.members.length === 0"
            class="empty-state"
          >
            Ainda não há membros listados. Convida alguém abaixo.
          </li>
        </ul>

        <div v-if="invitations.length > 0" class="invitations-section">
          <h3>Convites pendentes</h3>
          <ul class="invitations-list">
            <li v-for="i in invitations" :key="i.email" class="invitation-item">
              <span>{{ i.email }}</span>
              <span class="invitation-status">{{ i.status }}</span>
            </li>
          </ul>
        </div>

        <form
          v-if="!householdStore.membersLoading && householdStore.members.length < 2"
          class="invite-form"
          @submit="handleInvite"
        >
          <h3>Convidar membro (plano Couple após envio bem-sucedido)</h3>
          <div v-if="inviteError" class="form-error">{{ inviteError }}</div>
          <div class="form-row">
            <input
              v-model="inviteEmail"
              type="email"
              placeholder="email@exemplo.pt"
              class="input"
              required
            />
            <button type="submit" class="btn-invite" :disabled="inviteLoading">
              {{ inviteLoading ? 'A enviar...' : 'Convidar' }}
            </button>
          </div>
        </form>
      </div>

      <div v-if="householdStore.isCouple" class="card danger-card">
        <h2>Zona de perigo</h2>
        <p class="danger-text">
          Sair cancela a subscrição partilhada (Free para ambos). Antes de confirmares, lê o resumo
          no diálogo: quem sai deixa de ver este agregado; quem fica mantém os dados aqui.
        </p>
        <button type="button" class="btn-leave" @click="openLeaveModal">
          Sair do plano casal
        </button>
      </div>
    </div>

    <div v-if="leaveModalOpen" class="modal-overlay" @click.self="closeLeaveModal">
      <div class="modal modal-leave">
        <h3>Sair do plano casal?</h3>
        <ul class="leave-summary">
          <li>A subscrição partilhada é cancelada e ambos passam ao plano Free.</li>
          <li>
            <strong>Se estiver outra pessoa no agregado:</strong> tu passas para um
            <strong>novo agregado individual vazio</strong> (sem contas nem movimentos). A outra pessoa
            <strong>mantém</strong> todo o histórico (contas e movimentos) no agregado onde ficou.
          </li>
          <li>
            Quem fica vê um aviso ao iniciar sessão para manter os dados ou apagar tudo e recomeçar.
          </li>
        </ul>
        <label class="leave-ack">
          <input v-model="leaveAcknowledged" type="checkbox" />
          <span>Li e compreendo as consequências acima.</span>
        </label>
        <p v-if="leaveError" class="form-error">{{ leaveError }}</p>
        <div class="modal-actions">
          <button type="button" class="btn-cancel" @click="closeLeaveModal">
            Cancelar
          </button>
          <button
            type="button"
            class="btn-confirm-leave"
            :disabled="leaveLoading || !leaveAcknowledged"
            @click="handleLeave"
          >
            {{ leaveLoading ? 'A processar...' : 'Confirmar saída' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.household-settings {
  max-width: min(640px, 100%);
  margin: 0 auto;
  padding: 0 0 2.5rem;
}

.loading-state,
.error-state {
  text-align: center;
  padding: 3rem;
  color: #64748b;
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
  to { transform: rotate(360deg); }
}

.error-state p {
  color: #dc2626;
}

.card {
  background: var(--color-bg-card);
  border-radius: var(--app-radius-md, 12px);
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
  border: 1px solid var(--color-border);
}

.card h2 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 1rem 0;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.card-header h2 {
  margin: 0;
}

.badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
}

.badge-free {
  background: #f1f5f9;
  color: #475569;
}

.badge-couple {
  background: #dbeafe;
  color: #1d4ed8;
}

.plan-info {
  margin-bottom: 1.25rem;
}

.plan-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 0.25rem 0;
}

.plan-type {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0;
}

.plan-hint {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0.75rem 0 0 0;
  line-height: 1.4;
}

.members-list,
.invitations-list {
  list-style: none;
  padding: 0;
  margin: 0 0 1.5rem 0;
}

.members-hint {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0 0 0.75rem 0;
}

.member-item,
.invitation-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  background: #f8fafc;
  border-radius: 8px;
  margin-bottom: 0.5rem;
}

.member-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.member-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #0f172a;
}

.member-email,
.invitation-item span:first-child {
  font-size: 0.8125rem;
  color: #64748b;
}

.member-status,
.invitation-status {
  font-size: 0.75rem;
  color: #64748b;
}

.empty-state {
  padding: 1.5rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.875rem;
}

.invitations-section {
  margin-bottom: 1.5rem;
}

.invitations-section h3,
.invite-form h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: #475569;
  margin: 0 0 0.75rem 0;
}

.invite-form {
  padding-top: 1.5rem;
  border-top: 1px solid #f1f5f9;
}

.form-error {
  font-size: 0.8125rem;
  color: #dc2626;
  margin-bottom: 0.75rem;
}

.form-row {
  display: flex;
  gap: 0.75rem;
}

.input {
  flex: 1;
  padding: 0.625rem 0.875rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9375rem;
}

.input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
}

.btn-invite {
  padding: 0.625rem 1.25rem;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
}

.btn-invite:hover:not(:disabled) {
  background: #1d4ed8;
}

.danger-card h2 {
  color: #dc2626;
}

.danger-text {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0 0 1rem 0;
}

.btn-leave {
  padding: 0.5rem 1rem;
  background: transparent;
  color: #dc2626;
  border: 1px solid #fecaca;
  border-radius: 8px;
  font-size: 0.875rem;
  cursor: pointer;
}

.btn-leave:hover {
  background: #fef2f2;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1rem;
}

.modal {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 400px;
  width: 100%;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.modal-leave {
  max-width: min(520px, 100%);
}

.leave-summary {
  margin: 0 0 1rem 1.1rem;
  padding: 0;
  font-size: 0.875rem;
  color: #64748b;
  line-height: 1.5;
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
  font-size: 0.875rem;
  color: #0f172a;
  cursor: pointer;
  margin-bottom: 1rem;
  line-height: 1.4;
}

.leave-ack input {
  margin-top: 0.2rem;
  flex-shrink: 0;
}

.modal h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 0.5rem 0;
}

.modal p {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0 0 1.5rem 0;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.btn-cancel {
  padding: 0.5rem 1rem;
  background: #f1f5f9;
  color: #475569;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  cursor: pointer;
}

.btn-cancel:hover {
  background: #e2e8f0;
}

.btn-confirm-leave {
  padding: 0.5rem 1rem;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  cursor: pointer;
}

.btn-confirm-leave:hover:not(:disabled) {
  background: #b91c1c;
}

.btn-confirm-leave:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
