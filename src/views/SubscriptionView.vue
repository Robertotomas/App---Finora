<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSubscriptionStore } from '@/stores/subscription'
import type { SubscriptionPlan } from '@/types/subscription'
import { coupleInvitationsApi } from '@/api/coupleInvitations'
import { useAuthStore } from '@/stores/auth'
import { userFromProfileResponse } from '@/types/auth'
import { useHouseholdStore } from '@/stores/household'

const router = useRouter()
const subscriptionStore = useSubscriptionStore()
const authStore = useAuthStore()
const householdStore = useHouseholdStore()
const upgrading = ref<SubscriptionPlan | null>(null)

// Couple flow: pedir email antes de confirmar o upgrade
const coupleInviteOpen = ref(false)
const coupleInviteEmail = ref('')
const coupleInviteError = ref('')
const coupleInviteLoading = ref(false)

const partnerOtp = ref('')
const partnerMigratePersonalData = ref(true)
const partnerOtpError = ref('')
const partnerOtpSuccess = ref('')
const partnerOtpLoading = ref(false)

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
  const wasCouple = currentPlan.value === 'Couple'
  upgrading.value = plan
  try {
    await subscriptionStore.upgrade(plan)
    // Garante limites (ex.: objectivesEnabled) alinhados com o servidor antes de navegar para Objetivos/Dashboard.
    await subscriptionStore.fetchSubscription()
    if (wasCouple && (plan === 'Free' || plan === 'Pro')) {
      try {
        await householdStore.fetchHousehold()
      } catch {
        /* household pode falhar brevemente; o redirect atualiza a vista na mesma */
      }
      await router.push({ name: 'household-settings' })
    }
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
    await coupleInvitationsApi.create(email)
    await subscriptionStore.fetchSubscription()
    try {
      await householdStore.fetchHousehold()
    } catch {
      // opcional: household pode ainda não estar em cache
    }
    coupleInviteOpen.value = false
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } }
    coupleInviteError.value = err.response?.data?.message ?? 'Não foi possível enviar o convite.'
  } finally {
    coupleInviteLoading.value = false
  }
}

async function submitPartnerOtp() {
  partnerOtpError.value = ''
  partnerOtpSuccess.value = ''
  const code = partnerOtp.value.trim().replace(/\s/g, '')
  if (code.length !== 6 || !/^\d{6}$/.test(code)) {
    partnerOtpError.value = 'Indica o código de 6 dígitos enviado por email.'
    return
  }
  partnerOtpLoading.value = true
  try {
    const { data } = await coupleInvitationsApi.verifyOtp(code, partnerMigratePersonalData.value)
    partnerOtp.value = ''
    authStore.setAuth(data.accessToken, userFromProfileResponse(data.user))
    partnerOtpSuccess.value = 'Conta associada ao agregado do convite.'
    await Promise.all([subscriptionStore.fetchSubscription(), householdStore.fetchHousehold()])
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } }
    partnerOtpError.value = err.response?.data?.message ?? 'Código inválido ou expirado.'
  } finally {
    partnerOtpLoading.value = false
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
          Introduz o email da pessoa que queres convidar. O plano <strong>Couple</strong> só é ativado depois de o
          convite ser enviado com sucesso.
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

    <div class="partner-otp-card">
      <h2 class="partner-otp-title">Aceitar convite (conta existente)</h2>
      <p class="partner-otp-text">
        Se recebeste um código por email para te juntares ao agregado de outra pessoa, introduz-o aqui (depois de iniciares sessão com o mesmo email).
      </p>
      <label class="partner-otp-migrate">
        <input v-model="partnerMigratePersonalData" type="checkbox" :disabled="partnerOtpLoading" />
        <span>
          Levar os meus dados (contas, movimentos, recorrentes e objetivos) para o agregado do convite.
          Se desmarcares, o teu agregado atual tem de estar vazio (sem contas nem movimentos).
        </span>
      </label>
      <div class="partner-otp-row">
        <input
          v-model="partnerOtp"
          type="text"
          inputmode="numeric"
          maxlength="6"
          class="partner-otp-input"
          placeholder="000000"
          :disabled="partnerOtpLoading"
          aria-label="Código de 6 dígitos"
        />
        <button
          type="button"
          class="btn-plan"
          :disabled="partnerOtpLoading"
          @click="submitPartnerOtp"
        >
          {{ partnerOtpLoading ? 'A validar…' : 'Validar código' }}
        </button>
      </div>
      <p v-if="partnerOtpError" class="partner-otp-msg partner-otp-msg-error">{{ partnerOtpError }}</p>
      <p v-if="partnerOtpSuccess" class="partner-otp-msg partner-otp-msg-ok">{{ partnerOtpSuccess }}</p>
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

.partner-otp-card {
  margin-bottom: 1.5rem;
  padding: 1rem 1.1rem;
  border-radius: 14px;
  border: 1px solid #2a2a2f;
  background: rgba(15, 23, 42, 0.35);
  color: #e2e8f0;
}

.partner-otp-title {
  margin: 0 0 0.5rem 0;
  font-size: 1rem;
  font-weight: 750;
  color: #f8fafc;
}

.partner-otp-text {
  margin: 0 0 0.85rem 0;
  font-size: 0.86rem;
  color: #94a3b8;
  line-height: 1.45;
}

.partner-otp-migrate {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  margin: 0 0 0.85rem 0;
  font-size: 0.82rem;
  line-height: 1.45;
  color: #cbd5e1;
  cursor: pointer;
}

.partner-otp-migrate input {
  margin-top: 0.2rem;
  flex-shrink: 0;
}

.partner-otp-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: center;
}

.partner-otp-input {
  letter-spacing: 0.2em;
  font-size: 1.1rem;
  padding: 0.55rem 0.75rem;
  border-radius: 10px;
  border: 1px solid #2a2a2f;
  background: #0f1013;
  color: #f8fafc;
  width: 8rem;
}

.partner-otp-msg {
  margin: 0.65rem 0 0 0;
  font-size: 0.86rem;
}

.partner-otp-msg-error {
  color: #fecaca;
}

.partner-otp-msg-ok {
  color: #a7f3d0;
}
</style>

