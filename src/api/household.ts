import api from './client'
import type { Household, UpdateHouseholdRequest } from '@/types/household'

export const householdApi = {
  getMyHousehold: () =>
    api.get<Household>('/api/household/me'),

  update: (id: string, data: UpdateHouseholdRequest) =>
    api.put<Household>(`/api/household/${id}`, data),
}
