<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAccountsStore } from '@/stores/accounts'
import { useHouseholdStore } from '@/stores/household'
import { useSubscriptionStore } from '@/stores/subscription'
import { householdApi } from '@/api/household'
import AccountFormModal from '@/components/AccountFormModal.vue'
import BaseModal from '@/components/BaseModal.vue'
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue'
import DeleteAccountWithTransferModal from '@/components/DeleteAccountWithTransferModal.vue'
import ArchiveAccountModal from '@/components/ArchiveAccountModal.vue'
import type { Account, CreateAccountRequest } from '@/types/account'
import { ACCOUNT_TYPE_LABELS, AccountType } from '@/types/account'

const route = useRoute()
const router = useRouter()
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
const accountDeleteBlockedModalOpen = ref(false)
const accountDeleteBlockedMessage = ref('')
const deleteBlockedAccount = ref<Account | null>(null)

// Delete with transfer modal
const deleteWithTransferModalOpen = ref(false)
const deleteWithTransferAccount = ref<Account | null>(null)

// Archive modal
const archiveModalOpen = ref(false)
const archiveAccount = ref<Account | null>(null)

const needsPrimarySelection = computed(
  () => subscriptionStore.limits.needsPrimaryAccountSelection === true
)

/** Contas que não são a principal no Free — precisam de plano pago para movimentos/edição */
const showUnlockAccountsBanner = computed(
  () =>
    !needsPrimarySelection.value &&
    accountsStore.activeAccounts.some((a) => a.isActiveForPlan === false)
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
  return !!pid && pid === account.id && subscriptionStore.isFree && accountsStore.activeAccounts.length > 1
}

onMounted(async () => {
  try {
    await Promise.all([
      householdStore.fetchHousehold().then(() => {
        if (householdStore.household) return accountsStore.fetchAccounts()
      }),
      subscriptionStore.fetchSubscription(),
    ])
  } catch {
    // Handled in stores
  }
  if (route.query.action === 'new') {
    openCreateModal()
    router.replace({ query: { ...route.query, action: undefined } })
  }
})

