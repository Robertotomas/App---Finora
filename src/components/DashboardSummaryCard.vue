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
  background: var(--color-bg-card, #ffffff);
  border-radius: 12px;
  padding: 1.25rem 1.25rem 1.25rem 1.375rem;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
  border: 1px solid var(--color-border, #e2e8f0);
  border-left: 3px solid var(--color-border, #e2e8f0);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
  position: relative;
}

.card:hover {
  box-shadow: var(--app-shadow-card-hover, 0 4px 12px rgba(0, 0, 0, 0.08));
  transform: translateY(-1px);
}

.card-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted, #64748b);
  margin: 0 0 0.625rem 0;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.card-value {
  font-size: 1.625rem;
  font-weight: 700;
  color: var(--color-text, #0f172a);
  margin: 0;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.card-subtitle {
  font-size: 0.6875rem;
  color: var(--color-text-muted, #94a3b8);
  margin: 0.375rem 0 0 0;
  font-weight: 500;
}

/* Colored left accent borders per variant */
.card-income {
  border-left-color: var(--color-income, #059669);
}

.card-income .card-value {
  color: var(--color-income, #059669);
}

.card-expense {
  border-left-color: var(--color-expense, #dc2626);
}

.card-expense .card-value {
  color: var(--color-expense, #dc2626);
}

.card-savings {
  border-left-color: #2563eb;
}

.card-savings .card-value {
  color: #2563eb;
}

html.dark .card-savings .card-value {
  color: #4ade80;
}

html.dark .card-savings {
  border-left-color: #4ade80;
}
</style>
