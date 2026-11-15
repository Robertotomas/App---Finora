<script setup lang="ts">
defineProps<{
  cards?: number
  showCharts?: boolean
}>()
</script>

<template>
  <div class="skeleton" role="status" aria-live="polite" aria-label="A carregar">
    <div class="skeleton-cards">
      <div
        v-for="i in (cards ?? 4)"
        :key="i"
        class="skeleton-card"
      >
        <div class="skeleton-line short"></div>
        <div class="skeleton-line long"></div>
      </div>
    </div>
    <div v-if="showCharts" class="skeleton-charts">
      <div class="skeleton-chart"></div>
      <div class="skeleton-chart"></div>
    </div>
  </div>
</template>

<style scoped>
.skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.skeleton-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr));
  gap: var(--space-5);
}

.skeleton-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xs);
  padding: var(--space-5);
}

.skeleton-line,
.skeleton-chart {
  background: linear-gradient(
    90deg,
    var(--color-surface-muted) 0%,
    var(--color-surface-2) 50%,
    var(--color-surface-muted) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

.skeleton-line {
  height: 12px;
  border-radius: var(--radius-full);
}

.skeleton-line.short {
  width: 60%;
  margin-bottom: var(--space-2);
}

.skeleton-line.long {
  width: 90%;
}

.skeleton-charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
  gap: var(--space-5);
}

.skeleton-chart {
  height: 280px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
}

@keyframes shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-line,
  .skeleton-chart {
    animation: none;
  }
}
</style>
