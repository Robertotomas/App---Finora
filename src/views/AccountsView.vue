<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useAccountsStore } from '@/stores/accounts'
import { useHouseholdStore } from '@/stores/household'
import { useSubscriptionStore } from '@/stores/subscription'
import { householdApi } from '@/api/household'
import AccountFormModal from '@/components/AccountFormModal.vue'
import BaseModal from '@/components/BaseModal.vue'
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue'
import type { Account, CreateAccountRequest } from '@/types/account'
import { ACCOUNT_TYPE_LABELS, AccountType } from '@/types/account'

const accountsStore = useAccountsStore()
const subscriptionStore = useSubscriptionStore()

function isCreditCard(type: Account['type']): boolean {
  return Number(type) === AccountType.CreditCard
}
const householdStore = useHouseholdStore()

const createModalOpen = ref(false)
const editModalOpen = ref(false)
const deleteModalOpen = ref(false)
const accountToEdit = ref<Account | null>(null)
const accountToDelete = ref<Account | null>(null)

const actionLoading = ref(false)
const accountLimitModalOpen = ref(false)

const needsPrimarySelection = computed(
  () => subscriptionStore.limits.needsPrimaryAccountSelection === true
)

/** Contas que não são a principal no Free — precisam de plano pago para movimentos/edição */
const showUnlockAccountsBanner = computed(
  () =>
    !needsPrimarySelection.value &&
    accountsStore.accounts.some((a) => a.isActiveForPlan === false)
)

const selectedPrimaryId = ref('')
const primarySelectionLoading = ref(false)
const primaryError = ref<string | null>(null)

watch(
  () => [accountsStore.accounts, needsPrimarySelection.value] as const,
  () => {
    if (!needsPrimarySelection.value || accountsStore.accounts.length === 0) return
    const ok = accountsStore.accounts.some((a) => a.id === selectedPrimaryId.value)
    if (!selectedPrimaryId.value || !ok) {
      selectedPrimaryId.value = accountsStore.accounts[0].id
    }
  },
  { immediate: true }
)

async function setPrimaryAccount() {
  if (!selectedPrimaryId.value) return
  primarySelectionLoading.value = true
  primaryError.value = null
  try {
    await householdApi.setPrimaryAccount({ accountId: selectedPrimaryId.value })
    await Promise.all([subscriptionStore.fetchSubscription(), accountsStore.fetchAccounts()])
    if (householdStore.household) {
      await householdStore.fetchHousehold()
    }
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } }
    primaryError.value = err.response?.data?.message ?? 'Não foi possível definir a conta principal.'
  } finally {
    primarySelectionLoading.value = false
  }
}

function isPrimaryBadge(account: Account): boolean {
  const pid = subscriptionStore.limits.primaryAccountId
  return !!pid && pid === account.id && subscriptionStore.isFree && accountsStore.accounts.length > 1
}

onMounted(async () => {
  try {
    await householdStore.fetchHousehold()
    if (householdStore.household) {
      await accountsStore.fetchAccounts()
    }
    await subscriptionStore.fetchSubscription()
  } catch {
    // Handled in stores
  }
})

function openCreateModal() {
  if (!subscriptionStore.canAddAccount) {
    accountLimitModalOpen.value = true
    return
  }
  accountsStore.clearError()
  createModalOpen.value = true
}

function closeCreateModal() {
  createModalOpen.value = false
}

function openEditModal(account: Account) {
  if (needsPrimarySelection.value) return
  if (account.isActiveForPlan === false) return
  accountsStore.clearError()
  accountToEdit.value = account
  editModalOpen.value = true
}

function closeEditModal() {
  editModalOpen.value = false
  accountToEdit.value = null
}

function openDeleteModal(account: Account) {
  accountToDelete.value = account
  deleteModalOpen.value = true
}

function closeDeleteModal() {
  deleteModalOpen.value = false
  accountToDelete.value = null
}

