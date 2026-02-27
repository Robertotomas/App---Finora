import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/auth'
import type { User, LoginRequest, RegisterRequest } from '@/types/auth'

const TOKEN_KEY = 'token'
const USER_KEY = 'user'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const storedUser = localStorage.getItem(USER_KEY)
  const user = ref<User | null>(storedUser ? (JSON.parse(storedUser) as User) : null)

  const isAuthenticated = computed(() => !!token.value)

  function setAuth(authToken: string, authUser: User) {
    token.value = authToken
    user.value = authUser
    localStorage.setItem(TOKEN_KEY, authToken)
    localStorage.setItem(USER_KEY, JSON.stringify(authUser))
  }

  function clearAuth() {
    token.value = null
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  async function login(data: LoginRequest) {
    const { data: response } = await authApi.login(data)
    setAuth(response.accessToken, response.user)
    return response
  }

  async function register(data: RegisterRequest) {
    const { data: response } = await authApi.register(data)
    setAuth(response.accessToken, response.user)
    return response
  }

  function logout() {
    clearAuth()
  }

  function loadFromStorage() {
    const storedToken = localStorage.getItem(TOKEN_KEY)
    const storedUser = localStorage.getItem(USER_KEY)
    if (storedToken && storedUser) {
      token.value = storedToken
      user.value = JSON.parse(storedUser)
    }
  }

  return {
    token,
    user,
    isAuthenticated,
    login,
    register,
    logout,
    loadFromStorage,
  }
})
