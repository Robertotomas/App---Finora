<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSubscriptionStore } from '@/stores/subscription'
import type { SubscriptionPlan } from '@/types/subscription'
import { coupleInvitationsApi } from '@/api/coupleInvitations'
import { useAuthStore } from '@/stores/auth'
import { userFromProfileResponse } from '@/types/auth'
import { useHouseholdStore } from '@/stores/household'
import { useNotificationStore } from '@/stores/notifications'

const router = useRouter()
const subscriptionStore = useSubscriptionStore()
const authStore = useAuthStore()
const householdStore = useHouseholdStore()
const notificationStore = useNotificationStore()
const upgrading = ref<SubscriptionPlan | null>(null)

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
    subtitle: 'Para começar',
    price: '0€',
    period: '/mês',
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
    subtitle: 'Gestão individual completa',
    price: '7,99€',
    period: '/mês',
    features: [
      'Contas e transações sem limites',
      'Objetivos de poupança ativos',
      'Dashboard completo',
      'Relatórios mensais',
    ],
  },
  {
    plan: 'Couple' as SubscriptionPlan,
    title: 'Couple',
    subtitle: 'Finanças a dois, juntos',
    price: '12,99€',
    period: '/mês',
    preamble: 'Tudo do plano Pro, mais:',
    features: [
      'Convidar 1 pessoa para o household',
      'Partilha de contas e movimentos',
      'Visão conjunta do orçamento',
      'Relatórios partilhados',
    ],
    highlight: true,
  },
]

const currentPlan = computed(() => subscriptionStore.plan)

function buttonLabel(plan: SubscriptionPlan): string {
  if (plan === currentPlan.value) return 'Plano atual'
  return `Fazer upgrade para ${plan}`
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
    await subscriptionStore.fetchSubscription()
    if (wasCouple && (plan === 'Free' || plan === 'Pro')) {
      try {
        await householdStore.fetchHousehold()
      } catch { /* */ }
      await router.push({ name: 'agregado' })
    }
  } finally {
    upgrading.value = null
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function confirmCoupleInvite() {
  coupleInviteError.value = ''
  const email = coupleInviteEmail.value.trim()
  if (!email) { coupleInviteError.value = 'Indica um email válido para o convite.'; return }
  if (!isValidEmail(email)) { coupleInviteError.value = 'O email do convite parece inválido.'; return }
  coupleInviteLoading.value = true
  try {
    await coupleInvitationsApi.create(email)
    await subscriptionStore.fetchSubscription()
    try { await householdStore.fetchHousehold() } catch { /* */ }
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
    await Promise.all([subscriptionStore.fetchSubscription(), householdStore.fetchHousehold(), notificationStore.fetchUnreadCount()])
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
    try { await subscriptionStore.fetchSubscription() } catch { /* */ }
  }
})
</script>

