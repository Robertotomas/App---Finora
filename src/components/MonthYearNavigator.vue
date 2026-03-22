<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Anos disponíveis (pode incluir `0` = “todos os períodos”) */
    years: number[]
    /** Índice 1 = Janeiro … 12 = Dezembro */
    monthNames?: string[]
    allowAllMonths?: boolean
    allowAllYears?: boolean
    /** Rótulo quando month=0 e year>0 (ex.: "Ano completo" ou "Todos os meses") */
    allMonthsInYearTitle?: string
    /** Texto do botão no painel para month=0 */
    allMonthsInYearButton?: string
  }>(),
  {
    allMonthsInYearTitle: 'Ano completo',
    allMonthsInYearButton: 'Ano completo (todos os meses)',
    monthNames: () => [
      '',
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ],
    allowAllMonths: false,
    allowAllYears: false,
  }
)

const month = defineModel<number>('month', { required: true })
const year = defineModel<number>('year', { required: true })

const emit = defineEmits<{ change: [] }>()

const panelOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const yearsPositive = computed(() => [...new Set(props.years.filter((y) => y > 0))].sort((a, b) => a - b))
const minYear = computed(() => (yearsPositive.value.length ? Math.min(...yearsPositive.value) : new Date().getFullYear()))
const maxYear = computed(() => (yearsPositive.value.length ? Math.max(...yearsPositive.value) : new Date().getFullYear()))
const hasYearZero = computed(() => props.years.includes(0))

function closePanel() {
  panelOpen.value = false
}

function togglePanel() {
  panelOpen.value = !panelOpen.value
}

function onDocClick(e: MouseEvent) {
  if (!panelOpen.value || !rootRef.value) return
  if (!rootRef.value.contains(e.target as Node)) closePanel()
}

onMounted(() => document.addEventListener('click', onDocClick, true))
onUnmounted(() => document.removeEventListener('click', onDocClick, true))

const displayLabel = computed(() => {
  if (year.value === 0) return 'Todos os períodos'
  if (month.value === 0) return `${props.allMonthsInYearTitle} · ${year.value}`
  return `${props.monthNames[month.value]} ${year.value}`
})

const canPrev = computed(() => {
  if (year.value === 0) return false
  if (month.value === 0) {
    return year.value > minYear.value
  }
  if (year.value < minYear.value) return false
  if (year.value === minYear.value && month.value <= 1) return false
  return true
})

const canNext = computed(() => {
  if (year.value === 0) return false
  if (month.value === 0) {
    return year.value < maxYear.value
  }
  if (year.value > maxYear.value) return false
  if (year.value === maxYear.value && month.value >= 12) return false
  return true
})

function clampAfterNav() {
  if (year.value > 0) {
    if (year.value < minYear.value) year.value = minYear.value
    if (year.value > maxYear.value) year.value = maxYear.value
  }
}

function prev() {
  if (!canPrev.value) return
  if (month.value === 0) {
    const asc = yearsPositive.value
    const idx = asc.indexOf(year.value)
    if (idx > 0) year.value = asc[idx - 1]
  } else if (month.value <= 1) {
    month.value = 12
    year.value = year.value - 1
  } else {
    month.value = month.value - 1
  }
  clampAfterNav()
  emit('change')
}

function next() {
  if (!canNext.value) return
  if (month.value === 0) {
    const asc = yearsPositive.value
    const idx = asc.indexOf(year.value)
    if (idx >= 0 && idx < asc.length - 1) year.value = asc[idx + 1]
  } else if (month.value >= 12) {
    month.value = 1
    year.value = year.value + 1
  } else {
    month.value = month.value + 1
  }
  clampAfterNav()
  emit('change')
}

function pickMonth(m: number) {
  month.value = m
  closePanel()
  emit('change')
}

function pickYear(y: number) {
  if (y === 0) {
    year.value = 0
    month.value = 0
  } else {
    const wasAll = year.value === 0
    year.value = y
    if (wasAll) month.value = new Date().getMonth() + 1
  }
  closePanel()
  emit('change')
}

function chooseAllMonthsCurrentYear() {
  if (year.value === 0) return
  month.value = 0
  closePanel()
  emit('change')
}

function chooseAllPeriods() {
  year.value = 0
  month.value = 0
  closePanel()
  emit('change')
}
</script>

