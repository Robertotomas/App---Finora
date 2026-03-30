<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSubscriptionStore } from '@/stores/subscription'
import type { SubscriptionPlan } from '@/types/subscription'

const subscriptionStore = useSubscriptionStore()
const upgrading = ref<SubscriptionPlan | null>(null)

// Couple flow: pedir email antes de confirmar o upgrade
const coupleInviteOpen = ref(false)
const coupleInviteEmail = ref('')
const coupleInviteError = ref('')
const coupleInviteLoading = ref(false)

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
  if (plan === 'Couple') {
    coupleInviteError.value = ''
    coupleInviteEmail.value = ''
    coupleInviteOpen.value = true
    return
  }
  upgrading.value = plan
  try {
    await subscriptionStore.upgrade(plan)
    // Garante limites (ex.: objectivesEnabled) alinhados com o servidor antes de navegar para Objetivos/Dashboard.
    await subscriptionStore.fetchSubscription()
  } finally {
    upgrading.value = null
  }
}

function isValidEmail(email: string): boolean {
  // Regex simples (UI). A validação final é sempre do backend.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function confirmCoupleInvite() {
  coupleInviteError.value = ''
  const email = coupleInviteEmail.value.trim()
  if (!email) {
    coupleInviteError.value = 'Indica um email válido para o convite.'
    return
  }
  if (!isValidEmail(email)) {
    coupleInviteError.value = 'O email do convite parece inválido.'
    return
  }

  coupleInviteLoading.value = true
  try {
    // API atual não tem endpoint de convite; o que fazemos aqui é: upgrade para Couple.
    // O envio do convite pode ser implementado mais tarde via backend.
    upgrading.value = 'Couple'
    await subscriptionStore.upgrade('Couple')
    await subscriptionStore.fetchSubscription()
    coupleInviteOpen.value = false
  } finally {
    upgrading.value = null
    coupleInviteLoading.value = false
  }
}

function cancelCoupleInvite() {
  coupleInviteOpen.value = false
  coupleInviteError.value = ''
  coupleInviteEmail.value = ''
  coupleInviteLoading.value = false
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

    <div
      v-if="coupleInviteOpen"
      class="couple-invite-overlay"
      role="dialog"
      aria-modal="true"
      @click.self="cancelCoupleInvite"
    >
      <div class="couple-invite-modal">
        <h2 class="couple-invite-title">Enviar convite para Couple</h2>
        <p class="couple-invite-text">
          Introduz o email da pessoa que queres convidar. Depois de confirmares, vamos atualizar o teu plano para
          <strong>Couple</strong>.
        </p>

        <label class="field">
          <span class="field-label">Email do convidado</span>
          <input
            v-model="coupleInviteEmail"
            type="email"
            class="field-input"
            placeholder="email@exemplo.com"
            autocomplete="email"
            :disabled="coupleInviteLoading"
          />
        </label>

        <p v-if="coupleInviteError" class="couple-invite-error">{{ coupleInviteError }}</p>

        <div class="couple-invite-actions">
          <button
            type="button"
            class="btn-secondary"
            :disabled="coupleInviteLoading"
            @click="cancelCoupleInvite"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="btn-plan"
            :disabled="coupleInviteLoading"
            @click="confirmCoupleInvite"
          >
            {{ coupleInviteLoading ? 'A confirmar…' : 'Confirmar' }}
          </button>
        </div>
      </div>
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
          :disabled="currentPlan === card.plan || upgrading !== null || coupleInviteOpen"
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

.couple-invite-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}

.couple-invite-modal {
  width: 100%;
  max-width: 460px;
  background: linear-gradient(180deg, #1a1a1d 0%, #111315 100%);
  border: 1px solid #2a2a2f;
  border-radius: 16px;
  padding: 1.25rem;
  color: #f1f5f9;
}

.couple-invite-title {
  margin: 0 0 0.65rem 0;
  font-size: 1.1rem;
  font-weight: 750;
  color: #fff;
}

.couple-invite-text {
  margin: 0 0 1rem 0;
  color: #cbd5e1;
  font-size: 0.9rem;
  line-height: 1.45;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.85rem;
}

.field-label {
  font-size: 0.8125rem;
  font-weight: 650;
  color: #cbd5e1;
}

.field-input {
  padding: 0.6rem 0.8rem;
  border: 1px solid #2a2a2f;
  border-radius: 10px;
  background: #0f1013;
  color: #f8fafc;
  outline: none;
}

.field-input:disabled {
  opacity: 0.7;
}

.couple-invite-error {
  margin: -0.2rem 0 0.9rem 0;
  color: #fecaca;
  font-size: 0.875rem;
}

.couple-invite-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.btn-secondary {
  border: 1px solid #2a2a2f;
  border-radius: 999px;
  padding: 0.68rem 0.95rem;
  background: transparent;
  color: #e2e8f0;
  font-weight: 700;
  cursor: pointer;
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>