watch(() => route.query.action, (action) => {
  if (action === 'new') {
    openCreateModal()
    router.replace({ query: { ...route.query, action: undefined } })
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
  } catch (e: unknown) {
    const err = e as { response?: { status: number; data?: { code?: string; message?: string } } }
    if (err.response?.status === 400 && err.response?.data?.code === 'ACCOUNT_HAS_MOVEMENTS') {
      accountsStore.clearError()
      deleteBlockedAccount.value = accountToDelete.value
      accountDeleteBlockedMessage.value =
        err.response.data.message ??
        'Não é possível eliminar esta conta enquanto tiver movimentos associados.'
      accountDeleteBlockedModalOpen.value = true
      closeDeleteModal()
    }
  } finally {
    actionLoading.value = false
  }
}

function closeDeleteBlockedModal() {
  accountDeleteBlockedModalOpen.value = false
  accountDeleteBlockedMessage.value = ''
  deleteBlockedAccount.value = null
}

function handleArchiveFromBlocked() {
  if (!deleteBlockedAccount.value) return
  archiveAccount.value = deleteBlockedAccount.value
  archiveModalOpen.value = true
  closeDeleteBlockedModal()
}

function handleDeleteWithTransferFromBlocked() {
  if (!deleteBlockedAccount.value) return
  deleteWithTransferAccount.value = deleteBlockedAccount.value
  deleteWithTransferModalOpen.value = true
  closeDeleteBlockedModal()
}

function openDeleteArchivedModal(account: Account) {
  deleteWithTransferAccount.value = account
  deleteWithTransferModalOpen.value = true
}

function closeDeleteWithTransferModal() {
  deleteWithTransferModalOpen.value = false
  deleteWithTransferAccount.value = null
}

async function handleDeleteWithTransfer(targetAccountId: string) {
  if (!deleteWithTransferAccount.value) return
  actionLoading.value = true
  try {
    await accountsStore.deleteAccountWithTransfer(deleteWithTransferAccount.value.id, targetAccountId)
    await Promise.all([subscriptionStore.fetchSubscription(), accountsStore.fetchAccounts()])
    closeDeleteWithTransferModal()
  } catch {
    // Error shown in store
  } finally {
    actionLoading.value = false
  }
}

function openArchiveModal(account: Account) {
  archiveAccount.value = account
  archiveModalOpen.value = true
}

function closeArchiveModal() {
  archiveModalOpen.value = false
  archiveAccount.value = null
}

async function handleArchiveConfirm(targetAccountId: string | undefined) {
  if (!archiveAccount.value) return
  actionLoading.value = true
  try {
    await accountsStore.archiveAccount(archiveAccount.value.id, targetAccountId)
    await Promise.all([subscriptionStore.fetchSubscription(), accountsStore.fetchAccounts()])
    closeArchiveModal()
  } catch {
    // Error shown in store
  } finally {
    actionLoading.value = false
  }
}

async function handleReactivate(account: Account) {
  actionLoading.value = true
  try {
    await accountsStore.reactivateAccount(account.id)
    await subscriptionStore.fetchSubscription()
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

function accountIcon(type: AccountType): string {
  const icons: Record<number, string> = {
    [AccountType.Bank]: 'M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3',
    [AccountType.Cash]: 'M2 6h20v12H2zM12 12a2 2 0 100-4 2 2 0 000 4z',
    [AccountType.Savings]: 'M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-0.5 2-2 2-3.5V8c0-1-1-3-1-3z',
    [AccountType.Investment]: 'M22 12h-4l-3 9L9 3l-3 9H2',
    [AccountType.Other]: 'M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2',
  }
  return icons[type] || icons[AccountType.Other]
}
</script>

<template>
  <div class="accounts-page">
    <!-- Loading -->
    <div v-if="!householdStore.household && householdStore.loading" class="loading-state">
      <div class="spinner"></div>
      <p>A carregar...</p>
    </div>

    <!-- No household -->
    <div v-else-if="!householdStore.household && !householdStore.loading" class="empty-state">
      <p>Configura primeiro o teu household.</p>
      <router-link to="/household" class="link">Ir para Household</router-link>
    </div>

    <!-- Error -->
    <div v-else-if="householdStore.error && !householdStore.household" class="error-state">
      <p>{{ householdStore.error }}</p>
    </div>

    <!-- Main content -->
    <template v-else>
      <!-- Page header -->
      <div class="page-header">
        <div class="page-header-text">
          <h1 class="page-title">Contas</h1>
          <p class="page-subtitle">Gere as tuas contas financeiras</p>
        </div>
        <button
          v-if="accountsStore.activeAccounts.length > 0"
          type="button"
          class="btn-add"
          @click="openCreateModal"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
          Nova conta
        </button>
      </div>

      <!-- Global error -->
      <div v-if="accountsStore.error" class="global-error">
        {{ accountsStore.error }}
      </div>

      <!-- Primary selection banner -->
      <div
        v-if="needsPrimarySelection && accountsStore.activeAccounts.length > 1"
        class="banner banner--warning"
      >
        <div class="banner-content">
          <p class="banner-title">Escolhe a conta principal</p>
          <p class="banner-text">
            No plano Free só uma conta pode estar ativa para movimentos e edições.
          </p>
          <div class="primary-radio-list">
            <label v-for="a in accountsStore.activeAccounts" :key="a.id" class="primary-radio">
              <input v-model="selectedPrimaryId" type="radio" name="primary" :value="a.id" />
              <span>{{ a.name }}</span>
            </label>
          </div>
          <p v-if="primaryError" class="banner-error">{{ primaryError }}</p>
          <button
            type="button"
            class="btn-confirm"
            :disabled="primarySelectionLoading || !selectedPrimaryId"
            @click="setPrimaryAccount"
          >
            {{ primarySelectionLoading ? 'A guardar...' : 'Confirmar' }}
          </button>
        </div>
      </div>

      <!-- Unlock banner -->
      <div v-if="showUnlockAccountsBanner" class="banner banner--warning">
        <div class="banner-content banner-row">
          <div>
            <p class="banner-title">Contas bloqueadas</p>
            <p class="banner-text">Atualiza para Pro ou Couple para desbloquear todas as contas.</p>
          </div>
          <router-link :to="{ name: 'subscricao' }" class="btn-confirm">
            Ver planos
          </router-link>
        </div>
      </div>

      <!-- Loading accounts -->
      <div v-if="accountsStore.loading && accountsStore.accounts.length === 0" class="loading-state">
        <div class="spinner"></div>
        <p>A carregar contas...</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="accountsStore.activeAccounts.length === 0 && accountsStore.archivedAccounts.length === 0" class="empty-card">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="empty-icon"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/><circle cx="17" cy="15" r="1.5"/></svg>
        <p class="empty-text">Ainda não tens contas</p>
        <p class="empty-hint">Adiciona a tua primeira conta para começar a controlar as finanças.</p>
        <button type="button" class="btn-confirm" @click="openCreateModal">
          Adicionar conta
        </button>
      </div>

      <!-- Active accounts -->
      <template v-if="accountsStore.activeAccounts.length > 0">
        <div class="section-label">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/><circle cx="17" cy="15" r="1.5"/></svg>
          Contas Ativas
        </div>
        <div class="accounts-grid">
          <div
            v-for="account in accountsStore.activeAccounts"
            :key="account.id"
            class="account-card"
            :class="{
              'account-card--locked': account.isActiveForPlan === false,
            }"
          >
            <!-- Icon -->
            <div class="card-icon-wrap">
              <svg v-if="isCreditCard(account.type)" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="accountIcon(account.type)"/></svg>
            </div>

            <!-- Info -->
            <div class="card-body">
              <div class="card-name-row">
                <h3 class="card-name">{{ account.name }}</h3>
                <span v-if="isPrimaryBadge(account)" class="badge badge--primary">Principal</span>
              </div>
              <p class="card-balance" :class="{ negative: account.balance < 0 }">
                {{ formatBalance(account.balance, account.currency) }}
              </p>
              <span class="card-type">{{ ACCOUNT_TYPE_LABELS[account.type] }}</span>
              <p v-if="account.isActiveForPlan === false" class="card-locked-hint">
                Só consulta no plano Free
              </p>
            </div>

            <!-- Actions -->
            <div class="card-actions">
              <button
                type="button"
                class="action-btn"
                title="Editar"
                :disabled="needsPrimarySelection || account.isActiveForPlan === false"
                @click="openEditModal(account)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
              </button>
              <button
                type="button"
                class="action-btn"
                title="Arquivar"
                @click="openArchiveModal(account)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
              </button>
              <button
                type="button"
                class="action-btn action-btn--danger"
                title="Eliminar"
                @click="openDeleteModal(account)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        </div>
      </template>

      <!-- Archived accounts -->
      <div v-if="accountsStore.archivedAccounts.length > 0" class="archived-section">
        <div class="section-label">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
          Contas Arquivadas
        </div>

        <div class="accounts-grid">
          <div
            v-for="account in accountsStore.archivedAccounts"
            :key="account.id"
            class="account-card account-card--archived"
          >
            <div class="card-icon-wrap card-icon-wrap--muted">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
            </div>

            <div class="card-body">
              <div class="card-name-row">
                <h3 class="card-name">{{ account.name }}</h3>
                <span class="badge badge--archived">Arquivada</span>
              </div>
              <p class="card-balance card-balance--muted">
                {{ formatBalance(account.balance, account.currency) }}
              </p>
              <span class="card-type">{{ ACCOUNT_TYPE_LABELS[account.type] }}</span>
            </div>

            <div class="card-actions">
              <button
                type="button"
                class="action-btn action-btn--reactivate"
                title="Reativar"
                @click="handleReactivate(account)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.22-8.56"/><polyline points="21 3 21 9 15 9"/></svg>
              </button>
              <button
                type="button"
                class="action-btn action-btn--danger"
                title="Eliminar"
                @click="openDeleteArchivedModal(account)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Modals -->
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

    <!-- Delete blocked modal with options -->
    <BaseModal
      v-if="accountDeleteBlockedModalOpen"
      title="Não é possível eliminar"
      @close="closeDeleteBlockedModal"
    >
      <div class="blocked-body">
        <p class="blocked-msg">{{ accountDeleteBlockedMessage }}</p>
        <p class="blocked-question">O que queres fazer?</p>
        <div class="blocked-options">
          <button type="button" class="blocked-option" @click="handleArchiveFromBlocked" :disabled="actionLoading">
            <div class="blocked-option-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
            </div>
            <div>
              <span class="blocked-option-label">Arquivar conta</span>
              <span class="blocked-option-desc">Remove do património sem perder dados</span>
            </div>
          </button>
          <button type="button" class="blocked-option" @click="handleDeleteWithTransferFromBlocked" :disabled="actionLoading">
            <div class="blocked-option-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 7 17 7"/><polyline points="4 12 20 12"/><polyline points="7 17 17 17"/><polyline points="3 7 5 5 3 3"/><polyline points="21 17 19 19 21 21"/></svg>
            </div>
            <div>
              <span class="blocked-option-label">Eliminar com transferência</span>
              <span class="blocked-option-desc">Move saldo e movimentos para outra conta</span>
            </div>
          </button>
        </div>
        <div class="blocked-footer">
          <button type="button" class="btn-cancel" @click="closeDeleteBlockedModal">Cancelar</button>
        </div>
      </div>
    </BaseModal>

    <DeleteAccountWithTransferModal
      :open="deleteWithTransferModalOpen"
      :account="deleteWithTransferAccount"
      :accounts="accountsStore.accounts"
      :loading="actionLoading"
      @close="closeDeleteWithTransferModal"
      @confirm="handleDeleteWithTransfer"
    />

    <ArchiveAccountModal
      :open="archiveModalOpen"
      :account="archiveAccount"
      :accounts="accountsStore.accounts"
      :loading="actionLoading"
      @close="closeArchiveModal"
      @confirm="handleArchiveConfirm"
    />

    <BaseModal
      v-if="accountLimitModalOpen"
      title="Limite do plano Free"
      @close="accountLimitModalOpen = false"
    >
      <div class="blocked-body">
        <p class="blocked-msg">
          Atingiste o limite de contas do plano Free. Atualiza para Pro ou Couple para adicionares mais.
        </p>
        <div class="blocked-footer">
          <button type="button" class="btn-cancel" @click="accountLimitModalOpen = false">Agora não</button>
          <router-link :to="{ name: 'subscricao' }" class="btn-confirm" @click="accountLimitModalOpen = false">
            Ver planos
          </router-link>
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<style scoped>
.accounts-page {
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

.page-header-text {
  min-width: 0;
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

.btn-add {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #fff;
  background: #166534;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
}

.btn-add:hover {
  background: #15803d;
  transform: translateY(-1px);
}

/* ── Accounts grid ── */
.accounts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.875rem;
}

.account-card {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 1.125rem 1.25rem;
  transition: box-shadow 0.2s, transform 0.2s;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
}

.account-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.account-card--locked {
  opacity: 0.65;
  border-style: dashed;
}

.account-card--archived {
  opacity: 0.6;
  border-style: dashed;
}

/* ── Card icon ── */
.card-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 10px;
  background: #ecfdf5;
  color: #166534;
}

html.dark .card-icon-wrap {
  background: rgba(22, 101, 52, 0.2);
  color: #4ade80;
}

.card-icon-wrap--muted {
  background: var(--color-table-row-hover);
  color: var(--color-text-muted);
}

html.dark .card-icon-wrap--muted {
  background: rgba(100, 116, 139, 0.15);
  color: var(--color-text-muted);
}

/* ── Card body ── */
.card-body {
  flex: 1;
  min-width: 0;
}

.card-name-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.card-name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-balance {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 0.375rem;
  letter-spacing: -0.02em;
}

.card-balance.negative {
  color: var(--color-expense);
}

.card-balance--muted {
  color: var(--color-text-muted);
}

.card-type {
  display: inline-block;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--color-text-muted);
  background: var(--color-table-row-hover);
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
}

.card-locked-hint {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  margin: 0.375rem 0 0;
  line-height: 1.35;
}

/* ── Badges ── */
.badge {
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.15rem 0.4rem;
  border-radius: 999px;
  flex-shrink: 0;
}

.badge--primary {
  color: #fff;
  background: #166534;
}

.badge--archived {
  color: #fff;
  background: #64748b;
}

/* ── Card actions ── */
.card-actions {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  flex-shrink: 0;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover {
  background: var(--color-table-row-hover);
  color: var(--color-text);
  border-color: var(--color-text-muted);
}

.action-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.action-btn--danger:hover {
  color: #dc2626;
  border-color: #fecaca;
  background: #fef2f2;
}

html.dark .action-btn--danger:hover {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.3);
  background: rgba(248, 113, 113, 0.1);
}

.action-btn--reactivate:hover {
  color: #166534;
  border-color: #bbf7d0;
  background: #f0fdf4;
}

html.dark .action-btn--reactivate:hover {
  color: #4ade80;
  border-color: rgba(74, 222, 128, 0.3);
  background: rgba(74, 222, 128, 0.1);
}

/* ── Archived section ── */
.archived-section {
  margin-top: 2rem;
}

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

/* ── Banners ── */
.banner {
  border-radius: 12px;
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
}

.banner--warning {
  border: 1px solid #fde68a;
  background: #fffbeb;
}

html.dark .banner--warning {
  border-color: rgba(250, 204, 21, 0.3);
  background: rgba(120, 53, 15, 0.2);
}

.banner-content {
  display: flex;
  flex-direction: column;
}

.banner-row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.banner-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #92400e;
  margin: 0 0 0.25rem;
}

