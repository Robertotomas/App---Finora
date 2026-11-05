<script setup lang="ts">
// Receitas: todas as categorias partilham a cor do grupo "Rendimentos" → usar a paleta categórica.
import type { IncomeByCategory } from '@/types/dashboard'
import CategoryDoughnut from './CategoryDoughnut.vue'

defineProps<{
  data: IncomeByCategory[]
}>()
</script>

<template>
  <div class="chart-container">
    <CategoryDoughnut v-if="data.length > 0" :items="data" color-mode="series" />
    <div v-else class="chart-empty">Sem dados para mostrar</div>
  </div>
</template>

<style scoped>
.chart-container {
  min-height: 200px;
  position: relative;
}

.chart-empty {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
</style>
