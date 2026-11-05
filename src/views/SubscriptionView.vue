<script setup lang="ts">
import { PT_GROUPING } from '@/utils/numberFormat'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSubscriptionStore } from '@/stores/subscription'
import type { BillingInterval, PaidPlan, SubscriptionPlan } from '@/types/subscription'
import { coupleInvitationsApi } from '@/api/coupleInvitations'
import { useAuthStore } from '@/stores/auth'
import { userFromProfileResponse } from '@/types/auth'
import { useHouseholdStore } from '@/stores/household'
import { useNotificationStore } from '@/stores/notifications'
import UiButton from '@/components/ui/UiButton.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import { useToast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const subscriptionStore = useSubscriptionStore()
const authStore = useAuthStore()
const householdStore = useHouseholdStore()
const notificationStore = useNotificationStore()
const toast = useToast()

const intervalOptions: { value: BillingInterval; label: string }[] = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'annual', label: 'Anual' },
]

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
      'Movimentos recorrentes',
      'Investimentos (ações e ETFs) com cotações diárias',
      'Bens e valores (imóveis, veículos, arte…)',
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
  return (cents / 100).toLocaleString('pt-PT', { ...PT_GROUPING, minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

/** Big headline price = per-month figure (annual shows the monthly-equivalent of the yearly charge). */
function displayPrice(plan: SubscriptionPlan): string {
  if (plan === 'Free') return '0 €'
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
  if (plan === 'Free') return 'Mudar para Free'
  return `Escolher ${plan}`
}

/** Estilo do botão: atual / descer para Free = secundário, subir = verde cheio. */
function buttonVariant(plan: SubscriptionPlan): 'primary' | 'secondary' {
  if (isCurrent(plan) || plan === 'Free') return 'secondary'
  return 'primary'
}

// "Aceitar convite" fica recolhido por baixo dos planos (só interessa a quem recebeu um código).
const inviteOpen = ref(false)

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
  if (!email) { coupleInviteError.value = 'Indique um email válido para o convite.'; return }
  if (!isValidEmail(email)) { coupleInviteError.value = 'O email do convite parece inválido.'; return }
  coupleInviteLoading.value = true
  try {
    await coupleInvitationsApi.create(email)
    await subscriptionStore.fetchSubscription()
    try { await householdStore.fetchHousehold() } catch { /* */ }
    coupleInviteOpen.value = false
    toast.success('Convite enviado')
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
    partnerOtpError.value = 'Indique o código de 6 dígitos enviado por email.'
    return
  }
  partnerOtpLoading.value = true
  try {
    const { data } = await coupleInvitationsApi.verifyOtp(code, partnerMigratePersonalData.value)
    partnerOtp.value = ''
    authStore.setAuth(data.accessToken, userFromProfileResponse(data.user))
    partnerOtpSuccess.value = 'Conta associada ao agregado do convite.'
    toast.success(partnerOtpSuccess.value)
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
      <UiButton variant="ghost" size="sm" @click="router.push('/overview')">
        <template #icon>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        </template>
        Voltar
      </UiButton>
    </header>

    <div class="sub-content">
      <!-- Hero -->
      <div class="hero">
        <h1 class="hero-title">Planos que crescem consigo</h1>
        <p class="hero-subtitle">Comece grátis e mude de plano quando quiser. Cancele a qualquer momento.</p>
      </div>

      <div v-if="subscriptionStore.error" class="banner banner--error" role="alert">{{ subscriptionStore.error }}</div>
      <div v-if="checkoutNotice" class="banner" :class="checkoutNoticeKind === 'error' ? 'banner--error' : 'banner--info'" role="status">{{ checkoutNotice }}</div>

      <!-- Billing interval toggle -->
      <div class="interval-row">
        <SegmentedControl v-model="interval" :options="intervalOptions" aria-label="Periodicidade" />
        <span class="ui-badge ui-badge--brand">2 meses grátis no anual</span>
      </div>

      <!-- Invite partner (only when already on a paid Couple plan) -->
      <section v-if="subscriptionStore.canInvite" class="invite-cta">
        <div>
          <h2 class="invite-cta-title">Tem o plano Couple</h2>
          <p class="invite-cta-text">Convide o seu parceiro para partilharem contas, movimentos e orçamento.</p>
        </div>
        <UiButton @click="openInvite">Convidar parceiro</UiButton>
      </section>

      <!-- Plans grid -->
      <div class="plans-grid">
        <article
          v-for="card in planCards"
          :key="card.plan"
          class="plan-card"
          :class="{ 'plan-card--featured': card.highlight, 'plan-card--current': isCurrent(card.plan) }"
        >
          <div class="plan-body">
            <div class="plan-head">
              <h2 class="plan-name">{{ card.title }}</h2>
              <div class="plan-badges">
                <span v-if="isCurrent(card.plan)" class="ui-badge ui-badge--success">Plano atual</span>
                <span v-else-if="card.highlight" class="ui-badge ui-badge--brand">Recomendado</span>
              </div>
            </div>
            <p class="plan-subtitle">{{ card.subtitle }}</p>
            <p class="plan-price">
              <span class="plan-price-value">{{ displayPrice(card.plan) }}</span>
              <span class="plan-price-period">/mês</span>
            </p>
            <p class="plan-annual-note">{{ annualNote(card.plan) ?? ' ' }}</p>

            <UiButton
              class="plan-cta"
              block
              :variant="buttonVariant(card.plan)"
              :disabled="buttonDisabled(card.plan)"
              :loading="redirecting === card.plan"
              @click="selectPlan(card.plan)"
            >
              {{ buttonLabel(card.plan) }}
            </UiButton>

            <div class="plan-divider"></div>

            <p v-if="card.preamble" class="plan-preamble">{{ card.preamble }}</p>
            <ul class="plan-features">
              <li v-for="feature in card.features" :key="feature">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                {{ feature }}
              </li>
            </ul>
          </div>
        </article>
      </div>

      <!-- Aceitar convite (recolhido: só interessa a quem recebeu um código) -->
      <div class="invite-toggle-wrap">
        <button type="button" class="invite-toggle" :aria-expanded="inviteOpen" @click="inviteOpen = !inviteOpen">
          Recebeu um código de convite?
        </button>
      </div>
      <section v-if="inviteOpen" class="otp-card">
        <div class="otp-left">
          <div class="otp-icon-wrap" aria-hidden="true">
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
            <UiButton :loading="partnerOtpLoading" @click="submitPartnerOtp">
              {{ partnerOtpLoading ? 'A validar…' : 'Validar' }}
            </UiButton>
          </div>
          <label class="otp-migrate">
            <input v-model="partnerMigratePersonalData" type="checkbox" :disabled="partnerOtpLoading" />
            <span>Levar os meus dados para o agregado</span>
          </label>
          <p v-if="partnerOtpError" class="otp-msg otp-msg--error">{{ partnerOtpError }}</p>
          <p v-if="partnerOtpSuccess" class="otp-msg otp-msg--ok">{{ partnerOtpSuccess }}</p>
        </div>
      </section>
    </div>

    <!-- Couple invite modal -->
    <div
      v-if="coupleInviteOpen"
      class="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="couple-invite-title"
      @click.self="cancelCoupleInvite"
    >
      <div class="modal-card">
        <h2 id="couple-invite-title" class="modal-title">Convidar parceiro</h2>
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
            :class="{ 'field-input--error': coupleInviteError }"
            placeholder="email@exemplo.com"
            autocomplete="email"
            :disabled="coupleInviteLoading"
          />
        </label>
        <p v-if="coupleInviteError" class="field-error">{{ coupleInviteError }}</p>
        <div class="modal-actions">
          <UiButton variant="secondary" :disabled="coupleInviteLoading" @click="cancelCoupleInvite">Cancelar</UiButton>
          <UiButton :loading="coupleInviteLoading" @click="confirmCoupleInvite">
            {{ coupleInviteLoading ? 'A confirmar…' : 'Confirmar' }}
          </UiButton>
        </div>
      </div>
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
  height: 56px;
  padding: 0 var(--space-4);
  background: var(--color-header-bg);
  border-bottom: 1px solid var(--color-header-border);
}

.sub-content {
  max-width: 1080px;
  margin: 0 auto;
  padding: 0 var(--space-6) var(--space-12);
}

/* ── Hero ── */
.hero {
  text-align: center;
  padding: var(--space-10) 0 var(--space-6);
}

.hero-title {
  margin: 0;
  font-size: var(--text-2xl);
  font-weight: var(--weight-bold);
  letter-spacing: var(--tracking-tight);
  color: var(--color-text-strong);
}

.hero-subtitle {
  margin: var(--space-2) 0 0;
  font-size: var(--text-base);
  color: var(--color-text-muted);
}

/* ── Banners ── */
.banner {
  max-width: 720px;
  margin: 0 auto var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  text-align: center;
}

.banner--error {
  background: var(--color-danger-soft);
  color: var(--color-danger);
  border: 1px solid var(--color-danger-border);
}

.banner--info {
  background: var(--color-primary-soft);
  color: var(--color-primary-text);
  border: 1px solid var(--color-primary-soft-border);
}

/* ── Interval toggle ── */
.interval-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-8);
}

