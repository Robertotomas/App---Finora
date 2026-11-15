<script setup lang="ts">
/**
 * Esqueleto de carregamento: mostra a forma do conteúdo a cinza (com brilho a passar) enquanto os
 * dados chegam, em vez de um spinner com "A carregar…". Variantes:
 * - `table`     — barra de filtros + linhas de tabela (Movimentos, Recorrentes)
 * - `cards`     — grelha de cartões (Contas, Objetivos)
 * - `hero`      — cartão de topo com gráfico + linhas (Investimentos, Bens e valores)
 * - `dashboard` — cabeçalho + cartão de topo + 3 cartões (Visão geral)
 */
withDefaults(defineProps<{ variant?: 'table' | 'cards' | 'hero' | 'dashboard'; rows?: number }>(), {
  variant: 'table',
  rows: 6,
})
</script>

<template>
  <div class="sk" :class="`sk--${variant}`" role="status" aria-live="polite" aria-label="A carregar">
    <!-- Cabeçalho da página (só no dashboard, cujo overlay tapa também o PageHeader) -->
    <div v-if="variant === 'dashboard'" class="sk-head">
      <div class="sk-line sk-w-15 sk-h-lg" />
      <div class="sk-line sk-w-25 sk-h-sm" />
    </div>

    <!-- Cartão de topo (hero / dashboard) -->
    <div v-if="variant === 'hero' || variant === 'dashboard'" class="sk-card sk-hero">
      <div class="sk-line sk-w-15 sk-h-sm" />
      <div class="sk-line sk-w-30 sk-h-xl" />
      <div class="sk-line sk-w-20 sk-h-sm" />
      <div class="sk-chart" />
    </div>

    <!-- 3 cartões (dashboard) -->
    <div v-if="variant === 'dashboard'" class="sk-grid sk-grid--3">
      <div v-for="i in 3" :key="i" class="sk-card">
        <div class="sk-line sk-w-40 sk-h-md" />
        <div v-for="j in 3" :key="j" class="sk-row-mini">
          <div class="sk-dot" />
          <div class="sk-line sk-w-50" />
          <div class="sk-line sk-w-20 sk-push" />
        </div>
      </div>
    </div>

    <!-- Grelha de cartões -->
    <div v-if="variant === 'cards'" class="sk-grid">
      <div v-for="i in rows" :key="i" class="sk-card sk-card--tile">
        <div class="sk-row-mini">
          <div class="sk-dot" />
          <div class="sk-line sk-w-50" />
        </div>
        <div class="sk-line sk-w-40 sk-h-lg" />
        <div class="sk-line sk-w-70 sk-h-sm" />
      </div>
    </div>

    <!-- Tabela -->
    <template v-if="variant === 'table' || variant === 'hero'">
      <div v-if="variant === 'table'" class="sk-toolbar">
        <div v-for="i in 4" :key="i" class="sk-pill" />
      </div>
      <div class="sk-card sk-table">
        <div v-for="i in rows" :key="i" class="sk-table-row">
          <div class="sk-line sk-w-10" />
          <div class="sk-dot" />
          <div class="sk-line sk-w-30" />
          <div class="sk-line sk-w-15 sk-push" />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.sk {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  width: 100%;
  max-width: var(--page-max);
  margin: 0 auto;
}

.sk-head {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-bottom: var(--space-1);
}

.sk-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xs);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.sk-hero {
  padding: var(--space-6);
}

.sk-chart {
  height: 180px;
  margin-top: var(--space-3);
  border-radius: var(--radius-md);
}

.sk-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr));
  gap: var(--space-5);
}

.sk-grid--3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.sk-card--tile {
  min-height: 130px;
}

.sk-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.sk-pill {
  width: 110px;
  height: var(--control-h);
  border-radius: var(--radius-sm);
}

.sk-table {
  padding: var(--space-1) var(--space-5);
  gap: 0;
}

.sk-table-row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: 14px 0;
  border-bottom: 1px solid var(--color-border-subtle);
}

.sk-table-row:last-child {
  border-bottom: none;
}

.sk-row-mini {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 6px 0;
}

.sk-push {
  margin-left: auto;
}

/* Blocos com brilho (tokens → acompanham claro/escuro) */
.sk-line,
.sk-dot,
.sk-chart,
.sk-pill {
  background: linear-gradient(
    90deg,
    var(--color-surface-muted) 0%,
    var(--color-surface-2) 50%,
    var(--color-surface-muted) 100%
  );
  background-size: 200% 100%;
  animation: sk-shimmer 1.4s ease-in-out infinite;
}

.sk-line {
  height: 12px;
  border-radius: var(--radius-full);
}

.sk-dot {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.sk-h-sm { height: 10px; }
.sk-h-md { height: 14px; }
.sk-h-lg { height: 20px; }
.sk-h-xl { height: 32px; }
.sk-w-10 { width: 10%; }
.sk-w-15 { width: 15%; }
.sk-w-20 { width: 20%; }
.sk-w-25 { width: 25%; }
.sk-w-30 { width: 30%; }
.sk-w-35 { width: 35%; }
.sk-w-40 { width: 40%; }
.sk-w-50 { width: 50%; }
.sk-w-60 { width: 60%; }
.sk-w-70 { width: 70%; }

@keyframes sk-shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .sk-line,
  .sk-dot,
  .sk-chart,
  .sk-pill {
    animation: none;
  }
}

@media (max-width: 900px) {
  .sk-grid--3 {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .sk-head .sk-w-15 { width: 45%; }
  .sk-head .sk-w-25 { width: 65%; }
  .sk-hero { padding: var(--space-5) var(--space-4); }
  .sk-hero .sk-w-15 { width: 35%; }
  .sk-hero .sk-w-30 { width: 60%; }
  .sk-hero .sk-w-20 { width: 40%; }
}
</style>
