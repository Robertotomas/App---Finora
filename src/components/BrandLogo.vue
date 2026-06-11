<script setup lang="ts">
import { computed, ref, watch, useSlots } from 'vue'
import { findBrand, logoDevEnabled, logoDevUrl, faviconUrl, FALLBACK_BRAND_ICON, type Brand } from '@/types/brandLogos'

const props = withDefaults(
  defineProps<{
    /** Nome livre (entidade/conta) — resolvido via findBrand. */
    name?: string | null
    /** Domínio direto (tem prioridade sobre name). */
    domain?: string | null
    size?: number
    /** Se false, não mostra nada quando não há logo (nem genérico). Ignorado se houver slot #fallback. */
    showFallback?: boolean
  }>(),
  { name: '', domain: null, size: 28, showFallback: true },
)

const slots = useSlots()
const hasFallbackSlot = computed(() => !!slots.fallback)

/* ── Cache de falhas (por domínio+fonte) em localStorage, para não repetir pedidos mortos ── */
const FAIL_KEY = 'brandLogoFailed_v3'
const failed = loadFailed()

function loadFailed(): Set<string> {
  try {
    const raw = localStorage.getItem(FAIL_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}
function rememberFail(key: string) {
  failed.add(key)
  try {
    localStorage.setItem(FAIL_KEY, JSON.stringify([...failed]))
  } catch {
    /* quota/privado — ignora */
  }
}

const resolvedDomain = computed<string | null>(() => {
  if (props.domain) return props.domain
  const b: Brand | null = findBrand(props.name)
  return b ? b.domain : null
})

/**
 * Cadeia de fontes: Logo.dev (se houver token) → favicon do Google → (sem logo).
 * Logo.dev dá 404 quando não tem o logo; o favicon do Google devolve um globo
 * genérico a 16px quando não tem (detetado no @load).
 */
const SOURCES: string[] = logoDevEnabled() ? ['logodev', 'favicon'] : ['favicon']

function urlFor(domain: string, kind: string): string {
  return kind === 'logodev' ? logoDevUrl(domain) : faviconUrl(domain)
}

const sourceIndex = ref(0)

function firstViableIndex(domain: string): number {
  for (let i = 0; i < SOURCES.length; i++) {
    if (!failed.has(`${domain}|${SOURCES[i]}`)) return i
  }
  return SOURCES.length
}

watch(
  resolvedDomain,
  (d) => {
    sourceIndex.value = d ? firstViableIndex(d) : SOURCES.length
  },
  { immediate: true },
)

const currentKind = computed<string | null>(() => SOURCES[sourceIndex.value] ?? null)

const currentUrl = computed(() => {
  const d = resolvedDomain.value
  if (!d || !currentKind.value) return null
  return urlFor(d, currentKind.value)
})

function advance() {
  const d = resolvedDomain.value
  if (d && currentKind.value) rememberFail(`${d}|${currentKind.value}`)
  sourceIndex.value += 1
}

function onError() {
  advance()
}

function onLoad(e: Event) {
  if (currentKind.value !== 'favicon') return
  const img = e.target as HTMLImageElement
  // Globo genérico do Google = 16px. Logos reais vêm maiores.
  if (img.naturalWidth && img.naturalWidth <= 16) advance()
}

// Quando não há logo: usa o slot #fallback se existir, senão o ícone genérico (se showFallback).
const useSlotFallback = computed(() => !currentUrl.value && hasFallbackSlot.value)
const useGeneric = computed(() => !currentUrl.value && !hasFallbackSlot.value && props.showFallback)
const shouldRender = computed(() => !!currentUrl.value || useSlotFallback.value || useGeneric.value)
</script>

<template>
  <span
    v-if="shouldRender"
    class="brand-logo"
    :class="{ 'brand-logo--plain': useSlotFallback }"
    :style="{ width: size + 'px', height: size + 'px' }"
    aria-hidden="true"
  >
    <img
      v-if="currentUrl"
      :src="currentUrl"
      :width="size"
      :height="size"
      alt=""
      loading="lazy"
      class="brand-logo-img"
      @error="onError"
      @load="onLoad"
    />
    <slot v-else-if="useSlotFallback" name="fallback" />
    <svg
      v-else
      xmlns="http://www.w3.org/2000/svg"
      :width="Math.round(size * 0.62)"
      :height="Math.round(size * 0.62)"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="brand-logo-generic"
      v-html="FALLBACK_BRAND_ICON"
    ></svg>
  </span>
</template>

<style scoped>
.brand-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  background: var(--color-bg, #f1f5f9);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  vertical-align: middle;
}

/* Quando o fallback vem de um slot, o wrapper é transparente (o slot define o seu visual). */
.brand-logo--plain {
  background: transparent;
  border: none;
  border-radius: 0;
  overflow: visible;
}

.brand-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #ffffff;
}

.brand-logo-generic {
  opacity: 0.7;
}
</style>
