import api from './client'
import type { AuthResponse } from '@/types/auth'
import type { Household, HouseholdMember, SetPrimaryAccountRequest, UpdateHouseholdRequest } from '@/types/household'

export const householdApi = {
  getMyHousehold: () =>
    api.get<Household>('/api/household/me'),

  getMembers: () =>
    api.get<HouseholdMember[]>('/api/household/members'),

  update: (id: string, data: UpdateHouseholdRequest) =>
    api.put<Household>(`/api/household/${id}`, data),

  setPrimaryAccount: (data: SetPrimaryAccountRequest) =>
    api.put<Household>('/api/household/me/primary-account', data),

  leaveCouple: () => api.post<AuthResponse>('/api/household/me/leave-couple'),

  dismissPartnerLeftNotice: () =>
    api.post<Household>('/api/household/me/dismiss-partner-left-notice'),

  resetFinancialData: (confirmPhrase: string) =>
    api.post<Household>('/api/household/me/reset-financial-data', {
      confirmPhrase,
    }),
}
