<script setup lang="ts" generic="T extends string | number">
/**
 * Controlo segmentado único da app — usar para PERÍODOS (YTD/3M/6M/1A/5A) e para
 * alternar vistas/tipos (Todos/Receitas/Despesas). Para filtros de lista com contagens
 * usar `FilterChips`.
 * `locked` marca opções bloqueadas pelo plano (continuam clicáveis — o pai decide o que fazer).
 */
defineProps<{
  modelValue: T
  options: { value: T; label: string; locked?: boolean }[]
  size?: 'sm' | 'md'
  ariaLabel?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()
</script>

<template>
  <div class="seg" :class="`seg--${size ?? 'md'}`" role="tablist" :aria-label="ariaLabel">
    <button
      v-for="opt in options"
      :key="String(opt.value)"
      type="button"
      role="tab"
      class="seg-item"
      :class="{ active: opt.value === modelValue, locked: opt.locked }"
      :aria-selected="opt.value === modelValue"
      @click="emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<style scoped>
.seg {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  background: var(--color-surface-muted);
  border-radius: var(--radius-sm);
  height: var(--control-h);
}
.seg--sm {
  height: var(--control-h-sm);
  padding: 2px;
}
.seg-item {
  height: 100%;
  padding: 0 var(--space-3);
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast);
}
.seg--sm .seg-item {
  padding: 0 10px;
  font-size: var(--text-xs);
}
.seg-item:hover:not(.active) {
  color: var(--color-text-strong);
}
.seg-item.active {
  background: var(--color-surface-raised);
  color: var(--color-text-strong);
  box-shadow: var(--shadow-sm);
}
.seg-item.locked {
  color: var(--color-text-subtle);
}
.seg-item:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
</style>
