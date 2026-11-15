<script setup lang="ts">
import PageSkeleton from '@/components/PageSkeleton.vue'
import { PT_GROUPING } from '@/utils/numberFormat'
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
import PlanUpsellModal from '@/components/PlanUpsellModal.vue'
import BrandLogo from '@/components/BrandLogo.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import UiButton from '@/components/ui/UiButton.vue'
import FilterChips from '@/components/ui/FilterChips.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ActionMenu from '@/components/ui/ActionMenu.vue'
import type { ActionMenuItem } from '@/components/ui/ActionMenu.vue'
import { useToast } from '@/composables/useToast'
import type { Account, CreateAccountRequest } from '@/types/account'
import { ACCOUNT_TYPE_LABELS, AccountType } from '@/types/account'

const toast = useToast()
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

// Filtro de secção (chips Todas / Ativas / Arquivadas), ligado a ?tab=active|archived
type SectionFilter = 'all' | 'active' | 'archived'
const sectionFilter = computed<SectionFilter>({
  get: () =>
    route.query.tab === 'archived' ? 'archived' : route.query.tab === 'active' ? 'active' : 'all',
  set: (val) => {
    const tab = val === 'all' ? undefined : val
    router.replace({ query: { ...route.query, tab } })
  },
})

const filterOptions = computed(() => [
  {
    value: 'all' as SectionFilter,
    label: 'Todas',
    count: accountsStore.activeAccounts.length + accountsStore.archivedAccounts.length,
  },
  { value: 'active' as SectionFilter, label: 'Ativas', count: accountsStore.activeAccounts.length },
  { value: 'archived' as SectionFilter, label: 'Arquivadas', count: accountsStore.archivedAccounts.length },
])

/** Saldo total das contas ativas (moeda fixa EUR). */
const totalActiveBalance = computed(() =>
  accountsStore.activeAccounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0)
)

function activeAccountActions(account: Account): ActionMenuItem[] {
  return [
    {
      label: 'Editar',
      disabled: needsPrimarySelection.value || account.isActiveForPlan === false,
      onSelect: () => openEditModal(account),
    },
    { label: 'Arquivar', onSelect: () => openArchiveModal(account) },
    { label: 'Eliminar', danger: true, onSelect: () => openDeleteModal(account) },
  ]
}

function archivedAccountActions(account: Account): ActionMenuItem[] {
  return [
    { label: 'Reativar', onSelect: () => handleReactivate(account) },
    { label: 'Eliminar', danger: true, onSelect: () => openDeleteArchivedModal(account) },
  ]
}

const showActiveSection = computed(
  () => sectionFilter.value === 'all' || sectionFilter.value === 'active'
)
const showArchivedSection = computed(
  () => sectionFilter.value === 'all' || sectionFilter.value === 'archived'
)

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
    toast.success('Conta adicionada')
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
    toast.success('Conta atualizada')
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
    toast.success('Conta eliminada')
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
    toast.success('Conta eliminada')
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
    toast.success('Conta arquivada')
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
    toast.success('Conta reativada')
  } catch {
    // Error shown in store
  } finally {
    actionLoading.value = false
  }
}

