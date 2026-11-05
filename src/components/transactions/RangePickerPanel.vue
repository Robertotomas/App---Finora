<script setup lang="ts">
/**
 * Seletor de período (botão + painel com atalhos e dois calendários) dos separadores de Movimentos.
 * Puramente visual: o estado (datas, mês visível, passo de seleção) vive na vista, que passa
 * os valores e reage aos eventos. O pai envolve-o num elemento com `ref` para o clique-fora.
 */
defineProps<{
  label: string
  open: boolean
  activePreset: string
  leftYear: number
  leftMonth: number
  rightYear: number
  rightMonth: number
  leftDays: (number | null)[]
  rightDays: (number | null)[]
  isInRange: (y: number, m: number, d: number) => boolean
  isStart: (y: number, m: number, d: number) => boolean
  isEnd: (y: number, m: number, d: number) => boolean
}>()

const emit = defineEmits<{
  toggle: []
  preset: [key: string]
  prev: []
  next: []
  pick: [y: number, m: number, d: number]
}>()

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const PRESETS = [
  { key: 'month', label: 'Este mês' },
  { key: '30d', label: '30 dias' },
  { key: '3m', label: '3 meses' },
  { key: 'year', label: 'Este ano' },
]
</script>

<template>
  <div class="rp">
    <button type="button" class="rp-btn" :class="{ open }" :aria-expanded="open" @click.stop="emit('toggle')">
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="rp-icon"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
      <span>{{ label }}</span>
      <svg class="rp-chevron" :class="{ open }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    <Transition name="rp-panel">
      <div v-show="open" class="rp-panel" @click.stop>
        <div class="rp-presets">
          <button
            v-for="p in PRESETS"
            :key="p.key"
            type="button"
            class="rp-preset"
            :class="{ active: activePreset === p.key }"
            @click="emit('preset', p.key)"
          >
            {{ p.label }}
          </button>
        </div>
        <div class="rp-calendars">
          <div
            v-for="cal in [
              { side: 'l', y: leftYear, m: leftMonth, days: leftDays },
              { side: 'r', y: rightYear, m: rightMonth, days: rightDays },
            ]"
            :key="cal.side"
            class="rp-cal"
          >
            <div class="rp-cal-head">
              <button v-if="cal.side === 'l'" type="button" class="rp-nav" aria-label="Mês anterior" @click="emit('prev')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <span v-else class="rp-nav-spacer"></span>
              <span class="rp-cal-title">{{ MONTHS[cal.m] }} {{ cal.y }}</span>
              <button v-if="cal.side === 'r'" type="button" class="rp-nav" aria-label="Mês seguinte" @click="emit('next')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
              <span v-else class="rp-nav-spacer"></span>
            </div>
            <div class="rp-weekdays">
              <span v-for="wd in WEEKDAYS" :key="wd">{{ wd }}</span>
            </div>
            <div class="rp-grid">
              <button
                v-for="(d, i) in cal.days"
                :key="cal.side + i"
                type="button"
                class="rp-day"
                :class="{
                  empty: d === null,
                  'in-range': d !== null && isInRange(cal.y, cal.m, d),
                  'is-start': d !== null && isStart(cal.y, cal.m, d),
                  'is-end': d !== null && isEnd(cal.y, cal.m, d),
                }"
                :disabled="d === null"
                @click="d !== null && emit('pick', cal.y, cal.m, d)"
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
.rp {
  position: relative;
}

.rp-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  height: var(--control-h);
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  white-space: nowrap;
  cursor: pointer;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.rp-btn:hover {
  border-color: var(--color-text-subtle);
}

.rp-btn.open,
.rp-btn:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--focus-ring);
}

.rp-icon,
.rp-chevron {
  flex-shrink: 0;
  color: var(--color-text-muted);
}

.rp-chevron {
  transition: transform var(--transition-base);
}

.rp-chevron.open {
  transform: rotate(180deg);
}

.rp-panel {
  position: absolute;
  top: calc(100% + var(--space-2));
  left: 0;
  z-index: 60;
  padding: var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}

.rp-presets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--color-border-subtle);
}

.rp-preset {
  height: var(--control-h-sm);
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  white-space: nowrap;
  cursor: pointer;
  transition: border-color var(--transition-fast), color var(--transition-fast), background var(--transition-fast);
}

.rp-preset:hover {
  color: var(--color-text-strong);
  border-color: var(--color-border-strong);
}

.rp-preset.active {
  background: var(--color-selected);
  border-color: var(--color-border-strong);
  color: var(--color-selected-text);
}

.rp-calendars {
  display: flex;
  gap: var(--space-5);
}

.rp-cal {
  width: 240px;
}

.rp-cal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}

.rp-cal-title {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.rp-nav,
.rp-nav-spacer {
  width: 28px;
  height: 28px;
}

.rp-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.rp-nav:hover {
  background: var(--color-surface-muted);
  color: var(--color-text-strong);
}

.rp-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: var(--space-1);
}

.rp-weekdays span {
  padding: var(--space-1) 0;
  text-align: center;
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
  color: var(--color-text-subtle);
}

.rp-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
}

.rp-day {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--color-text);
  font-family: inherit;
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.rp-day.empty {
  cursor: default;
}

.rp-day:not(.empty):hover,
.rp-day.in-range {
  background: var(--color-selected);
}

.rp-day.is-start,
.rp-day.is-end {
  background: var(--color-primary);
  color: var(--color-on-primary);
  font-weight: var(--weight-bold);
}

.rp-day.is-start { border-radius: 6px 0 0 6px; }
.rp-day.is-end { border-radius: 0 6px 6px 0; }
.rp-day.is-start.is-end { border-radius: 6px; }

.rp-panel-enter-active,
.rp-panel-leave-active {
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.rp-panel-enter-from,
.rp-panel-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 640px) {
  .rp-panel {
    position: fixed;
    top: auto;
    left: var(--space-4);
    right: var(--space-4);
    bottom: var(--space-4);
    max-height: 80vh;
    overflow-y: auto;
  }

  .rp-calendars {
    flex-direction: column;
  }

  .rp-cal {
    width: 100%;
  }
}
</style>
