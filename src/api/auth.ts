import api from './client'
import type { AuthResponse, LoginRequest, RegisterRequest, RegisterResponse, UpdateProfileRequest, User } from '@/types/auth'

export const authApi = {
  register: (data: RegisterRequest) =>
    api.post<RegisterResponse>('/api/auth/register', data),

  login: (data: LoginRequest) =>
    api.post<AuthResponse>('/api/auth/login', data),

  confirmEmail: (token: string) =>
    api.post<{ message: string }>('/api/auth/confirm-email', { token }),

  resendEmailConfirmation: (email: string) =>
    api.post<{ message: string }>('/api/auth/resend-email-confirmation', { email }),

  refresh: (refreshToken: string) =>
    api.post<AuthResponse>('/api/auth/refresh', { refreshToken }),

  forgotPassword: (email: string) =>
    api.post<{ message: string }>('/api/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    api.post<{ message: string }>('/api/auth/reset-password', { token, newPassword }),

  me: () => api.get('/api/auth/me'),

  getProfile: () => api.get<User>('/api/auth/profile'),

  updateProfile: (data: UpdateProfileRequest) => api.put<User>('/api/auth/profile', data),
}