function formatBalance(balance: number, currency: string): string {
  return new Intl.NumberFormat('pt-PT', { ...PT_GROUPING,
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
    <PageSkeleton v-if="!householdStore.household && householdStore.loading" variant="cards" :rows="3" />

    <!-- No household -->
    <EmptyState
      v-else-if="!householdStore.household && !householdStore.loading"
      title="Ainda não tem um agregado"
      description="Configure primeiro o seu agregado para começar a adicionar contas."
    >
      <router-link to="/household" class="link">Configurar agregado</router-link>
    </EmptyState>

    <!-- Error -->
    <div v-else-if="householdStore.error && !householdStore.household" class="notice notice--danger">
      {{ householdStore.error }}
    </div>

    <!-- Main content -->
    <template v-else>
      <PageHeader title="Contas">
        <template v-if="accountsStore.activeAccounts.length > 0" #actions>
          <UiButton variant="primary" @click="openCreateModal">
            <template #icon>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
            </template>
            Adicionar
          </UiButton>
        </template>
      </PageHeader>

      <!-- Global error -->
      <div v-if="accountsStore.error" class="notice notice--danger">
        {{ accountsStore.error }}
      </div>

      <!-- Resumo -->
      <section v-if="accountsStore.activeAccounts.length > 0" class="summary">
        <div class="summary-item">
          <span class="ui-label">Saldo total</span>
          <span class="summary-value">{{ formatBalance(totalActiveBalance, 'EUR') }}</span>
        </div>
        <div class="summary-item summary-item--side">
          <span class="ui-label">Contas ativas</span>
          <span class="summary-count">{{ accountsStore.activeAccounts.length }}</span>
        </div>
        <div v-if="accountsStore.archivedAccounts.length > 0" class="summary-item summary-item--side">
          <span class="ui-label">Arquivadas</span>
          <span class="summary-count">{{ accountsStore.archivedAccounts.length }}</span>
        </div>
      </section>

      <!-- Filtro Ativas / Arquivadas -->
      <div
        v-if="accountsStore.activeAccounts.length > 0 || accountsStore.archivedAccounts.length > 0"
        class="ui-toolbar"
      >
        <FilterChips v-model="sectionFilter" :options="filterOptions" aria-label="Filtrar contas" />
      </div>

      <!-- Primary selection banner -->
      <div
        v-if="showActiveSection && needsPrimarySelection && accountsStore.activeAccounts.length > 1"
        class="banner"
      >
        <p class="banner-title">Escolha a conta principal</p>
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
        <div>
          <UiButton
            variant="primary"
            size="sm"
            :loading="primarySelectionLoading"
            :disabled="!selectedPrimaryId"
            @click="setPrimaryAccount"
          >
            Confirmar
          </UiButton>
        </div>
      </div>

      <!-- Unlock banner -->
      <div v-if="showActiveSection && showUnlockAccountsBanner" class="banner banner--row">
        <div>
          <p class="banner-title">Contas bloqueadas</p>
          <p class="banner-text">Atualize para Pro ou Couple para desbloquear todas as contas.</p>
        </div>
        <router-link :to="{ name: 'subscricao' }" class="banner-link">Ver planos</router-link>
      </div>

      <!-- Loading accounts -->
      <PageSkeleton v-if="accountsStore.loading && accountsStore.accounts.length === 0" variant="cards" :rows="3" />

      <!-- Empty state -->
      <div
        v-else-if="accountsStore.activeAccounts.length === 0 && accountsStore.archivedAccounts.length === 0"
        class="empty-card"
      >
        <EmptyState
          title="Ainda não tem contas"
          description="Adicione a sua primeira conta para começar a controlar as finanças."
        >
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/><circle cx="17" cy="15" r="1.5"/></svg>
          </template>
          <UiButton variant="secondary" @click="openCreateModal">Adicionar conta</UiButton>
        </EmptyState>
      </div>

      <!-- Active accounts -->
      <section v-if="showActiveSection && accountsStore.activeAccounts.length > 0" class="section">
        <h2 v-if="sectionFilter === 'all'" class="ui-label section-heading">Ativas</h2>
        <div class="ui-grid-3">
          <article
            v-for="account in accountsStore.activeAccounts"
            :key="account.id"
            class="account-card"
            :class="{ 'account-card--locked': account.isActiveForPlan === false }"
          >
            <div class="card-top">
              <BrandLogo :name="account.name" :domain="account.logoDomain" :size="40" class="card-logo">
                <template #fallback>
                  <span class="card-icon">
                    <svg v-if="isCreditCard(account.type)" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="accountIcon(account.type)"/></svg>
                  </span>
                </template>
              </BrandLogo>
              <div class="card-heading">
                <h3 class="card-name" :title="account.name">{{ account.name }}</h3>
                <div class="card-badges">
                  <span class="ui-badge">{{ ACCOUNT_TYPE_LABELS[account.type] }}</span>
                  <span v-if="isPrimaryBadge(account)" class="ui-badge ui-badge--brand">Principal</span>
                </div>
              </div>
              <ActionMenu :items="activeAccountActions(account)" :aria-label="`Ações de ${account.name}`" />
            </div>
            <p class="card-balance" :class="{ 'card-balance--neg': account.balance < 0 }">
              {{ formatBalance(account.balance, account.currency) }}
            </p>
            <p v-if="account.isActiveForPlan === false" class="card-hint">
              Só consulta no plano Free
            </p>
          </article>
        </div>
      </section>

      <!-- Archived empty state -->
      <div
        v-if="sectionFilter === 'archived' && accountsStore.archivedAccounts.length === 0"
        class="empty-card"
      >
        <EmptyState
          title="Sem contas arquivadas"
          description="As contas que arquivar aparecem aqui, sem perder o histórico."
        >
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
          </template>
        </EmptyState>
      </div>

      <!-- Archived accounts -->
      <section v-if="showArchivedSection && accountsStore.archivedAccounts.length > 0" class="section">
        <h2 v-if="sectionFilter === 'all'" class="ui-label section-heading">Arquivadas</h2>
        <div class="ui-grid-3">
          <article
            v-for="account in accountsStore.archivedAccounts"
            :key="account.id"
            class="account-card account-card--archived"
          >
            <div class="card-top">
              <BrandLogo :name="account.name" :domain="account.logoDomain" :size="40" class="card-logo">
                <template #fallback>
                  <span class="card-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
                  </span>
                </template>
              </BrandLogo>
              <div class="card-heading">
                <h3 class="card-name" :title="account.name">{{ account.name }}</h3>
                <div class="card-badges">
                  <span class="ui-badge">{{ ACCOUNT_TYPE_LABELS[account.type] }}</span>
                  <span class="ui-badge ui-badge--warning">Arquivada</span>
                </div>
              </div>
              <ActionMenu :items="archivedAccountActions(account)" :aria-label="`Ações de ${account.name}`" />
            </div>
            <p class="card-balance">
              {{ formatBalance(account.balance, account.currency) }}
            </p>
          </article>
        </div>
      </section>
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
        <p class="blocked-question">O que pretende fazer?</p>
        <div class="blocked-options">
          <button type="button" class="blocked-option" @click="handleArchiveFromBlocked" :disabled="actionLoading">
            <span class="blocked-option-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
            </span>
            <span>
              <span class="blocked-option-label">Arquivar conta</span>
              <span class="blocked-option-desc">Remove do património sem perder dados</span>
            </span>
          </button>
          <button type="button" class="blocked-option" @click="handleDeleteWithTransferFromBlocked" :disabled="actionLoading">
            <span class="blocked-option-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 7 17 7"/><polyline points="4 12 20 12"/><polyline points="7 17 17 17"/><polyline points="3 7 5 5 3 3"/><polyline points="21 17 19 19 21 21"/></svg>
            </span>
            <span>
              <span class="blocked-option-label">Eliminar com transferência</span>
              <span class="blocked-option-desc">Move saldo e movimentos para outra conta</span>
            </span>
          </button>
        </div>
        <div class="blocked-footer">
          <UiButton variant="secondary" @click="closeDeleteBlockedModal">Cancelar</UiButton>
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

    <PlanUpsellModal
      :open="accountLimitModalOpen"
      title="Adicione todas as suas contas"
      description="No plano Free só pode ter 1 conta. Atualize para Pro ou Couple para juntar todas as que precisar."
      :features="[
        'Contas ilimitadas',
        'Veja o seu património completo num só sítio',
        'Objetivos de poupança e relatórios mensais',
      ]"
      @close="accountLimitModalOpen = false"
    />
  </div>
</template>

<style scoped>
.accounts-page {
  max-width: var(--page-max);
  margin: 0 auto;
  padding: 0 0 var(--space-12);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}
/* O espaçamento entre secções vem do gap da página */
.accounts-page > .page-head {
  margin-bottom: 0;
}

/* ── Resumo ── */
.summary {
  display: flex;
  align-items: flex-end;
  gap: var(--space-8);
  flex-wrap: wrap;
  padding: var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}
.summary-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}
.summary-item--side {
  padding-left: var(--space-8);
  border-left: 1px solid var(--color-border);
}
.summary-value {
  font-size: var(--text-2xl);
  font-weight: var(--weight-bold);
  letter-spacing: var(--tracking-tight);
  color: var(--color-text-strong);
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
}
.summary-count {
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
  font-variant-numeric: tabular-nums;
}

.ui-toolbar {
  margin-bottom: 0;
}

/* ── Secções ── */
.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.section-heading {
  margin: 0;
}

/* ── Cartões de conta ── */
.account-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  transition: border-color var(--transition-fast);
  min-width: 0;
}
.account-card:hover {
  border-color: var(--color-border-strong);
}
.account-card--locked,
.account-card--archived {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
}
.account-card--locked .card-logo,
.account-card--locked .card-balance,
.account-card--archived .card-logo,
.account-card--archived .card-name,
.account-card--archived .card-balance {
  opacity: 0.6;
}

