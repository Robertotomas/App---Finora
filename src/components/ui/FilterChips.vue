<script setup lang="ts" generic="T extends string | number">
/**
 * Chips de filtro de lista (ex.: Todas / Ativas / Arquivadas). Contagem opcional por chip.
 * Para períodos ou alternar tipo usar `SegmentedControl`.
 */
defineProps<{
  modelValue: T
  options: { value: T; label: string; count?: number }[]
  ariaLabel?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
</script>

<template>
  <div class="chips" role="tablist" :aria-label="ariaLabel">
    <button
      v-for="opt in options"
      :key="String(opt.value)"
      type="button"
      role="tab"
      class="chip"
      :class="{ active: opt.value === modelValue }"
      :aria-selected="opt.value === modelValue"
      @click="emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
      <span v-if="opt.count !== undefined" class="chip-count">{{ opt.count }}</span>
    </button>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: var(--control-h-sm);
  padding: 0 var(--space-3);
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  cursor: pointer;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}
.chip:hover:not(.active) {
  border-color: var(--color-border-strong);
  color: var(--color-text-strong);
}
.chip.active {
  background: var(--color-selected);
  border-color: var(--color-border-strong);
  color: var(--color-selected-text);
  font-weight: var(--weight-semibold);
}
.chip-count {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: var(--radius-full);
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.chip.active .chip-count {
  background: var(--color-surface);
  color: var(--color-text-strong);
}
.chip:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
</style>
