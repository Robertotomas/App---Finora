<script setup lang="ts">
/**
 * Ícone à esquerda do nome de um movimento/recorrente — está SEMPRE presente (nomes alinhados):
 * logo da marca quando é conhecida (Spotify, NET…), senão o ícone da categoria no quadrado colorido
 * (padrão Revolut/Monzo/N26). A coluna Categoria fica só com o texto, para não repetir o ícone.
 */
import { computed } from 'vue'
import BrandLogo from '@/components/BrandLogo.vue'
import { categoryColor, categoryIcon } from '@/types/categoryMeta'

const props = withDefaults(defineProps<{ name?: string | null; category: number; size?: number }>(), { name: '', size: 28 })
const color = computed(() => categoryColor(props.category))
</script>

<template>
  <BrandLogo :name="name" :size="size" class="tx-avatar">
    <template #fallback>
      <span
        class="tx-avatar-cat"
        :style="{ color, background: color + '1f', width: size + 'px', height: size + 'px' }"
        aria-hidden="true"
      >
        <!-- eslint-disable-next-line vue/no-v-html -->
        <svg xmlns="http://www.w3.org/2000/svg" :width="Math.round(size * 0.52)" :height="Math.round(size * 0.52)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="categoryIcon(category)"></svg>
      </span>
    </template>
  </BrandLogo>
</template>

<style scoped>
.tx-avatar {
  border-radius: var(--radius-sm);
}
.tx-avatar-cat {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
}
</style>
