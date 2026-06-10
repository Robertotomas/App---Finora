<script setup lang="ts">
import { useRouter } from 'vue-router'

withDefaults(
  defineProps<{
    open: boolean
    title?: string
    description?: string
    featuresTitle?: string
    features?: string[]
  }>(),
  {
    title: 'Fazer upgrade do plano',
    description: 'Atingiste o limite do plano Free. Faz upgrade para dados históricos alargados.',
    featuresTitle: 'Incluído no Pro:',
    features: () => [
      'Histórico do património até 5 anos',
      'Objetivos de poupança e relatórios mensais',
      'Transações recorrentes ilimitadas',
    ],
  },
)

const emit = defineEmits<{ close: [] }>()
const router = useRouter()

function goToPlans() {
  emit('close')
  router.push({ name: 'subscricao' })
}
</script>

<template>
  <Transition name="upsell">
    <div v-if="open" class="upsell-overlay" @click.self="emit('close')">
      <div class="upsell-modal" role="dialog" aria-modal="true">
        <div class="upsell-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
        </div>

        <h2 class="upsell-title">{{ title }}</h2>
        <p class="upsell-desc">{{ description }}</p>

        <div class="upsell-features">
          <span class="upsell-features-title">{{ featuresTitle }}</span>
          <ul>
            <li v-for="(f, i) in features" :key="i">
              <svg class="upsell-check" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span>{{ f }}</span>
            </li>
          </ul>
        </div>

        <div class="upsell-actions">
          <button type="button" class="upsell-btn-ghost" @click="emit('close')">Agora não</button>
          <button type="button" class="upsell-btn-primary" @click="goToPlans">Ver planos</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.upsell-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-modal-overlay, rgba(15, 23, 42, 0.5));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
  padding: 1rem;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.upsell-modal {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.6rem;
  width: 100%;
  max-width: 440px;
  padding: 2rem 1.75rem 1.5rem;
  background: var(--color-bg-card, #fff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 18px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.upsell-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  margin-bottom: 0.25rem;
  border-radius: 50%;
  background: rgba(22, 101, 52, 0.1);
  color: #166534;
}

html.dark .upsell-icon {
  background: rgba(74, 222, 128, 0.12);
  color: #4ade80;
}

.upsell-title {
  margin: 0;
  font-size: 1.1875rem;
  font-weight: 700;
  color: var(--color-text);
}

.upsell-desc {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--color-text-muted);
  max-width: 34ch;
}

.upsell-features {
  width: 100%;
  margin-top: 0.75rem;
  padding: 1rem 1.125rem;
  text-align: left;
  background: var(--color-bg, transparent);
  border: 1px solid var(--color-border);
  border-radius: 12px;
}

.upsell-features-title {
  display: block;
  margin-bottom: 0.625rem;
  font-size: 0.8125rem;
  font-weight: 700;
  color: var(--color-text);
}

.upsell-features ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.upsell-features li {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.8125rem;
  line-height: 1.4;
  color: var(--color-text-muted);
}

.upsell-check {
  flex-shrink: 0;
  margin-top: 1px;
  color: #166534;
}

html.dark .upsell-check {
  color: #4ade80;
}

.upsell-actions {
  display: flex;
  gap: 0.625rem;
  margin-top: 1.25rem;
}

.upsell-btn-ghost,
.upsell-btn-primary {
  padding: 0.625rem 1.5rem;
  font-size: 0.875rem;
  font-weight: 650;
  font-family: inherit;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
}

.upsell-btn-ghost {
  background: transparent;
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.upsell-btn-ghost:hover {
  background: var(--color-table-row-hover, rgba(0, 0, 0, 0.04));
}

.upsell-btn-primary {
  background: linear-gradient(135deg, #166534 0%, #15803d 100%);
  color: #fff;
  border: none;
}

.upsell-btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(22, 101, 52, 0.25);
}

.upsell-enter-active,
.upsell-leave-active {
  transition: opacity 0.2s ease;
}
.upsell-enter-from,
.upsell-leave-to {
  opacity: 0;
}
.upsell-enter-active .upsell-modal {
  animation: upsell-in 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes upsell-in {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
</style>
