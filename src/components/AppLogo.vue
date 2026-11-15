<script setup lang="ts">
/**
 * Logo da FinoraFlow — ícone (quadrado verde arredondado com o "F" branco, igual ao favicon) + nome.
 * Fonte única do logo na app; sem PNG nem filtros (acompanha claro/escuro por tokens).
 * - `size`: altura do ícone em px (o nome escala a partir dele).
 * - `markOnly`: só o ícone. `inverse`: para fundos verdes (ícone branco com F verde, nome branco).
 * Geometria do "F" numa grelha 20×22 — espelhada em public/favicon.svg e nos ícones PNG
 * (gerados a partir da mesma geometria; ao mudar aqui, regenerar esses ficheiros).
 */
withDefaults(defineProps<{ size?: number; markOnly?: boolean; inverse?: boolean }>(), { size: 28 })
</script>

<template>
  <span class="app-logo" :class="{ 'app-logo--inverse': inverse }" :style="{ '--logo-size': size + 'px' }">
    <span class="app-logo-tile" aria-hidden="true">
      <svg viewBox="0 0 20 22">
        <polygon points="0 0 20 0 16.25 5 0 5" />
        <polygon points="7.5 7.5 16.5 7.5 12.75 12.5 7.5 12.5" />
        <polygon points="0 7.5 5 7.5 5 17 0 22" />
      </svg>
    </span>
    <span v-if="!markOnly" class="app-logo-word">FinoraFlow</span>
    <span v-else class="sr-only">FinoraFlow</span>
  </span>
</template>

<style scoped>
.app-logo {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--logo-size) * 0.36);
  line-height: 1;
  user-select: none;
}
.app-logo-tile {
  width: var(--logo-size);
  height: var(--logo-size);
  flex-shrink: 0;
  border-radius: calc(var(--logo-size) * 0.24);
  background: var(--brand-600);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.app-logo-tile svg {
  /* mesmo enquadramento do favicon: F a ~50% da altura, ligeiramente à direita (centragem ótica) */
  height: 52%;
  width: calc(var(--logo-size) * 0.52 * 20 / 22);
  margin-left: calc(var(--logo-size) * 0.04);
  fill: #fff;
}
.app-logo-word {
  font-family: var(--font-sans);
  font-size: calc(var(--logo-size) * 0.68);
  font-weight: var(--weight-bold);
  letter-spacing: -0.035em;
  color: var(--color-text-strong);
  white-space: nowrap;
}
.app-logo--inverse .app-logo-tile {
  background: #fff;
}
.app-logo--inverse .app-logo-tile svg {
  fill: var(--brand-600);
}
.app-logo--inverse .app-logo-word {
  color: #fff;
}
</style>
