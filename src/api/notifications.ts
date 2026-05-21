import api from './client'
import type { Notification } from '@/types/notification'

export const notificationsApi = {
  list: (limit = 20, offset = 0) =>
    api.get<Notification[]>('/api/notifications', { params: { limit, offset } }),

  unreadCount: () =>
    api.get<{ count: number }>('/api/notifications/unread-count'),

  markAsRead: (id: string) =>
    api.patch(`/api/notifications/${id}/read`),

  markBatchAsRead: (ids: string[]) =>
    api.post('/api/notifications/mark-batch-read', { ids }),

  markAllAsRead: () =>
    api.post('/api/notifications/mark-all-read'),
}
