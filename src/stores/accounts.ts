import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { accountsApi } from '@/api/accounts'
import type { Account, CreateAccountRequest, UpdateAccountRequest } from '@/types/account'

function extractError(e: unknown): string {
  const err = e as {
    response?: {
      data?: { errors?: Record<string, string[]>; message?: string }
      status: number
    }
  }
  if (err.response?.data?.message) return err.response.data.message
  if (err.response?.data?.errors) {
    const first = Object.values(err.response.data.errors)[0]
    return Array.isArray(first) ? first[0] : String(first)
  }
  if (err.response?.status === 404) return 'Household não encontrado. Cria primeiro um household.'
  return 'Ocorreu um erro. Tenta novamente.'
}

function mapAccount(a: Account): Account {
  return {
    id: a.id,
    name: a.name,
    type: a.type,
    balance: Number(a.balance),
    currency: a.currency,
    householdId: a.householdId,
    isActiveForPlan: a.isActiveForPlan ?? true,
    isArchived: a.isArchived ?? false,
    archivedAt: a.archivedAt
  }
}

export const useAccountsStore = defineStore('accounts', () => {
  const accounts = ref<Account[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const activeAccounts = computed(() => accounts.value.filter((a) => !a.isArchived))
  const archivedAccounts = computed(() => accounts.value.filter((a) => a.isArchived))

  async function fetchAccounts() {
    loading.value = true
    error.value = null
    try {
      const { data } = await accountsApi.getAll()
      accounts.value = data.map(mapAccount)
      return accounts.value
    } catch (e: unknown) {
      error.value = extractError(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function createAccount(request: CreateAccountRequest) {
    loading.value = true
    error.value = null
    try {
      const { data } = await accountsApi.create(request)
      const account = mapAccount(data)
      accounts.value = [...accounts.value, account]
      return account
    } catch (e: unknown) {
      error.value = extractError(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateAccount(id: string, request: UpdateAccountRequest) {
    loading.value = true
    error.value = null
    try {
      const { data } = await accountsApi.update(id, request)
      const account = mapAccount(data)
      const idx = accounts.value.findIndex((a) => a.id === id)
      if (idx >= 0) {
        accounts.value = [...accounts.value]
        accounts.value[idx] = account
      } else {
        accounts.value = [...accounts.value, account]
      }
      return account
    } catch (e: unknown) {
      error.value = extractError(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteAccount(id: string) {
    loading.value = true
    error.value = null
    try {
      await accountsApi.delete(id)
      accounts.value = accounts.value.filter((a) => a.id !== id)
    } catch (e: unknown) {
      error.value = extractError(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function archiveAccount(id: string, targetAccountId?: string) {
    loading.value = true
    error.value = null
    try {
      const { data } = await accountsApi.archive(id, targetAccountId)
      const account = mapAccount(data)
      const idx = accounts.value.findIndex((a) => a.id === id)
      if (idx >= 0) {
        accounts.value = [...accounts.value]
        accounts.value[idx] = account
      }
      return account
    } catch (e: unknown) {
      error.value = extractError(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function reactivateAccount(id: string) {
    loading.value = true
    error.value = null
    try {
      const { data } = await accountsApi.reactivate(id)
      const account = mapAccount(data)
      const idx = accounts.value.findIndex((a) => a.id === id)
      if (idx >= 0) {
        accounts.value = [...accounts.value]
        accounts.value[idx] = account
      }
      return account
    } catch (e: unknown) {
      error.value = extractError(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteAccountWithTransfer(id: string, targetAccountId: string) {
    loading.value = true
    error.value = null
    try {
      await accountsApi.deleteWithTransfer(id, targetAccountId)
      accounts.value = accounts.value.filter((a) => a.id !== id)
    } catch (e: unknown) {
      error.value = extractError(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  function adjustBalance(accountId: string, delta: number) {
    const idx = accounts.value.findIndex((a) => a.id === accountId)
    if (idx >= 0) {
      accounts.value = [...accounts.value]
      accounts.value[idx] = { ...accounts.value[idx], balance: accounts.value[idx].balance + delta }
    }
  }

  function clearError() {
    error.value = null
  }

  return {
    accounts,
    activeAccounts,
    archivedAccounts,
    loading,
    error,
    fetchAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
    archiveAccount,
    reactivateAccount,
    deleteAccountWithTransfer,
    adjustBalance,
    clearError
  }
})