<template>
  <div ref="rootRef" class="month-year-nav">
    <button
      type="button"
      class="nav-arrow"
      :disabled="!canPrev"
      aria-label="Período anterior"
      @click="prev"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m15 18-6-6 6-6" />
      </svg>
    </button>

    <button
      type="button"
      class="nav-center"
      :aria-expanded="panelOpen"
      aria-haspopup="dialog"
      @click.stop="togglePanel"
    >
      <span class="nav-center-label">{{ displayLabel }}</span>
      <svg class="nav-center-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <button
      type="button"
      class="nav-arrow"
      :disabled="!canNext"
      aria-label="Período seguinte"
      @click="next"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m9 18 6-6-6-6" />
      </svg>
    </button>

    <Transition name="panel">
      <div v-show="panelOpen" class="nav-panel" role="dialog" aria-label="Escolher mês e ano" @click.stop>
        <div class="panel-section">
          <p class="panel-heading">Ano</p>
          <div class="year-chips">
            <button
              v-for="y in yearsPositive.slice().reverse()"
              :key="y"
              type="button"
              class="year-chip"
              :class="{ active: year === y }"
              @click="pickYear(y)"
            >
              {{ y }}
            </button>
            <button
              v-if="allowAllYears && hasYearZero"
              type="button"
              class="year-chip year-chip-wide"
              :class="{ active: year === 0 }"
              @click="chooseAllPeriods"
            >
              Todos os períodos
            </button>
          </div>
        </div>

        <div v-if="year !== 0" class="panel-section">
          <p class="panel-heading">Mês</p>
          <div class="month-grid">
            <button
              v-for="m in 12"
              :key="m"
              type="button"
              class="month-cell"
              :class="{ active: month === m }"
              @click="pickMonth(m)"
            >
              {{ monthNames[m].slice(0, 3) }}
            </button>
          </div>
          <button
            v-if="allowAllMonths"
            type="button"
            class="panel-footer-btn"
            :class="{ active: month === 0 }"
            @click="chooseAllMonthsCurrentYear"
          >
            {{ allMonthsInYearButton }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.month-year-nav {
  position: relative;
  display: inline-flex;
  align-items: stretch;
  gap: 0;
  border-radius: var(--app-radius-md, 12px);
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
  box-shadow: var(--app-shadow-sm, 0 1px 2px rgba(15, 23, 42, 0.06));
}

.nav-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  min-height: 2.75rem;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.nav-arrow:hover:not(:disabled) {
  background: var(--color-table-row-hover);
  color: var(--color-text);
}

.nav-arrow:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.nav-center {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: min(14rem, 72vw);
  padding: 0 1rem;
  border: none;
  border-left: 1px solid var(--color-border);
  border-right: 1px solid var(--color-border);
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s ease;
}

.nav-center:hover {
  background: var(--color-table-row-hover);
}

.nav-center-label {
  flex: 1;
  text-align: center;
  font-size: 0.9375rem;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--color-text);
}

.nav-center-chevron {
  flex-shrink: 0;
  color: var(--color-text-muted);
  transition: transform 0.2s ease;
}

.nav-center[aria-expanded='true'] .nav-center-chevron {
  transform: rotate(180deg);
}

.nav-panel {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  z-index: 50;
  min-width: min(18rem, calc(100vw - 2rem));
  padding: 1rem;
  border-radius: var(--app-radius-md, 12px);
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
  box-shadow: var(--app-shadow-dropdown, 0 12px 40px -8px rgba(15, 23, 42, 0.18));
}

.panel-section + .panel-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
}

.panel-heading {
  margin: 0 0 0.5rem;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.year-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.year-chip {
  padding: 0.4rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  border: 1px solid var(--color-border);
  border-radius: var(--app-radius-sm, 8px);
  background: var(--color-bg);
  color: var(--color-text);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.year-chip:hover {
  border-color: #166534;
  background: var(--color-table-row-hover);
}

.year-chip.active {
  border-color: #166534;
  background: rgba(22, 101, 52, 0.1);
  color: #166534;
}

html.dark .year-chip.active {
  border-color: #4ade80;
  background: rgba(74, 222, 128, 0.12);
  color: #4ade80;
}

.year-chip-wide {
  width: 100%;
  margin-top: 0.25rem;
}

.month-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.35rem;
}

.month-cell {
  padding: 0.5rem 0.25rem;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  border: 1px solid transparent;
  border-radius: var(--app-radius-sm, 8px);
  background: var(--color-bg);
  color: var(--color-text);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.month-cell:hover {
  border-color: var(--color-border);
  background: var(--color-table-row-hover);
}

.month-cell.active {
  border-color: #166534;
  background: rgba(22, 101, 52, 0.12);
  color: #166534;
}

html.dark .month-cell.active {
  border-color: #4ade80;
  background: rgba(74, 222, 128, 0.14);
  color: #4ade80;
}

.panel-footer-btn {
  width: 100%;
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  border: 1px dashed var(--color-border);
  border-radius: var(--app-radius-sm, 8px);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}

.panel-footer-btn:hover {
  border-color: #166534;
  color: #166534;
  background: rgba(22, 101, 52, 0.06);
}

.panel-footer-btn.active {
  border-style: solid;
  border-color: #166534;
  color: #166534;
  background: rgba(22, 101, 52, 0.1);
}

.panel-enter-active,
.panel-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
