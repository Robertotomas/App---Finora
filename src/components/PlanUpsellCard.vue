<script setup lang="ts">
defineProps<{
  title: string
  description: string
  features: string[]
  /** Texto do botão (default "Ver planos"). */
  ctaLabel?: string
}>()
</script>

<template>
  <div class="upsell-card">
    <div class="upsell-card-icon" aria-hidden="true">
      <slot name="icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 14.5 9.5 21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></svg>
      </slot>
    </div>

    <h2 class="upsell-card-title">{{ title }}</h2>
    <p class="upsell-card-text">{{ description }}</p>

    <ul class="upsell-card-features">
      <li v-for="(f, i) in features" :key="i">
        <svg class="upsell-card-check" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        <span>{{ f }}</span>
      </li>
    </ul>

    <router-link :to="{ name: 'subscricao' }" class="upsell-card-cta">{{ ctaLabel ?? 'Ver planos' }}</router-link>
  </div>
</template>

<style scoped>
.upsell-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 440px;
  margin: var(--space-10) auto;
  padding: var(--space-8) var(--space-6) var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.upsell-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin-bottom: var(--space-4);
  border-radius: 50%;
  background: var(--color-primary-soft);
  color: var(--color-primary-text);
}

.upsell-card-title {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.upsell-card-text {
  margin: var(--space-2) 0 0;
  max-width: 36ch;
  font-size: var(--text-base);
  line-height: 1.5;
  color: var(--color-text-muted);
}

.upsell-card-features {
  list-style: none;
  width: 100%;
  margin: var(--space-5) 0 0;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.upsell-card-features li {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  text-align: left;
  font-size: var(--text-sm);
  line-height: 1.45;
  color: var(--color-text);
}

.upsell-card-check {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--color-primary-text);
}

/* Link com o aspeto do UiButton primário (bloco) */
.upsell-card-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: var(--control-h);
  margin-top: var(--space-5);
  padding: 0 var(--space-4);
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-on-primary);
  background: var(--color-primary);
  border-radius: var(--radius-sm);
  text-decoration: none;
  transition: background var(--transition-fast);
}

.upsell-card-cta:hover {
  background: var(--color-primary-hover);
}

.upsell-card-cta:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
</style>
