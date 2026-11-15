<script setup lang="ts">
// Painel direito das páginas de autenticação (split-screen).
// Alterna entre dois cartões: Individual (Património Total, gráfico real NetWorthChart) e
// Casal (despesas do mês por membro + responsável em cada movimento — o diferencial do produto).
// Os dois cartões ocupam a mesma célula de grelha (sem saltos de altura). Roda a cada 7 s,
// pausa com o rato por cima. Decorativo: escondido em mobile e ignorado por leitores de ecrã.
import { ref, onMounted, onUnmounted } from 'vue'
import NetWorthChart, { type DailyBalancePoint } from '@/components/charts/NetWorthChart.vue'
import UserAvatar from '@/components/ui/UserAvatar.vue'

type Slide = 'solo' | 'couple'
const SLIDES: Slide[] = ['solo', 'couple']
const SUBTITLES: Record<Slide, string> = {
  solo: 'Acompanhe o seu património, movimentos e objetivos num só lugar.',
  couple: 'Partilhe as finanças com quem vive consigo e saiba sempre quem pagou o quê.',
}
const ROTATE_MS = 7000

const active = ref<Slide>('solo')
const paused = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

function next() {
  if (paused.value) return
  active.value = SLIDES[(SLIDES.indexOf(active.value) + 1) % SLIDES.length]
}
function go(slide: Slide) {
  active.value = slide
  restart()
}
function restart() {
  if (timer) clearInterval(timer)
  timer = setInterval(next, ROTATE_MS)
}
onMounted(restart)
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

// Cartão Casal: despesas de junho por membro + últimos movimentos com o responsável.
const members = [
  { first: 'Ana', last: 'Silva', amount: '1 184,40 €', percent: 58 },
  { first: 'Rui', last: 'Costa', amount: '857,60 €', percent: 42 },
]
const coupleMovements = [
  { name: 'Continente', category: 'Supermercado', amount: '−84,20 €', who: members[0] },
  { name: 'EDP', category: 'Eletricidade', amount: '−62,35 €', who: members[1] },
  { name: 'Restaurante', category: 'Restauração', amount: '−46,00 €', who: members[1] },
]

// Série de exemplo (~6 meses, tendência de subida) que alimenta o gráfico real.
const points: DailyBalancePoint[] = [
  { date: '2025-12-01', balance: 9800 },
  { date: '2025-12-08', balance: 9950 },
  { date: '2025-12-15', balance: 10120 },
  { date: '2025-12-22', balance: 10080 },
  { date: '2026-01-01', balance: 10250 },
  { date: '2026-01-08', balance: 10400 },
  { date: '2026-01-15', balance: 10300 },
  { date: '2026-01-22', balance: 10550 },
  { date: '2026-02-01', balance: 10700 },
  { date: '2026-02-08', balance: 10650 },
  { date: '2026-02-15', balance: 10900 },
  { date: '2026-02-22', balance: 11050 },
  { date: '2026-03-01', balance: 11000 },
  { date: '2026-03-08', balance: 11250 },
  { date: '2026-03-15', balance: 11400 },
  { date: '2026-03-22', balance: 11350 },
  { date: '2026-04-01', balance: 11600 },
  { date: '2026-04-08', balance: 11750 },
  { date: '2026-04-15', balance: 11700 },
  { date: '2026-04-22', balance: 11950 },
  { date: '2026-05-01', balance: 12050 },
  { date: '2026-05-08', balance: 12200 },
  { date: '2026-05-15', balance: 12150 },
  { date: '2026-05-22', balance: 12380 },
  { date: '2026-06-01', balance: 12450 },
]

const categories = [
  { name: 'Dinheiro e poupanças', value: '9 850,00 €', percent: '79,11% do total' },
  { name: 'Ações e fundos', value: '2 100,80 €', percent: '16,87% do total' },
  { name: 'Outros', value: '500,00 €', percent: '4,02% do total' },
]
</script>

