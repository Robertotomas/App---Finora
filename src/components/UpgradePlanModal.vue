<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseModal from './BaseModal.vue'
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
    title="Atualiza o teu plano"
    @close="emit('close')"
  >
    <div class="modal-body">
      <p v-if="reason" class="reason-text">{{ reason }}</p>
      <div class="plan-grid">
        <div class="plan-card">
          <div class="plan-name">
            {{ planTitle('Free') }}
          </div>
          <div class="plan-desc">{{ planSummary('Free') }}</div>
          <div class="plan-badge" :class="{ active: currentPlan === 'Free' }">
            {{ currentPlan === 'Free' ? 'Atual' : '—' }}
          </div>
          <button type="button" class="btn-disabled" disabled>
            Atual
          </button>
        </div>

        <div class="plan-card">
          <div class="plan-name">
            {{ planTitle('Pro') }}
          </div>
          <div class="plan-desc">{{ planSummary('Pro') }}</div>
          <div class="plan-badge" :class="{ active: currentPlan === 'Pro' }">
            {{ currentPlan === 'Pro' ? 'Atual' : '—' }}
          </div>
          <button type="button" class="btn-primary" :disabled="updating" @click="handleChoose('Pro')">
            {{ currentPlan === 'Pro' ? 'Selecionado' : 'Escolher Pro' }}
          </button>
        </div>

        <div class="plan-card">
          <div class="plan-name">
            {{ planTitle('Couple') }}
          </div>
          <div class="plan-desc">{{ planSummary('Couple') }}</div>
          <div class="plan-badge" :class="{ active: currentPlan === 'Couple' }">
            {{ currentPlan === 'Couple' ? 'Atual' : '—' }}
          </div>
          <button type="button" class="btn-primary btn-couple" :disabled="updating" @click="handleChoose('Couple')">
            {{ currentPlan === 'Couple' ? 'Selecionado' : 'Escolher Couple' }}
          </button>
        </div>
      </div>

      <p v-if="subscriptionStore.error" class="error-text">
        {{ subscriptionStore.error }}
      </p>
    </div>
  </BaseModal>
</template>

<style scoped>
.modal-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.reason-text {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.plan-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.8rem;
}

@media (min-width: 640px) {
  .plan-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.plan-card {
  border: 1px solid var(--color-border);
  background: var(--color-bg);
  border-radius: 12px;
  padding: 0.85rem 0.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.plan-name {
  font-weight: 750;
  color: var(--color-text);
}

.plan-desc {
  font-size: 0.82rem;
  color: var(--color-text-muted);
  line-height: 1.3;
  min-height: 2.4em;
}

.plan-badge {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.plan-badge.active {
  color: #059669;
  font-weight: 700;
}

.btn-primary {
  background: #166534;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 0.6rem 0.7rem;
  font-weight: 650;
  cursor: pointer;
}

.btn-couple {
  background: #0f766e;
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-disabled {
  background: transparent;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 0.6rem 0.7rem;
  font-weight: 650;
}

.error-text {
  margin: 0;
  color: var(--color-error);
  font-size: 0.85rem;
}
</style>