async function handleCreate(payload: CreateAccountRequest) {
  actionLoading.value = true
  try {
    await accountsStore.createAccount(payload)
    await subscriptionStore.fetchSubscription()
    closeCreateModal()
  } catch (e: unknown) {
    const err = e as { response?: { status: number; data?: { code?: string; message?: string } } }
    const code = err.response?.data?.code
    if (err.response?.status === 403 && code === 'PLAN_LIMIT') {
      accountLimitModalOpen.value = true
    }
  } finally {
    actionLoading.value = false
  }
}

async function handleEdit(payload: CreateAccountRequest) {
  if (!accountToEdit.value) return
  actionLoading.value = true
  try {
    await accountsStore.updateAccount(accountToEdit.value.id, payload)
    closeEditModal()
  } catch {
    // Error shown in store
  } finally {
    actionLoading.value = false
  }
}

async function handleDelete() {
  if (!accountToDelete.value) return
  actionLoading.value = true
  try {
    await accountsStore.deleteAccount(accountToDelete.value.id)
    await subscriptionStore.fetchSubscription()
    closeDeleteModal()
  } catch {
    // Error shown in store
  } finally {
    actionLoading.value = false
  }
}

function formatBalance(balance: number, currency: string): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: currency || 'EUR'
  }).format(balance)
}
</script>

