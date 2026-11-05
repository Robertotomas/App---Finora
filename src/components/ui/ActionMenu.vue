<script setup lang="ts">
/**
 * Menu de ações "⋯" (editar / arquivar / eliminar…). Substitui pilhas de ícones sempre visíveis.
 * O menu é `position: fixed` para não ser cortado por contentores com overflow.
 */
import { nextTick, onBeforeUnmount, ref } from 'vue'

export interface ActionMenuItem {
  label: string
  danger?: boolean
  disabled?: boolean
  onSelect: () => void
}

defineProps<{ items: ActionMenuItem[]; ariaLabel?: string }>()

const open = ref(false)
const trigger = ref<HTMLButtonElement | null>(null)
const pos = ref({ top: 0, left: 0 })
const MENU_W = 180

function place() {
  const r = trigger.value?.getBoundingClientRect()
  if (!r) return
  const left = Math.min(Math.max(8, r.right - MENU_W), window.innerWidth - MENU_W - 8)
  pos.value = { top: r.bottom + 4, left }
}

async function toggle() {
  open.value = !open.value
  if (open.value) {
    place()
    await nextTick()
    document.addEventListener('click', onOutside, true)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
  } else close()
}
function close() {
  open.value = false
  document.removeEventListener('click', onOutside, true)
  window.removeEventListener('scroll', close, true)
  window.removeEventListener('resize', close)
}
function onOutside(e: MouseEvent) {
  if (trigger.value?.contains(e.target as Node)) return
  if ((e.target as HTMLElement)?.closest?.('.action-menu')) return
  close()
}
function select(item: ActionMenuItem) {
  if (item.disabled) return
  close()
  item.onSelect()
}
onBeforeUnmount(close)
</script>

<template>
  <button
    ref="trigger"
    type="button"
    class="action-trigger"
    :class="{ open }"
    :aria-label="ariaLabel ?? 'Mais ações'"
    aria-haspopup="menu"
    :aria-expanded="open"
    @click.stop="toggle"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
  </button>
  <Teleport to="body">
    <Transition name="action-menu">
      <div
        v-if="open"
        class="action-menu"
        role="menu"
        :style="{ top: pos.top + 'px', left: pos.left + 'px', width: MENU_W + 'px' }"
      >
        <button
          v-for="item in items"
          :key="item.label"
          type="button"
          role="menuitem"
          class="action-menu-item"
          :class="{ danger: item.danger }"
          :disabled="item.disabled"
          @click="select(item)"
        >
          {{ item.label }}
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.action-trigger {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: transparent;
  color: var(--color-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.action-trigger:hover,
.action-trigger.open {
  background: var(--color-surface-muted);
  color: var(--color-text-strong);
}
.action-trigger:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.action-menu {
  position: fixed;
  z-index: var(--z-menu);
  padding: 4px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}
.action-menu-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  cursor: pointer;
}
.action-menu-item:hover:not(:disabled) {
  background: var(--color-surface-muted);
}
.action-menu-item.danger {
  color: var(--color-danger);
}
.action-menu-item.danger:hover:not(:disabled) {
  background: var(--color-danger-soft);
}
.action-menu-item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.action-menu-enter-active,
.action-menu-leave-active {
  transition: opacity 120ms ease, transform 120ms ease;
}
.action-menu-enter-from,
.action-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
