import { defineStore } from 'pinia'
import { ref } from 'vue'
import { accountsApi } from '@/api/accounts'
import type { Account, CreateAccountRequest, UpdateAccountRequest } from '@/types/account'

function extractError(e: unknown): string {
  const err = e as { response?: { data?: { errors?: Record<string, string[]> }; status: number } }
  if (err.response?.data?.errors) {
    const first = Object.values(err.response.data.errors)[0]
    return Array.isArray(first) ? first[0] : String(first)
  }
  if (err.response?.status === 404) return 'Household não encontrado. Cria primeiro um household.'
  return 'Ocorreu um erro. Tenta novamente.'
}

export const useAccountsStore = defineStore('accounts', () => {
  const accounts = ref<Account[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAccounts() {
    loading.value = true
    error.value = null
    try {
      const { data } = await accountsApi.getAll()
      accounts.value = data.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: Number(a.balance),
        currency: a.currency,
        householdId: a.householdId
      }))
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
      const account: Account = {
        id: data.id,
        name: data.name,
        type: data.type,
        balance: Number(data.balance),
        currency: data.currency,
        householdId: data.householdId
      }
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
      const account: Account = {
        id: data.id,
        name: data.name,
        type: data.type,
        balance: Number(data.balance),
        currency: data.currency,
        householdId: data.householdId
      }
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

  function clearError() {
    error.value = null
  }

  return {
    accounts,
    loading,
    error,
    fetchAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
    clearError
  }
})
