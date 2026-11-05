<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useHouseholdStore } from '@/stores/household'
import { useAuthStore } from '@/stores/auth'
import { coupleInvitationsApi } from '@/api/coupleInvitations'
import { useSubscriptionStore } from '@/stores/subscription'
import type { HouseholdMember } from '@/types/household'
import PageHeader from '@/components/ui/PageHeader.vue'
import UiCard from '@/components/ui/UiCard.vue'
import UiButton from '@/components/ui/UiButton.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'
import { useToast } from '@/composables/useToast'

const router = useRouter()
const householdStore = useHouseholdStore()
const authStore = useAuthStore()
const subscriptionStore = useSubscriptionStore()
const toast = useToast()

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
    toast.success('Nome do agregado atualizado')
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } }
    nameError.value = e.response?.data?.message ?? 'Não foi possível guardar o nome.'
    toast.error(nameError.value)
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
    toast.success('Convite enviado')
    await subscriptionStore.fetchSubscription()
    await householdStore.fetchHousehold()
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } }
    inviteError.value = e.response?.data?.message ?? 'Não foi possível enviar o convite.'
    toast.error(inviteError.value)
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
    <PageHeader title="Agregado" />

    <div v-if="householdStore.loading && !householdStore.household" class="loading-state">
      <div class="spinner"></div>
      <p>A carregar...</p>
    </div>

    <div v-else-if="householdStore.error && !householdStore.household" class="loading-state">
      <p class="load-error">{{ householdStore.error }}</p>
    </div>

    <div v-else-if="householdStore.household" class="ui-stack">
      <!-- Plano atual -->
      <UiCard title="Plano atual" subtitle="O nome do agregado e o tipo de plano.">
        <div v-if="nameError" class="form-error">{{ nameError }}</div>
        <div class="plan-row">
          <div class="plan-info">
            <div v-if="editingName" class="name-edit-row">
              <input
                v-model="editName"
                class="field-input name-input"
                type="text"
                maxlength="13"
                aria-label="Nome do agregado"
                @keydown.enter="saveHouseholdName"
                @keydown.escape="cancelEditName"
              />
              <UiButton icon-only size="sm" :disabled="savingName" aria-label="Guardar" title="Guardar" @click="saveHouseholdName">
                <template #icon>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </template>
              </UiButton>
              <UiButton icon-only size="sm" variant="secondary" aria-label="Cancelar" title="Cancelar" @click="cancelEditName">
                <template #icon>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </template>
              </UiButton>
            </div>
            <div v-else class="name-display-row">
              <span class="plan-name">{{ householdStore.household.name }}</span>
              <UiButton icon-only size="sm" variant="ghost" aria-label="Editar nome" title="Editar nome" @click="startEditName">
                <template #icon>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                </template>
              </UiButton>
            </div>
            <span class="plan-type">{{ householdStore.isIndividual ? 'Individual' : 'Plano para casal' }}</span>
          </div>
          <span :class="['ui-badge', householdStore.isIndividual ? '' : 'ui-badge--brand']">
            {{ householdStore.isIndividual ? 'Free' : 'Couple' }}
          </span>
        </div>
      </UiCard>

      <!-- Membros -->
      <UiCard title="Membros" subtitle="Quem tem acesso a este agregado.">
        <p v-if="householdStore.membersLoading" class="hint-text">A carregar membros…</p>

        <ul v-if="householdStore.members.length > 0" class="members-list">
          <li v-for="m in householdStore.members" :key="m.id" class="member-item">
            <UserAvatar :first-name="m.firstName || m.email" :last-name="m.firstName ? m.lastName : null" :size="36" />
            <div class="member-info">
              <span class="member-name">{{ memberLabel(m) }}</span>
              <span class="member-email">{{ m.email }}</span>
            </div>
            <span class="ui-badge" :class="isCurrentUser(m) ? 'ui-badge--brand' : 'ui-badge--success'">{{ isCurrentUser(m) ? 'Você' : 'Ativo' }}</span>
          </li>
        </ul>

        <p v-else-if="!householdStore.membersLoading" class="hint-text">
          Ainda não há membros listados. Convide alguém abaixo.
        </p>

        <!-- Convites pendentes -->
        <template v-if="invitations.length > 0">
          <h3 class="sub-title">Convites pendentes</h3>
          <ul class="members-list">
            <li v-for="i in invitations" :key="i.email" class="member-item">
              <UserAvatar :first-name="i.email" :size="36" />
              <div class="member-info">
                <span class="member-email">{{ i.email }}</span>
              </div>
              <span class="ui-badge ui-badge--warning">{{ i.status }}</span>
            </li>
          </ul>
        </template>
      </UiCard>

      <!-- Convidar -->
      <UiCard
        v-if="!householdStore.membersLoading && householdStore.members.length < 2"
        title="Convidar membro"
        subtitle="Envie um convite para ativar o plano Couple."
      >
        <div v-if="inviteError" class="form-error">{{ inviteError }}</div>
        <form @submit="handleInvite">
          <label class="field">
            <span class="field-label">Email do parceiro</span>
            <input
              v-model="inviteEmail"
              type="email"
              placeholder="email@exemplo.pt"
              class="field-input"
              required
            />
          </label>
          <div class="form-actions">
            <UiButton type="submit" :loading="inviteLoading">
              {{ inviteLoading ? 'A enviar...' : 'Convidar' }}
            </UiButton>
          </div>
        </form>
      </UiCard>

      <!-- Zona de perigo -->
      <section v-if="householdStore.isCouple" class="danger-card">
        <div>
          <h2 class="danger-title">Sair do agregado</h2>
          <p class="danger-desc">
            Sair cancela a subscrição partilhada. Ambos passam ao plano Free. Quem sai fica com um agregado vazio.
          </p>
        </div>
        <UiButton variant="danger-ghost" @click="openLeaveModal">Sair do agregado</UiButton>
      </section>
    </div>

    <!-- Modal sair -->
    <Teleport to="body">
      <div v-if="leaveModalOpen" class="modal-backdrop" @click.self="closeLeaveModal">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="leave-title">
          <div class="modal-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
          </div>
          <h3 id="leave-title" class="modal-title">Sair do plano casal?</h3>
          <ul class="leave-summary">
            <li>A subscrição partilhada é cancelada e ambos passam ao plano Free.</li>
            <li>
              <strong>Se estiver outra pessoa no agregado:</strong> você passa para um
              <strong>novo agregado individual vazio</strong> (sem contas nem movimentos). A outra pessoa
              <strong>mantém</strong> todo o histórico no agregado onde ficou.
            </li>
            <li>Quem fica vê um aviso ao iniciar sessão para manter os dados ou apagar tudo e recomeçar.</li>
          </ul>
          <label class="leave-ack">
            <input v-model="leaveAcknowledged" type="checkbox" />
            <span>Li e compreendo as consequências acima.</span>
          </label>
          <p v-if="leaveError" class="form-error">{{ leaveError }}</p>
          <div class="modal-actions">
            <UiButton variant="secondary" @click="closeLeaveModal">Cancelar</UiButton>
            <UiButton variant="danger" :disabled="!leaveAcknowledged" :loading="leaveLoading" @click="handleLeave">
              {{ leaveLoading ? 'A processar...' : 'Confirmar saída' }}
            </UiButton>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Mesma largura/alinhamento das outras páginas (título no mesmo sítio); o conteúdo, por ser
   formulário, fica com largura confortável e alinhado à esquerda. */
