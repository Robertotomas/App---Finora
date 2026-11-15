<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import BrandLogo from './BrandLogo.vue'
import {
  searchBrands,
  findBrand,
  primaryLogoUrl,
  POPULAR_BANK_DOMAINS,
  type Brand,
  type BrandType,
} from '@/types/brandLogos'

const props = withDefaults(
  defineProps<{
    modelValue: string
    /** 'bank' mostra só bancos (e os principais ao focar vazio); 'all' mostra tudo. */
    scope?: 'all' | BrandType
    placeholder?: string
    maxlength?: number
    id?: string
    error?: boolean
    /** Quando true, o logo do prefixo vem de `logoDomain` (escolha explícita), não do findBrand pelo nome. */
    domainMode?: boolean
    /** Domínio do logo a mostrar no prefixo quando `domainMode` (persiste mesmo com nome personalizado). */
    logoDomain?: string | null
  }>(),
  { scope: 'all', placeholder: '', maxlength: 200, id: undefined, error: false, domainMode: false, logoDomain: null },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  select: [brand: Brand]
}>()

const root = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const open = ref(false)
const activeIndex = ref(0)
const menuStyle = ref<Record<string, string>>({})

const MAX_SUGGESTIONS = 8

const suggestions = computed<Brand[]>(() => {
  const list = searchBrands(props.modelValue, props.scope)
  return list.slice(0, MAX_SUGGESTIONS)
})

/** Marca correspondente ao valor atual (para o logo no prefixo) — só no modo "auto" (findBrand). */
const matched = computed<Brand | null>(() => (props.domainMode ? null : findBrand(props.modelValue)))

function onInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  emit('update:modelValue', value)
  activeIndex.value = 0
  if (!open.value) openMenu()
}

function select(brand: Brand) {
  emit('update:modelValue', brand.name)
  emit('select', brand)
  closeMenu()
}

function onEnter() {
  if (open.value && suggestions.value.length > 0) {
    select(suggestions.value[Math.min(activeIndex.value, suggestions.value.length - 1)])
  } else {
    closeMenu()
  }
}

function moveActive(delta: number) {
  if (!open.value) { openMenu(); return }
  const n = suggestions.value.length
  if (n === 0) return
  activeIndex.value = (activeIndex.value + delta + n) % n
}

/* ── Posição fixed (não cortada por modais com scroll); abre para cima se preciso ── */
function updatePosition() {
  const wrap = root.value?.querySelector('.brand-ac-input-wrap') as HTMLElement | undefined
  if (!wrap) return
  const r = wrap.getBoundingClientRect()
  const spaceBelow = window.innerHeight - r.bottom
  const spaceAbove = r.top
  const desired = 300
  const openUp = spaceBelow < desired && spaceAbove > spaceBelow
  const base: Record<string, string> = {
    position: 'fixed',
    left: `${r.left}px`,
    width: `${r.width}px`,
    right: 'auto',
  }
  menuStyle.value = openUp
    ? { ...base, bottom: `${window.innerHeight - r.top + 4}px`, top: 'auto', maxHeight: `${Math.min(desired, spaceAbove - 8)}px` }
    : { ...base, top: `${r.bottom + 4}px`, maxHeight: `${Math.min(desired, spaceBelow - 8)}px` }
}

async function openMenu() {
  open.value = true
  activeIndex.value = 0
  await nextTick()
  updatePosition()
  window.addEventListener('scroll', updatePosition, true)
  window.addEventListener('resize', updatePosition)
}

function closeMenu() {
  open.value = false
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
}

function onFocus() {
  openMenu()
}

function onClickOutside(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) closeMenu()
}

// Não deixar o activeIndex fora do intervalo quando a lista encolhe
watch(suggestions, (list) => {
  if (activeIndex.value >= list.length) activeIndex.value = 0
})

/** Warm-up do cache: pré-carrega os logos dos bancos principais (scope bank). */
function warmUpBankLogos() {
  if (props.scope !== 'bank') return
  for (const domain of POPULAR_BANK_DOMAINS) {
    const img = new Image()
    img.src = primaryLogoUrl(domain)
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  warmUpBankLogos()
})
onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
  window.removeEventListener('scroll', updatePosition, true)
  window.removeEventListener('resize', updatePosition)
})
</script>

<template>
  <div ref="root" class="brand-ac" :class="{ 'is-open': open }">
    <div class="brand-ac-input-wrap" :class="{ 'is-error': error }">
      <BrandLogo
        v-if="domainMode && logoDomain"
        :domain="logoDomain"
        :size="22"
        :show-fallback="false"
        class="brand-ac-prefix"
      />
      <BrandLogo
        v-else-if="matched"
        :name="matched.name"
        :size="22"
        :show-fallback="false"
        class="brand-ac-prefix"
      />
      <input
        :id="id"
        ref="inputEl"
        :value="modelValue"
        type="text"
        class="brand-ac-input"
        :placeholder="placeholder"
        :maxlength="maxlength"
        autocomplete="off"
        @input="onInput"
        @focus="onFocus"
        @keydown.down.prevent="moveActive(1)"
        @keydown.up.prevent="moveActive(-1)"
        @keydown.enter.prevent="onEnter"
        @keydown.esc.prevent="closeMenu"
      />
    </div>

    <Transition name="brand-ac-pop">
      <div v-show="open && suggestions.length > 0" class="brand-ac-menu" role="listbox" :style="menuStyle">
        <button
          v-for="(b, i) in suggestions"
          :key="b.name"
          type="button"
          class="brand-ac-option"
          :class="{ 'is-active': i === activeIndex }"
          role="option"
          :aria-selected="i === activeIndex"
          @mouseenter="activeIndex = i"
          @click="select(b)"
        >
          <BrandLogo :name="b.name" :size="24" />
          <span class="brand-ac-option-label">{{ b.name }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.brand-ac {
  position: relative;
  width: 100%;
}

.brand-ac-input-wrap {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: 40px;
  box-sizing: border-box;
  padding: 0 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.brand-ac-input-wrap:hover:not(:focus-within) {
  border-color: var(--color-text-subtle);
}
.brand-ac-input-wrap:focus-within {
  border-color: var(--color-primary);
  box-shadow: var(--focus-ring);
}
.brand-ac-input-wrap.is-error {
  border-color: var(--color-danger);
}

.brand-ac-prefix {
  margin-left: -4px;
  flex-shrink: 0;
}

.brand-ac-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0;
  border: none;
  outline: none;
  background: transparent;
  font-family: inherit;
  font-size: var(--text-base);
  color: var(--color-text-strong);
}
/* Anula o halo global de input:focus-visible (o wrapper é que dá o foco) */
.brand-ac-input:focus,
.brand-ac-input:focus-visible {
  border: none;
  outline: none;
  box-shadow: none;
}
.brand-ac-input::placeholder {
  color: var(--color-text-subtle);
}

.brand-ac-menu {
  position: absolute;
  z-index: var(--z-popover);
  padding: 4px;
  overflow-y: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}

.brand-ac-option {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 34px;
  padding: 3px 10px 3px 6px;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: var(--text-base);
  color: var(--color-text);
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
}
.brand-ac-option.is-active {
  background: var(--color-surface-muted);
  color: var(--color-text-strong);
}

.brand-ac-option-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brand-ac-pop-enter-active,
.brand-ac-pop-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.brand-ac-pop-enter-from,
.brand-ac-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
