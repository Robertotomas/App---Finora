import api from './client'
import type { AuthResponse, LoginRequest, RegisterRequest, UpdateProfileRequest, User } from '@/types/auth'

export const authApi = {
  register: (data: RegisterRequest) =>
    api.post<AuthResponse>('/api/auth/register', data),

  login: (data: LoginRequest) =>
    api.post<AuthResponse>('/api/auth/login', data),

  refresh: (refreshToken: string) =>
    api.post<AuthResponse>('/api/auth/refresh', { refreshToken }),

  me: () => api.get('/api/auth/me'),

  getProfile: () => api.get<User>('/api/auth/profile'),

  updateProfile: (data: UpdateProfileRequest) => api.put<User>('/api/auth/profile', data),
}
