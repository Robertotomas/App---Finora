import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/auth'
import { userFromProfileResponse, type User, type LoginRequest, type RegisterRequest, type AuthResponse } from '@/types/auth'

const TOKEN_KEY = 'token'
const REFRESH_TOKEN_KEY = 'refreshToken'
const USER_KEY = 'user'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const refreshTokenValue = ref<string | null>(localStorage.getItem(REFRESH_TOKEN_KEY))
  const storedUser = localStorage.getItem(USER_KEY)
  const user = ref<User | null>(storedUser ? (JSON.parse(storedUser) as User) : null)

  let refreshTimer: ReturnType<typeof setTimeout> | null = null

  const isAuthenticated = computed(() => !!token.value)

  function setAuth(authToken: string, authUser: User, refreshToken?: string) {
    token.value = authToken
    user.value = authUser
    localStorage.setItem(TOKEN_KEY, authToken)
    localStorage.setItem(USER_KEY, JSON.stringify(authUser))
    if (refreshToken) {
      refreshTokenValue.value = refreshToken
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
    }
  }

  function clearAuth() {
    token.value = null
    refreshTokenValue.value = null
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    if (refreshTimer) {
      clearTimeout(refreshTimer)
      refreshTimer = null
    }
  }

  function scheduleRefresh(expiresInSeconds: number) {
    if (refreshTimer) clearTimeout(refreshTimer)
    // Refresh 2 minutes before expiry (or at half-time if < 4 min)
    const refreshInMs = Math.max((expiresInSeconds - 120) * 1000, (expiresInSeconds / 2) * 1000)
    if (refreshInMs <= 0) return
    refreshTimer = setTimeout(() => doRefresh(), refreshInMs)
  }

  async function doRefresh() {
    if (!refreshTokenValue.value) return
    try {
      const { data: response } = await authApi.refresh(refreshTokenValue.value)
      setAuth(response.accessToken, response.user, response.refreshToken)
      scheduleRefresh(response.expiresIn)
    } catch {
      clearAuth()
      window.location.href = '/login'
    }
  }

  async function login(data: LoginRequest) {
    const { data: response } = await authApi.login(data)
    setAuth(response.accessToken, response.user, response.refreshToken)
    scheduleRefresh(response.expiresIn)
    return response
  }

  /**
   * Regista. No fluxo normal devolve `{ requiresEmailConfirmation: true }` (sem iniciar
   * sessão — falta confirmar o email). No convite de casal inicia sessão e devolve o user.
   */
  async function register(data: RegisterRequest) {
    const { data: response } = await authApi.register(data)
    if ('requiresEmailConfirmation' in response && response.requiresEmailConfirmation) {
      return { requiresEmailConfirmation: true as const, email: response.email }
    }
    const auth = response as AuthResponse
    setAuth(auth.accessToken, auth.user, auth.refreshToken)
    scheduleRefresh(auth.expiresIn)
    return { requiresEmailConfirmation: false as const, user: auth.user }
  }

  function logout() {
    clearAuth()
  }

  function loadFromStorage() {
    const storedToken = localStorage.getItem(TOKEN_KEY)
    const storedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY)
    const storedUser = localStorage.getItem(USER_KEY)
    if (storedToken && storedUser) {
      token.value = storedToken
      refreshTokenValue.value = storedRefresh
      user.value = JSON.parse(storedUser)
      // Schedule a refresh soon since we don't know when the token expires
      if (storedRefresh) scheduleRefresh(300)
    }
  }

  /** Atualiza o utilizador em memória e no localStorage (ex.: após guardar o perfil). */
  function applyUserFromProfileResponse(payload: unknown) {
    if (!token.value) return
    const next = userFromProfileResponse(payload)
    user.value = next
    localStorage.setItem(USER_KEY, JSON.stringify(next))
  }

  return {
    token,
    user,
    isAuthenticated,
    setAuth,
    login,
    register,
    logout,
    loadFromStorage,
    applyUserFromProfileResponse,
  }
})
