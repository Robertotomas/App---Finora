<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useHouseholdStore } from '@/stores/household'
import { useAuthStore } from '@/stores/auth'

const householdStore = useHouseholdStore()
const authStore = useAuthStore()

const inviteEmail = ref('')
const inviteLoading = ref(false)
const inviteError = ref('')
const upgradeLoading = ref(false)
const leaveModalOpen = ref(false)
const leaveLoading = ref(false)

// Placeholder - API does not support members/invitations yet
const invitations = ref<{ email: string; status: string }[]>([])

// Show current user as member when Couple plan
const members = computed(() => {
  const list: { email: string; status: string }[] = []
  if (householdStore.isCouple && authStore.user) {
    list.push({ email: authStore.user.email, status: 'Ativo' })
  }
  return list
})

onMounted(async () => {
  try {
    await householdStore.fetchHousehold()
  } catch {
    // Handled in store
  }
})

async function handleUpgrade() {
  upgradeLoading.value = true
  try {
    await householdStore.upgradeToCouple()
  } catch {
    // Error shown in store
  } finally {
    upgradeLoading.value = false
  }
}

async function handleInvite(e: Event) {
  e.preventDefault()
  if (!inviteEmail.value.trim()) return

  inviteLoading.value = true
  inviteError.value = ''
  try {
    // API does not support invite yet - show placeholder message
    inviteError.value = 'Convite de membros será disponibilizado em breve.'
  } finally {
    inviteLoading.value = false
  }
}

function openLeaveModal() {
  leaveModalOpen.value = true
}

function closeLeaveModal() {
  leaveModalOpen.value = false
}

async function handleLeave() {
  leaveLoading.value = true
  try {
    // API does not support leave yet
    closeLeaveModal()
    // Placeholder: feature coming soon - would call API and redirect
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
        <div v-if="householdStore.isIndividual" class="upgrade-section">
          <button
            type="button"
            class="btn-upgrade"
            :disabled="upgradeLoading"
            @click="handleUpgrade"
          >
            {{ upgradeLoading ? 'A processar...' : 'Upgrade to Couple Plan' }}
          </button>
        </div>
      </div>

      <div v-if="householdStore.isCouple" class="card members-card">
        <h2>Membros</h2>
        <ul class="members-list">
          <li v-for="m in members" :key="m.email" class="member-item">
            <span class="member-email">{{ m.email }}</span>
            <span class="member-status">{{ m.status }}</span>
          </li>
          <li v-if="members.length === 0" class="empty-state">
            Ainda não há outros membros. Convida alguém abaixo.
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

        <form class="invite-form" @submit="handleInvite">
          <h3>Convidar membro</h3>
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

      <div class="card danger-card">
        <h2>Zona de perigo</h2>
        <p class="danger-text">Sair do household removerá o teu acesso a todos os dados partilhados.</p>
        <button type="button" class="btn-leave" @click="openLeaveModal">
          Sair do household
        </button>
      </div>
    </div>

    <div v-if="leaveModalOpen" class="modal-overlay" @click.self="closeLeaveModal">
      <div class="modal">
        <h3>Sair do household?</h3>
        <p>Esta ação não pode ser revertida. Os teus dados serão removidos do household.</p>
        <div class="modal-actions">
          <button type="button" class="btn-cancel" @click="closeLeaveModal">
            Cancelar
          </button>
          <button
            type="button"
            class="btn-confirm-leave"
            :disabled="leaveLoading"
            @click="handleLeave"
          >
            {{ leaveLoading ? 'A processar...' : 'Sair' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.household-settings {
  max-width: 640px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 0.25rem 0;
}

.subtitle {
  color: #64748b;
  font-size: 0.9375rem;
  margin: 0;
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
  border: 3px solid #e2e8f0;
  border-top-color: #2563eb;
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
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border: 1px solid #f1f5f9;
}

.card h2 {
  font-size: 1rem;
  font-weight: 600;
  color: #334155;
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

.upgrade-section {
  padding-top: 1rem;
  border-top: 1px solid #f1f5f9;
}

.btn-upgrade {
  width: 100%;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9375rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn-upgrade:hover:not(:disabled) {
  opacity: 0.95;
}

.btn-upgrade:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.members-list,
.invitations-list {
  list-style: none;
  padding: 0;
  margin: 0 0 1.5rem 0;
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

.member-email,
.invitation-item span:first-child {
  font-size: 0.875rem;
  color: #334155;
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
