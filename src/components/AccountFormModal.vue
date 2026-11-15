<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import BaseModal from './BaseModal.vue'
import BrandLogo from './BrandLogo.vue'
import BrandAutocomplete from './BrandAutocomplete.vue'
import UiButton from './ui/UiButton.vue'
import { accountBanks, COUNTRIES, type Brand } from '@/types/brandLogos'
import type { Account, CreateAccountRequest } from '@/types/account'
import { AccountType } from '@/types/account'

const props = defineProps<{
  open: boolean
  account?: Account | null
  loading?: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: CreateAccountRequest]
}>()

const isEdit = computed(() => !!props.account)

type Step = 'pick' | 'details'
const step = ref<Step>('pick')

const country = ref('pt')
const query = ref('')

const name = ref('')
const balance = ref<number | null>(null)
const errors = ref<Record<string, string>>({})
/** Domínio do banco escolhido — mantém o logo mesmo que o nome seja personalizado. */
const selectedDomain = ref<string | null>(null)

/* ── Seletor de país (bandeiras via flagcdn; emojis de bandeira não renderizam no Windows) ── */
const countryOpen = ref(false)
const countryRef = ref<HTMLElement | null>(null)
function flagSrc(code: string): string {
  return `https://flagcdn.com/w40/${code}.png`
}
const selectedCountry = computed(() => COUNTRIES.find((c) => c.code === country.value) ?? COUNTRIES[0])
function selectCountry(code: string) {
  country.value = code
  countryOpen.value = false
}
function onCountryOutside(e: MouseEvent) {
  if (countryOpen.value && countryRef.value && !countryRef.value.contains(e.target as Node)) {
    countryOpen.value = false
  }
}
onMounted(() => document.addEventListener('click', onCountryOutside, true))
onUnmounted(() => document.removeEventListener('click', onCountryOutside, true))

/* ── Lista de instituições (filtrada por país + pesquisa) ── */
const institutions = computed(() => accountBanks(country.value, query.value))
const popularBanks = computed(() => institutions.value.filter((b) => b.popular))
const otherBanks = computed(() => institutions.value.filter((b) => !b.popular))

watch(
  () => props.open,
  (open) => {
    if (!open) return
    errors.value = {}
    query.value = ''
    if (props.account) {
      // Edição: vai direto aos detalhes (mantém o logo guardado).
      step.value = 'details'
      name.value = props.account.name
      balance.value = props.account.balance
      selectedDomain.value = props.account.logoDomain ?? null
    } else {
      selectedDomain.value = null
      step.value = 'pick'
      country.value = 'pt'
      name.value = ''
      balance.value = null
    }
  },
)

function pickInstitution(b: Brand) {
  name.value = b.name
  selectedDomain.value = b.domain
  balance.value = null
  errors.value = {}
  step.value = 'details'
}

function pickManual() {
  name.value = ''
  selectedDomain.value = null
  balance.value = null
  errors.value = {}
  step.value = 'details'
}

function backToPick() {
  errors.value = {}
  step.value = 'pick'
}

function validate(): boolean {
  const e: Record<string, string> = {}
  if (!name.value.trim()) e.name = 'Nome é obrigatório'
  else if (name.value.length > 200) e.name = 'Nome é demasiado longo'
  errors.value = e
  return Object.keys(e).length === 0
}

function handleSubmit() {
  if (!validate()) return
  emit('submit', {
    name: name.value.trim(),
    type: AccountType.Bank,
    balance: Number(balance.value) || 0,
    currency: 'EUR',
    logoDomain: selectedDomain.value,
  })
}

function handleClose() {
  if (!props.loading) emit('close')
}
</script>

