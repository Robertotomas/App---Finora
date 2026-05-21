import { ref } from 'vue'
import { defineStore } from 'pinia'
import { notificationsApi } from '@/api/notifications'
import type { Notification } from '@/types/notification'

export const useNotificationStore = defineStore('notifications', () => {
  const notifications = ref<Notification[]>([])
  const unreadCount = ref(0)
  const loading = ref(false)
  let pollInterval: ReturnType<typeof setInterval> | null = null

  async function fetchUnreadCount() {
    try {
      const { data } = await notificationsApi.unreadCount()
      unreadCount.value = data.count
    } catch {
      // silent
    }
  }

  async function fetchNotifications(limit = 20, offset = 0) {
    loading.value = true
    try {
      const { data } = await notificationsApi.list(limit, offset)
      if (offset === 0) {
        notifications.value = data
      } else {
        notifications.value = [...notifications.value, ...data]
      }
    } catch {
      // silent
    } finally {
      loading.value = false
    }
  }

  async function markAsRead(id: string) {
    try {
      await notificationsApi.markAsRead(id)
      const idx = notifications.value.findIndex(x => x.id === id)
      if (idx !== -1) {
        const wasUnread = !notifications.value[idx].isRead
        notifications.value.splice(idx, 1)
        if (wasUnread) unreadCount.value = Math.max(0, unreadCount.value - 1)
      }
    } catch {
      // silent
    }
  }

  async function markBatchAsRead(ids: string[]) {
    if (ids.length === 0) return
    try {
      await notificationsApi.markBatchAsRead(ids)
      const unreadRemoved = notifications.value.filter(n => ids.includes(n.id) && !n.isRead).length
      notifications.value = notifications.value.filter(n => !ids.includes(n.id))
      unreadCount.value = Math.max(0, unreadCount.value - unreadRemoved)
    } catch {
      // silent
    }
  }

  async function markAllAsRead() {
    try {
      await notificationsApi.markAllAsRead()
      notifications.value = []
      unreadCount.value = 0
    } catch {
      // silent
    }
  }

  function startPolling() {
    stopPolling()
    fetchUnreadCount()
    pollInterval = setInterval(fetchUnreadCount, 3 * 60 * 1000)
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  }

  return {
    notifications,
    unreadCount,
    loading,
    fetchUnreadCount,
    fetchNotifications,
    markAsRead,
    markBatchAsRead,
    markAllAsRead,
    startPolling,
    stopPolling,
  }
})
