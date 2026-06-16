<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import InstrumentAutocomplete from './InstrumentAutocomplete.vue'
import InstrumentLogo from './InstrumentLogo.vue'
import InstrumentMiniChart from './InstrumentMiniChart.vue'
import DatePicker from './DatePicker.vue'
import { InstrumentType, InvestmentOperation, INSTRUMENT_TYPE_LABELS } from '@/types/investment'
import type { InstrumentSearchResult, AddTransactionRequest, InvestmentTransaction } from '@/types/investment'

interface FixedInstrument {
  symbol: string
  exchange: string
  micCode: string
  providerSymbol: string
  name: string
  currency: string
  type: InstrumentType
  logoDomain?: string | null
}

const props = defineProps<{
  open: boolean
  /** Instrumento fixo (adicionar transação a uma posição existente / editar). */
  instrument?: FixedInstrument | null
  /** Transação a editar. */
  transaction?: InvestmentTransaction | null
  loading?: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: AddTransactionRequest]
}>()

const isEdit = computed(() => !!props.transaction)

const picked = ref<FixedInstrument | null>(null)
const operation = ref<InvestmentOperation>(InvestmentOperation.Buy)
const date = ref('')
const quantity = ref<number | null>(null)
const unitPrice = ref<number | null>(null)
const commission = ref<number | null>(null)
const fxFeePercent = ref<number | null>(0.5)
const errors = ref<Record<string, string>>({})

// Os valores de compra/venda são na moeda do instrumento (conforme o ticker).
const currencySymbol = computed(() => {
  const c = picked.value?.currency || 'EUR'
  return c === 'EUR' ? '€' : c === 'USD' ? '$' : c === 'GBP' ? '£' : c
})

// Só há câmbio (e fee) quando o instrumento não é em EUR.
const isForeign = computed(() => !!picked.value && picked.value.currency.toUpperCase() !== 'EUR')

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    errors.value = {}
    picked.value = props.instrument ?? null
    if (props.transaction) {
      operation.value = props.transaction.operation
      date.value = props.transaction.date.slice(0, 10)
      quantity.value = props.transaction.quantity
      unitPrice.value = props.transaction.unitPrice
      commission.value = props.transaction.commission
      fxFeePercent.value = props.transaction.fxFeePercent
    } else {
      operation.value = InvestmentOperation.Buy
      date.value = todayLocal()
      quantity.value = null
      unitPrice.value = null
      commission.value = null
      fxFeePercent.value = 0.5
    }
  },
)

function onSelect(r: InstrumentSearchResult) {
  picked.value = {
    symbol: r.symbol,
    exchange: r.exchange,
    micCode: r.micCode,
    providerSymbol: r.providerSymbol,
    name: r.name,
    currency: r.currency,
    type: r.type,
    logoDomain: r.logoDomain,
  }
}

function clearPicked() {
  if (props.instrument) return
  picked.value = null
}

function validate(): boolean {
  const e: Record<string, string> = {}
  if (!picked.value) e.instrument = 'Escolha um instrumento'
  if (!quantity.value || quantity.value <= 0) e.quantity = 'Indique a quantidade'
  if (unitPrice.value === null || unitPrice.value < 0) e.unitPrice = 'Indique o preço'
  errors.value = e
  return Object.keys(e).length === 0
}

function handleSubmit() {
  if (!validate() || !picked.value) return
  emit('submit', {
    symbol: picked.value.symbol,
    exchange: picked.value.exchange,
    micCode: picked.value.micCode,
    providerSymbol: picked.value.providerSymbol,
    name: picked.value.name,
    logoDomain: picked.value.logoDomain,
    currency: picked.value.currency,
    type: picked.value.type,
    operation: operation.value,
    date: date.value,
    quantity: Number(quantity.value),
    unitPrice: Number(unitPrice.value) || 0,
    commission: Number(commission.value) || 0,
    fxFeePercent: isForeign.value ? Number(fxFeePercent.value) || 0 : 0,
  })
}

function handleClose() {
  if (!props.loading) emit('close')
}
</script>

