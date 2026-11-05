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
    /** Mostrar "Início do ano até agora" (month = -1) */
    allowYearToDate?: boolean
    yearToDateButton?: string
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
    allowYearToDate: false,
    yearToDateButton: 'Início do ano até agora',
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
  if (month.value === -1) return `${props.yearToDateButton} · ${year.value}`
  if (month.value === 0) return `${props.allMonthsInYearTitle} · ${year.value}`
  return `${props.monthNames[month.value]} ${year.value}`
})

const canPrev = computed(() => {
  if (year.value === 0) return false
  if (month.value === 0 || month.value === -1) {
    return year.value > minYear.value
  }
  if (year.value < minYear.value) return false
  if (year.value === minYear.value && month.value <= 1) return false
  return true
})

const canNext = computed(() => {
  if (year.value === 0) return false
  if (month.value === 0 || month.value === -1) {
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
  if (month.value === 0 || month.value === -1) {
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
  if (month.value === 0 || month.value === -1) {
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

function chooseYearToDate() {
  if (year.value === 0) return
  month.value = -1
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
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
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
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
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
          <button
            v-if="allowYearToDate"
            type="button"
            class="panel-footer-btn panel-footer-btn-secondary"
            :class="{ active: month === -1 }"
            @click="chooseYearToDate"
          >
            {{ yearToDateButton }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* Controlo compacto: ‹ Mês - Ano ⌄ › com 36px de altura. */
.month-year-nav {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: var(--control-h);
  padding: 2px;
  gap: 2px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface);
  box-sizing: border-box;
}

.nav-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 100%;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 6px;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.nav-arrow:hover:not(:disabled) {
  background: var(--color-surface-muted);
  color: var(--color-text-strong);
}
.nav-arrow:focus-visible,
.nav-center:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.nav-arrow:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.nav-center {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 100%;
  min-width: 9.5rem;
  padding: 0 var(--space-2);
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  border-radius: 6px;
  transition: background var(--transition-fast);
}
.nav-center:hover {
  background: var(--color-surface-muted);
}
.nav-center-label {
  text-align: center;
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.nav-center-chevron {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  color: var(--color-text-muted);
  transition: transform var(--transition-base);
}
.nav-center[aria-expanded='true'] .nav-center-chevron {
  transform: rotate(180deg);
}

/* ── Painel ── */
.nav-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 50;
  width: min(18rem, calc(100vw - 2rem));
  padding: var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow-lg);
  box-sizing: border-box;
}
.panel-section + .panel-section {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border-subtle);
}
.panel-heading {
  margin: 0 0 var(--space-2);
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
  letter-spacing: var(--tracking-caps);
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.year-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.year-chip,
.month-cell {
  height: var(--control-h-sm);
  padding: 0 var(--space-3);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: var(--color-surface-muted);
  color: var(--color-text);
  cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}
.year-chip:hover,
.month-cell:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-border);
}
.year-chip.active,
.month-cell.active {
  background: var(--color-selected);
  border-color: var(--color-border-strong);
  color: var(--color-selected-text);
  font-weight: var(--weight-semibold);
}
.year-chip-wide {
  width: 100%;
  margin-top: var(--space-1);
}

.month-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.month-cell {
  padding: 0 var(--space-1);
}

.panel-footer-btn {
  width: 100%;
  height: var(--control-h-sm);
  margin-top: var(--space-3);
  padding: 0 var(--space-3);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  font-family: inherit;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: border-color var(--transition-fast), color var(--transition-fast), background var(--transition-fast);
}
.panel-footer-btn:hover {
  border-color: var(--color-border-strong);
  color: var(--color-selected-text);
  background: var(--color-selected);
}
.panel-footer-btn.active {
  border-style: solid;
  border-color: var(--color-border-strong);
  color: var(--color-selected-text);
  background: var(--color-selected);
  font-weight: var(--weight-semibold);
}
.panel-footer-btn-secondary {
  margin-top: var(--space-2);
}

.panel-enter-active,
.panel-leave-active {
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}
.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
