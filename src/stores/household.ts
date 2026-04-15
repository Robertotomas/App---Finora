import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { householdApi } from '@/api/household'
import { useAuthStore } from '@/stores/auth'
import { userFromProfileResponse } from '@/types/auth'
import type { Household, HouseholdMember, HouseholdType } from '@/types/household'

export const useHouseholdStore = defineStore('household', () => {
  const household = ref<Household | null>(null)
  const members = ref<HouseholdMember[]>([])
  const membersLoading = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isIndividual = computed(() => household.value?.type === 0)
  const isCouple = computed(() => household.value?.type === 1)

  async function fetchHousehold() {
    loading.value = true
    error.value = null
    try {
      const { data } = await householdApi.getMyHousehold()
      household.value = {
        id: data.id,
        type: data.type,
        name: data.name,
        primaryAccountId: data.primaryAccountId ?? undefined
      }
      await fetchMembers()
      return data
    } catch (e: unknown) {
      const err = e as { response?: { status: number } }
      if (err.response?.status === 404) {
        household.value = null
        members.value = []
      } else {
        error.value = 'Erro ao carregar household.'
      }
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchMembers() {
    if (!household.value) {
      members.value = []
      return
    }
    membersLoading.value = true
    try {
      const { data } = await householdApi.getMembers()
      members.value = Array.isArray(data) ? data : []
    } catch {
      members.value = []
    } finally {
      membersLoading.value = false
    }
  }

  async function leaveCoupleHousehold() {
    const authStore = useAuthStore()
    loading.value = true
    error.value = null
    try {
      const { data } = await householdApi.leaveCouple()
      authStore.setAuth(data.accessToken, userFromProfileResponse(data.user))
      await fetchHousehold()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message ?? 'Não foi possível sair do agregado.'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function upgradeToCouple() {
    if (!household.value) return
    loading.value = true
    error.value = null
    try {
      const { data } = await householdApi.update(household.value.id, {
        type: 1,
        name: household.value.name
      })
      household.value = data
      return data
    } catch (e: unknown) {
      error.value = 'Erro ao atualizar plano.'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateHousehold(type: HouseholdType, name: string) {
    if (!household.value) return
    loading.value = true
    error.value = null
    try {
      const { data } = await householdApi.update(household.value.id, { type, name })
      household.value = data
      return data
    } catch (e: unknown) {
      error.value = 'Erro ao atualizar household.'
      throw e
    } finally {
      loading.value = false
    }
  }

  function clearHousehold() {
    household.value = null
    members.value = []
    error.value = null
  }

  return {
    household,
    members,
    membersLoading,
    loading,
    error,
    isIndividual,
    isCouple,
    fetchHousehold,
    fetchMembers,
    leaveCoupleHousehold,
    upgradeToCouple,
    updateHousehold,
    clearHousehold,
  }
})
