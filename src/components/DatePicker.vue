<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import BaseSelect from './BaseSelect.vue'

const props = defineProps<{
  modelValue: string
  error?: boolean
  placeholder?: string
  disabled?: boolean
  /** Permite escrever a data à mão (dd/mm/aaaa); o calendário só abre pelo ícone. */
  editable?: boolean
  /**
   * Data máxima permitida (yyyy-MM-dd) ou 'today' (hoje, local). Para datas de coisas que já
   * aconteceram (avaliações, compras, depósitos…): sem anos/meses/dias futuros no calendário e
   * datas escritas depois do máximo são recusadas.
   */
  max?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom']

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

const today = new Date()
const viewYear = ref(today.getFullYear())
const viewMonth = ref(today.getMonth())

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Data máxima já resolvida (yyyy-MM-dd) ou null. */
const maxIso = computed<string | null>(() => {
  if (!props.max) return null
  if (props.max === 'today') return localStr(today)
  return /^\d{4}-\d{2}-\d{2}$/.test(props.max) ? props.max : null
})
const maxYear = computed(() => (maxIso.value ? Number(maxIso.value.slice(0, 4)) : null))
const maxMonth = computed(() => (maxIso.value ? Number(maxIso.value.slice(5, 7)) - 1 : null)) // 0-11

const monthOptions = computed(() =>
  MONTHS.map((m, i) => ({ value: i, label: m })).filter(
    (o) => maxYear.value === null || viewYear.value < maxYear.value || o.value <= (maxMonth.value ?? 11),
  ),
)
const yearOptions = computed(() => {
  const top = maxYear.value ?? today.getFullYear() + 5
  const arr: { value: number; label: string }[] = []
  for (let y = top; y >= 1950; y--) arr.push({ value: y, label: String(y) })
  return arr
})

/** O dia (do mês em vista) passa o máximo? */
function isAfterMax(d: number): boolean {
  return !!maxIso.value && toStr(viewYear.value, viewMonth.value, d) > maxIso.value
}
/** Já estamos no mês do máximo (a seta "seguinte" fica desativada)? */
const atMaxMonth = computed(
  () => maxYear.value !== null && (viewYear.value > maxYear.value || (viewYear.value === maxYear.value && viewMonth.value >= (maxMonth.value ?? 11))),
)
/** Ao mudar para o ano do máximo, o mês em vista não pode ficar depois dele. */
function clampView() {
  if (maxYear.value === null || maxMonth.value === null) return
  if (viewYear.value > maxYear.value) viewYear.value = maxYear.value
  if (viewYear.value === maxYear.value && viewMonth.value > maxMonth.value) viewMonth.value = maxMonth.value
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

/* ── Modo escrevível (dd/mm/aaaa) ── */
const inputText = ref(displayLabel.value)
const isTyping = ref(false)

function isValidDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false
  return d <= new Date(y, m, 0).getDate()
}

/** Converte "dd/mm/aaaa" (aceita - . / e ano de 2 dígitos) em ISO yyyy-MM-dd, ou null. */
function parseTyped(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (!m) return null
  const d = Number(m[1])
  const mo = Number(m[2])
  let y = Number(m[3])
  if (y < 100) y += 2000
  if (!isValidDate(y, mo, d)) return null
  const iso = `${y}-${pad(mo)}-${pad(d)}`
  if (maxIso.value && iso > maxIso.value) return null // data futura → recusada
  return iso
}

/** Formata os dígitos como dd/mm/aaaa, inserindo as barras automaticamente. */
function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function onTypedInput(e: Event) {
  isTyping.value = true
  const el = e.target as HTMLInputElement
  const masked = maskDate(el.value)
  el.value = masked // garante a máscara no DOM mesmo quando o valor "lógico" não muda
  inputText.value = masked
  // Só aplica quando a data está completa (8 dígitos), para não emitir valores parciais.
  if (masked.replace(/\D/g, '').length === 8) {
    const iso = parseTyped(masked)
    if (iso) emit('update:modelValue', iso)
  }
}

function onTypedBlur() {
  isTyping.value = false
  const iso = parseTyped(inputText.value)
  if (iso) emit('update:modelValue', iso)
  // Normaliza para o formato canónico (ou reverte ao último valor válido).
  inputText.value = displayLabel.value
}

// Mantém o texto sincronizado quando o valor muda por fora (ex.: escolha no calendário),
// sem mexer enquanto o utilizador está a escrever.
watch(
  () => props.modelValue,
  () => {
    if (!isTyping.value) inputText.value = displayLabel.value
  },
)

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
  if (isAfterMax(d)) return
  emit('update:modelValue', toStr(viewYear.value, viewMonth.value, d))
  close()
}

function prevMonth() {
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- }
  else viewMonth.value--
}
function nextMonth() {
  if (atMaxMonth.value) return
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ }
  else viewMonth.value++
}

