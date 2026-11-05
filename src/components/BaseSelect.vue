<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

interface SelectOption {
  value: string | number
  label: string
}

const props = defineProps<{
  modelValue: string | number
  options: SelectOption[]
  placeholder?: string
  error?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const menuStyle = ref<Record<string, string>>({})

const selectedLabel = computed(() => {
  const found = props.options.find((o) => o.value === props.modelValue)
  return found ? found.label : ''
})

/** Posiciona o menu com position:fixed para não ser cortado por modais com scroll;
    abre para cima se não houver espaço em baixo. */
function updatePosition() {
  const trigger = root.value?.querySelector('.base-select-trigger') as HTMLElement | undefined
  if (!trigger) return
  const r = trigger.getBoundingClientRect()
  const spaceBelow = window.innerHeight - r.bottom
  const spaceAbove = r.top
  const desired = 248
  const openUp = spaceBelow < desired && spaceAbove > spaceBelow
  const base: Record<string, string> = {
    position: 'fixed',
    left: `${r.left}px`,
    width: `${r.width}px`,
    right: 'auto'
  }
  menuStyle.value = openUp
    ? { ...base, bottom: `${window.innerHeight - r.top + 4}px`, top: 'auto', maxHeight: `${Math.min(desired, spaceAbove - 8)}px` }
    : { ...base, top: `${r.bottom + 4}px`, maxHeight: `${Math.min(desired, spaceBelow - 8)}px` }
}

async function openMenu() {
  open.value = true
  await nextTick()
  updatePosition()
  window.addEventListener('scroll', updatePosition, true)
  window.addEventListener('resize', updatePosition)
}

function closeMenu() {
  open.value = false
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
}

function toggle() {
  if (props.disabled) return
  if (open.value) closeMenu()
  else openMenu()
}

function select(opt: SelectOption) {
  emit('update:modelValue', opt.value)
  closeMenu()
}

function onClickOutside(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) {
    closeMenu()
  }
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
})
</script>

<template>
  <div ref="root" class="base-select" :class="{ 'is-open': open, 'is-error': error, 'is-disabled': disabled }">
    <button type="button" class="base-select-trigger" :disabled="disabled" @click.stop="toggle">
      <span class="base-select-value" :class="{ 'is-placeholder': !selectedLabel }">
        {{ selectedLabel || placeholder || 'Selecionar' }}
      </span>
      <svg class="base-select-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    <Transition name="select-pop">
      <ul v-show="open" class="base-select-menu" role="listbox" :style="menuStyle">
        <li
          v-for="opt in options"
          :key="String(opt.value)"
          class="base-select-option"
          :class="{ 'is-selected': opt.value === modelValue }"
          role="option"
          :aria-selected="opt.value === modelValue"
          @click="select(opt)"
        >
          <span class="base-select-option-label">{{ opt.label }}</span>
          <svg v-if="opt.value === modelValue" class="base-select-check" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.base-select {
  position: relative;
  width: 100%;
}

.base-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
  height: 40px;
  padding: 0 10px 0 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: var(--text-base);
  color: var(--color-text-strong);
  cursor: pointer;
  text-align: left;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.base-select-trigger:hover:not(:disabled) {
  border-color: var(--color-text-subtle);
}
.base-select-trigger:focus-visible,
.base-select.is-open .base-select-trigger {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--focus-ring);
}
.base-select.is-error .base-select-trigger {
  border-color: var(--color-danger);
}
.base-select.is-disabled .base-select-trigger {
  background: var(--color-surface-2);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.base-select-value {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.base-select-value.is-placeholder {
  color: var(--color-text-subtle);
}

.base-select-chevron {
  flex-shrink: 0;
  color: var(--color-text-muted);
  transition: transform var(--transition-fast);
}
.base-select.is-open .base-select-chevron {
  transform: rotate(180deg);
}

.base-select-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: var(--z-popover);
  margin: 0;
  padding: 4px;
  list-style: none;
  max-height: 240px;
  overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}

.base-select-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-height: 34px;
  padding: 0 10px;
  font-size: var(--text-base);
  color: var(--color-text);
  border-radius: 6px;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.base-select-option:hover {
  background: var(--color-surface-muted);
}
.base-select-option.is-selected {
  background: var(--color-selected);
  color: var(--color-selected-text);
  font-weight: var(--weight-semibold);
}

.base-select-option-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.base-select-check {
  flex-shrink: 0;
}

.select-pop-enter-active,
.select-pop-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.select-pop-enter-from,
.select-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