<template>
  <aside class="auth-right" aria-hidden="true">
    <div class="auth-showcase">
      <div class="auth-showcase-copy">
        <p class="auth-showcase-title">As suas finanças, sozinho ou a dois.</p>
        <div class="auth-showcase-sub-wrap">
          <p v-for="sl in SLIDES" :key="sl" class="auth-showcase-sub" :class="{ 'is-active': active === sl }">
            {{ SUBTITLES[sl] }}
          </p>
        </div>
      </div>

      <div class="slides" @mouseenter="paused = true" @mouseleave="paused = false">
      <!-- Slide Individual: Património Total -->
      <div class="dash-mock slide" :class="{ 'is-active': active === 'solo' }">
        <div class="dash-mock-chrome">
          <span class="dot"></span><span class="dot"></span><span class="dot"></span>
          <span class="dash-mock-periods">
            <span class="dmp">3M</span><span class="dmp dmp--active">6M</span><span class="dmp">1A</span>
          </span>
        </div>
        <div class="dash-mock-body">
          <div class="dm-hero">
            <p class="dm-label">Património Total</p>
            <p class="dm-value">12 450,80 €</p>
            <p class="dm-trend">▲ 3,2% este mês</p>
          </div>
          <div class="dm-chart">
            <NetWorthChart :points="points" currency="EUR" period="6M" />
          </div>
          <div class="dm-rows">
            <div v-for="c in categories" :key="c.name" class="dm-row">
              <span class="dm-row-name">{{ c.name }}</span>
              <span class="dm-row-values">
                <span class="dm-row-value">{{ c.value }}</span>
                <span class="dm-row-percent">{{ c.percent }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Slide Casal: despesas por membro + responsável -->
      <div class="dash-mock slide" :class="{ 'is-active': active === 'couple' }">
        <div class="dash-mock-chrome">
          <span class="dot"></span><span class="dot"></span><span class="dot"></span>
          <span class="dm-plan">Plano Casal</span>
        </div>
        <div class="dash-mock-body">
          <div class="dm-hero">
            <p class="dm-label">Despesas de junho</p>
            <p class="dm-value">2 042,00 €</p>
            <p class="dm-sub">Repartidas por membro</p>
          </div>

          <div class="dm-split">
            <span class="dm-split-a" :style="{ width: members[0].percent + '%' }"></span>
            <span class="dm-split-b" :style="{ width: members[1].percent + '%' }"></span>
          </div>
          <div class="dm-members">
            <div v-for="(m, i) in members" :key="m.first" class="dm-member">
              <span class="dm-member-dot" :class="i === 0 ? 'dm-split-a' : 'dm-split-b'"></span>
              <UserAvatar :first-name="m.first" :last-name="m.last" :size="26" />
              <span class="dm-member-name">{{ m.first }}</span>
              <span class="dm-member-values">
                <span class="dm-row-value">{{ m.amount }}</span>
                <span class="dm-row-percent">{{ m.percent }}%</span>
              </span>
            </div>
          </div>

          <p class="dm-section">Últimos movimentos</p>
          <div class="dm-rows">
            <div v-for="mv in coupleMovements" :key="mv.name" class="dm-row">
              <span class="dm-mv">
                <span class="dm-row-name">{{ mv.name }}</span>
                <span class="dm-row-percent">{{ mv.category }}</span>
              </span>
              <span class="dm-mv-right">
                <span class="dm-row-value">{{ mv.amount }}</span>
                <UserAvatar :first-name="mv.who.first" :last-name="mv.who.last" :size="22" />
              </span>
            </div>
          </div>
        </div>
      </div>
      </div>

      <div class="slide-dots">
        <button
          v-for="sl in SLIDES"
          :key="sl"
          type="button"
          tabindex="-1"
          class="slide-dot"
          :class="{ 'is-active': active === sl }"
          @click="go(sl)"
        ></button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.auth-right {
  flex: 1 1 50%;
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow: hidden;
  background: linear-gradient(150deg, #075E46 0%, #0A7A5B 55%, #054A37 100%);
  padding: 5rem 2rem 3rem;
}

/* Brilho subtil no canto */
.auth-right::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 75% 15%, rgba(255, 255, 255, 0.14) 0%, transparent 55%);
  pointer-events: none;
}

.auth-showcase {
  position: relative;
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: clamp(1.5rem, 5vh, 3rem);
}

.auth-showcase-copy {
  color: #ffffff;
}