function updatePosition() {
  const trigger = (root.value?.querySelector('.dp-trigger') ?? root.value?.querySelector('.dp-input-wrap')) as HTMLElement | undefined
  if (!trigger) return
  const r = trigger.getBoundingClientRect()
  const width = 360 // cabe o mês por extenso ("Fevereiro ✓") e o ano
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
  clampView()
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
    <!-- Modo escrevível: campo de texto + ícone para abrir o calendário -->
    <div v-if="editable" class="dp-input-wrap">
      <input
        type="text"
        class="dp-input"
        :value="inputText"
        :placeholder="placeholder || 'dd/mm/aaaa'"
        :disabled="disabled"
        inputmode="numeric"
        autocomplete="off"
        @input="onTypedInput"
        @focus="isTyping = true"
        @blur="onTypedBlur"
        @keydown.enter.prevent="onTypedBlur"
      />
      <button type="button" class="dp-cal-btn" :disabled="disabled" title="Abrir calendário" @click.stop="toggle">
        <svg class="dp-cal-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
      </button>
    </div>

    <!-- Modo botão (default): abre o calendário ao clicar -->
    <button v-else type="button" class="dp-trigger" :disabled="disabled" @click.stop="toggle">
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
                @update:model-value="(v) => { viewYear = Number(v); clampView() }"
              />
            </div>
          </div>
          <button type="button" class="dp-nav" :disabled="atMaxMonth" @click="nextMonth">
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
            :class="{ empty: d === null, selected: d !== null && isSelected(d), today: d !== null && isToday(d), future: d !== null && isAfterMax(d) }"
            :disabled="d === null || isAfterMax(d)"
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

/* Campo (modo botão e modo escrevível partilham o mesmo aspeto) */
.dp-trigger,
.dp-input-wrap {
  display: flex;
  align-items: center;
  width: 100%;
  height: 40px;
  box-sizing: border-box;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: var(--text-base);
  color: var(--color-text-strong);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.dp-trigger {
  justify-content: space-between;
  gap: var(--space-2);
  padding: 0 12px;
  cursor: pointer;
  text-align: left;
}
.dp-trigger:hover:not(:disabled),
.dp-input-wrap:hover:not(:focus-within) {
  border-color: var(--color-text-subtle);
}
.dp-trigger:focus-visible,
.dp-input-wrap:focus-within {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--focus-ring);
}
.date-picker.is-error .dp-trigger,
.date-picker.is-error .dp-input-wrap {
  border-color: var(--color-danger);
}
.date-picker.is-disabled .dp-trigger,
.date-picker.is-disabled .dp-input-wrap {
  background: var(--color-surface-2);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.dp-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 12px;
  border: none;
  outline: none;
  background: transparent;
  font-size: var(--text-base);
  font-family: inherit;
  color: var(--color-text-strong);
  font-variant-numeric: tabular-nums;
}
.dp-input:focus,
.dp-input:focus-visible {
  outline: none;
  box-shadow: none;
}
.dp-input::placeholder {
  color: var(--color-text-subtle);
}

.dp-cal-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  align-self: stretch;
  padding: 0 12px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  transition: color var(--transition-fast);
}
.dp-cal-btn:hover:not(:disabled) {
  color: var(--color-primary-text);
}
.dp-cal-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.dp-value {
  font-variant-numeric: tabular-nums;
}
.dp-value.is-placeholder {
  color: var(--color-text-subtle);
}
.dp-cal-icon {
  flex-shrink: 0;
  color: var(--color-text-muted);
}

/* Calendário */
.dp-panel {
  z-index: var(--z-popover);
  padding: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}

.dp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 10px;
}
.dp-selects {
  display: flex;
  gap: 6px;
  flex: 1;
}
.dp-select--month {
  flex: 1;
}
.dp-select--year {
  width: 110px; /* o ano + o visto ✓ da opção selecionada cabem sem reticências */
  flex-shrink: 0;
}
/* Dropdowns de mês/ano mais compactos para o ano caber sem reticências. */
.dp-select :deep(.base-select-trigger) {
  height: 32px;
  padding: 0 8px;
  gap: 4px;
  font-size: var(--text-sm);
}

.dp-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast), color var(--transition-fast);
}
.dp-nav:hover:not(:disabled) {
  background: var(--color-surface-muted);
  color: var(--color-text-strong);
}
.dp-nav:disabled {
  opacity: 0.35;
  cursor: default;
}

.dp-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 4px;
}
.dp-weekdays span {
  padding: 4px 0;
  text-align: center;
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text-muted);
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
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  font-variant-numeric: tabular-nums;
  color: var(--color-text);
  cursor: pointer;
  border-radius: 6px;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.dp-day.empty {
  cursor: default;
}
.dp-day.future {
  color: var(--color-text-subtle);
  opacity: 0.45;
  cursor: default;
}
.dp-day:not(.empty):not(.selected):not(.future):hover {
  background: var(--color-surface-muted);
}
.dp-day.today:not(.selected) {
  color: var(--color-primary-text);
  font-weight: var(--weight-bold);
  box-shadow: inset 0 0 0 1px var(--color-primary-soft-border);
}
.dp-day.selected {
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-weight: var(--weight-bold);
}

.dp-pop-enter-active,
.dp-pop-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.dp-pop-enter-from,
.dp-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
