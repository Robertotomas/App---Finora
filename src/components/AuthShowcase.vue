<script setup lang="ts">
// Painel direito das páginas de autenticação (split-screen).
// Cartão único com o gráfico real de Património Total (NetWorthChart).
// Decorativo: escondido em mobile e ignorado por leitores de ecrã.
import NetWorthChart, { type DailyBalancePoint } from '@/components/charts/NetWorthChart.vue'

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
  { name: 'Dinheiro e poupanças', value: '9.850,00 €', percent: '79,11% do total' },
  { name: 'Ações e fundos', value: '2.100,80 €', percent: '16,87% do total' },
  { name: 'Outros', value: '500,00 €', percent: '4,02% do total' },
]
</script>

<template>
  <aside class="auth-right" aria-hidden="true">
    <div class="auth-showcase">
      <div class="auth-showcase-copy">
        <p class="auth-showcase-title">As suas finanças, sob controlo.</p>
        <p class="auth-showcase-sub">Acompanhe o seu património, movimentos e objetivos num só lugar.</p>
      </div>

      <!-- Cartão único: Património Total -->
      <div class="dash-mock">
        <div class="dash-mock-chrome">
          <span class="dot"></span><span class="dot"></span><span class="dot"></span>
          <span class="dash-mock-periods">
            <span class="dmp">3M</span><span class="dmp dmp--active">6M</span><span class="dmp">1A</span>
          </span>
        </div>
        <div class="dash-mock-body">
          <div class="dm-hero">
            <p class="dm-label">Património Total</p>
            <p class="dm-value">12.450,80 €</p>
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
  background: linear-gradient(150deg, #166534 0%, #15803d 55%, #14532d 100%);
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
}

.auth-showcase-sub {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.82);
}

/* ── Cartão Património ── */
.dash-mock {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.45), 0 8px 24px -12px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.dash-mock-chrome {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.75rem 1rem;
  background: #f1f5f9;
  border-bottom: 1px solid #e2e8f0;
}

.dash-mock-chrome .dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background: #cbd5e1;
}

.dash-mock-periods {
  display: flex;
  gap: 0.25rem;
  margin-left: auto;
}

.dmp {
  font-size: 0.625rem;
  font-weight: 700;
  color: #94a3b8;
  padding: 0.125rem 0.4375rem;
  border-radius: 6px;
}

.dmp--active {
  color: #166534;
  background: rgba(22, 101, 52, 0.1);
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
  color: #94a3b8;
}

.dm-value {
  margin: 0.25rem 0 0.125rem;
  font-size: 1.875rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  color: #0f172a;
}

.dm-trend {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #16a34a;
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
  background: #f8fafc;
  border-radius: 10px;
  font-size: 0.8125rem;
}

.dm-row-name {
  color: #475569;
  font-weight: 500;
}

.dm-row-values {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.0625rem;
}

.dm-row-value {
  color: #0f172a;
  font-weight: 700;
}

.dm-row-percent {
  font-size: 0.6875rem;
  color: #94a3b8;
  font-weight: 500;
}

/* ── Dark mode: cartão preto neutro como no dashboard real ── */
html.dark .dash-mock {
  background: #161616;
  box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.7);
}

html.dark .dash-mock-chrome {
  background: #1f1f1f;
  border-bottom-color: #2a2a2a;
}

html.dark .dash-mock-chrome .dot {
  background: #3a3a3a;
}

html.dark .dmp--active {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.14);
}

html.dark .dm-value,
html.dark .dm-row-value {
  color: #ffffff;
}

html.dark .dm-trend {
  color: #4ade80;
}

html.dark .dm-row {
  background: #1f1f1f;
}

html.dark .dm-row-name {
  color: #a3a3a3;
}

html.dark .dm-row-percent {
  color: #737373;
}

/* Esconder o painel em ecrãs estreitos (form ocupa tudo) */
@media (max-width: 900px) {
  .auth-right {
    display: none;
  }
}
</style>
