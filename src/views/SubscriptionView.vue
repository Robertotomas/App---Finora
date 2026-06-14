<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSubscriptionStore } from '@/stores/subscription'
import type { BillingInterval, PaidPlan, SubscriptionPlan } from '@/types/subscription'
import { coupleInvitationsApi } from '@/api/coupleInvitations'
import { useAuthStore } from '@/stores/auth'
import { userFromProfileResponse } from '@/types/auth'
import { useHouseholdStore } from '@/stores/household'
import { useNotificationStore } from '@/stores/notifications'

const route = useRoute()
const router = useRouter()
const subscriptionStore = useSubscriptionStore()
const authStore = useAuthStore()
const householdStore = useHouseholdStore()
const notificationStore = useNotificationStore()

const interval = ref<BillingInterval>('monthly')
const redirecting = ref<SubscriptionPlan | null>(null)
const portalLoading = ref(false)
const checkoutNotice = ref('')
const checkoutNoticeKind = ref<'info' | 'error'>('info')

const coupleInviteOpen = ref(false)
const coupleInviteEmail = ref('')
const coupleInviteError = ref('')
const coupleInviteLoading = ref(false)

const partnerOtp = ref('')
const partnerMigratePersonalData = ref(true)
const partnerOtpError = ref('')
const partnerOtpSuccess = ref('')
const partnerOtpLoading = ref(false)

interface PlanCard {
  plan: SubscriptionPlan
  title: string
  subtitle: string
  preamble?: string
  features: string[]
  highlight?: boolean
}

// Fallback prices (cents) used until /plans loads — kept in sync with server defaults.
const FALLBACK_PRICES: Record<PaidPlan, { monthly: number; annual: number }> = {
  Pro: { monthly: 799, annual: 7990 },
  Couple: { monthly: 1299, annual: 12990 },
}

const planCards: PlanCard[] = [
  {
    plan: 'Free',
    title: 'Free',
    subtitle: 'Para começar',
    features: [
      '1 conta',
      '1 receita por mês',
      '5 despesas por mês',
      'Transferências ilimitadas',
      'Dashboard com histórico até 6 meses',
      'Plano mensal e orçamento',
    ],
  },
  {
    plan: 'Pro',
    title: 'Pro',
    subtitle: 'Gestão individual completa',
    preamble: 'Tudo do Free, mais:',
    features: [
      'Contas ilimitadas',
      'Receitas e despesas ilimitadas',
      'Transações recorrentes',
      'Objetivos de poupança',
      'Relatórios mensais automáticos (PDF)',
      'Dashboard completo com histórico até 5 anos',
    ],
  },
  {
    plan: 'Couple',
    title: 'Couple',
    subtitle: 'Finanças a dois, juntos',
    preamble: 'Tudo do Pro, mais:',
    features: [
      'Convidar 1 pessoa para o agregado',
      'Contas e movimentos partilhados',
      'Responsável por cada movimento e recorrente',
      'Visão conjunta do orçamento',
    ],
    highlight: true,
  },
]

const currentPlan = computed(() => subscriptionStore.plan)

function pricesFor(plan: PaidPlan): { monthly: number; annual: number } {
  const p = subscriptionStore.plans
  if (!p) return FALLBACK_PRICES[plan]
  return plan === 'Pro' ? p.pro : p.couple
}

function formatEuro(cents: number): string {
  return (cents / 100).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€'
}

/** Big headline price = per-month figure (annual shows the monthly-equivalent of the yearly charge). */
function displayPrice(plan: SubscriptionPlan): string {
  if (plan === 'Free') return '0€'
  const prices = pricesFor(plan as PaidPlan)
  const cents = interval.value === 'annual' ? Math.round(prices.annual / 12) : prices.monthly
  return formatEuro(cents)
}

/** Sub-line shown under annual prices: total billed per year. */
function annualNote(plan: SubscriptionPlan): string | null {
  if (plan === 'Free' || interval.value !== 'annual') return null
  return `Faturação anual de ${formatEuro(pricesFor(plan as PaidPlan).annual)}`
}

function isCurrent(plan: SubscriptionPlan): boolean {
  return plan === currentPlan.value
}

