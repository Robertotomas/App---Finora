<script setup lang="ts">
/**
 * Barra de progresso padrão (8px, raio total, trilho neutro).
 * `tone` só muda a cor quando há significado (aviso/excesso); por defeito usa o primário.
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    /** Percentagem 0–100 (valores acima são cortados visualmente). */
    value: number
    tone?: 'primary' | 'warning' | 'danger'
    label?: string
  }>(),
  { tone: 'primary' },
)

const width = computed(() => `${Math.max(0, Math.min(100, props.value || 0))}%`)
</script>

<template>
  <div
    class="meter"
    role="progressbar"
    :aria-valuenow="Math.round(value || 0)"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-label="label"
  >
    <div class="meter-fill" :class="`meter-fill--${tone}`" :style="{ width }" />
  </div>
</template>

<style scoped>
.meter {
  width: 100%;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-surface-muted);
  overflow: hidden;
}
.meter-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width var(--transition-slow);
}
.meter-fill--primary { background: var(--color-primary); }
.meter-fill--warning { background: var(--color-warning); }
.meter-fill--danger { background: var(--color-danger); }
</style>
