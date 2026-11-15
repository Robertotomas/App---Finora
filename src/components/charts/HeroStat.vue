<script setup lang="ts">
/** Estatística pequena do rodapé do `ValueHeroCard` (rótulo por cima, valor por baixo). Slot default = extra ao lado do valor. */
defineProps<{ label: string; value?: string; hint?: string }>()
</script>

<template>
  <div class="hero-stat" :class="{ 'hero-stat--help': !!hint }" :title="hint">
    <span class="hero-stat-label">{{ label }}</span>
    <span class="hero-stat-value">
      <span v-if="value !== undefined">{{ value }}</span>
      <slot />
    </span>
  </div>
</template>

<style scoped>
.hero-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.hero-stat--help {
  cursor: help;
}
.hero-stat-label {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
}
.hero-stat-value {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 22px;
  font-size: 0.9375rem; /* 15px */
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
