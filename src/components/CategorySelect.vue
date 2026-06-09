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
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
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

.cat-select.is-open .cat-select-trigger {
  border-color: #166534;
  box-shadow: 0 0 0 2px rgba(22, 101, 52, 0.2);
}

html.dark .cat-select.is-open .cat-select-trigger {
  border-color: #4ade80;
  box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.2);
}

.cat-select.is-error .cat-select-trigger {
  border-color: #dc2626;
}

.cat-select.is-disabled .cat-select-trigger {
  opacity: 0.6;
  cursor: not-allowed;
}

.cat-select-value {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.cat-select-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cat-select-label.is-placeholder {
  color: var(--color-text-muted, #94a3b8);
}

.cat-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 8px;
}

.cat-select-chevron {
  flex-shrink: 0;
  color: var(--color-text-muted, #64748b);
  transition: transform 0.18s ease;
}

.cat-select.is-open .cat-select-chevron {
  transform: rotate(180deg);
}

.cat-select-menu {
  position: absolute;
  z-index: 20;
  padding: 4px;
  overflow-y: auto;
  background: var(--color-bg-card, #fff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 10px 30px -8px rgba(0, 0, 0, 0.25), 0 4px 12px -4px rgba(0, 0, 0, 0.12);
}

.cat-group-label {
  padding: 0.5rem 0.75rem 0.25rem;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted, #94a3b8);
}

.cat-option {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.4rem 0.75rem;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 0.875rem;
  color: var(--color-text, #334155);
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;
}

.cat-option:hover {
  background: var(--color-table-row-hover, #f1f5f9);
}

.cat-option.is-selected {
  font-weight: 600;
}

.cat-option-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cat-check {
  flex-shrink: 0;
  color: #166534;
}

html.dark .cat-check {
  color: #4ade80;
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
