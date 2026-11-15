<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { TRANSACTION_CATEGORY_LABELS, type TransactionCategory } from '@/types/transaction'
import { CATEGORY_GROUPS, categoryIcon, categoryColor } from '@/types/categoryMeta'

const props = defineProps<{
  modelValue: number
  /** Filtra os grupos: receita mostra só Rendimentos; despesa mostra os restantes. */
  type: 'income' | 'expense'
  error?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const menuStyle = ref<Record<string, string>>({})

const groups = computed(() =>
  CATEGORY_GROUPS.filter((g) => g.type === props.type || g.type === 'both')
)

const selectedLabel = computed(
  () => TRANSACTION_CATEGORY_LABELS[props.modelValue as TransactionCategory] ?? ''
)
const selectedIcon = computed(() => categoryIcon(props.modelValue))
const selectedColor = computed(() => categoryColor(props.modelValue))

/** Posiciona o menu com position:fixed (não cortado por modais com scroll); abre para cima se preciso. */
function updatePosition() {
  const trigger = root.value?.querySelector('.cat-select-trigger') as HTMLElement | undefined
  if (!trigger) return
  const r = trigger.getBoundingClientRect()
  const spaceBelow = window.innerHeight - r.bottom
  const spaceAbove = r.top
  const desired = 320
  const openUp = spaceBelow < desired && spaceAbove > spaceBelow
  const base: Record<string, string> = {
    position: 'fixed',
    left: `${r.left}px`,
    width: `${r.width}px`,
    right: 'auto',
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

function select(value: number) {
  emit('update:modelValue', value)
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
  <div ref="root" class="cat-select" :class="{ 'is-open': open, 'is-error': error, 'is-disabled': disabled }">
    <button type="button" class="cat-select-trigger" :disabled="disabled" @click.stop="toggle">
      <span class="cat-select-value">
        <span
          v-if="selectedLabel"
          class="cat-icon"
          :style="{ background: selectedColor + '1f', color: selectedColor }"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="selectedIcon"></svg>
        </span>
        <span class="cat-select-label" :class="{ 'is-placeholder': !selectedLabel }">
          {{ selectedLabel || 'Selecionar categoria' }}
        </span>
      </span>
      <svg class="cat-select-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    <Transition name="select-pop">
      <div v-show="open" class="cat-select-menu" role="listbox" :style="menuStyle">
        <template v-for="group in groups" :key="group.key">
          <div class="cat-group-label">{{ group.label }}</div>
          <button
            v-for="cat in group.categories"
            :key="cat"
            type="button"
            class="cat-option"
            :class="{ 'is-selected': cat === modelValue }"
            role="option"
            :aria-selected="cat === modelValue"
            @click="select(cat)"
          >
            <span class="cat-icon" :style="{ background: categoryColor(cat) + '1f', color: categoryColor(cat) }">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="categoryIcon(cat)"></svg>
            </span>
            <span class="cat-option-label">{{ TRANSACTION_CATEGORY_LABELS[cat] }}</span>
            <svg v-if="cat === modelValue" class="cat-check" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
        </template>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.cat-select {
  position: relative;
  width: 100%;
}

.cat-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
  height: 40px;
  padding: 0 10px 0 6px;
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
.cat-select-trigger:hover:not(:disabled) {
  border-color: var(--color-text-subtle);
}
.cat-select-trigger:focus-visible,
.cat-select.is-open .cat-select-trigger {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--focus-ring);
}
.cat-select.is-error .cat-select-trigger {
  border-color: var(--color-danger);
}
.cat-select.is-disabled .cat-select-trigger {
  background: var(--color-surface-2);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.cat-select-value {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}
.cat-select-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cat-select-label.is-placeholder {
  padding-left: 6px;
  color: var(--color-text-subtle);
}

.cat-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border-radius: 6px;
}

.cat-select-chevron {
  flex-shrink: 0;
  color: var(--color-text-muted);
  transition: transform var(--transition-fast);
}
.cat-select.is-open .cat-select-chevron {
  transform: rotate(180deg);
}

.cat-select-menu {
  position: absolute;
  z-index: var(--z-popover);
  padding: 4px;
  overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}

.cat-group-label {
  padding: 10px 10px 4px;
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-caps);
  color: var(--color-text-muted);
}
.cat-group-label:first-child {
  padding-top: 6px;
}

.cat-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 34px;
  padding: 3px 10px 3px 4px;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: var(--text-base);
  color: var(--color-text);
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.cat-option:hover {
  background: var(--color-surface-muted);
}
.cat-option:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.cat-option.is-selected {
  background: var(--color-selected);
  color: var(--color-selected-text);
  font-weight: var(--weight-semibold);
}

.cat-option-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cat-check {
  flex-shrink: 0;
  color: var(--color-primary-text);
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
