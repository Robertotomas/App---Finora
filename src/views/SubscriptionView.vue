<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSubscriptionStore } from '@/stores/subscription'
import type { SubscriptionPlan } from '@/types/subscription'

const subscriptionStore = useSubscriptionStore()
const upgrading = ref<SubscriptionPlan | null>(null)

const planCards = [
  {
    plan: 'Free' as SubscriptionPlan,
    title: 'Free',
    price: '0 EUR',
    period: '/ mês',
    description: 'Ideal para começar e experimentar.',
    features: [
      'Até 1 conta',
      '1 receita por mês',
      'Até 5 despesas por mês',
      'Objetivos bloqueados',
    ],
  },
  {
    plan: 'Pro' as SubscriptionPlan,
    title: 'Pro',
    price: '7.99 EUR',
    period: '/ mês',
    description: 'Acesso completo para gestão individual.',
    features: [
      'Contas e transações sem limites',
      'Objetivos de poupança ativos',
      'Dashboard completo',
      'Sem convite de parceiro',
    ],
  },
  {
    plan: 'Couple' as SubscriptionPlan,
    title: 'Couple',
    price: '12.99 EUR',
    period: '/ mês',
    description: 'Tudo do Pro com colaboração em casal.',
    features: [
      'Tudo incluído do plano Pro',
      'Convidar 1 pessoa para o household',
      'Partilha de contas e movimentos',
      'Visão conjunta do orçamento',
    ],
    popular: true,
  },
]

const currentPlan = computed(() => subscriptionStore.plan)

function buttonLabel(plan: SubscriptionPlan): string {
  if (plan === currentPlan.value) return 'O seu plano atual'
  return `Atualizar para ${plan}`
}

async function choosePlan(plan: SubscriptionPlan) {
  if (plan === currentPlan.value || upgrading.value) return
  upgrading.value = plan
  try {
    await subscriptionStore.upgrade(plan)
  } finally {
    upgrading.value = null
  }
}

onMounted(async () => {
  if (!subscriptionStore.subscription) {
    try {
      await subscriptionStore.fetchSubscription()
    } catch {
      // store handles message
    }
  }
})
</script>

<template>
  <div class="subscription-view">
    <div class="page-header">
      <h1>{{ currentPlan === 'Free' ? 'Atualizar plano' : 'Gerir plano' }}</h1>
      <p class="subtitle">
        Escolhe o plano que melhor se ajusta ao teu uso.
      </p>
    </div>

    <div v-if="subscriptionStore.error" class="global-error">
      {{ subscriptionStore.error }}
    </div>

    <div class="plans-grid">
      <article
        v-for="card in planCards"
        :key="card.plan"
        class="plan-card"
        :class="{ active: currentPlan === card.plan, popular: card.popular }"
      >
        <header class="plan-header">
          <div>
            <h2>{{ card.title }}</h2>
            <p class="plan-price">
              <span class="plan-price-value">{{ card.price }}</span>
              <span class="plan-price-period">{{ card.period }}</span>
            </p>
          </div>
          <div class="plan-tags">
            <span v-if="card.popular" class="plan-badge plan-badge-popular">Popular</span>
            <span v-if="currentPlan === card.plan" class="plan-badge">Atual</span>
          </div>
        </header>
        <p class="plan-description">{{ card.description }}</p>
        <ul class="plan-features">
          <li v-for="feature in card.features" :key="feature">{{ feature }}</li>
        </ul>
        <button
          type="button"
          class="btn-plan"
          :disabled="currentPlan === card.plan || upgrading !== null"
          @click="choosePlan(card.plan)"
        >
          {{ upgrading === card.plan ? 'A atualizar...' : buttonLabel(card.plan) }}
        </button>
      </article>
    </div>
  </div>
</template>

<style scoped>
.subscription-view {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 0 2rem;
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.plan-card {
  background: linear-gradient(180deg, #1a1a1d 0%, #111315 100%);
  border: 1px solid #2a2a2f;
  border-radius: 16px;
  padding: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  color: #f1f5f9;
}

.plan-card.active {
  border-color: #4f46e5;
  box-shadow: 0 0 0 1px rgba(79, 70, 229, 0.35);
}

.plan-card.popular {
  background: radial-gradient(120% 100% at 0% 0%, rgba(79, 70, 229, 0.35) 0%, #161722 52%, #111315 100%);
}

.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.plan-header h2 {
  margin: 0;
  font-size: 1.2rem;
  color: #f8fafc;
}

.plan-badge {
  font-size: 0.7rem;
  font-weight: 700;
  color: #a7f3d0;
  border: 1px solid rgba(167, 243, 208, 0.4);
  border-radius: 999px;
  padding: 0.2rem 0.5rem;
}

.plan-badge-popular {
  color: #ddd6fe;
  border-color: rgba(196, 181, 253, 0.5);
}

.plan-tags {
  display: flex;
  gap: 0.3rem;
}

.plan-price {
  margin: 0.3rem 0 0;
}

.plan-price-value {
  font-size: 1.7rem;
  font-weight: 750;
  color: #ffffff;
}

.plan-price-period {
  margin-left: 0.35rem;
  font-size: 0.82rem;
  color: #cbd5e1;
}

.plan-description {
  margin: 0;
  color: #cbd5e1;
  font-size: 0.88rem;
  line-height: 1.4;
}

.plan-features {
  margin: 0;
  padding-left: 1.05rem;
  display: flex;
  flex-direction: column;
  gap: 0.36rem;
  color: #e2e8f0;
  font-size: 0.84rem;
  line-height: 1.35;
}

.btn-plan {
  margin-top: auto;
  border: none;
  border-radius: 999px;
  padding: 0.68rem 0.95rem;
  background: #4f46e5;
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}

.btn-plan:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.global-error {
  margin-bottom: 1rem;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}
</style>

