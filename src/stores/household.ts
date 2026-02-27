import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { householdApi } from '@/api/household'
import type { Household, HouseholdType } from '@/types/household'

export const useHouseholdStore = defineStore('household', () => {
  const household = ref<Household | null>(null)
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
        name: data.name
      }
      return data
    } catch (e: unknown) {
      const err = e as { response?: { status: number } }
      if (err.response?.status === 404) {
        household.value = null
      } else {
        error.value = 'Erro ao carregar household.'
      }
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
    error.value = null
  }

  return {
    household,
    loading,
    error,
    isIndividual,
    isCouple,
    fetchHousehold,
    upgradeToCouple,
    updateHousehold,
    clearHousehold,
  }
})
