<script setup lang="ts">
import { useRouter } from 'vue-router'
import UiButton from '@/components/ui/UiButton.vue'

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
    description: 'Atingiu o limite do plano Free. Faça upgrade para dados históricos alargados.',
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
      <div class="upsell-modal" role="dialog" aria-modal="true" aria-labelledby="upsell-modal-title">
        <div class="upsell-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
        </div>

        <h2 id="upsell-modal-title" class="upsell-title">{{ title }}</h2>
        <p class="upsell-desc">{{ description }}</p>

        <div class="upsell-features">
          <span class="upsell-features-title">{{ featuresTitle }}</span>
          <ul>
            <li v-for="(f, i) in features" :key="i">
              <svg class="upsell-check" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span>{{ f }}</span>
            </li>
          </ul>
        </div>

        <div class="upsell-actions">
          <UiButton variant="ghost" @click="emit('close')">Agora não</UiButton>
          <UiButton @click="goToPlans">Ver planos</UiButton>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.upsell-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: var(--color-modal-overlay);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.upsell-modal {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 100%;
  max-width: 420px;
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  padding: var(--space-8) var(--space-6) var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.upsell-icon {
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

.upsell-title {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.upsell-desc {
  margin: var(--space-2) 0 0;
  max-width: 34ch;
  font-size: var(--text-base);
  line-height: 1.5;
  color: var(--color-text-muted);
}

.upsell-features {
  width: 100%;
  margin-top: var(--space-5);
  padding: var(--space-4);
  text-align: left;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.upsell-features-title {
  display: block;
  margin-bottom: var(--space-3);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.upsell-features ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.upsell-features li {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  font-size: var(--text-sm);
  line-height: 1.45;
  color: var(--color-text);
}

.upsell-check {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--color-primary-text);
}

.upsell-actions {
  display: flex;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  margin-top: var(--space-6);
}

.upsell-enter-active,
.upsell-leave-active {
  transition: opacity var(--transition-base);
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
