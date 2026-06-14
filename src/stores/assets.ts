import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { assetsApi } from '@/api/assets'
import type {
  Asset,
  AssetValuation,
  CreateAssetRequest,
  UpdateAssetRequest,
  AddValuationRequest,
} from '@/types/asset'

function extractError(e: unknown): string {
  const err = e as {
    response?: { data?: { errors?: Record<string, string[]>; message?: string }; status: number }
  }
  if (err.response?.data?.message) return err.response.data.message
  if (err.response?.data?.errors) {
    const first = Object.values(err.response.data.errors)[0]
    return Array.isArray(first) ? first[0] : String(first)
  }
  return 'Ocorreu um erro. Tente novamente.'
}

function mapValuation(v: AssetValuation): AssetValuation {
  return { id: v.id, date: v.date, value: Number(v.value) }
}

function mapAsset(a: Asset): Asset {
  return {
    id: a.id,
    householdId: a.householdId,
    name: a.name,
    category: a.category,
    acquisitionCost: Number(a.acquisitionCost),
    currency: a.currency,
    acquisitionDate: a.acquisitionDate,
    currentValue: Number(a.currentValue),
    lastValuationDate: a.lastValuationDate,
    valuations: Array.isArray(a.valuations) ? a.valuations.map(mapValuation) : [],
  }
}

export const useAssetsStore = defineStore('assets', () => {
  const assets = ref<Asset[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)

  const totalCurrentValue = computed(() => assets.value.reduce((sum, a) => sum + a.currentValue, 0))

  function upsert(asset: Asset) {
    const idx = assets.value.findIndex((a) => a.id === asset.id)
    if (idx >= 0) {
      assets.value = [...assets.value]
      assets.value[idx] = asset
    } else {
      assets.value = [...assets.value, asset]
    }
  }

  async function fetchAssets() {
    loading.value = true
    error.value = null
    try {
      const { data } = await assetsApi.getAll()
      assets.value = data.map(mapAsset)
      return assets.value
    } catch (e: unknown) {
      error.value = extractError(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchAsset(id: string) {
    error.value = null
    try {
      const { data } = await assetsApi.getById(id)
      const asset = mapAsset(data)
      upsert(asset)
      return asset
    } catch (e: unknown) {
      error.value = extractError(e)
      throw e
    }
  }

  async function createAsset(request: CreateAssetRequest) {
    error.value = null
    try {
      const { data } = await assetsApi.create(request)
      const asset = mapAsset(data)
      upsert(asset)
      return asset
    } catch (e: unknown) {
      error.value = extractError(e)
      throw e
    }
  }

  async function updateAsset(id: string, request: UpdateAssetRequest) {
    error.value = null
    try {
      const { data } = await assetsApi.update(id, request)
      const asset = mapAsset(data)
      upsert(asset)
      return asset
    } catch (e: unknown) {
      error.value = extractError(e)
      throw e
    }
  }

  async function deleteAsset(id: string) {
    error.value = null
    try {
      await assetsApi.delete(id)
      assets.value = assets.value.filter((a) => a.id !== id)
    } catch (e: unknown) {
      error.value = extractError(e)
      throw e
    }
  }

  async function addValuation(id: string, request: AddValuationRequest) {
    error.value = null
    try {
      const { data } = await assetsApi.addValuation(id, request)
      const asset = mapAsset(data)
      upsert(asset)
      return asset
    } catch (e: unknown) {
      error.value = extractError(e)
      throw e
    }
  }

  async function updateValuation(id: string, valuationId: string, request: AddValuationRequest) {
    error.value = null
    try {
      const { data } = await assetsApi.updateValuation(id, valuationId, request)
      const asset = mapAsset(data)
      upsert(asset)
      return asset
    } catch (e: unknown) {
      error.value = extractError(e)
      throw e
    }
  }

  async function deleteValuation(id: string, valuationId: string) {
    error.value = null
    try {
      const { data } = await assetsApi.deleteValuation(id, valuationId)
      const asset = mapAsset(data)
      upsert(asset)
      return asset
    } catch (e: unknown) {
      error.value = extractError(e)
      throw e
    }
  }

  function clearError() {
    error.value = null
  }

  return {
    assets,
    loading,
    error,
    totalCurrentValue,
    fetchAssets,
    fetchAsset,
    createAsset,
    updateAsset,
    deleteAsset,
    addValuation,
    updateValuation,
    deleteValuation,
    clearError,
  }
})
