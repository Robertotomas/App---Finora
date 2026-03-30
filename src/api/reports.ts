import api from './client'

export interface MonthlyReportListItem {
  id: string
  year: number
  month: number
  generatedAt: string
  fileSizeBytes: number | null
}

function normalizeListItem(raw: Record<string, unknown>): MonthlyReportListItem {
  return {
    id: String(raw.id ?? raw.Id ?? ''),
    year: Number(raw.year ?? raw.Year) || 0,
    month: Number(raw.month ?? raw.Month) || 0,
    generatedAt: String(raw.generatedAt ?? raw.GeneratedAt ?? ''),
    fileSizeBytes:
      raw.fileSizeBytes != null || raw.FileSizeBytes != null
        ? Number(raw.fileSizeBytes ?? raw.FileSizeBytes)
        : null,
  }
}

export const reportsApi = {
  list: async (params?: { year?: number; month?: number }) => {
    const { data } = await api.get<unknown[]>('/api/reports', { params })
    const arr = Array.isArray(data) ? data : []
    return arr.map((x) => normalizeListItem((x ?? {}) as Record<string, unknown>))
  },

  downloadBlob: async (id: string) => {
    const { data } = await api.get<Blob>(`/api/reports/${id}/download`, {
      responseType: 'blob',
    })
    return data
  },
}
