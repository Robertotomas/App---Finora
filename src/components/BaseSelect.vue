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
  gap: 0.5rem;
  width: 100%;
  padding: 0.625rem 0.875rem;
  background: var(--color-input-bg, #fff);
  border: 1px solid var(--color-input-border, #e2e8f0);
  border-radius: 8px;
  font-size: 0.9375rem;
  font-family: inherit;
  color: var(--color-text, #0f172a);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.base-select.is-open .base-select-trigger {
  border-color: #166534;
  box-shadow: 0 0 0 2px rgba(22, 101, 52, 0.2);
}

html.dark .base-select.is-open .base-select-trigger {
  border-color: #4ade80;
  box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.2);
}

.base-select.is-error .base-select-trigger {
  border-color: #dc2626;
}

.base-select.is-disabled .base-select-trigger {
  opacity: 0.6;
  cursor: not-allowed;
}

.base-select-value {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.base-select-value.is-placeholder {
  color: var(--color-text-muted, #94a3b8);
}

.base-select-chevron {
  flex-shrink: 0;
  color: var(--color-text-muted, #64748b);
  transition: transform 0.18s ease;
}

.base-select.is-open .base-select-chevron {
  transform: rotate(180deg);
}

.base-select-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 20;
  margin: 0;
  padding: 4px;
  list-style: none;
  max-height: 240px;
  overflow-y: auto;
  background: var(--color-bg-card, #fff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 10px 30px -8px rgba(0, 0, 0, 0.25), 0 4px 12px -4px rgba(0, 0, 0, 0.12);
}

.base-select-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: var(--color-text, #334155);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.base-select-option:hover {
  background: var(--color-table-row-hover, #f1f5f9);
}

.base-select-option.is-selected {
  color: #166534;
  font-weight: 600;
}

html.dark .base-select-option.is-selected {
  color: #4ade80;
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
  transition: opacity 0.15s ease, transform 0.15s ease;
  transform-origin: top;
}

.select-pop-enter-from,
.select-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px) scaleY(0.96);
}
</style>