/* ── Invite CTA ── */
.invite-cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  margin: 0 0 var(--space-6);
  padding: var(--space-4) var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.invite-cta-title {
  margin: 0;
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.invite-cta-text {
  margin: var(--space-1) 0 0;
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

/* ── Plans grid ── */
.plans-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-5);
  align-items: stretch;
  margin-bottom: var(--space-8);
}

.plan-card {
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  transition: border-color var(--transition-base);
}

.plan-card:not(.plan-card--featured):hover {
  border-color: var(--color-border-strong);
}

.plan-card--featured {
  border: 2px solid var(--color-primary);
  /* compensa a borda de 2px para manter o alinhamento interno */
  padding: calc(var(--space-6) - 1px);
}

.plan-body {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.plan-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-height: 24px;
}

.plan-badges {
  display: flex;
  gap: var(--space-1);
}

.plan-name {
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.plan-subtitle {
  margin: var(--space-1) 0 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.plan-price {
  margin: var(--space-5) 0 0;
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
}

.plan-price-value {
  font-size: var(--text-3xl);
  font-weight: var(--weight-bold);
  letter-spacing: var(--tracking-tight);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-strong);
}

.plan-price-period {
  font-size: var(--text-base);
  color: var(--color-text-muted);
}

.plan-annual-note {
  margin: var(--space-1) 0 0;
  min-height: 1.2em;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.plan-cta {
  margin-top: var(--space-5);
}

.plan-divider {
  height: 1px;
  margin: var(--space-6) 0 var(--space-5);
  background: var(--color-border-subtle);
}

.plan-preamble {
  margin: 0 0 var(--space-3);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.plan-features {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.plan-features li {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  font-size: var(--text-base);
  line-height: 1.45;
  color: var(--color-text);
}

.plan-features li svg {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--color-primary-text);
}

/* ── Aceitar convite ── */
.invite-toggle-wrap {
  text-align: center;
  margin: 0 0 var(--space-4);
}

.invite-toggle {
  border: none;
  background: none;
  padding: var(--space-1) var(--space-2);
  font-family: inherit;
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-primary-text);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.invite-toggle:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
  border-radius: var(--radius-sm);
}

.otp-card {
  max-width: 860px;
  margin: 0 auto;
  padding: var(--space-5) var(--space-6);
  display: flex;
  align-items: center;
  gap: var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.otp-left {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  flex: 1;
  min-width: 0;
}

.otp-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--color-primary-soft);
  color: var(--color-primary-text);
}

.otp-title {
  margin: 0;
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.otp-text {
  margin: var(--space-1) 0 0;
  font-size: var(--text-sm);
  line-height: 1.45;
  color: var(--color-text-muted);
}

.otp-right {
  flex-shrink: 0;
}

.otp-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.otp-input {
  width: 8.5rem;
  height: 40px;
  padding: 0 var(--space-3);
  letter-spacing: 0.25em;
  font-size: var(--text-md);
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface);
  color: var(--color-text-strong);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.otp-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--focus-ring);
}