<template>
  <div class="accounts-view">
    <div class="page-header">
      <h1>Contas</h1>
      <p class="subtitle">Gerir as tuas contas financeiras</p>
    </div>

    <div v-if="!householdStore.household && !householdStore.loading" class="empty-state">
      <p>Configura primeiro o teu household.</p>
      <router-link to="/household" class="link">Ir para Household</router-link>
    </div>

    <div v-else-if="householdStore.loading && !householdStore.household" class="loading-state">
      <div class="spinner"></div>
      <p>A carregar...</p>
    </div>

    <div v-else-if="householdStore.error && !householdStore.household" class="error-state">
      <p>{{ householdStore.error }}</p>
    </div>

    <div v-else class="content">
      <div v-if="accountsStore.error" class="global-error">
        {{ accountsStore.error }}
      </div>

      <div
        v-if="needsPrimarySelection && accountsStore.accounts.length > 1"
        class="primary-banner"
      >
        <p class="primary-banner-title">Escolhe a conta principal</p>
        <p class="primary-banner-text">
          No plano Free só uma conta pode estar ativa para movimentos e edições. As outras ficam só para consulta até
          eliminares ou atualizares o plano.
        </p>
        <div class="primary-radio-list">
          <label v-for="a in accountsStore.accounts" :key="a.id" class="primary-radio">
            <input v-model="selectedPrimaryId" type="radio" name="primary" :value="a.id" />
            <span>{{ a.name }}</span>
          </label>
        </div>
        <p v-if="primaryError" class="primary-banner-error">{{ primaryError }}</p>
        <button
          type="button"
          class="btn-primary-confirm"
          :disabled="primarySelectionLoading || !selectedPrimaryId"
          @click="setPrimaryAccount"
        >
          {{ primarySelectionLoading ? 'A guardar...' : 'Confirmar conta principal' }}
        </button>
      </div>

      <div v-if="showUnlockAccountsBanner" class="primary-banner accounts-unlock-banner">
        <div class="accounts-unlock-banner-inner">
          <div class="accounts-unlock-banner-copy">
            <p class="primary-banner-title">Outras contas</p>
            <p class="primary-banner-text accounts-unlock-banner-desc">
              Para desbloquear as outras contas para movimentos e edições, atualize o plano para Pro ou Couple.
            </p>
          </div>
          <router-link :to="{ name: 'subscription' }" class="accounts-unlock-banner-cta">
            Ver planos
          </router-link>
        </div>
      </div>

      <div class="section-card">
        <div class="section-header">
          <h2 class="section-title">As minhas contas</h2>
          <button
            v-if="accountsStore.accounts.length > 0"
            type="button"
            class="btn-add"
            @click="openCreateModal"
          >
            + Nova conta
          </button>
        </div>

        <div v-if="accountsStore.loading && accountsStore.accounts.length === 0" class="loading-state loading-in-card">
          <div class="spinner"></div>
          <p>A carregar contas...</p>
        </div>

        <div v-else-if="accountsStore.accounts.length === 0" class="section-empty">
          <p class="section-empty-text">Ainda não tens contas.</p>
          <button type="button" class="btn-section-add" @click="openCreateModal">
            Adicionar a sua primeira conta
          </button>
        </div>

        <div v-else class="cards-grid">
        <div
          v-for="account in accountsStore.accounts"
          :key="account.id"
          class="account-card"
          :class="{ 'account-card--locked': account.isActiveForPlan === false }"
        >
          <div class="card-main">
            <div class="account-header">
              <span v-if="isCreditCard(account.type)" class="account-type-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="20" height="14" x="2" y="5" rx="2"/>
                  <line x1="2" x2="22" y1="10" y2="10"/>
                </svg>
              </span>
              <h3 class="account-name">{{ account.name }}</h3>
              <span v-if="isPrimaryBadge(account)" class="primary-badge">Principal</span>
            </div>
            <p class="account-balance" :class="{ negative: account.balance < 0 }">
              {{ formatBalance(account.balance, account.currency) }}
            </p>
            <span class="account-type-badge">
              {{ ACCOUNT_TYPE_LABELS[account.type] }}
            </span>
            <p v-if="account.isActiveForPlan === false" class="account-locked-hint">
              Conta só de consulta no plano Free com várias contas.
            </p>
          </div>
          <div class="card-actions">
            <button
              type="button"
              class="btn-icon"
              :title="
                needsPrimarySelection
                  ? 'Escolhe primeiro a conta principal acima'
                  : account.isActiveForPlan === false
                    ? 'No plano Free só podes editar a conta principal'
                    : 'Editar'
              "
              :disabled="needsPrimarySelection || account.isActiveForPlan === false"
              @click="openEditModal(account)"
            >
              Editar
            </button>
            <button
              type="button"
              class="btn-icon btn-delete"
              title="Eliminar"
              @click="openDeleteModal(account)"
            >
              Eliminar
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>

    <AccountFormModal
      :open="createModalOpen"
      :loading="actionLoading"
      @close="closeCreateModal"
      @submit="handleCreate"
    />

    <AccountFormModal
      :open="editModalOpen"
      :account="accountToEdit"
      :loading="actionLoading"
      @close="closeEditModal"
      @submit="handleEdit"
    />

    <ConfirmDeleteModal
      :open="deleteModalOpen"
      title="Eliminar conta"
      :message="accountToDelete
        ? `Tem a certeza que deseja eliminar ${accountToDelete.name}? Esta ação não pode ser revertida.`
        : ''"
      :loading="actionLoading"
      @close="closeDeleteModal"
      @confirm="handleDelete"
    />

    <BaseModal
      v-if="accountLimitModalOpen"
      title="Limite do plano Free"
      @close="accountLimitModalOpen = false"
    >
      <div class="locked-modal-body">
        <p>
          Atingiste o limite de contas do plano Free: só podes ter uma conta. Atualiza para Pro ou Couple para adicionares mais.
        </p>
        <div class="locked-modal-actions">
          <button type="button" class="btn-secondary" @click="accountLimitModalOpen = false">Agora não</button>
          <router-link :to="{ name: 'subscription' }" class="locked-modal-cta" @click="accountLimitModalOpen = false">
            Ver planos
          </router-link>
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<style scoped>
.accounts-view {
  max-width: min(800px, 100%);
  margin: 0 auto;
  padding: 0 0 2.5rem;
}

