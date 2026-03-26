export interface SavingsObjectiveActive {
  id: string
  name: string
  targetAmount: number
  sortOrder: number
  allocatedAmount: number
  progressPercent: number
  canFinalize: boolean
}

export interface SavingsObjectiveHistory {
  id: string
  name: string
  targetAmount: number
  sortOrder: number
  completedAt: string
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
}

export interface UpdateSavingsObjectiveRequest {
  name: string
  targetAmount: number
}
