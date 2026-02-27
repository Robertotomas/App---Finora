export enum HouseholdType {
  Individual = 0,
  Couple = 1
}

export interface Household {
  id: string
  type: HouseholdType
  name: string
}

export interface UpdateHouseholdRequest {
  type: HouseholdType
  name: string
}
