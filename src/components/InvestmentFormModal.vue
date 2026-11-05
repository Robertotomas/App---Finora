<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import UiButton from './ui/UiButton.vue'
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
  import: []
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
    <form id="investment-tx-form" class="modal-form" @submit.prevent="handleSubmit">
      <!-- Escolher instrumento -->
      <div v-if="!picked" class="form-group">
        <label>Produto</label>
        <InstrumentAutocomplete :error="!!errors.instrument" @select="onSelect" />
        <span v-if="errors.instrument" class="error-text">{{ errors.instrument }}</span>

        <div class="import-divider"><span>ou</span></div>
        <UiButton variant="secondary" block @click="emit('import')">
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
          </template>
          Importar de corretora (Excel/CSV)
        </UiButton>
      </div>

      <!-- Instrumento escolhido -->
      <div v-else class="picked">
        <InstrumentLogo :symbol="picked.symbol" :name="picked.name" :type="picked.type" :domain="picked.logoDomain" :size="38" />
        <div class="picked-body">
          <div class="picked-info">
            <span class="picked-symbol">{{ picked.providerSymbol || picked.symbol }}</span>
            <span class="ui-badge ui-badge--brand">{{ INSTRUMENT_TYPE_LABELS[picked.type] }}</span>
            <span class="picked-meta">{{ picked.exchange }} · {{ picked.currency }}</span>
          </div>
          <span class="picked-name">{{ picked.name }}</span>
        </div>
        <UiButton v-if="!instrument && !isEdit" variant="ghost" size="sm" @click="clearPicked">Trocar</UiButton>
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
          <div class="type-toggle">
            <button
              type="button"
              class="type-toggle-btn"
              :class="{ 'active-income': operation === InvestmentOperation.Buy }"
              @click="operation = InvestmentOperation.Buy"
            >
              Comprar
            </button>
            <button
              type="button"
              class="type-toggle-btn"
              :class="{ 'active-expense': operation === InvestmentOperation.Sell }"
              @click="operation = InvestmentOperation.Sell"
            >
              Vender
            </button>
          </div>
        </div>

        <div class="form-group">
          <label>Data</label>
          <DatePicker editable :model-value="date" placeholder="dd/mm/aaaa" @update:model-value="(v) => (date = v)" />
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

    </form>

    <template #footer>
      <UiButton variant="secondary" :disabled="loading" @click="handleClose">Cancelar</UiButton>
      <UiButton type="submit" form="investment-tx-form" :loading="loading">{{ isEdit ? 'Guardar' : 'Adicionar' }}</UiButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.picked {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}
.picked-body {
  min-width: 0;
  flex: 1;
}
.picked-info {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.picked-symbol {
  font-size: var(--text-base);
  font-weight: var(--weight-bold);
  color: var(--color-text-strong);
}
.picked-meta {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
.picked-name {
  display: block;
  margin-top: 2px;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.import-divider {
  display: flex;
  align-items: center;
  margin: var(--space-3) 0 var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-text-subtle);
}
.import-divider::before,
.import-divider::after {
  content: '';
  flex: 1;
  border-top: 1px solid var(--color-border-subtle);
}
.import-divider span {
  padding: 0 10px;
}

.fx-wrap {
  max-width: 140px;
}
</style>