<template>
  <div class="sub-page">
    <!-- Top bar -->
    <header class="top-bar">
      <button type="button" class="btn-back" @click="router.push('/inicio')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
      </button>
    </header>

    <!-- Hero -->
    <div class="hero">
      <h1 class="hero-title">Planos que crescem contigo</h1>
    </div>

    <div v-if="subscriptionStore.error" class="banner banner--error">{{ subscriptionStore.error }}</div>

    <!-- Partner OTP section -->
    <section class="otp-card">
      <div class="otp-left">
        <div class="otp-icon-wrap">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
        </div>
        <div>
          <h2 class="otp-title">Aceitar convite</h2>
          <p class="otp-text">Já tinhas conta e recebeste um código por email? Introduz-o para te juntares ao agregado.</p>
        </div>
      </div>
      <div class="otp-right">
        <div class="otp-row">
          <input
            v-model="partnerOtp"
            type="text"
            inputmode="numeric"
            maxlength="6"
            class="otp-input"
            placeholder="000000"
            :disabled="partnerOtpLoading"
            aria-label="Código de 6 dígitos"
          />
          <button type="button" class="btn-primary" :disabled="partnerOtpLoading" @click="submitPartnerOtp">
            {{ partnerOtpLoading ? 'A validar…' : 'Validar' }}
          </button>
        </div>
        <label class="otp-migrate">
          <input v-model="partnerMigratePersonalData" type="checkbox" :disabled="partnerOtpLoading" />
          <span>Levar os meus dados para o agregado</span>
        </label>
        <p v-if="partnerOtpError" class="otp-msg otp-msg--error">{{ partnerOtpError }}</p>
        <p v-if="partnerOtpSuccess" class="otp-msg otp-msg--ok">{{ partnerOtpSuccess }}</p>
      </div>
    </section>

    <!-- Couple invite modal -->
    <div
      v-if="coupleInviteOpen"
      class="modal-overlay"
      role="dialog"
      aria-modal="true"
      @click.self="cancelCoupleInvite"
    >
      <div class="modal-card">
        <h2 class="modal-title">Enviar convite para Couple</h2>
        <p class="modal-text">
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
        <p v-if="coupleInviteError" class="field-error">{{ coupleInviteError }}</p>
        <div class="modal-actions">
          <button type="button" class="btn-secondary" :disabled="coupleInviteLoading" @click="cancelCoupleInvite">Cancelar</button>
          <button type="button" class="btn-primary" :disabled="coupleInviteLoading" @click="confirmCoupleInvite">
            {{ coupleInviteLoading ? 'A confirmar…' : 'Confirmar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Plans grid -->
    <div class="plans-grid">
      <article
        v-for="card in planCards"
        :key="card.plan"
        class="plan-card"
        :class="{ 'plan-card--highlight': card.highlight }"
      >
        <div class="plan-body">
          <h2 class="plan-name">{{ card.title }}</h2>
          <p class="plan-subtitle">{{ card.subtitle }}</p>
          <p class="plan-price">
            <span class="plan-price-value">{{ card.price }}</span>
            <span class="plan-price-period">{{ card.period }}</span>
          </p>
          <p v-if="card.preamble" class="plan-preamble">{{ card.preamble }}</p>
          <ul class="plan-features">
            <li v-for="feature in card.features" :key="feature">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              {{ feature }}
            </li>
          </ul>
        </div>
        <button
          type="button"
          class="btn-plan"
          :class="{ 'btn-plan--current': currentPlan === card.plan, 'btn-plan--upgrade': currentPlan !== card.plan }"
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
.sub-page {
  min-height: 100vh;
  background: var(--color-bg);
  color: var(--color-text);
}

/* ── Top bar ── */
.top-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  height: 52px;
  padding: 0 1.5rem;
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
}

.btn-back {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color 0.15s;
}

.btn-back:hover {
  color: var(--color-text);
}

/* ── Hero ── */
.hero {
  text-align: center;
  padding: 2.5rem 1.5rem 1.5rem;
}

.hero-title {
  font-size: 1.75rem;
  font-weight: 750;
  color: var(--color-text);
  margin: 0;
  letter-spacing: -0.03em;
}

/* ── Banners ── */
.banner {
  max-width: 960px;
  margin: 0 auto 1rem;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  font-size: 0.8125rem;
  font-weight: 500;
}

.banner--error {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

/* ── Plans grid ── */
.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.25rem;
  max-width: 960px;
  margin: 0 auto;
  padding: 0 1.5rem 2rem;
}

.plan-card {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: 1.75rem 1.5rem 1.5rem;
  transition: box-shadow 0.2s, transform 0.2s;
}

.plan-card:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
  transform: translateY(-2px);
}

.plan-card--highlight {
  border-color: #166534;
  box-shadow: 0 0 0 1px #166534;
}

.plan-body {
  flex: 1;
}

.plan-name {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
}

