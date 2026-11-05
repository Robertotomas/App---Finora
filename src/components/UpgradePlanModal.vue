<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import UiButton from '@/components/ui/UiButton.vue'
import { useSubscriptionStore } from '@/stores/subscription'
import type { SubscriptionPlan } from '@/types/subscription'

const props = defineProps<{
  open: boolean
  reason?: string
}>()

const emit = defineEmits<{
  close: []
  upgraded: [plan: SubscriptionPlan]
}>()

const subscriptionStore = useSubscriptionStore()
const updating = ref(false)

const currentPlan = computed(() => subscriptionStore.plan)

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    if (!subscriptionStore.subscription) {
      try {
        await subscriptionStore.fetchSubscription()
      } catch {
        // handled in store
      }
    }
  },
  { immediate: true },
)

function planTitle(plan: SubscriptionPlan) {
  return plan === 'Free' ? 'Free' : plan === 'Pro' ? 'Pro' : 'Couple'
}

function planSummary(plan: SubscriptionPlan) {
  if (plan === 'Free') return '1 conta, 1 receita/mês, 5 despesas/mês. Sem objetivos.'
  if (plan === 'Pro') return 'Acesso total (sem convites).'
  return 'Acesso total + convites (Partilha).'
}

async function handleChoose(target: SubscriptionPlan) {
  if (updating.value) return
  updating.value = true
  try {
    const updated = await subscriptionStore.upgrade(target)
    emit('upgraded', updated.plan)
    emit('close')
  } finally {
    updating.value = false
  }
}
</script>

<template>
  <BaseModal
    v-if="open"
    title="Atualize o seu plano"
    @close="emit('close')"
  >
    <div class="modal-body">
      <div class="upgrade-intro">
        <div class="upgrade-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 14.5 9.5 21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/></svg>
        </div>
        <p class="reason-text">{{ reason || 'Escolha o plano que melhor se adapta a si.' }}</p>
      </div>

      <div class="plan-list">
        <div class="plan-card" :class="{ 'plan-card--current': currentPlan === 'Free' }">
          <div class="plan-info">
            <div class="plan-name">
              {{ planTitle('Free') }}
              <span v-if="currentPlan === 'Free'" class="ui-badge ui-badge--success">Atual</span>
            </div>
            <div class="plan-summary">{{ planSummary('Free') }}</div>
          </div>
          <UiButton variant="secondary" size="sm" disabled>Atual</UiButton>
        </div>

        <div class="plan-card" :class="{ 'plan-card--current': currentPlan === 'Pro' }">
          <div class="plan-info">
            <div class="plan-name">
              {{ planTitle('Pro') }}
              <span v-if="currentPlan === 'Pro'" class="ui-badge ui-badge--success">Atual</span>
            </div>
            <div class="plan-summary">{{ planSummary('Pro') }}</div>
          </div>
          <UiButton size="sm" :disabled="updating" @click="handleChoose('Pro')">
            {{ currentPlan === 'Pro' ? 'Selecionado' : 'Escolher Pro' }}
          </UiButton>
        </div>

        <div class="plan-card plan-card--featured" :class="{ 'plan-card--current': currentPlan === 'Couple' }">
          <div class="plan-info">
            <div class="plan-name">
              {{ planTitle('Couple') }}
              <span v-if="currentPlan === 'Couple'" class="ui-badge ui-badge--success">Atual</span>
              <span v-else class="ui-badge ui-badge--brand">Recomendado</span>
            </div>
            <div class="plan-summary">{{ planSummary('Couple') }}</div>
          </div>
          <UiButton size="sm" :disabled="updating" @click="handleChoose('Couple')">
            {{ currentPlan === 'Couple' ? 'Selecionado' : 'Escolher Couple' }}
          </UiButton>
        </div>
      </div>

      <p v-if="subscriptionStore.error" class="error-text" role="alert">
        {{ subscriptionStore.error }}
      </p>
    </div>
  </BaseModal>
</template>

<style scoped>
.modal-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.upgrade-intro {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.upgrade-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--color-primary-soft);
  color: var(--color-primary-text);
}

.reason-text {
  margin: 0;
  font-size: var(--text-base);
  line-height: 1.5;
  color: var(--color-text-muted);
}

.plan-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.plan-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.plan-card--featured {
  background: var(--color-surface);
  border: 2px solid var(--color-primary);
  padding: calc(var(--space-3) - 2px) calc(var(--space-4) - 2px);
}

.plan-card--current {
  background: var(--color-surface);
}

.plan-info {
  min-width: 0;
}

.plan-name {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.plan-summary {
  margin-top: 2px;
  font-size: var(--text-sm);
  line-height: 1.4;
  color: var(--color-text-muted);
}

.error-text {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-danger);
}
</style>
