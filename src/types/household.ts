export enum HouseholdType {
  Individual = 0,
  Couple = 1
}

export interface Household {
  id: string
  type: HouseholdType
  name: string
  primaryAccountId?: string | null
  /** Set when the other member left a Couple household; remaining user may dismiss or reset data. */
  partnerLeftNoticeAtUtc?: string | null
}

export interface SetPrimaryAccountRequest {
  accountId: string
}

export interface HouseholdMember {
  id: string
  firstName: string
  lastName: string
  email: string
}

export interface UpdateHouseholdRequest {
  type: HouseholdType
  name: string
}
