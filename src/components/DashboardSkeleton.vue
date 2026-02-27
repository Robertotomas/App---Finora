<script setup lang="ts">
defineProps<{
  cards?: number
  showCharts?: boolean
}>()
</script>

<template>
  <div class="skeleton">
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
  gap: 1.5rem;
}

.skeleton-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.skeleton-card {
  background: white;
  border-radius: 12px;
  padding: 1.25rem;
  border: 1px solid #f1f5f9;
}

.skeleton-line {
  height: 12px;
  background: linear-gradient(
    90deg,
    #f1f5f9 25%,
    #e2e8f0 50%,
    #f1f5f9 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.skeleton-line.short {
  width: 60%;
  margin-bottom: 0.5rem;
}

.skeleton-line.long {
  width: 90%;
}

.skeleton-charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.skeleton-chart {
  height: 280px;
  background: white;
  border-radius: 12px;
  border: 1px solid #f1f5f9;
  background: linear-gradient(
    90deg,
    #f8fafc 25%,
    #f1f5f9 50%,
    #f8fafc 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
