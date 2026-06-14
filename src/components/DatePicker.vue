<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import BaseSelect from './BaseSelect.vue'

const props = defineProps<{
  modelValue: string
  error?: boolean
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const MONTHS_ABBR = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.']
const WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

const today = new Date()
const viewYear = ref(today.getFullYear())
const viewMonth = ref(today.getMonth())

const monthOptions = MONTHS_ABBR.map((m, i) => ({ value: i, label: m }))
const yearOptions = (() => {
  const cy = today.getFullYear()
  const arr: { value: number; label: string }[] = []
  for (let y = cy + 5; y >= 1950; y--) arr.push({ value: y, label: String(y) })
  return arr
})()

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function toStr(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`
}
function localStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const displayLabel = computed(() => {
  if (!props.modelValue) return ''
  const d = new Date(props.modelValue + 'T00:00:00')
  if (isNaN(d.getTime())) return ''
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
})

function calendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay()
  const startOffset = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells
}

const days = computed(() => calendarDays(viewYear.value, viewMonth.value))

function isSelected(d: number): boolean {
  return toStr(viewYear.value, viewMonth.value, d) === props.modelValue
}
function isToday(d: number): boolean {
  return toStr(viewYear.value, viewMonth.value, d) === localStr(today)
}

function pick(d: number) {
  emit('update:modelValue', toStr(viewYear.value, viewMonth.value, d))
  close()
}

function prevMonth() {
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- }
  else viewMonth.value--
}
function nextMonth() {
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ }
  else viewMonth.value++
}

function updatePosition() {
  const trigger = root.value?.querySelector('.dp-trigger') as HTMLElement | undefined
  if (!trigger) return
  const r = trigger.getBoundingClientRect()
  const width = 330
  const desired = 340
  const spaceBelow = window.innerHeight - r.bottom
  const spaceAbove = r.top
  const openUp = spaceBelow < desired && spaceAbove > spaceBelow
  let left = r.left
  if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8
  if (left < 8) left = 8
  const base: Record<string, string> = { position: 'fixed', left: `${left}px`, width: `${width}px` }
  panelStyle.value = openUp
    ? { ...base, bottom: `${window.innerHeight - r.top + 6}px`, top: 'auto' }
    : { ...base, top: `${r.bottom + 6}px` }
}

async function openMenu() {
  if (props.disabled) return
  // Sincroniza a vista com o valor atual (ou hoje).
  const base = props.modelValue ? new Date(props.modelValue + 'T00:00:00') : today
  if (!isNaN(base.getTime())) {
    viewYear.value = base.getFullYear()
    viewMonth.value = base.getMonth()
  }
  open.value = true
  await nextTick()
  updatePosition()
  window.addEventListener('scroll', updatePosition, true)
  window.addEventListener('resize', updatePosition)
}

function close() {
  open.value = false
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
}

function toggle() {
  if (open.value) close()
  else openMenu()
}

function onClickOutside(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) close()
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
})
</script>

<template>
  <div ref="root" class="date-picker" :class="{ 'is-error': error, 'is-disabled': disabled }">
    <button type="button" class="dp-trigger" :disabled="disabled" @click.stop="toggle">
      <span class="dp-value" :class="{ 'is-placeholder': !displayLabel }">
        {{ displayLabel || placeholder || 'Selecione uma data' }}
      </span>
      <svg class="dp-cal-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
    </button>

    <Transition name="dp-pop">
      <div v-show="open" class="dp-panel" :style="panelStyle" @click.stop>
        <div class="dp-header">
          <button type="button" class="dp-nav" @click="prevMonth">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div class="dp-selects">
            <div class="dp-select dp-select--month">
              <BaseSelect
                :model-value="viewMonth"
                :options="monthOptions"
                @update:model-value="(v) => (viewMonth = Number(v))"
              />
            </div>
            <div class="dp-select dp-select--year">
              <BaseSelect
                :model-value="viewYear"
                :options="yearOptions"
                @update:model-value="(v) => (viewYear = Number(v))"
              />
            </div>
          </div>
          <button type="button" class="dp-nav" @click="nextMonth">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>

        <div class="dp-weekdays">
          <span v-for="wd in WEEKDAYS" :key="wd">{{ wd }}</span>
        </div>
        <div class="dp-grid">
          <button
            v-for="(d, i) in days"
            :key="i"
            type="button"
            class="dp-day"
            :class="{ empty: d === null, selected: d !== null && isSelected(d), today: d !== null && isToday(d) }"
            :disabled="d === null"
            @click="d !== null && pick(d)"
          >
            {{ d ?? '' }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.date-picker {
  position: relative;
  width: 100%;
}

.dp-trigger {
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

.date-picker.is-error .dp-trigger {
  border-color: #dc2626;
}

.date-picker.is-disabled .dp-trigger {
  opacity: 0.6;
  cursor: not-allowed;
}

.dp-value.is-placeholder {
  color: var(--color-text-muted, #94a3b8);
}

.dp-cal-icon {
  flex-shrink: 0;
  color: var(--color-text-muted, #64748b);
}

.dp-panel {
  z-index: 70;
  padding: 0.75rem;
  background: var(--color-bg-card, #fff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 12px 40px -8px rgba(15, 23, 42, 0.22);
}

.dp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.375rem;
  margin-bottom: 0.625rem;
}

.dp-selects {
  display: flex;
  gap: 0.375rem;
  flex: 1;
}

.dp-select--month {
  flex: 1;
}

.dp-select--year {
  width: 96px;
  flex-shrink: 0;
}

/* Dropdowns de mês/ano mais compactos para o ano caber sem reticências. */
.dp-select :deep(.base-select-trigger) {
  padding: 0.5rem 0.625rem;
  gap: 0.25rem;
  font-size: 0.875rem;
}

.dp-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s, color 0.15s;
}

.dp-nav:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--color-text);
}

html.dark .dp-nav:hover {
  background: rgba(255, 255, 255, 0.08);
}

.dp-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 0.25rem;
}

.dp-weekdays span {
  text-align: center;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text-muted);
  padding: 0.25rem 0;
}

.dp-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.dp-day {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text);
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.12s, color 0.12s;
}

.dp-day.empty {
  cursor: default;
}

.dp-day:not(.empty):hover {
  background: rgba(22, 101, 52, 0.1);
}

.dp-day.today:not(.selected) {
  color: #166534;
  font-weight: 700;
}

html.dark .dp-day.today:not(.selected) {
  color: #4ade80;
}

.dp-day.selected {
  background: #166534;
  color: #fff;
  font-weight: 700;
}

html.dark .dp-day.selected {
  background: #4ade80;
  color: #0a0a0a;
}

.dp-pop-enter-active,
.dp-pop-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
  transform-origin: top;
}

.dp-pop-enter-from,
.dp-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px) scaleY(0.97);
}
</style>
