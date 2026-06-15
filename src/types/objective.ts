export interface SavingsObjectiveActive {
  id: string
  name: string
  targetAmount: number
  /** ISO date yyyy-MM-dd */
  targetDate: string | null
  sortOrder: number
  allocatedAmount: number
  progressPercent: number
  canFinalize: boolean
}

export interface SavingsObjectiveHistory {
  id: string
  name: string
  targetAmount: number
  targetDate: string | null
  sortOrder: number
  completedAt: string
  /** ISO datetime; null se ainda não foi liquidado */
  liquidatedAt: string | null
}

export interface SavingsObjectivesOverview {
  totalSavings: number
  reservedByCompletedObjectives: number
  availableForActiveObjectives: number
  activeObjectives: SavingsObjectiveActive[]
  historyObjectives: SavingsObjectiveHistory[]
}

export interface CreateSavingsObjectiveRequest {
  name: string
  targetAmount: number
  targetDate?: string | null
}

export interface UpdateSavingsObjectiveRequest {
  name: string
  targetAmount: number
  targetDate?: string | null
}
