import api from './client'
import type {
  CreateSavingsObjectiveRequest,
  SavingsObjectivesOverview,
  UpdateSavingsObjectiveRequest,
} from '@/types/objective'

export const objectivesApi = {
  getOverview: () =>
    api.get<SavingsObjectivesOverview>('/api/objectives'),

  create: (data: CreateSavingsObjectiveRequest) =>
    api.post<SavingsObjectivesOverview>('/api/objectives', data),

  update: (id: string, data: UpdateSavingsObjectiveRequest) =>
    api.put<SavingsObjectivesOverview>(`/api/objectives/${id}`, data),

  finalize: (id: string) =>
    api.post<SavingsObjectivesOverview>(`/api/objectives/${id}/finalize`),
}