<template>
  <BaseModal
    v-if="open"
    :title="isEdit ? 'Editar conta' : 'Adicionar conta'"
    :subtitle="step === 'pick' ? 'Escolha a sua instituição ou adicione a conta manualmente.' : undefined"
    @close="handleClose"
  >
    <!-- ── Passo 1: escolher instituição ── -->
    <div v-if="step === 'pick'" class="picker">
      <div class="picker-top">
        <div class="search-wrap">
          <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            v-model="query"
            type="text"
            class="search-input"
            placeholder="Pesquisar instituição..."
            autocomplete="off"
          />
        </div>
        <div ref="countryRef" class="country-select">
          <button type="button" class="country-btn" @click.stop="countryOpen = !countryOpen">
            <img :src="flagSrc(selectedCountry.code)" :alt="selectedCountry.name" class="flag-img" />
            <svg class="country-chevron" :class="{ open: countryOpen }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <Transition name="select-pop">
            <div v-show="countryOpen" class="country-menu">
              <button
                v-for="c in COUNTRIES"
                :key="c.code"
                type="button"
                class="country-option"
                :class="{ 'is-selected': c.code === country }"
                @click="selectCountry(c.code)"
              >
                <img :src="flagSrc(c.code)" :alt="c.name" class="flag-img" />
                <span class="country-option-label">{{ c.name }}</span>
              </button>
            </div>
          </Transition>
        </div>
      </div>

      <div class="picker-list">
        <!-- Adicionar manualmente -->
        <button type="button" class="inst-row inst-row--manual" @click="pickManual">
          <span class="inst-manual-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
          </span>
          <span class="inst-name">Adicionar manualmente</span>
          <svg class="inst-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>

        <template v-if="popularBanks.length">
          <p class="inst-section">Mais populares</p>
          <button v-for="b in popularBanks" :key="b.name" type="button" class="inst-row" @click="pickInstitution(b)">
            <BrandLogo :name="b.name" :size="32">
              <template #fallback>
                <span class="bank-default-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10 12 4l9 6"/><path d="M5 10v9"/><path d="M9 10v9"/><path d="M15 10v9"/><path d="M19 10v9"/><path d="M3 21h18"/></svg>
                </span>
              </template>
            </BrandLogo>
            <span class="inst-name">{{ b.name }}</span>
            <svg class="inst-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </template>

        <template v-if="otherBanks.length">
          <p class="inst-section">Outras instituições</p>
          <button v-for="b in otherBanks" :key="b.name" type="button" class="inst-row" @click="pickInstitution(b)">
            <BrandLogo :name="b.name" :size="32">
              <template #fallback>
                <span class="bank-default-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10 12 4l9 6"/><path d="M5 10v9"/><path d="M9 10v9"/><path d="M15 10v9"/><path d="M19 10v9"/><path d="M3 21h18"/></svg>
                </span>
              </template>
            </BrandLogo>
            <span class="inst-name">{{ b.name }}</span>
            <svg class="inst-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </template>

        <p v-if="!popularBanks.length && !otherBanks.length" class="inst-empty">
          Sem resultados. Use "Adicionar manualmente".
        </p>
      </div>
    </div>

    <!-- ── Passo 2: detalhes (nome + saldo) ── -->
    <form v-else id="account-form" class="modal-form" @submit.prevent="handleSubmit">
      <UiButton v-if="!isEdit" variant="ghost" size="sm" class="back-btn" @click="backToPick">
        <template #icon>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </template>
        Voltar
      </UiButton>

      <div class="form-group">
        <label for="account-name">Nome</label>
        <BrandAutocomplete
          id="account-name"
          v-model="name"
          scope="bank"
          domain-mode
          :logo-domain="selectedDomain"
          placeholder="Nome da conta"
          :maxlength="200"
          :error="!!errors.name"
          @select="(b) => (selectedDomain = b.domain)"
        />
        <p class="hint">Escreva para ver sugestões de bancos, ou use um nome livre.</p>
        <span v-if="errors.name" class="error-text">{{ errors.name }}</span>
      </div>

      <div class="form-group">
        <label for="account-balance">Saldo</label>
        <div class="amount-wrap">
          <input
            id="account-balance"
            v-model.number="balance"
            type="number"
            step="0.01"
            class="input amount-input"
            placeholder="0,00"
          />
          <span class="amount-suffix">€</span>
        </div>
      </div>

    </form>

    <template v-if="step === 'details'" #footer>
      <UiButton variant="secondary" :disabled="loading" @click="handleClose">Cancelar</UiButton>
      <UiButton type="submit" form="account-form" :loading="loading">
        {{ isEdit ? 'Guardar' : 'Criar' }}
      </UiButton>
    </template>
  </BaseModal>
</template>

<style scoped>
/* ── Passo 1: escolher instituição ── */
.picker {
  display: flex;
  flex-direction: column;
}

.picker-top {
  display: flex;
  gap: var(--space-2);
  align-items: stretch;
  padding-bottom: var(--space-3);
}

.search-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
}
.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-subtle);
  pointer-events: none;
}
.search-input {
  width: 100%;
  height: 40px;
  box-sizing: border-box;
  padding: 0 12px 0 36px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: var(--text-base);
  color: var(--color-text-strong);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.search-input::placeholder {
  color: var(--color-text-subtle);
}
.search-input:hover:not(:focus) {
  border-color: var(--color-text-subtle);
}
.search-input:focus,
.search-input:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--focus-ring);
}

.country-select {
  position: relative;
  flex-shrink: 0;
}
.country-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.country-btn:hover {
  border-color: var(--color-text-subtle);
}
.country-btn:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--focus-ring);
}

.flag-img {
  width: 22px;
  height: 16px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
  box-shadow: 0 0 0 1px var(--color-border);
}

.country-chevron {
  color: var(--color-text-muted);
  transition: transform var(--transition-fast);
}
.country-chevron.open {
  transform: rotate(180deg);
}

.country-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 20;
  min-width: 180px;
  padding: 4px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}
.country-option {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: 34px;
  padding: 0 10px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  font-size: var(--text-base);
  color: var(--color-text);
}
.country-option:hover {
  background: var(--color-surface-muted);
}
.country-option.is-selected {
  background: var(--color-selected);
  color: var(--color-selected-text);
  font-weight: var(--weight-semibold);
}
.country-option-label {
  flex: 1;
}

.select-pop-enter-active,
.select-pop-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.select-pop-enter-from,
.select-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.picker-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 340px;
  overflow-y: auto;
  margin: 0 -6px;
  padding: 0 6px;
}

.bank-default-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: var(--radius-sm);
  background: var(--color-primary-soft);
  color: var(--color-primary-text);
}

.inst-section {
  margin: var(--space-3) 0 var(--space-1);
  padding: 0 var(--space-2);
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-caps);
  color: var(--color-text-muted);
}

.inst-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-2);
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: background var(--transition-fast);
}
.inst-row:hover {
  background: var(--color-surface-muted);
}
.inst-row:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.inst-name {
  flex: 1;
  min-width: 0;
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  color: var(--color-text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.inst-chevron {
  flex-shrink: 0;
  color: var(--color-text-subtle);
}

.inst-manual-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--color-border-strong);
  background: var(--color-surface);
  color: var(--color-text-muted);
}

.inst-empty {
  margin: 0;
  padding: var(--space-6) var(--space-2);
  text-align: center;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

/* ── Passo 2: detalhes ── */
.back-btn {
  align-self: flex-start;
  margin: -4px 0 -4px -8px;
}
</style>
