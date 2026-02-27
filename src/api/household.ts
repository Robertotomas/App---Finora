import api from './client'
import type { Household, HouseholdMember, UpdateHouseholdRequest } from '@/types/household'

export const householdApi = {
  getMyHousehold: () =>
    api.get<Household>('/api/household/me'),

  getMembers: () =>
    api.get<HouseholdMember[]>('/api/household/members'),

  update: (id: string, data: UpdateHouseholdRequest) =>
    api.put<Household>(`/api/household/${id}`, data),
}
