<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Preset inicial: 'month' | '30d' | '3m' | 'year' | 'all'. */
    initialPreset?: string
    /** Alinha o painel à direita do botão (para botões encostados à direita). */
    align?: 'left' | 'right'
  }>(),
  { initialPreset: 'year', align: 'left' },
)

const emit = defineEmits<{
  /** from/to em yyyy-MM-dd (locais). Em 'all' ambos vêm vazios (sem limites). */
  change: [{ from: string; to: string; preset: string }]
}>()

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const PRESET_LABELS: Record<string, string> = { month: 'Este mês', '30d': 'Últimos 30 dias', '3m': '3 meses', year: 'Este ano', all: 'Desde sempre' }

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const activePreset = ref<string>('')
const filterFrom = ref('')
const filterTo = ref('')
const selectStep = ref<'from' | 'to'>('from')

const now = new Date()
const leftYear = ref(now.getFullYear())
const leftMonth = ref(now.getMonth())
const rightYear = computed(() => (leftMonth.value === 11 ? leftYear.value + 1 : leftYear.value))
const rightMonth = computed(() => (leftMonth.value === 11 ? 0 : leftMonth.value + 1))

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function toDateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function calendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay()
  const startOffset = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells
}

const leftDays = computed(() => calendarDays(leftYear.value, leftMonth.value))
const rightDays = computed(() => calendarDays(rightYear.value, rightMonth.value))

function isInRange(y: number, m: number, d: number): boolean {
  if (!filterFrom.value || !filterTo.value) return false
  const ds = toDateStr(y, m, d)
  return ds >= filterFrom.value && ds <= filterTo.value
}
function isStart(y: number, m: number, d: number): boolean { return toDateStr(y, m, d) === filterFrom.value }
function isEnd(y: number, m: number, d: number): boolean { return toDateStr(y, m, d) === filterTo.value }

function prevMonth() {
  if (leftMonth.value === 0) { leftMonth.value = 11; leftYear.value-- }
  else leftMonth.value--
}
function nextMonth() {
  if (leftMonth.value === 11) { leftMonth.value = 0; leftYear.value++ }
  else leftMonth.value++
}

function emitChange() {
  emit('change', { from: filterFrom.value, to: filterTo.value, preset: activePreset.value })
}

function pickDay(y: number, m: number, d: number) {
  const ds = toDateStr(y, m, d)
  activePreset.value = ''
  if (selectStep.value === 'from') {
    filterFrom.value = ds
    filterTo.value = ''
    selectStep.value = 'to'
  } else {
    if (ds < filterFrom.value) {
      filterFrom.value = ds
      filterTo.value = ''
      selectStep.value = 'to'
    } else {
      filterTo.value = ds
      selectStep.value = 'from'
      open.value = false
      emitChange()
    }
  }
}

function applyPreset(preset: string) {
  const today = new Date()
  activePreset.value = preset
  filterTo.value = localDateStr(today)
  if (preset === 'month') {
    filterFrom.value = localDateStr(new Date(today.getFullYear(), today.getMonth(), 1))
  } else if (preset === '30d') {
    const d = new Date(); d.setDate(d.getDate() - 30); filterFrom.value = localDateStr(d)
  } else if (preset === '3m') {
    const d = new Date(); d.setMonth(d.getMonth() - 3); filterFrom.value = localDateStr(d)
  } else if (preset === 'year') {
    filterFrom.value = localDateStr(new Date(today.getFullYear(), 0, 1))
  } else if (preset === 'all') {
    filterFrom.value = ''
    filterTo.value = ''
  }
  open.value = false
  emitChange()
}

const label = computed(() => {
  if (activePreset.value && PRESET_LABELS[activePreset.value]) return PRESET_LABELS[activePreset.value]
  if (!filterFrom.value && !filterTo.value) return 'Selecionar período'
  const fmt = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
  if (filterFrom.value && filterTo.value) return `${fmt(filterFrom.value)} – ${fmt(filterTo.value)}`
  if (filterFrom.value) return `${fmt(filterFrom.value)} – ...`
  return 'Selecionar período'
})

function toggle() {
  open.value = !open.value
  if (open.value) {
    if (filterFrom.value) {
      const d = new Date(filterFrom.value + 'T00:00:00')
      leftYear.value = d.getFullYear()
      leftMonth.value = d.getMonth()
    }
    selectStep.value = !filterTo.value ? 'to' : 'from'
  }
}

function onOutside(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false
}

onMounted(() => {
  document.addEventListener('click', onOutside, true)
  applyPreset(props.initialPreset)
})
onUnmounted(() => document.removeEventListener('click', onOutside, true))
</script>