<template>
  <BaseModal v-if="open" :title="isEdit ? 'Editar transação' : 'Adicionar transação'" @close="handleClose">
    <form class="tx-form" @submit.prevent="handleSubmit">
      <!-- Escolher instrumento -->
      <div v-if="!picked" class="form-group">
        <label>Produto</label>
        <InstrumentAutocomplete :error="!!errors.instrument" @select="onSelect" />
        <span v-if="errors.instrument" class="error-text">{{ errors.instrument }}</span>
      </div>

      <!-- Instrumento escolhido -->
      <div v-else class="picked">
        <InstrumentLogo :symbol="picked.symbol" :name="picked.name" :type="picked.type" :domain="picked.logoDomain" :size="38" />
        <div class="picked-body">
          <div class="picked-info">
            <span class="picked-symbol">{{ picked.providerSymbol || picked.symbol }}</span>
            <span class="picked-badge">{{ INSTRUMENT_TYPE_LABELS[picked.type] }}</span>
            <span class="picked-meta">{{ picked.exchange }} · {{ picked.currency }}</span>
          </div>
          <span class="picked-name">{{ picked.name }}</span>
        </div>
        <button v-if="!instrument && !isEdit" type="button" class="picked-change" @click="clearPicked">Trocar</button>
      </div>

      <!-- Comportamento real do ticker -->
      <InstrumentMiniChart
        v-if="picked && picked.providerSymbol"
        :symbol="picked.providerSymbol"
        :currency="picked.currency"
      />

      <template v-if="picked">
        <div class="form-group">
          <label>Operação</label>
          <div class="op-toggle">
            <button
              type="button"
              class="op-btn"
              :class="{ 'active-buy': operation === InvestmentOperation.Buy }"
              @click="operation = InvestmentOperation.Buy"
            >
              Comprar
            </button>
            <button
              type="button"
              class="op-btn"
              :class="{ 'active-sell': operation === InvestmentOperation.Sell }"
              @click="operation = InvestmentOperation.Sell"
            >
              Vender
            </button>
          </div>
        </div>

        <div class="form-group">
          <label>Data</label>
          <DatePicker :model-value="date" placeholder="Selecione uma data" @update:model-value="(v) => (date = v)" />
        </div>

        <div class="form-row form-row--3">
          <div class="form-group">
            <label for="tx-qty">Quantidade</label>
            <input
              id="tx-qty"
              v-model.number="quantity"
              type="number"
              step="any"
              class="input"
              :class="{ 'input-error': errors.quantity }"
              placeholder="0"
            />
            <span v-if="errors.quantity" class="error-text">{{ errors.quantity }}</span>
          </div>
          <div class="form-group">
            <label for="tx-price">Preço unitário</label>
            <div class="amount-wrap">
              <input
                id="tx-price"
                v-model.number="unitPrice"
                type="number"
                step="0.0001"
                class="input amount-input"
                :class="{ 'input-error': errors.unitPrice }"
                placeholder="0,00"
              />
              <span class="amount-suffix">{{ currencySymbol }}</span>
            </div>
            <span v-if="errors.unitPrice" class="error-text">{{ errors.unitPrice }}</span>
          </div>
          <div class="form-group">
            <label for="tx-fee">Comissão</label>
            <div class="amount-wrap">
              <input
                id="tx-fee"
                v-model.number="commission"
                type="number"
                step="0.01"
                class="input amount-input"
                placeholder="0,00"
              />
              <span class="amount-suffix">{{ currencySymbol }}</span>
            </div>
          </div>
        </div>

        <div v-if="isForeign" class="form-group fx-group">
          <label for="tx-fxfee">Taxa de câmbio</label>
          <div class="amount-wrap fx-wrap">
            <input
              id="tx-fxfee"
              v-model.number="fxFeePercent"
              type="number"
              step="0.05"
              min="0"
              class="input amount-input"
              placeholder="0,5"
            />
            <span class="amount-suffix">%</span>
          </div>
          <span class="hint">Margem de conversão {{ picked?.currency }}→EUR (ex.: 0,5% na XTB). Entra no custo em euros.</span>
        </div>
      </template>

      <div class="modal-actions">
        <button type="button" class="btn-cancel" @click="handleClose">Cancelar</button>
        <button type="submit" class="btn-primary" :disabled="loading">
          {{ loading ? 'A guardar...' : isEdit ? 'Guardar' : 'Adicionar' }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>

<style scoped>
.tx-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 0;
}

.form-group label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-muted, #475569);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-row--3 {
  grid-template-columns: 1fr 1fr 1fr;
}

.op-toggle {
  display: flex;
  gap: 4px;
  padding: 4px;
  border: 1.5px solid var(--color-border, #e2e8f0);
  border-radius: 10px;
  background: var(--color-bg, #f8fafc);
}

.op-btn {
  flex: 1;
  padding: 0.55rem 0.5rem;
  border: none;
  background: transparent;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-muted, #64748b);
  cursor: pointer;
  border-radius: 7px;
  transition: background 0.15s, color 0.15s;
  font-family: inherit;
}

.op-btn.active-buy {
  background: #059669;
  color: #fff;
}

html.dark .op-btn.active-buy {
  background: #047857;
}

.op-btn.active-sell {
  background: #dc2626;
  color: #fff;
}

.picked {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-table-row-hover);
}

.picked-body {
  min-width: 0;
  flex: 1;
}

.picked-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.picked-symbol {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-text);
}

.picked-badge {
  font-size: 0.625rem;
  font-weight: 600;
  color: #166534;
  background: rgba(22, 101, 52, 0.12);
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
}

html.dark .picked-badge {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.14);
}

.picked-meta {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
}

.picked-name {
  display: block;
  margin-top: 0.15rem;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.picked-change {
  position: absolute;
  top: 0.75rem;
  right: 0.875rem;
  background: transparent;
  border: none;
  color: #166534;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

html.dark .picked-change {
  color: #4ade80;
}

.amount-wrap {
  position: relative;
}

.amount-input {
  width: 100%;
  padding-right: 2.25rem;
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
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-muted, #64748b);
  pointer-events: none;
}

.input {
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--color-input-border, #e2e8f0);
  border-radius: 8px;
  font-size: 0.9375rem;
  background: var(--color-input-bg, #fff);
  color: var(--color-text, #0f172a);
  font-family: inherit;
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

.input-error {
  border-color: #dc2626;
}

.error-text {
  font-size: 0.75rem;
  color: #dc2626;
}

.hint {
  font-size: 0.75rem;
  color: var(--color-text-muted, #64748b);
  line-height: 1.4;
}

.fx-wrap {
  max-width: 140px;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.btn-cancel {
  padding: 0.5rem 1rem;
  background: var(--color-bg, #f1f5f9);
  color: var(--color-text-muted, #475569);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  font-size: 0.875rem;
  cursor: pointer;
  font-family: inherit;
}

.btn-cancel:hover {
  background: var(--color-table-row-hover, #e2e8f0);
}

.btn-primary {
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #166534 0%, #15803d 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.95;
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