.auth-showcase-title {
  margin: 0 0 0.5rem;
  font-size: 1.625rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.2;
  text-wrap: balance;
}

.auth-showcase-sub {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.82);
}

/* ── Rotação: subtítulos e cartões empilhados na mesma célula (altura = o maior) ── */
.auth-showcase-sub-wrap {
  display: grid;
}
.auth-showcase-sub-wrap > .auth-showcase-sub {
  grid-area: 1 / 1;
  opacity: 0;
  transition: opacity 600ms ease;
}
.auth-showcase-sub-wrap > .auth-showcase-sub.is-active {
  opacity: 1;
}
.slides {
  display: grid;
}
.slide {
  grid-area: 1 / 1;
  opacity: 0;
  transform: translateY(8px);
  transition: opacity 600ms ease, transform 600ms ease;
  pointer-events: none;
}
.slide.is-active {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}
.slide-dots {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-top: -0.75rem;
}
.slide-dot {
  width: 0.5rem;
  height: 0.5rem;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  transition: width 300ms ease, background 300ms ease;
}
.slide-dot.is-active {
  width: 1.25rem;
  background: #ffffff;
}
@media (prefers-reduced-motion: reduce) {
  .slide,
  .auth-showcase-sub-wrap > .auth-showcase-sub,
  .slide-dot {
    transition: none;
    transform: none;
  }
}

/* ── Cartão Casal ── */
.dm-plan {
  margin-left: auto;
  font-size: 0.625rem;
  font-weight: 700;
  color: var(--color-primary-text);
  border: 1px solid var(--color-primary-text);
  border-radius: 999px;
  padding: 0.0625rem 0.5rem;
}
.dm-sub {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}
.dm-split {
  display: flex;
  height: 0.5rem;
  border-radius: 999px;
  overflow: hidden;
  margin: 0.75rem 0 0.875rem;
  gap: 2px;
}
.dm-split-a {
  background: var(--color-primary);
}
.dm-split-b {
  background: var(--color-income);
  opacity: 0.55;
}
.dm-members {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
.dm-member {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
}
.dm-member-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 999px;
  flex: none;
}
.dm-member-name {
  color: var(--color-text-secondary);
  font-weight: 600;
}
.dm-member-values {
  margin-left: auto;
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}
.dm-section {
  margin: 0 0 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-subtle);
}
.dm-mv {
  display: flex;
  flex-direction: column;
  gap: 0.0625rem;
}
.dm-mv-right {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

/* ── Cartão Património ── */
.dash-mock {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.45), 0 8px 24px -12px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.dash-mock-chrome {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.75rem 1rem;
  background: var(--color-surface-muted);
  border-bottom: 1px solid var(--color-border);
}

.dash-mock-chrome .dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background: var(--color-border-strong);
}

.dash-mock-periods {
  display: flex;
  gap: 0.25rem;
  margin-left: auto;
}

.dmp {
  font-size: 0.625rem;
  font-weight: 700;
  color: var(--color-text-subtle);
  padding: 0.125rem 0.4375rem;
  border-radius: 6px;
}

.dmp--active {
  color: var(--color-primary-text);
  background: var(--color-primary-soft);
}

.dash-mock-body {
  padding: 1.25rem 1.375rem 1.5rem;
}

.dm-hero {
  margin-bottom: 0.75rem;
}

.dm-label {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-subtle);
}

.dm-value {
  margin: 0.25rem 0 0.125rem;
  font-size: 1.875rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: var(--color-text-strong);
}

.dm-trend {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-success);
}

.dm-chart {
  margin-bottom: 1rem;
}

.dm-chart :deep(.net-worth-chart) {
  height: 150px;
}

.dm-rows {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.dm-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0.75rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
}

.dm-row-name {
  color: var(--color-text-secondary);
  font-weight: 500;
}

.dm-row-values {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.0625rem;
}

.dm-row-value {
  color: var(--color-text-strong);
  font-weight: 700;
}

.dm-row-percent {
  font-size: 0.6875rem;
  color: var(--color-text-subtle);
  font-weight: 500;
}

/* Esconder o painel em ecrãs estreitos (form ocupa tudo) */
@media (max-width: 900px) {
  .auth-right {
    display: none;
  }
}
</style>