<template>
  <div ref="root" class="date-range-picker">
    <button type="button" class="date-range-btn" @click.stop="toggle">
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
      <span>{{ label }}</span>
      <svg class="date-range-chevron" :class="{ open }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    <Transition name="panel">
      <div v-show="open" class="date-range-panel" :class="{ 'align-right': align === 'right' }" @click.stop>
        <div class="dr-presets">
          <button type="button" class="dr-preset-btn" :class="{ active: activePreset === 'month' }" @click="applyPreset('month')">Este mês</button>
          <button type="button" class="dr-preset-btn" :class="{ active: activePreset === '30d' }" @click="applyPreset('30d')">30 dias</button>
          <button type="button" class="dr-preset-btn" :class="{ active: activePreset === '3m' }" @click="applyPreset('3m')">3 meses</button>
          <button type="button" class="dr-preset-btn" :class="{ active: activePreset === 'year' }" @click="applyPreset('year')">Este ano</button>
          <button type="button" class="dr-preset-btn" :class="{ active: activePreset === 'all' }" @click="applyPreset('all')">Desde sempre</button>
        </div>
        <div class="date-range-calendars">
          <div class="dr-calendar">
            <div class="dr-cal-header">
              <button type="button" class="dr-cal-nav" @click="prevMonth">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <span class="dr-cal-title">{{ MONTH_NAMES[leftMonth] }} {{ leftYear }}</span>
              <span class="dr-cal-spacer"></span>
            </div>
            <div class="dr-cal-weekdays">
              <span v-for="wd in WEEKDAYS" :key="wd">{{ wd }}</span>
            </div>
            <div class="dr-cal-grid">
              <button
                v-for="(d, i) in leftDays"
                :key="'l' + i"
                type="button"
                class="dr-day"
                :class="{
                  empty: d === null,
                  'in-range': d !== null && isInRange(leftYear, leftMonth, d),
                  'is-start': d !== null && isStart(leftYear, leftMonth, d),
                  'is-end': d !== null && isEnd(leftYear, leftMonth, d),
                }"
                :disabled="d === null"
                @click="d !== null && pickDay(leftYear, leftMonth, d)"
              >
                {{ d ?? '' }}
              </button>
            </div>
          </div>
          <div class="dr-calendar">
            <div class="dr-cal-header">
              <span class="dr-cal-spacer"></span>
              <span class="dr-cal-title">{{ MONTH_NAMES[rightMonth] }} {{ rightYear }}</span>
              <button type="button" class="dr-cal-nav" @click="nextMonth">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
            <div class="dr-cal-weekdays">
              <span v-for="wd in WEEKDAYS" :key="wd">{{ wd }}</span>
            </div>
            <div class="dr-cal-grid">
              <button
                v-for="(d, i) in rightDays"
                :key="'r' + i"
                type="button"
                class="dr-day"
                :class="{
                  empty: d === null,
                  'in-range': d !== null && isInRange(rightYear, rightMonth, d),
                  'is-start': d !== null && isStart(rightYear, rightMonth, d),
                  'is-end': d !== null && isEnd(rightYear, rightMonth, d),
                }"
                :disabled="d === null"
                @click="d !== null && pickDay(rightYear, rightMonth, d)"
              >
                {{ d ?? '' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.date-range-picker {
  position: relative;
}

/* Botão de toolbar (mesma altura dos controlos de filtro) */
.date-range-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: var(--control-h);
  padding: 0 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-xs);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text);
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.date-range-btn:hover {
  background: var(--color-surface-muted);
}
.date-range-btn:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--focus-ring);
}
.date-range-btn svg:first-child {
  color: var(--color-text-muted);
  flex-shrink: 0;
}
.date-range-chevron {
  color: var(--color-text-muted);
  flex-shrink: 0;
  transition: transform var(--transition-fast);
}
.date-range-chevron.open {
  transform: rotate(180deg);
}

/* Painel */
.date-range-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 60;
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}
.date-range-panel.align-right {
  left: auto;
  right: 0;
}

.dr-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: var(--space-3);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border-subtle);
}
.dr-preset-btn {
  height: 28px;
  padding: 0 10px;
  font-family: inherit;
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: border-color var(--transition-fast), color var(--transition-fast), background var(--transition-fast);
}
.dr-preset-btn:hover {
  background: var(--color-surface-muted);
  color: var(--color-text-strong);
}
.dr-preset-btn.active {
  border-color: var(--color-border-strong);
  background: var(--color-selected);
  color: var(--color-selected-text);
}

.date-range-calendars {
  display: flex;
  gap: var(--space-5);
}
.dr-calendar {
  width: 240px;
}

.dr-cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}
.dr-cal-spacer {
  width: 32px;
}
.dr-cal-title {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
  text-align: center;
}
.dr-cal-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast), color var(--transition-fast);
}
.dr-cal-nav:hover {
  background: var(--color-surface-muted);
  color: var(--color-text-strong);
}

.dr-cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 4px;
}
.dr-cal-weekdays span {
  padding: 4px 0;
  text-align: center;
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.dr-cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  row-gap: 2px;
}
.dr-day {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  font-variant-numeric: tabular-nums;
  color: var(--color-text);
  cursor: pointer;
  border-radius: 0;
  transition: background var(--transition-fast);
}
.dr-day.empty {
  cursor: default;
}
.dr-day:not(.empty):not(.is-start):not(.is-end):hover {
  background: var(--color-surface-muted);
  border-radius: 6px;
}
.dr-day.in-range {
  background: var(--color-selected);
  color: var(--color-selected-text);
}
.dr-day.is-start,
.dr-day.is-end {
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-weight: var(--weight-bold);
}
.dr-day.is-start { border-radius: 6px 0 0 6px; }
.dr-day.is-end { border-radius: 0 6px 6px 0; }
.dr-day.is-start.is-end { border-radius: 6px; }

.panel-enter-active,
.panel-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 640px) {
  .date-range-calendars {
    flex-direction: column;
    gap: var(--space-3);
  }
  .dr-calendar {
    width: 220px;
  }
}
</style>