function buttonLabel(plan: SubscriptionPlan): string {
  if (redirecting.value === plan) return 'A redirecionar…'
  if (isCurrent(plan)) return plan === 'Free' ? 'Plano atual' : 'Gerir subscrição'
  if (plan === 'Free') return 'Gerir subscrição'
  return `Escolher ${plan}`
}

function buttonDisabled(plan: SubscriptionPlan): boolean {
  if (redirecting.value !== null || portalLoading.value) return true
  return isCurrent(plan) && plan === 'Free'
}

async function selectPlan(plan: SubscriptionPlan) {
  if (buttonDisabled(plan)) return

  // Current paid plan, or downgrading to Free → manage/cancel in the Stripe portal.
  if (isCurrent(plan) || plan === 'Free') {
    portalLoading.value = true
    try {
      await subscriptionStore.openPortal()
    } finally {
      portalLoading.value = false
    }
    return
  }

  // New paid plan → hosted Stripe Checkout.
  redirecting.value = plan
  try {
    await subscriptionStore.startCheckout(plan as PaidPlan, interval.value)
  } catch {
    redirecting.value = null
  }
}

function openInvite() {
  coupleInviteError.value = ''
  coupleInviteEmail.value = ''
  coupleInviteOpen.value = true
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
  subscriptionStore.fetchPlans()

  if (!subscriptionStore.subscription) {
    try { await subscriptionStore.fetchSubscription() } catch { /* */ }
  }

  // Returning from Stripe Checkout: reconcile the plan from Stripe's truth (not the URL).
  const checkout = route.query.checkout
  if (checkout === 'success') {
    checkoutNoticeKind.value = 'info'
    checkoutNotice.value = 'Pagamento concluído. A ativar o seu plano…'
    await subscriptionStore.syncFromStripe()
    try { await householdStore.fetchHousehold() } catch { /* */ }
    if (subscriptionStore.plan !== 'Free') {
      checkoutNoticeKind.value = 'info'
      checkoutNotice.value = 'Plano ativado com sucesso!'
    } else {
      // Pagou mas o plano ainda não confirmou (subscrição incompleta/em processamento).
      checkoutNoticeKind.value = 'error'
      checkoutNotice.value = 'Não foi possível confirmar a subscrição. Se o pagamento foi efetuado, aguarde um momento e atualize a página.'
    }
  } else if (checkout === 'cancel') {
    checkoutNoticeKind.value = 'error'
    checkoutNotice.value = 'Subscrição não concluída. Não foi efetuada nenhuma cobrança.'
  }

  if (checkout) {
    // Clean the query so a refresh doesn't re-trigger the notice.
    router.replace({ query: {} })
  }
})
</script>

