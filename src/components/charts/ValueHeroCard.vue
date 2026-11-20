<script setup lang="ts">
/**
 * Cartão hero com gráfico (Investimentos, Bens e valores — lista e detalhe).
 *  - Topo esquerdo: seletor de modo "Valor de mercado" / "Desempenho" + número grande + variação + data.
 *  - Topo direito: slot `actions` (período, "Atualizar", DateRangePicker…).
 *  - Gráfico de ponta a ponta (`AssetsChart variant="hero"`), o cabeçalho segue o hover.
 *  - Rodapé: slot `footer` com `HeroStat`s.
 * Slots: `leading` (ex.: logo à esquerda do bloco de texto), `empty` (sem pontos suficientes),
 * `title-extra` (ao lado do título estático: dica, olho…).
 * Com `title` (ex.: "Património total" no Dashboard) mostra um rótulo fixo em vez do seletor de modo e
 * fica sempre no modo valor (sem custo → sem "Desempenho"). `hideValues` mascara todos os números.
 * Só apresentação: os dados (pontos, totais) vêm da vista.
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import AssetsChart from './AssetsChart.vue'
import type { AssetChartPoint } from './AssetsChart.vue'
import { formatCurrency, formatPct } from './chartTheme'
import { indexOfDate, periodChange, returnPct } from './heroSeries'

const props = withDefaults(
  defineProps<{
    points: AssetChartPoint[]
    /** Valor e custo atuais (cabeçalho fora do hover). */
    currentValue: number
    currentCost: number
    /** Nome da linha de referência no modo valor ("Investido" / "Custo"). Vazio = sem linha de referência. */
    costLabel?: string
    /** Texto do período na linha da variação ("em 6 meses", "este ano", "desde o início"). */
    periodLabel: string
    yearTicks?: boolean
    loading?: boolean
    /** Data mostrada fora do hover. */
    idleDateLabel?: string
    currency?: string
    /** Rótulo fixo no lugar do seletor "Valor de mercado"/"Desempenho" (força o modo valor). */
    title?: string
    /** Mascara valores (número grande, variação e mín./máx. do gráfico) com "••••••". */
    hideValues?: boolean
  }>(),
  { costLabel: '', yearTicks: false, loading: false, idleDateLabel: 'Hoje', currency: 'EUR', title: '', hideValues: false },
)

type Mode = 'value' | 'performance'
const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: 'value', label: 'Valor de mercado' },
  { value: 'performance', label: 'Desempenho' },
]
/** O modo escolhido é memorizado (preferência do utilizador, partilhada por todas as páginas com este cartão). */
const MODE_KEY = 'finora-hero-mode'
function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'performance' ? 'performance' : 'value'
  } catch {
    return 'value'
  }
}
const storedMode = ref<Mode>(readMode())
/** Com título fixo não há modo Desempenho. */
const mode = computed<Mode>(() => (props.title ? 'value' : storedMode.value))
const modeLabel = computed(() => MODE_OPTIONS.find((o) => o.value === mode.value)?.label ?? '')

/* ── Menu do modo ── */
const menuOpen = ref(false)
const root = ref<HTMLElement | null>(null)
function onOutside(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) closeMenu()
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') closeMenu()
}
function openMenu() {
  menuOpen.value = true
  document.addEventListener('click', onOutside, true)
  document.addEventListener('keydown', onKey)
}
function closeMenu() {
  menuOpen.value = false
  document.removeEventListener('click', onOutside, true)
  document.removeEventListener('keydown', onKey)
}
function toggleMenu() {
  if (menuOpen.value) closeMenu()
  else openMenu()
}
function selectMode(m: Mode) {
  storedMode.value = m
  try {
    localStorage.setItem(MODE_KEY, m)
  } catch {
    /* sem armazenamento (modo privado): fica só nesta sessão */
  }
  closeMenu()
}
onBeforeUnmount(closeMenu)

/* ── Hover ── */
const hovered = ref<{ date: string; value: number; cost: number } | null>(null)
function onHover(p: { date: string; value: number; cost: number } | null) {
  hovered.value = p
}