.otp-migrate {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin: var(--space-2) 0 0;
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  cursor: pointer;
}

.otp-migrate input {
  flex-shrink: 0;
  accent-color: var(--color-primary);
}

.otp-msg {
  margin: var(--space-2) 0 0;
  font-size: var(--text-sm);
}

.otp-msg--error { color: var(--color-danger); }
.otp-msg--ok { color: var(--color-primary-text); }

/* ── Modal ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: var(--color-modal-overlay);
  backdrop-filter: blur(4px);
}

.modal-card {
  width: 100%;
  max-width: 460px;
  padding: var(--space-6);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

.modal-title {
  margin: 0 0 var(--space-2);
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.modal-text {
  margin: 0 0 var(--space-5);
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--color-text-muted);
}

.modal-text strong {
  color: var(--color-text-strong);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-5);
}

/* ── Fields ── */
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.field-input {
  height: 40px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  font-size: var(--text-base);
  font-family: inherit;
  background: var(--color-surface);
  color: var(--color-text);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.field-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--focus-ring);
}

.field-input--error {
  border-color: var(--color-danger);
}

.field-input:disabled {
  background: var(--color-surface-muted);
  cursor: not-allowed;
}

.field-error {
  margin: 6px 0 0;
  font-size: var(--text-sm);
  color: var(--color-danger);
}

@media (max-width: 960px) {
  .plans-grid {
    grid-template-columns: minmax(0, 1fr);
    max-width: 480px;
    margin-left: auto;
    margin-right: auto;
  }
}

@media (max-width: 720px) {
  .sub-content { padding: 0 var(--space-4) var(--space-10); }
  .hero { padding-top: var(--space-8); }
  .hero-title { font-size: var(--text-xl); }
  .otp-card {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-4);
    padding: var(--space-5);
  }
  .plan-card { padding: var(--space-5); }
  .plan-card--featured { padding: calc(var(--space-5) - 1px); }
}
</style>
