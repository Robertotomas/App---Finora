<script setup lang="ts">
/**
 * Dropdown de filtro da barra de ferramentas dos Movimentos (categoria / conta).
 * Puramente visual: a vista controla `open`/`selected` e reage a `toggle`/`pick`.
 * O pai envolve-o num elemento com `ref` para o clique-fora.
 */
defineProps<{
  label: string
  open: boolean
  active: boolean
  allLabel: string
  options: { value: string; label: string }[]
  selected: string
}>()

const emit = defineEmits<{ toggle: []; pick: [value: string] }>()
</script>

<template>
  <div class="fd">
    <button type="button" class="fd-btn" :class="{ active, open }" :aria-expanded="open" @click.stop="emit('toggle')">
      <span class="fd-label">{{ label }}</span>
      <svg class="fd-chevron" :class="{ open }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
    </button>
    <Transition name="fd-panel">
      <div v-show="open" class="fd-panel" role="listbox" @click.stop>
        <button type="button" class="fd-item" :class="{ selected: selected === '' }" @click="emit('pick', '')">{{ allLabel }}</button>
        <button
          v-for="o in options"
          :key="o.value"
          type="button"
          class="fd-item"
          :class="{ selected: selected === o.value }"
          @click="emit('pick', o.value)"
        >
          {{ o.label }}
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fd {
  position: relative;
}

.fd-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  max-width: 220px;
  height: var(--control-h);
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  white-space: nowrap;
  cursor: pointer;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast), color var(--transition-fast);
}

.fd-btn:hover {
  border-color: var(--color-text-subtle);
}

.fd-btn.active {
  color: var(--color-text-strong);
}

.fd-btn.open,
.fd-btn:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--focus-ring);
}

.fd-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.fd-chevron {
  flex-shrink: 0;
  color: var(--color-text-muted);
  transition: transform var(--transition-base);
}

.fd-chevron.open {
  transform: rotate(180deg);
}

.fd-panel {
  position: absolute;
  top: calc(100% + var(--space-1));
  left: 0;
  z-index: 50;
  min-width: 100%;
  max-height: 280px;
  overflow-y: auto;
  padding: var(--space-1);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}

.fd-item {
  display: block;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  font-family: inherit;
  font-size: var(--text-sm);
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.fd-item:hover {
  background: var(--color-surface-hover);
}

.fd-item.selected {
  background: var(--color-selected);
  color: var(--color-selected-text);
  font-weight: var(--weight-semibold);
}

.fd-panel-enter-active,
.fd-panel-leave-active {
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.fd-panel-enter-from,
.fd-panel-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
