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
    <div class="upsell-card-icon">
      <slot name="icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 14.5 9.5 21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></svg>
      </slot>
    </div>

    <p class="upsell-card-title">{{ title }}</p>
    <p class="upsell-card-text">{{ description }}</p>

    <ul class="upsell-card-features">
      <li v-for="(f, i) in features" :key="i">
        <svg class="upsell-card-check" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
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
  gap: 0.6rem;
  max-width: 460px;
  margin: 2.5rem auto;
  padding: 2.25rem 2rem;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 16px;
}

.upsell-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  margin-bottom: 0.25rem;
  border-radius: 12px;
  background: rgba(22, 101, 52, 0.1);
  color: #166534;
}

html.dark .upsell-card-icon {
  background: rgba(74, 222, 128, 0.12);
  color: #4ade80;
}

.upsell-card-title {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--color-text);
}

.upsell-card-text {
  margin: 0 0 0.5rem;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--color-text-muted);
  max-width: 36ch;
}

.upsell-card-features {
  list-style: none;
  margin: 0 0 0.5rem;
  padding: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.upsell-card-features li {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  text-align: left;
  font-size: 0.8438rem;
  line-height: 1.4;
  color: var(--color-text-muted);
}

.upsell-card-check {
  flex-shrink: 0;
  margin-top: 1px;
  color: #166534;
}

html.dark .upsell-card-check {
  color: #4ade80;
}

.upsell-card-cta {
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.75rem 1.125rem;
  text-align: center;
  background: linear-gradient(135deg, #166534 0%, #15803d 100%);
  color: #fff;
  font-size: 0.9375rem;
  font-weight: 650;
  border-radius: 12px;
  text-decoration: none;
  transition: transform 0.15s, box-shadow 0.15s;
}

.upsell-card-cta:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(22, 101, 52, 0.25);
}
</style>