html.dark .banner-title {
  color: #fcd34d;
}

.banner-text {
  font-size: 0.8125rem;
  color: #78350f;
  margin: 0 0 0.75rem;
  line-height: 1.45;
}

html.dark .banner-text {
  color: #fde68a;
}

.banner-error {
  font-size: 0.8125rem;
  color: #dc2626;
  margin: 0 0 0.5rem;
}

.primary-radio-list {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-bottom: 0.75rem;
}

.primary-radio {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--color-text);
  cursor: pointer;
}

/* ── Buttons ── */
.btn-confirm {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #fff;
  background: #166534;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s;
  white-space: nowrap;
}

.btn-confirm:hover {
  background: #15803d;
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-cancel {
  padding: 0.5rem 0.85rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-cancel:hover {
  background: var(--color-table-row-hover);
}

/* ── Empty state ── */
.empty-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem 1.5rem;
  background: var(--color-bg-card);
  border: 1px dashed var(--color-border);
  border-radius: 14px;
  text-align: center;
}

.empty-icon {
  color: var(--color-text-muted);
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-text {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 0.25rem;
}

.empty-hint {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0 0 1.25rem;
}

/* ── Loading / Error ── */
.loading-state,
.error-state,
.empty-state {
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

.error-state p {
  color: var(--color-error);
}

.link {
  color: var(--color-link-hover);
  border-bottom: 1px solid transparent;
}

.link:hover {
  border-bottom-color: var(--color-link-hover);
}

.global-error {
  padding: 0.625rem 1rem;
  background: #fef2f2;
  color: #dc2626;
  border-radius: 10px;
  font-size: 0.8125rem;
  margin-bottom: 1rem;
}

html.dark .global-error {
  background: rgba(220, 38, 38, 0.1);
  color: #f87171;
}

/* ── Blocked modal ── */
.blocked-body {
  display: flex;
  flex-direction: column;
}

.blocked-msg {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  line-height: 1.5;
  margin: 0;
}

.blocked-question {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 1rem 0 0.625rem;
}

.blocked-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.blocked-option {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem 1rem;
  border: 1.5px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-card);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.blocked-option:hover:not(:disabled) {
  border-color: #166534;
  box-shadow: 0 2px 8px rgba(22, 101, 52, 0.08);
}

.blocked-option:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.blocked-option-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 8px;
  background: #ecfdf5;
  color: #166534;
}

html.dark .blocked-option-icon {
  background: rgba(22, 101, 52, 0.2);
  color: #4ade80;
}

.blocked-option-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
}

.blocked-option-desc {
  display: block;
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--color-text-muted);
  margin-top: 0.125rem;
}

.blocked-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1.25rem;
}

/* ── Responsive ── */
@media (max-width: 600px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .accounts-grid {
    grid-template-columns: 1fr;
  }

  .patrimonio-hero {
    padding: 1.25rem;
  }

  .patrimonio-value {
    font-size: 1.5rem;
  }

  .banner-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
