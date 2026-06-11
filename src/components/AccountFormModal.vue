<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import BaseModal from './BaseModal.vue'
import BrandLogo from './BrandLogo.vue'
import BrandAutocomplete from './BrandAutocomplete.vue'
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
          <button v-for="b in popularBanks" :key="b.domain" type="button" class="inst-row" @click="pickInstitution(b)">
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
          <button v-for="b in otherBanks" :key="b.domain" type="button" class="inst-row" @click="pickInstitution(b)">
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
          Sem resultados. Usa "Adicionar manualmente".
        </p>
      </div>
    </div>

    <!-- ── Passo 2: detalhes (nome + saldo) ── -->
    <form v-else class="account-form" @submit.prevent="handleSubmit">
      <button v-if="!isEdit" type="button" class="back-btn" @click="backToPick">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Voltar
      </button>

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
        <p class="name-hint">Escreva para ver sugestões de bancos, ou use um nome livre.</p>
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

      <div class="modal-actions">
        <button type="button" class="btn-cancel" @click="handleClose">Cancelar</button>
        <button type="submit" class="btn-primary" :disabled="loading">
          {{ loading ? 'A guardar...' : (isEdit ? 'Guardar' : 'Criar') }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>

<style scoped>
/* ── Picker ── */
.picker {
  display: flex;
  flex-direction: column;
}

.picker-top {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
  padding-bottom: 0.75rem;
}

.search-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted, #94a3b8);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 0.6rem 0.75rem 0.6rem 2.25rem;
  border: 1px solid var(--color-input-border, #e2e8f0);
  border-radius: 10px;
  font-size: 0.9375rem;
  font-family: inherit;
  background: var(--color-input-bg, #fff);
  color: var(--color-text);
}

.search-input:focus {
  outline: none;
  border-color: #166534;
}

html.dark .search-input:focus {
  border-color: #4ade80;
}

.country-select {
  position: relative;
  flex-shrink: 0;
}

.country-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  height: 100%;
  padding: 0.5rem 0.625rem;
  background: var(--color-input-bg, #fff);
  border: 1px solid var(--color-input-border, #e2e8f0);
  border-radius: 10px;
  cursor: pointer;
}

.flag-img {
  width: 22px;
  height: 16px;
  object-fit: cover;
  border-radius: 3px;
  flex-shrink: 0;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08);
}

.country-chevron {
  color: var(--color-text-muted, #64748b);
  transition: transform 0.18s ease;
}
.country-chevron.open {
  transform: rotate(180deg);
}

.country-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 20;
  min-width: 160px;
  padding: 4px;
  background: var(--color-bg-card, #fff);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 10px 30px -8px rgba(0, 0, 0, 0.25), 0 4px 12px -4px rgba(0, 0, 0, 0.12);
}

.country-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.45rem 0.625rem;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  font-size: 0.875rem;
  color: var(--color-text);
}

.country-option:hover {
  background: var(--color-table-row-hover, #f1f5f9);
}

.country-option.is-selected {
  font-weight: 650;
}

.country-option-label {
  flex: 1;
}

.select-pop-enter-active,
.select-pop-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
  transform-origin: top;
}
.select-pop-enter-from,
.select-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px) scaleY(0.96);
}

.picker-list {
  display: flex;
  flex-direction: column;
  max-height: 320px;
  overflow-y: auto;
  margin: 0 -0.25rem;
  padding: 0 0.25rem;
}

.bank-default-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 8px;
  background: #ecfdf5;
  color: #166534;
}

html.dark .bank-default-icon {
  background: rgba(22, 101, 52, 0.2);
  color: #4ade80;
}

.inst-section {
  margin: 0.75rem 0 0.25rem;
  padding: 0 0.25rem;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted, #94a3b8);
}

.inst-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.6rem 0.5rem;
  border: none;
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: background 0.12s;
}

.inst-row:hover {
  background: var(--color-table-row-hover, #f1f5f9);
}

.inst-name {
  flex: 1;
  min-width: 0;
  font-size: 0.9375rem;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inst-chevron {
  flex-shrink: 0;
  color: var(--color-text-muted, #94a3b8);
}

.inst-manual-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 8px;
  background: var(--color-table-row-hover, #f1f5f9);
  color: var(--color-text-muted);
}

.inst-empty {
  padding: 1.5rem 0.5rem;
  text-align: center;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

/* ── Detalhes ── */
.account-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  align-self: flex-start;
  padding: 0.25rem 0.5rem 0.25rem 0.25rem;
  margin-bottom: -0.25rem;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 0.8125rem;
  font-family: inherit;
  cursor: pointer;
  border-radius: 8px;
}

.back-btn:hover {
  background: var(--color-table-row-hover);
  color: var(--color-text);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.form-group label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-muted, #475569);
}

.name-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--color-input-border, #e2e8f0);
  border-radius: 8px;
  background: var(--color-input-bg, #fff);
}

.name-row:focus-within {
  border-color: var(--color-input-border, #e2e8f0);
}

.name-row.is-error {
  border-color: #dc2626;
}

.name-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.9375rem;
  font-family: inherit;
  color: var(--color-text);
}

.amount-wrap {
  position: relative;
}

.amount-input {
  width: 100%;
  padding-right: 2rem;
  -moz-appearance: textfield;
  appearance: textfield;
}

.amount-input::-webkit-outer-spin-button,
.amount-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.amount-suffix {
  position: absolute;
  right: 0.875rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text-muted, #64748b);
  pointer-events: none;
}

.input {
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--color-input-border, #e2e8f0);
  border-radius: 8px;
  font-size: 0.9375rem;
  font-family: inherit;
  background: var(--color-input-bg, #fff);
  color: var(--color-text);
}

.input:focus {
  outline: none;
  border-color: #166534;
  box-shadow: 0 0 0 2px rgba(22, 101, 52, 0.2);
}

html.dark .input:focus {
  border-color: #4ade80;
  box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.2);
}

.error-text {
  font-size: 0.75rem;
  color: #dc2626;
}

.name-hint {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.btn-cancel {
  padding: 0.5rem 1rem;
  background: transparent;
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 0.875rem;
  font-family: inherit;
  cursor: pointer;
}

.btn-cancel:hover {
  background: var(--color-table-row-hover);
}

.btn-primary {
  padding: 0.5rem 1.125rem;
  background: linear-gradient(135deg, #166534 0%, #15803d 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(22, 101, 52, 0.25);
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