.household-page {
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 0 0 var(--space-12);
}

.household-page > :not(.page-head) {
  max-width: var(--page-max-narrow);
}

/* ── Loading ── */
.loading-state {
  text-align: center;
  padding: var(--space-12);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.load-error {
  color: var(--color-danger);
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

/* ── Plano ── */
.plan-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.plan-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.name-display-row,
.name-edit-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.plan-name {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.plan-type {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.name-input {
  width: 220px;
  max-width: 100%;
  font-weight: var(--weight-semibold);
}

/* ── Membros ── */
.members-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Tile sem borda dentro do cartão (evita borda dupla) */
.member-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}

.member-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.member-name {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.member-email {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub-title {
  margin: var(--space-6) 0 var(--space-3);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.hint-text {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

/* ── Formulário ── */
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
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

.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-4);
}

.form-error {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-sm);
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  margin: 0 0 var(--space-4);
}

/* ── Zona de perigo ── */
.danger-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-danger-border);
  border-radius: var(--radius-lg);
}

.danger-title {
  margin: 0;
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--color-danger);
}

.danger-desc {
  margin: var(--space-1) 0 0;
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--color-text-muted);
}

/* ── Modal sair ── */
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: var(--color-modal-overlay);
  backdrop-filter: blur(4px);
}

.modal {
  width: 100%;
  max-width: 480px;
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  padding: var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.modal-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--color-danger-soft);
  color: var(--color-danger);
  margin-bottom: var(--space-4);
}

.modal-title {
  margin: 0 0 var(--space-3);
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.leave-summary {
  margin: 0 0 var(--space-4);
  padding-left: var(--space-5);
  font-size: var(--text-sm);
  line-height: 1.55;
  color: var(--color-text-secondary);
}

.leave-summary li {
  margin-bottom: var(--space-2);
}

.leave-summary li:last-child {
  margin-bottom: 0;
}

.leave-summary strong {
  color: var(--color-text-strong);
}

.leave-ack {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
  font-size: var(--text-sm);
  color: var(--color-text);
  cursor: pointer;
}

.leave-ack input {
  margin-top: 2px;
  accent-color: var(--color-danger);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

@media (max-width: 600px) {
  .danger-card {
    flex-direction: column;
    align-items: flex-start;
    padding: var(--space-4);
  }

  .plan-row {
    flex-wrap: wrap;
  }
}
</style>
