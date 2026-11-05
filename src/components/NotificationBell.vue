<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useNotificationStore } from '@/stores/notifications'
import ShellIcon from '@/components/shell/ShellIcon.vue'

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

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) {
    open.value = false
    selectedIds.value = new Set()
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside, true)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside, true)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="notification-menu">
    <button
      type="button"
      class="shell-icon-btn"
      :class="{ 'is-open': open }"
      :aria-label="store.unreadCount > 0 ? `Notificações (${store.unreadCount} por ler)` : 'Notificações'"
      title="Notificações"
      :aria-expanded="open"
      @click.stop="toggle"
    >
      <ShellIcon name="bell" :size="18" />
      <span v-if="store.unreadCount > 0" class="notification-badge">{{ store.unreadCount > 9 ? '9+' : store.unreadCount }}</span>
    </button>
    <Transition name="dropdown">
      <div v-show="open" class="shell-menu notification-dropdown">
        <div class="notification-header">
          <span class="notification-title">Notificações</span>
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

        <div v-if="store.loading && store.notifications.length === 0" class="notification-empty">
          <span class="notification-spinner" aria-hidden="true" />
          A carregar…
        </div>
        <div v-else-if="store.notifications.length === 0" class="notification-empty">
          <span class="notification-empty-icon"><ShellIcon name="bell" :size="20" /></span>
          <span class="notification-empty-title">Está tudo em dia</span>
          <span>Não tem notificações por agora.</span>
        </div>
        <div v-else class="notification-list">
          <div
            v-for="n in store.notifications"
            :key="n.id"
            class="notification-item"
            :class="{ 'notification-item--unread': !n.isRead, 'notification-item--selected': selectedIds.has(n.id) }"
          >
            <label class="notification-checkbox-wrap" @click.stop>
              <input
                type="checkbox"
                class="notification-checkbox"
                :checked="selectedIds.has(n.id)"
                aria-label="Selecionar notificação"
                @change="toggleSelect(n.id)"
              />
            </label>
            <button type="button" class="notification-item-btn" @click="handleClick(n)">
              <p class="notification-item-msg">{{ n.message }}</p>
              <span class="notification-item-time">{{ timeAgo(n.createdAt) }}</span>
            </button>
            <span v-if="!n.isRead" class="notification-dot" aria-label="Por ler" />
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

.notification-badge {
  position: absolute;
  top: 4px;
  right: 3px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: var(--radius-full);
  border: 2px solid var(--color-header-bg);
  box-sizing: content-box;
  background: var(--color-danger);
  color: #fff;
  font-size: 0.625rem;
  font-weight: var(--weight-bold);
  line-height: 16px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
  transform: translate(25%, -25%);
}

.notification-dropdown {
  width: 360px;
  max-height: min(480px, 75vh);
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}

.notification-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: 44px;
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--color-border-subtle);
  flex-shrink: 0;
}

.notification-title {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.notification-mark-all {
  padding: 4px 6px;
  margin-right: -6px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--color-primary-text);
  font-family: inherit;
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--transition-fast);
}

.notification-mark-all:hover {
  background: var(--color-selected);
}

.notification-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-8) var(--space-4);
  text-align: center;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.notification-empty-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin-bottom: var(--space-2);
  border-radius: var(--radius-full);
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
}

.notification-empty-title {
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.notification-spinner {
  width: 18px;
  height: 18px;
  margin-bottom: var(--space-2);
  border-radius: 50%;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary-text);
  animation: notification-spin 0.7s linear infinite;
}

@keyframes notification-spin {
  to {
    transform: rotate(360deg);
  }
}

.notification-list {
  overflow-y: auto;
  padding: 4px;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: 10px;
  border-radius: 6px;
  transition: background var(--transition-fast);
}

.notification-item:hover {
  background: var(--color-surface-hover);
}

.notification-item--selected,
.notification-item--selected:hover {
  background: var(--color-selected);
}

.notification-checkbox-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 20px;
  flex-shrink: 0;
  cursor: pointer;
}

.notification-checkbox {
  width: 14px;
  height: 14px;
  margin: 0;
  cursor: pointer;
  accent-color: var(--color-primary);
}

.notification-item-btn {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0;
  border: none;
  background: none;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.notification-item-btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
  border-radius: 4px;
}

.notification-item-msg {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.45;
  color: var(--color-text-secondary);
}

.notification-item--unread .notification-item-msg {
  color: var(--color-text-strong);
  font-weight: var(--weight-medium);
}

.notification-item-time {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.notification-dot {
  width: 8px;
  height: 8px;
  margin-top: 6px;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  background: var(--color-primary-text);
}

@media (max-width: 768px) {
  .notification-dropdown {
    position: fixed;
    top: calc(56px + 4px);
    left: var(--space-2);
    right: var(--space-2);
    width: auto;
  }
}
</style>
