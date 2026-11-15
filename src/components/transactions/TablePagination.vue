<script setup lang="ts">
/** Paginação compacta, alinhada à direita, para o rodapé das tabelas de Movimentos. */
defineProps<{
  page: number
  pages: (number | '...')[]
  canPrev: boolean
  canNext: boolean
}>()

const emit = defineEmits<{ prev: []; next: []; go: [page: number] }>()
</script>

<template>
  <nav class="pg" aria-label="Paginação">
    <button type="button" class="pg-btn" :disabled="!canPrev" aria-label="Página anterior" @click="emit('prev')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
    </button>
    <template v-for="(p, i) in pages" :key="i">
      <span v-if="p === '...'" class="pg-dots">…</span>
      <button
        v-else
        type="button"
        class="pg-btn pg-num"
        :class="{ active: p === page }"
        :aria-current="p === page ? 'page' : undefined"
        @click="emit('go', p)"
      >
        {{ p }}
      </button>
    </template>
    <button type="button" class="pg-btn" :disabled="!canNext" aria-label="Página seguinte" @click="emit('next')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
    </button>
  </nav>
</template>

<style scoped>
.pg {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 2px;
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-border-subtle);
}

.pg-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--control-h-sm);
  height: var(--control-h-sm);
  padding: 0 var(--space-2);
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.pg-btn:hover:not(:disabled) {
  background: var(--color-surface-muted);
  color: var(--color-text-strong);
}

.pg-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.pg-btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.pg-num.active {
  background: var(--color-surface-muted);
  color: var(--color-text-strong);
  font-weight: var(--weight-semibold);
}

.pg-dots {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: var(--control-h-sm);
  color: var(--color-text-subtle);
  font-size: var(--text-sm);
  user-select: none;
}
</style>
