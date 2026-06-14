import api from './client'
import type { Asset, CreateAssetRequest, UpdateAssetRequest, AddValuationRequest } from '@/types/asset'

export const assetsApi = {
  getAll: () => api.get<Asset[]>('/api/assets'),

  getById: (id: string) => api.get<Asset>(`/api/assets/${id}`),

  create: (data: CreateAssetRequest) => api.post<Asset>('/api/assets', data),

  update: (id: string, data: UpdateAssetRequest) => api.put<Asset>(`/api/assets/${id}`, data),

  delete: (id: string) => api.delete(`/api/assets/${id}`),

  addValuation: (id: string, data: AddValuationRequest) =>
    api.post<Asset>(`/api/assets/${id}/valuations`, data),

  updateValuation: (id: string, valuationId: string, data: AddValuationRequest) =>
    api.put<Asset>(`/api/assets/${id}/valuations/${valuationId}`, data),

  deleteValuation: (id: string, valuationId: string) =>
    api.delete<Asset>(`/api/assets/${id}/valuations/${valuationId}`),
}