const hasChart = computed(() => props.points.length >= 2)
const current = computed(() => hovered.value ?? { value: props.currentValue, cost: props.currentCost })

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const dateLabel = computed(() => {
  const h = hovered.value
  if (!h) return props.idleDateLabel
  if (h.date === todayStr()) return 'Hoje'
  return new Date(h.date + 'T00:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })
})

function signed(v: number, fmt: (x: number) => string): string {
  return `${v >= 0 ? '+' : '−'}${fmt(Math.abs(v))}`
}
const money = (v: number) => formatCurrency(v, props.currency)
const pct = (v: number) => formatPct(v, 2)

/** Período = toda a vida da posição ("Tudo", "desde o início", "desde a aquisição"). */
const isFullRange = computed(() => /^desde (o início|a aquisição)/i.test(props.periodLabel))

/** Variação do período até ao ponto atual (último, ou o do hover). */
const periodResult = computed(() => {
  if (!hasChart.value) return null
  // Vida toda: usa o ganho/rentabilidade totais (evita diferenças de cêntimos face ao preço do dia da 1.ª compra).
  if (isFullRange.value && !hovered.value) {
    const c = current.value
    return { abs: c.value - c.cost, pct: returnPct(c) }
  }
  const idx = hovered.value ? indexOfDate(props.points, hovered.value.date) : props.points.length - 1
  return periodChange(props.points, idx < 0 ? props.points.length - 1 : idx)
})

/** Rentabilidade total (desde o início), mostrada como referência no modo Desempenho. */
const totalReturn = computed(() => returnPct(current.value))

/** Número grande: valor (modo valor) ou rentabilidade DO PERÍODO (modo desempenho). */
const bigValue = computed(() => {
  if (props.hideValues) return '••••••'
  if (mode.value === 'value') return money(current.value.value)
  const r = periodResult.value ? periodResult.value.pct : totalReturn.value
  return r === null ? '—' : signed(r, pct)
})

/** Linha da variação: montante (+%) colorido + texto do período. */
const change = computed<{ abs: number; pct: number | null; suffix: string } | null>(() => {
  if (!periodResult.value) {
    // Sem gráfico e sem custo de referência: não há variação para mostrar.
    if (!props.costLabel) return null
    const c = current.value
    return {
      abs: c.value - c.cost,
      pct: mode.value === 'performance' ? null : returnPct(c),
      suffix: `vs. ${props.costLabel.toLowerCase()}`,
    }
  }
  // No desempenho a % já é o número grande: aqui fica só o ganho em €.
  return { abs: periodResult.value.abs, pct: mode.value === 'performance' ? null : periodResult.value.pct, suffix: props.periodLabel }
})

/** Referência no modo Desempenho: "Total: +43,28%" (só quando difere da % do período). */
const totalNote = computed(() => {
  if (props.hideValues || mode.value !== 'performance' || !periodResult.value || totalReturn.value === null || isFullRange.value) return ''
  const p = periodResult.value.pct
  if (p !== null && Math.abs(p - totalReturn.value) < 0.005) return ''
  return `Total: ${signed(totalReturn.value, pct)}`
})
</script>

<template>
  <section class="vh-card">
    <div class="vh-head">
      <div class="vh-main">
        <div v-if="$slots.leading" class="vh-leading"><slot name="leading" /></div>
        <div class="vh-info">
          <div v-if="title" class="vh-title">
            <span class="vh-title-text">{{ title }}</span>
            <slot name="title-extra" />
          </div>
          <div v-else class="vh-mode-row">
          <div ref="root" class="vh-mode">
            <button
              type="button"
              class="vh-mode-btn"
              :class="{ open: menuOpen }"
              aria-haspopup="listbox"
              :aria-expanded="menuOpen"
              @click="toggleMenu"
            >
              {{ modeLabel }}
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <Transition name="vh-menu">
              <div v-if="menuOpen" class="vh-menu" role="listbox" aria-label="Modo do gráfico">
                <button
                  v-for="opt in MODE_OPTIONS"
                  :key="opt.value"
                  type="button"
                  role="option"
                  class="vh-menu-item"
                  :class="{ active: opt.value === mode }"
                  :aria-selected="opt.value === mode"
                  @click="selectMode(opt.value)"
                >
                  <span>{{ opt.label }}</span>
                  <svg v-if="opt.value === mode" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                </button>
              </div>
            </Transition>
          </div>
          <slot name="title-extra" />
          </div>

          <div class="vh-value">{{ bigValue }}</div>
          <div v-if="change" class="vh-change">
            <span v-if="hideValues" class="vh-change-amt vh-muted">•••••</span>
            <span v-else class="vh-change-amt" :class="change.abs < 0 ? 'neg' : 'pos'">
              {{ signed(change.abs, money) }}<template v-if="change.pct !== null"> ({{ signed(change.pct, pct) }})</template>
            </span>
            <span class="vh-muted">{{ change.suffix }}</span>
            <span v-if="totalNote" class="vh-muted vh-total">· {{ totalNote }}</span>
          </div>
          <div class="vh-date vh-muted">{{ dateLabel }}</div>
        </div>
      </div>
      <div v-if="$slots.actions" class="vh-actions"><slot name="actions" /></div>
    </div>

    <div class="vh-chart">
      <div v-if="loading" class="vh-chart-state"><div class="vh-spinner" aria-label="A carregar"></div></div>
      <AssetsChart
        v-else-if="hasChart"
        variant="hero"
        :mode="mode"
        :points="points"
        :currency="currency"
        :year-ticks="yearTicks"
        :cost-label="costLabel"
        :hide-values="hideValues"
        show-extremes
        @hover="onHover"
      />
      <div v-else class="vh-empty"><slot name="empty" /></div>
    </div>

    <div v-if="$slots.footer" class="vh-footer"><slot name="footer" /></div>
  </section>
</template>

<style scoped>
.vh-card {
  --vh-pad: var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--vh-pad);
  min-width: 0;
}