.plan-subtitle {
  margin: 0.2rem 0 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.plan-price {
  margin: 1.25rem 0 0;
  display: flex;
  align-items: baseline;
  gap: 0.15rem;
}

.plan-price-value {
  font-size: 2rem;
  font-weight: 750;
  color: var(--color-text);
  letter-spacing: -0.03em;
}

.plan-price-period {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.plan-preamble {
  margin: 1.25rem 0 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.plan-features {
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.plan-features li {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--color-text);
  line-height: 1.4;
}

.plan-features li svg {
  flex-shrink: 0;
  margin-top: 0.1rem;
  color: #166534;
}

html.dark .plan-features li svg {
  color: #4ade80;
}

/* ── Plan buttons ── */
.btn-plan {
  margin-top: 1.5rem;
  width: 100%;
  padding: 0.625rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  font-family: inherit;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
  border: none;
}

.btn-plan--upgrade {
  background: #166534;
  color: #fff;
}

.btn-plan--upgrade:hover:not(:disabled) {
  background: #15803d;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(22, 101, 52, 0.2);
}

.btn-plan--current {
  background: transparent;
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  cursor: default;
}

.btn-plan:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* ── OTP card ── */
.otp-card {
  max-width: 960px;
  margin: 0 auto 2rem;
  padding: 1.25rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  box-shadow: var(--app-shadow-card, 0 1px 3px rgba(0, 0, 0, 0.06));
  margin-left: 1.5rem;
  margin-right: 1.5rem;
  max-width: calc(960px - 3rem);
}

@media (min-width: 993px) {
  .otp-card {
    margin-left: auto;
    margin-right: auto;
    max-width: 960px;
  }
}

.otp-left {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  flex-shrink: 0;
}

.otp-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 10px;
  background: #ecfdf5;
  color: #166534;
}

html.dark .otp-icon-wrap {
  background: rgba(22, 101, 52, 0.2);
  color: #4ade80;
}

.otp-title {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.otp-text {
  margin: 0.2rem 0 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  line-height: 1.4;
}

.otp-right {
  flex: 1;
  min-width: 0;
}

.otp-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.otp-input {
  letter-spacing: 0.2em;
  font-size: 1.05rem;
  font-family: inherit;
  padding: 0.5rem 0.75rem;
  border-radius: 10px;
  border: 1px solid var(--color-input-border);
  background: var(--color-input-bg);
  color: var(--color-text);
  width: 8rem;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.otp-input:focus {
  outline: none;
  border-color: #166534;
  box-shadow: 0 0 0 3px rgba(22, 101, 52, 0.12);
}

.otp-migrate {
  display: flex;
  gap: 0.4rem;
  align-items: center;
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  cursor: pointer;
}

.otp-migrate input {
  flex-shrink: 0;
}

.otp-msg {
  margin: 0.4rem 0 0;
  font-size: 0.8125rem;
}

.otp-msg--error { color: #dc2626; }
.otp-msg--ok { color: #166534; }

html.dark .otp-msg--ok { color: #4ade80; }

/* ── Modal ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}

.modal-card {
  width: 100%;
  max-width: 460px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 1.5rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
}

.modal-title {
  margin: 0 0 0.5rem;
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--color-text);
}

.modal-text {
  margin: 0 0 1rem;
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  line-height: 1.45;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.625rem;
  margin-top: 0.25rem;
}

/* ── Fields ── */
.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-bottom: 0.75rem;
}

.field-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text-muted);
}

.field-input {
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--color-input-border);
  border-radius: 10px;
  font-size: 0.875rem;
  font-family: inherit;
  background: var(--color-input-bg);
  color: var(--color-text);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.field-input:focus {
  outline: none;
  border-color: #166534;
  box-shadow: 0 0 0 3px rgba(22, 101, 52, 0.12);
}

.field-input:disabled { opacity: 0.7; }

.field-error {
  margin: -0.25rem 0 0.75rem;
  color: #dc2626;
  font-size: 0.8125rem;
}

/* ── Buttons ── */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  color: #fff;
  background: #166534;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
  white-space: nowrap;
}

.btn-primary:hover:not(:disabled) { background: #15803d; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
  padding: 0.5rem 0.85rem;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  color: var(--color-text);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-secondary:hover { background: var(--color-table-row-hover); }
.btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }

@media (max-width: 600px) {
  .hero-title { font-size: 1.35rem; }
  .plans-grid { padding: 0 1rem 2rem; }
  .otp-card {
    flex-direction: column;
    gap: 0.75rem;
    margin-left: 1rem;
    margin-right: 1rem;
  }
  .plan-card { padding: 1.25rem 1.125rem 1.25rem; }
}
</style>