.card-top {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}
.card-logo {
  flex-shrink: 0;
  border-radius: 10px;
  border: 1px solid var(--color-border-subtle);
  overflow: hidden;
}
.card-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
}
.card-heading {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.card-name {
  margin: 0;
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-badges {
  display: flex;
  gap: var(--space-1);
  flex-wrap: wrap;
}
.card-balance {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--weight-bold);
  letter-spacing: var(--tracking-tight);
  color: var(--color-text-strong);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-balance--neg {
  color: var(--color-expense);
}
.card-hint {
  margin: calc(-1 * var(--space-2)) 0 0;
  font-size: var(--text-xs);
  color: var(--color-warning);
  font-weight: var(--weight-medium);
}

/* ── Banners ── */
.banner {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-warning-border);
  background: var(--color-warning-soft);
}
.banner--row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}
.banner-title {
  margin: 0;
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}
.banner-text {
  margin: 2px 0 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}
.banner-error {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-danger);
}
.banner-link {
  display: inline-flex;
  align-items: center;
  height: var(--control-h-sm);
  padding: 0 var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  text-decoration: none;
  transition: background var(--transition-fast);
}
.banner-link:hover {
  background: var(--color-primary-hover);
}
.primary-radio-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: var(--space-1) 0;
}
.primary-radio {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-base);
  color: var(--color-text);
  cursor: pointer;
}
.primary-radio input {
  accent-color: var(--color-primary);
}