.vh-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.vh-main {
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  min-width: 0;
}

.vh-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
  min-width: 0;
}

/* ── Título fixo (sem seletor de modo) ── */
.vh-title {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  height: 28px;
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

/* ── Seletor de modo ── */
.vh-mode-row {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
.vh-mode {
  position: relative;
  margin-left: calc(-1 * var(--space-2));
}
.vh-mode-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  height: 28px;
  padding: 0 var(--space-2);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}
.vh-mode-btn:hover,
.vh-mode-btn.open {
  background: var(--color-surface-hover);
  color: var(--color-text-strong);
}
.vh-mode-btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.vh-mode-btn svg {
  transition: transform var(--transition-fast);
}
.vh-mode-btn.open svg {
  transform: rotate(180deg);
}
.vh-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: var(--z-popover);
  min-width: 200px;
  padding: 4px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}
.vh-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  text-align: left;
  cursor: pointer;
}
.vh-menu-item:hover {
  background: var(--color-surface-hover);
}
.vh-menu-item.active {
  background: var(--color-selected);
  color: var(--color-selected-text);
  font-weight: var(--weight-semibold);
}
.vh-menu-item.active svg {
  color: var(--color-primary-text);
}
.vh-menu-enter-active,
.vh-menu-leave-active {
  transition: opacity 120ms ease, transform 120ms ease;
}
.vh-menu-enter-from,
.vh-menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ── Valores ── */
.vh-value {
  font-size: var(--text-3xl);
  font-weight: var(--weight-bold);
  color: var(--color-text-strong);
  letter-spacing: var(--tracking-tight);
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.vh-change {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0 var(--space-2);
  margin-top: 2px;
  font-size: var(--text-base);
}
.vh-change-amt {
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
}
.vh-change-amt.pos {
  color: var(--color-income);
}
.vh-change-amt.neg {
  color: var(--color-expense);
}
.vh-muted {
  color: var(--color-text-muted);
}
.vh-date {
  font-size: var(--text-sm);
}

.vh-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
  justify-content: flex-end;
}

/* ── Gráfico de ponta a ponta ── */
.vh-chart {
  --hero-gutter: var(--vh-pad);
  margin: var(--space-5) calc(-1 * var(--vh-pad)) 0;
}
.vh-chart-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 240px;
}
.vh-empty {
  padding: 0 var(--vh-pad);
}
.vh-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: vh-spin 0.8s linear infinite;
}
@keyframes vh-spin {
  to {
    transform: rotate(360deg);
  }
}

/* ── Rodapé ── */
.vh-footer {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4) var(--space-8);
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border-subtle);
}

@media (max-width: 768px) {
  .vh-chart-state {
    height: 200px;
  }
}

@media (max-width: 640px) {
  .vh-card {
    --vh-pad: var(--space-4);
  }
  .vh-head {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-3);
  }
  .vh-actions {
    justify-content: flex-start;
  }
  .vh-value {
    font-size: var(--text-2xl);
  }
  .vh-footer {
    gap: var(--space-3) var(--space-6);
  }
}
</style>
