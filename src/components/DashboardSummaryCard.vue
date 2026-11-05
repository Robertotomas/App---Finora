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
    <p class="card-title"><span class="card-dot" aria-hidden="true" />{{ title }}</p>
    <p class="card-value">{{ value }}</p>
    <p v-if="subtitle" class="card-subtitle">{{ subtitle }}</p>
  </div>
</template>

<style scoped>
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xs);
  padding: var(--space-5);
  min-width: 0;
}

.card-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 var(--space-2);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--color-text-muted);
}

.card-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-subtle);
}

.card-value {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--weight-bold);
  line-height: 1.2;
  letter-spacing: var(--tracking-tight);
  color: var(--color-text-strong);
  font-variant-numeric: tabular-nums;
}

.card-subtitle {
  margin: var(--space-1) 0 0;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.card-income .card-dot { background: var(--color-income); }
.card-income .card-value { color: var(--color-income); }
.card-expense .card-dot { background: var(--color-expense); }
.card-expense .card-value { color: var(--color-expense); }
.card-savings .card-dot { background: var(--color-primary-text); }
</style>
