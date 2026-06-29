<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { logoDevTickerUrl, logoDevUrl, logoDevEnabled } from '@/types/brandLogos'
import { InstrumentType, instrumentBrandDomain, etfTickerDomain } from '@/types/investment'

const props = withDefaults(
  defineProps<{
    symbol: string
    name?: string
    type?: InstrumentType
    /** Domínio da marca já resolvido (Logo.dev backend) — prioritário sobre o mapa/ticker. */
    domain?: string | null
    size?: number
  }>(),
  { size: 32, name: '', type: undefined, domain: null },
)

const idx = ref(0)

// Fontes candidatas, por ordem:
//  - ETF/Fundo: logo do EMISSOR (Vanguard, iShares...) — o ticker dá muitas vezes o logo errado.
//  - Ação/Outro: logo por TICKER.
// Iniciais como fallback final.
const candidates = computed<string[]>(() => {
  if (!logoDevEnabled() || !props.symbol) return []
  const list: string[] = []
  // 1) Domínio resolvido no backend (Logo.dev search) — prioritário.
  if (props.domain) list.push(logoDevUrl(props.domain))
  // 2) Mapa curado (ETF → emissor pelo nome; ação → empresa).
  const mapped = props.type !== undefined ? instrumentBrandDomain(props.name, props.type) : null
  if (mapped && mapped !== props.domain) list.push(logoDevUrl(mapped))
  // 2b) ETF: emissor pelo TICKER (o nome importado costuma ser só o ticker, ex.: "VUAA").
  if (props.type === InstrumentType.Etf) {
    const td = etfTickerDomain(props.symbol)
    if (td && td !== props.domain && td !== mapped) list.push(logoDevUrl(td))
  }
  // 3) Ações: logo por ticker como reserva (bom para EUA). ETFs não, para evitar logos errados.
  if (props.type !== InstrumentType.Etf) list.push(logoDevTickerUrl(props.symbol))
  return list
})

const currentSrc = computed(() => (idx.value < candidates.value.length ? candidates.value[idx.value] : ''))
const showImg = computed(() => !!currentSrc.value)

function onError() {
  idx.value += 1
}

const initials = computed(() => (props.symbol || '?').slice(0, 2).toUpperCase())
const bg = computed(() => {
  const palette = ['#166534', '#2563eb', '#db2777', '#ca8a04', '#0891b2', '#7c3aed', '#dc2626', '#0d9488']
  let h = 0
  for (const ch of props.symbol || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return palette[h % palette.length]
})

watch(
  () => [props.symbol, props.name, props.type, props.domain],
  () => (idx.value = 0),
)
</script>

<template>
  <span class="inst-logo" :style="{ width: size + 'px', height: size + 'px' }">
    <img
      v-if="showImg"
      :key="currentSrc"
      :src="currentSrc"
      :width="size"
      :height="size"
      alt=""
      loading="lazy"
      @error="onError"
    />
    <span v-else class="inst-logo-fallback" :style="{ background: bg, fontSize: Math.round(size * 0.36) + 'px' }">
      {{ initials }}
    </span>
  </span>
</template>

<style scoped>
.inst-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 9px;
  overflow: hidden;
  background: var(--color-table-row-hover);
}

.inst-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 9px;
}

.inst-logo-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #fff;
  font-weight: 700;
  letter-spacing: -0.02em;
}
</style>
