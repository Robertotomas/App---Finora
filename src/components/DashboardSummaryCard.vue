<script setup lang="ts">
defineProps<{
  title: string
  value: string
  subtitle?: string
  variant?: 'default' | 'income' | 'expense' | 'savings'
}>()
</script>

<template>
  <div class="card" :class="[variant && `card-${variant}`]">
    <p class="card-title">{{ title }}</p>
    <p class="card-value">{{ value }}</p>
    <p v-if="subtitle" class="card-subtitle">{{ subtitle }}</p>
  </div>
</template>

<style scoped>
.card {
  background: white;
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  border: 1px solid #f1f5f9;
}

.card-title {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #64748b;
  margin: 0 0 0.5rem 0;
}

.card-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.card-subtitle {
  font-size: 0.75rem;
  color: #94a3b8;
  margin: 0.25rem 0 0 0;
}

.card-income .card-value {
  color: #059669;
}

.card-expense .card-value {
  color: #dc2626;
}

.card-savings .card-value {
  color: #2563eb;
}
</style>
