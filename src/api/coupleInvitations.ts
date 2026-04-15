import api from './client'
import type { AuthResponse } from '@/types/auth'

export interface ValidateInviteResponse {
  valid: boolean
  inviterName?: string
  householdName?: string
  inviteeEmailMasked?: string
}

export const coupleInvitationsApi = {
  validate: (token: string) =>
    api.get<ValidateInviteResponse>('/api/couple-invitations/validate', { params: { token } }),

  create: (email: string) => api.post('/api/couple-invitations', { email }),

  verifyOtp: (code: string, migratePersonalData: boolean) =>
    api.post<AuthResponse>('/api/couple-invitations/verify-otp', { code, migratePersonalData }),
}
