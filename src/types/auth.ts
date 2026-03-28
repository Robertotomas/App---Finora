export type Gender = 'Male' | 'Female' | 0 | 1

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  gender?: Gender
  householdId?: string
}

export interface AuthResponse {
  accessToken: string
  tokenType: string
  expiresIn: number
  user: User
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  firstName: string
  lastName: string
  gender?: Gender
}

export interface UpdateProfileRequest {
  firstName: string
  lastName: string
  gender: number | null
}

/** Resposta de GET/PUT /api/auth/profile (camelCase ou PascalCase). */
export function userFromProfileResponse(data: unknown): User {
  const o = (data ?? {}) as Record<string, unknown>
  const pick = (k: string) => o[k] ?? o[k.charAt(0).toUpperCase() + k.slice(1)]
  const g = pick('gender')
  let gender: Gender | undefined
  if (g === 0 || g === 'Male') gender = 0
  else if (g === 1 || g === 'Female') gender = 1
  const hid = pick('householdId')
  return {
    id: String(pick('id') ?? ''),
    email: String(pick('email') ?? ''),
    firstName: String(pick('firstName') ?? ''),
    lastName: String(pick('lastName') ?? ''),
    gender,
    householdId: hid != null && hid !== '' ? String(hid) : undefined,
  }
}