<template>
  <div class="sub-page">
    <!-- Top bar -->
    <header class="top-bar">
      <button type="button" class="btn-back" @click="router.push('/overview')">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
      </button>
    </header>

    <!-- Hero -->
    <div class="hero">
      <h1 class="hero-title">Planos que crescem consigo</h1>
    </div>

    <div v-if="subscriptionStore.error" class="banner banner--error">{{ subscriptionStore.error }}</div>
    <div v-if="checkoutNotice" class="banner" :class="checkoutNoticeKind === 'error' ? 'banner--error' : 'banner--info'">{{ checkoutNotice }}</div>

    <!-- Billing interval toggle -->
    <div class="interval-toggle" role="group" aria-label="Periodicidade">
      <button
        type="button"
        class="interval-btn"
        :class="{ 'interval-btn--active': interval === 'monthly' }"
        @click="interval = 'monthly'"
      >Mensal</button>
      <button
        type="button"
        class="interval-btn"
        :class="{ 'interval-btn--active': interval === 'annual' }"
        @click="interval = 'annual'"
      >
        Anual
        <span class="interval-save">2 meses grátis</span>
      </button>
    </div>

    <!-- Invite partner (only when already on a paid Couple plan) -->
    <section v-if="subscriptionStore.canInvite" class="invite-cta">
      <div>
        <h2 class="invite-cta-title">Tem o plano Couple</h2>
        <p class="invite-cta-text">Convide o seu parceiro para partilharem contas, movimentos e orçamento.</p>
      </div>
      <button type="button" class="btn-primary" @click="openInvite">Convidar parceiro</button>
    </section>

    <!-- Partner OTP section -->
    <section class="otp-card">
      <div class="otp-left">
        <div class="otp-icon-wrap">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
        </div>
        <div>
          <h2 class="otp-title">Aceitar convite</h2>
          <p class="otp-text">Já tinha conta e recebeu um código por email? Introduza-o para se juntar ao agregado.</p>
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
        <h2 class="modal-title">Convidar parceiro</h2>
        <p class="modal-text">
          Introduza o email da pessoa que quer convidar para o seu agregado <strong>Couple</strong>.
          Ela recebe um convite por email para se juntar.
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
        :class="{ 'plan-card--highlight': currentPlan === card.plan, 'plan-card--featured': card.highlight }"
      >
        <span v-if="card.highlight" class="plan-tag">Mais completo</span>
        <div class="plan-body">
          <h2 class="plan-name">{{ card.title }}</h2>
          <p class="plan-subtitle">{{ card.subtitle }}</p>
          <p class="plan-price">
            <span class="plan-price-value">{{ displayPrice(card.plan) }}</span>
            <span class="plan-price-period">/mês</span>
          </p>
          <p v-if="annualNote(card.plan)" class="plan-annual-note">{{ annualNote(card.plan) }}</p>
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
          :class="{ 'btn-plan--current': isCurrent(card.plan), 'btn-plan--upgrade': !isCurrent(card.plan) }"
          :disabled="buttonDisabled(card.plan)"
          @click="selectPlan(card.plan)"
        >
          {{ buttonLabel(card.plan) }}
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

html.dark .banner--error {
  background: rgba(220, 38, 38, 0.12);
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.3);
}

.banner--info {
  background: #ecfdf5;
  color: #166534;
  border: 1px solid #bbf7d0;
}

html.dark .banner--info {
  background: rgba(22, 101, 52, 0.18);
  color: #4ade80;
  border-color: rgba(74, 222, 128, 0.3);
}

/* ── Interval toggle ── */
.interval-toggle {
  display: inline-flex;
  gap: 0.25rem;
  margin: 0 auto 1.75rem;
  padding: 0.25rem;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  /* center the inline-flex within the page */
}

.sub-page > .interval-toggle {
  display: flex;
  width: max-content;
}

.interval-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1.1rem;
  font-size: 0.875rem;
  font-weight: 600;
  font-family: inherit;
  color: var(--color-text-muted);
  background: transparent;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.interval-btn--active {
  background: #166534;
  color: #fff;
}

html.dark .interval-btn--active {
  background: #15803d;
}

.interval-save {
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: rgba(22, 101, 52, 0.12);
  color: #166534;
}

.interval-btn--active .interval-save {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

html.dark .interval-save {
  background: rgba(74, 222, 128, 0.18);
  color: #4ade80;
}

/* ── Invite CTA ── */
.invite-cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  max-width: 960px;
  margin: 0 auto 1.5rem;
  padding: 1rem 1.25rem;
  background: var(--color-bg-card);
  border: 1px solid #166534;
  border-radius: 14px;
}

.invite-cta-title {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-text);
}

.invite-cta-text {
  margin: 0.2rem 0 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.plan-annual-note {
  margin: 0.35rem 0 0;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

/* ── Plans grid ── */
.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 1.5rem 2.5rem;
}

.plan-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 18px;
  padding: 2.25rem 1.875rem 1.875rem;
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

.plan-tag {
  position: absolute;
  top: 0;
  right: 1.5rem;
  transform: translateY(-50%);
  padding: 0.25rem 0.625rem;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #fff;
  background: #166534;
  border-radius: 999px;
}

html.dark .plan-tag {
  background: #15803d;
}

.plan-body {
  flex: 1;
}

.plan-name {
  margin: 0;
  font-size: 1.375rem;
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
  font-size: 2.375rem;
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
  margin: 1.25rem 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.plan-features li {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--color-text);
  line-height: 1.45;
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
  margin-top: 1.75rem;
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 0.9375rem;
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
