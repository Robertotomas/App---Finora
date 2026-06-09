import api from './client'
import type { AuthResponse, LoginRequest, RegisterRequest, UpdateProfileRequest, User } from '@/types/auth'

export const authApi = {
  register: (data: RegisterRequest) =>
    api.post<AuthResponse>('/api/auth/register', data),

  login: (data: LoginRequest) =>
    api.post<AuthResponse>('/api/auth/login', data),

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
