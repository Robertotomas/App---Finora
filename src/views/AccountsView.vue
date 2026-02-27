<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAccountsStore } from '@/stores/accounts'
import { useHouseholdStore } from '@/stores/household'
import AccountFormModal from '@/components/AccountFormModal.vue'
import ConfirmDeleteModal from '@/components/ConfirmDeleteModal.vue'
import type { Account, CreateAccountRequest } from '@/types/account'
import { ACCOUNT_TYPE_LABELS } from '@/types/account'

const accountsStore = useAccountsStore()
const householdStore = useHouseholdStore()

const createModalOpen = ref(false)
const editModalOpen = ref(false)
const deleteModalOpen = ref(false)
const accountToEdit = ref<Account | null>(null)
const accountToDelete = ref<Account | null>(null)

const actionLoading = ref(false)

onMounted(async () => {
  try {
    await householdStore.fetchHousehold()
    if (householdStore.household) {
      await accountsStore.fetchAccounts()
    }
  } catch {
    // Handled in stores
  }
})

function openCreateModal() {
  accountsStore.clearError()
  createModalOpen.value = true
}

function closeCreateModal() {
  createModalOpen.value = false
}

function openEditModal(account: Account) {
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
    closeCreateModal()
  } catch {
    // Error shown in store
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

      <div class="actions-bar">
        <button type="button" class="btn-add" @click="openCreateModal">
          + Nova conta
        </button>
      </div>

      <div v-if="accountsStore.loading && accountsStore.accounts.length === 0" class="loading-state">
        <div class="spinner"></div>
        <p>A carregar contas...</p>
      </div>

      <div v-else-if="accountsStore.accounts.length === 0" class="empty-state">
        <p>Nenhuma conta ainda. Cria a tua primeira conta.</p>
        <button type="button" class="btn-add" @click="openCreateModal">
          + Nova conta
        </button>
      </div>

      <div v-else class="cards-grid">
        <div
          v-for="account in accountsStore.accounts"
          :key="account.id"
          class="account-card"
        >
          <div class="card-main">
            <h3 class="account-name">{{ account.name }}</h3>
            <p class="account-balance" :class="{ negative: account.balance < 0 }">
              {{ formatBalance(account.balance, account.currency) }}
            </p>
            <span class="account-type-badge">
              {{ ACCOUNT_TYPE_LABELS[account.type] }}
            </span>
          </div>
          <div class="card-actions">
            <button
              type="button"
              class="btn-icon"
              title="Editar"
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
  </div>
</template>

<style scoped>
.accounts-view {
  max-width: 800px;
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
.error-state,
.empty-state {
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

.actions-bar {
  margin-bottom: 1.5rem;
}

.btn-add {
  padding: 0.625rem 1.25rem;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
}

.btn-add:hover {
  opacity: 0.95;
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

.card-main {
  flex: 1;
}

.account-name {
  font-size: 1.0625rem;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 0.5rem 0;
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
</style>
