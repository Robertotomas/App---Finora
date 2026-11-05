<script setup lang="ts">
/** Célula de categoria: ícone com a cor da categoria (categoryMeta) + rótulo + dica opcional por baixo. */
import { computed } from 'vue'
import { categoryColor, categoryIcon } from '@/types/categoryMeta'
import { TRANSACTION_CATEGORY_LABELS, type TransactionCategory } from '@/types/transaction'

/** `iconless`: só o texto (quando o ícone da categoria já aparece ao lado do nome). */
const props = defineProps<{ category: number; hint?: string; label?: string; iconless?: boolean }>()

const color = computed(() => categoryColor(props.category))
const text = computed(() => props.label ?? TRANSACTION_CATEGORY_LABELS[props.category as TransactionCategory] ?? 'Outro')
</script>

<template>
  <span class="cat" :class="{ 'cat--iconless': iconless }">
    <span v-if="!iconless" class="cat-icon" :style="{ color, background: color + '1f' }" aria-hidden="true">
      <!-- eslint-disable-next-line vue/no-v-html -->
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="categoryIcon(category)"></svg>
    </span>
    <span class="cat-text">
      <span class="cat-label">{{ text }}</span>
      <span v-if="hint" class="cat-hint">{{ hint }}</span>
    </span>
  </span>
</template>

<style scoped>
.cat {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.cat-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
}

.cat-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.cat-label {
  color: var(--color-text);
  white-space: nowrap;
}
/* Sem ícone (o ícone está ao lado do nome): texto mais suave, funciona como legenda */
.cat--iconless .cat-label {
  color: var(--color-text-muted);
}

.cat-hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
}
</style>