/* ── Avisos / vazio ── */
.notice {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
}
.notice--danger {
  background: var(--color-danger-soft);
  border: 1px solid var(--color-danger-border);
  color: var(--color-danger);
}
.empty-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}
.link {
  color: var(--color-primary-text);
  font-weight: var(--weight-semibold);
  text-decoration: none;
}
.link:hover {
  text-decoration: underline;
}

/* ── Modal "não é possível eliminar" ── */
.blocked-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.blocked-msg {
  margin: 0;
  font-size: var(--text-base);
  color: var(--color-text-secondary);
  line-height: 1.5;
}
.blocked-question {
  margin: var(--space-2) 0 0;
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}
.blocked-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.blocked-option {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  text-align: left;
  font: inherit;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}
.blocked-option:hover:not(:disabled) {
  border-color: var(--color-border-strong);
  background: var(--color-selected);
}
.blocked-option:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.blocked-option-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
  color: var(--color-text-secondary);
}
.blocked-option-label {
  display: block;
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}
.blocked-option-desc {
  display: block;
  margin-top: 2px;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.blocked-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-2);
}

@media (max-width: 600px) {
  .summary {
    gap: var(--space-4) var(--space-6);
    padding: var(--space-4);
  }
  .summary-item:first-child {
    flex-basis: 100%;
  }
  .summary-item--side {
    padding-left: 0;
    border-left: none;
  }
  .summary-value {
    font-size: var(--text-xl);
  }
}
</style>