.loading-state,
.error-state,
.empty-state {
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

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.link {
  color: #2563eb;
  border-bottom: 1px solid transparent;
}

.link:hover {
  border-bottom-color: #2563eb;
}

.global-error {
  padding: 0.75rem 1rem;
  background: #fef2f2;
  color: #dc2626;
  border-radius: 8px;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.primary-banner {
  margin-bottom: 1rem;
  padding: 1rem 1.25rem;
  border-radius: var(--app-radius-md, 12px);
  border: 1px solid #fde68a;
  background: #fffbeb;
}

.primary-banner-title {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  font-weight: 600;
  color: #92400e;
}

.primary-banner-text {
  margin: 0 0 1rem 0;
  font-size: 0.875rem;
  line-height: 1.45;
  color: #78350f;
}

html.dark .primary-banner {
  border-color: rgba(250, 204, 21, 0.38);
  background: rgba(120, 53, 15, 0.28);
}

html.dark .primary-banner-title {
  color: #fcd34d;
}

html.dark .primary-banner-text {
  color: #fde68a;
}

.primary-radio-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.primary-radio {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9375rem;
  color: var(--color-text);
  cursor: pointer;
}

.primary-banner-error {
  margin: 0 0 0.75rem 0;
  font-size: 0.8125rem;
  color: #dc2626;
}

.btn-primary-confirm {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #fff;
  background: #166534;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.btn-primary-confirm:hover:not(:disabled) {
  background: #15803d;
}

.btn-primary-confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.accounts-unlock-banner-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.875rem 1rem;
}

.accounts-unlock-banner-copy {
  flex: 1;
  min-width: min(100%, 240px);
}

.accounts-unlock-banner-desc {
  margin-bottom: 0;
}

.accounts-unlock-banner-cta {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #fff;
  background: #166534;
  border-radius: 8px;
  text-decoration: none;
  transition: background 0.2s;
}

.accounts-unlock-banner-cta:hover {
  background: #15803d;
}

.section-card {
  background: var(--color-bg-card);
  border-radius: var(--app-radius-md, 12px);
  padding: 1.5rem;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
  border: 1px solid var(--color-border);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.section-empty {
  text-align: center;
  padding: 2rem 1rem;
}

.section-empty-text {
  font-size: 0.9375rem;
  color: var(--color-text-muted);
  margin: 0 0 1rem 0;
}

.btn-section-add {
  padding: 0.625rem 1.25rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: #fff;
  background: #166534;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-section-add:hover {
  background: #15803d;
}

.loading-in-card {
  padding: 2rem;
}

.btn-add {
  padding: 0.5rem 1rem;
  background: #166534;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-add:hover {
  background: #15803d;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}

.account-card {
  background: white;
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.account-card--locked {
  opacity: 0.92;
  border-style: dashed;
  border-color: #cbd5e1;
}

.account-locked-hint {
  margin: 0.5rem 0 0 0;
  font-size: 0.75rem;
  color: #64748b;
  line-height: 1.35;
}

.btn-icon:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.card-main {
  flex: 1;
}

.account-header {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.primary-badge {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: #166534;
  background: #dcfce7;
  padding: 0.2rem 0.45rem;
  border-radius: 6px;
}

.account-type-icon {
  display: inline-flex;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  color: var(--color-text);
}

.account-type-icon svg {
  width: 100%;
  height: 100%;
}

.account-name {
  font-size: 1.0625rem;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}

.account-balance {
  font-size: 1.25rem;
  font-weight: 700;
  color: #059669;
  margin: 0 0 0.5rem 0;
}

.account-balance.negative {
  color: #dc2626;
}

.account-type-badge {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 500;
  color: #64748b;
  background: #f1f5f9;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
}

.card-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-icon {
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
  color: #64748b;
  background: transparent;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  cursor: pointer;
}

.btn-icon:hover {
  background: #f8fafc;
  color: #334155;
}

.btn-delete:hover {
  color: #dc2626;
  border-color: #fecaca;
  background: #fef2f2;
}

.locked-modal-body p {
  margin: 0;
  color: var(--color-text-muted);
  line-height: 1.45;
}

.locked-modal-actions {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.locked-modal-actions .btn-secondary,
.locked-modal-actions .locked-modal-cta {
  border-radius: 8px;
  border: 1px solid transparent;
  padding: 0.5rem 0.85rem;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.locked-modal-actions .btn-secondary {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text);
}

.locked-modal-actions .locked-modal-cta {
  background: #166534;
  color: #fff;
}

.locked-modal-actions .locked-modal-cta:hover {
  background: #15803d;
}
</style>
