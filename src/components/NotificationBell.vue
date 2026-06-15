<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationStore } from '@/stores/notifications'

const router = useRouter()
const store = useNotificationStore()
const open = ref(false)
const selectedIds = ref<Set<string>>(new Set())

const hasSelection = computed(() => selectedIds.value.size > 0)
const selectionCount = computed(() => selectedIds.value.size)

function toggle() {
  open.value = !open.value
  if (open.value && store.notifications.length === 0) {
    store.fetchNotifications()
  }
  if (!open.value) {
    selectedIds.value = new Set()
  }
}

function toggleSelect(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selectedIds.value = next
}

function handleClick(n: { id: string; isRead: boolean; redirectUrl?: string | null }) {
  if (!n.isRead) store.markAsRead(n.id)
  if (n.redirectUrl) router.push(n.redirectUrl)
  open.value = false
  selectedIds.value = new Set()
}

async function markSelectedRead() {
  if (!hasSelection.value) return
  await store.markBatchAsRead([...selectedIds.value])
  selectedIds.value = new Set()
}

function markAllRead() {
  store.markAllAsRead()
  selectedIds.value = new Set()
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  return `${Math.floor(days / 30)}m`
}

function onClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (open.value && !target.closest('.notification-menu')) {
    open.value = false
    selectedIds.value = new Set()
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside, true)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside, true)
})
</script>

<template>
  <div class="notification-menu">
    <button type="button" class="notification-btn" title="Notificações" @click.stop="toggle">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
      <span v-if="store.unreadCount > 0" class="notification-badge">{{ store.unreadCount > 9 ? '9+' : store.unreadCount }}</span>
    </button>
    <Transition name="dropdown">
      <div v-show="open" class="notification-dropdown">
        <div class="notification-header">
          <span class="notification-title">Notificações</span>
          <div class="notification-header-actions">
            <button
              v-if="hasSelection"
              type="button"
              class="notification-mark-all"
              @click="markSelectedRead"
            >
              Marcar {{ selectionCount }} como {{ selectionCount === 1 ? 'lida' : 'lidas' }}
            </button>
            <button
              v-else-if="store.unreadCount > 0"
              type="button"
              class="notification-mark-all"
              @click="markAllRead"
            >
              Marcar todas como lidas
            </button>
          </div>
        </div>
        <div v-if="store.loading && store.notifications.length === 0" class="notification-empty">
          A carregar...
        </div>
        <div v-else-if="store.notifications.length === 0" class="notification-empty">
          Sem notificações
        </div>
        <div v-else class="notification-list">
          <div
            v-for="n in store.notifications"
            :key="n.id"
            class="notification-item"
            :class="{ 'notification-item--unread': !n.isRead, 'notification-item--selected': selectedIds.has(n.id) }"
          >
            <label
              class="notification-checkbox-wrap"
              @click.stop
            >
              <input
                type="checkbox"
                class="notification-checkbox"
                :checked="selectedIds.has(n.id)"
                @change="toggleSelect(n.id)"
              />
            </label>
            <button
              type="button"
              class="notification-item-btn"
              @click="handleClick(n)"
            >
              <div class="notification-item-content">
                <p class="notification-item-msg">{{ n.message }}</p>
                <span class="notification-item-time">{{ timeAgo(n.createdAt) }}</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.notification-menu {
  position: relative;
}

.notification-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}

.notification-btn:hover {
  color: var(--color-text);
  background: var(--color-table-row-hover);
}

.notification-badge {
  position: absolute;
  top: -2px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 0.6rem;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
  color: #fff;
  background: #dc2626;
  border-radius: 8px;
}

.notification-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 320px;
  max-height: 400px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 200;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.notification-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
}

.notification-title {
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-text);
}

.notification-header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.notification-mark-all {
  font-size: 0.7rem;
  font-weight: 500;
  color: #166534;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  padding: 0;
}

.notification-mark-all:hover {
  text-decoration: underline;
}

.notification-empty {
  padding: 2rem 1rem;
  text-align: center;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.notification-list {
  overflow-y: auto;
  max-height: 340px;
  scrollbar-width: none;
}

.notification-list::-webkit-scrollbar {
  display: none;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  width: 100%;
  padding: 0.625rem 1rem;
  border-bottom: 1px solid var(--color-border);
  transition: background 0.12s;
}

.notification-item:last-child {
  border-bottom: none;
}

.notification-item:hover {
  background: var(--color-table-row-hover);
}

.notification-item--unread {
  background: rgba(22, 101, 52, 0.04);
}

html.dark .notification-item--unread {
  background: rgba(22, 163, 74, 0.08);
}

.notification-item--selected {
  background: rgba(22, 101, 52, 0.08);
}

html.dark .notification-item--selected {
  background: rgba(22, 163, 74, 0.12);
}

.notification-checkbox-wrap {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-top: 2px;
  cursor: pointer;
}

.notification-checkbox {
  width: 14px;
  height: 14px;
  cursor: pointer;
  accent-color: #166534;
}

.notification-item-btn {
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  padding: 0;
}

.notification-item-content {
  flex: 1;
  min-width: 0;
}

.notification-item-msg {
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.4;
  color: var(--color-text);
}

.notification-item-time {
  font-size: 0.675rem;
  color: var(--color-text-muted);
}
</style>
