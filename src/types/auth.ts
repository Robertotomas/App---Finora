export type Gender = 'Male' | 'Female' | 0 | 1

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  gender?: Gender
  householdId?: string
  /** IANA timezone (e.g. Europe/Lisbon) for monthly report scheduling */
  timeZoneId?: string | null
  /** Parceiro convidado por link/OTP (plano Couple) */
  isCoupleGuest?: boolean
  /** Se uniste por OTP: se os dados do agregado anterior foram migrados; omitido no registo só por link */
  coupleJoinDataMigrated?: boolean | null
}

export interface AuthResponse {
  accessToken: string
  refreshToken?: string
  tokenType: string
  expiresIn: number
  user: User
}

export interface LoginRequest {
  email: string
  password: string
  timeZoneId?: string
}

export interface RegisterRequest {
  email: string
  password: string
  firstName: string
  lastName: string
  gender?: Gender
  inviteToken?: string
  timeZoneId?: string
}

export interface UpdateProfileRequest {
  firstName: string
  lastName: string
  gender: number | null
  timeZoneId?: string | null
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
  const tz = pick('timeZoneId')
  const guest = pick('isCoupleGuest')
  const migrated = pick('coupleJoinDataMigrated')
  return {
    id: String(pick('id') ?? ''),
    email: String(pick('email') ?? ''),
    firstName: String(pick('firstName') ?? ''),
    lastName: String(pick('lastName') ?? ''),
    gender,
    householdId: hid != null && hid !== '' ? String(hid) : undefined,
    timeZoneId: tz != null && String(tz) !== '' ? String(tz) : null,
    isCoupleGuest: guest === true,
    coupleJoinDataMigrated:
      migrated === null || migrated === undefined
        ? null
        : migrated === true
          ? true
          : false
  }
}
