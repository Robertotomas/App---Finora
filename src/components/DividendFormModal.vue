<script setup lang="ts">
import { PT_GROUPING } from '@/utils/numberFormat'
import { ref, computed, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import UiButton from './ui/UiButton.vue'
import BaseSelect from './BaseSelect.vue'
import DatePicker from './DatePicker.vue'
import type { InvestmentHolding, InvestmentDividendItem, SaveDividendRequest } from '@/types/investment'

const props = defineProps<{
  open: boolean
  holdings: InvestmentHolding[]
  dividend?: InvestmentDividendItem | null
  loading?: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: SaveDividendRequest]
}>()

const isEdit = computed(() => !!props.dividend)

const holdingId = ref('')
const date = ref('')
const gross = ref<number | null>(null)
const tax = ref<number | null>(null)
const currency = ref('EUR')
const errors = ref<Record<string, string>>({})

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Posições ativas primeiro; as fechadas também (pode ter recebido dividendos antes de vender).
const holdingOptions = computed(() =>
  [...props.holdings]
    .sort((a, b) => Number(b.quantity > 1e-9) - Number(a.quantity > 1e-9) || a.name.localeCompare(b.name))
    .map((h) => ({ value: h.id, label: `${h.providerSymbol || h.symbol} · ${h.name}` })),
)

const selectedHolding = computed(() => props.holdings.find((h) => h.id === holdingId.value) ?? null)

const currencyOptions = computed(() => {
  const list = [selectedHolding.value?.currency, 'EUR', 'USD', 'GBP', 'CHF', currency.value]
    .filter((c): c is string => !!c)
    .map((c) => c.toUpperCase())
  return [...new Set(list)].map((c) => ({ value: c, label: c }))
})

const net = computed(() => Math.max(0, (Number(gross.value) || 0) - (Number(tax.value) || 0)))

function fmt(v: number): string {
  try {
    return new Intl.NumberFormat('pt-PT', { ...PT_GROUPING, style: 'currency', currency: currency.value || 'EUR' }).format(v)
  } catch {
    return `${v} ${currency.value}`
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    errors.value = {}
    const d = props.dividend
    if (d) {
      holdingId.value = d.holdingId ?? ''
      date.value = d.date.slice(0, 10)
      gross.value = d.amountGross
      tax.value = d.withholdingTax || null
      currency.value = d.currency || 'EUR'
    } else {
      const first = holdingOptions.value[0]
      holdingId.value = first ? String(first.value) : ''
      date.value = todayLocal()
      gross.value = null
      tax.value = null
      currency.value = selectedHolding.value?.currency || 'EUR'
    }
  },
)

function selectHolding(v: string | number) {
  holdingId.value = String(v)
  // A moeda por defeito acompanha a posição escolhida (só ao criar).
  if (!isEdit.value && selectedHolding.value) currency.value = selectedHolding.value.currency || 'EUR'
}

function validate(): boolean {
  const e: Record<string, string> = {}
  if (!holdingId.value) e.holding = 'Escolha o ativo'
  if (!date.value) e.date = 'A data é obrigatória'
  if (gross.value === null || !(gross.value > 0)) e.gross = 'Indique o montante bruto'
  if (tax.value !== null && tax.value < 0) e.tax = 'O imposto não pode ser negativo'
  else if (tax.value !== null && gross.value !== null && tax.value > gross.value) e.tax = 'O imposto não pode ser maior do que o bruto'
  errors.value = e
  return Object.keys(e).length === 0
}

function handleSubmit() {
  if (!validate()) return
  emit('submit', {
    holdingId: holdingId.value,
    date: date.value,
    amountGross: Number(gross.value) || 0,
    withholdingTax: Number(tax.value) || 0,
    currency: currency.value,
  })
}

function handleClose() {
  if (!props.loading) emit('close')
}
</script>

<template>
  <BaseModal v-if="open" :title="isEdit ? 'Editar dividendo' : 'Adicionar dividendo'" @close="handleClose">
    <form id="dividend-form" class="modal-form" @submit.prevent="handleSubmit">
      <div class="form-group">
        <label>Ativo</label>
        <BaseSelect
          :model-value="holdingId"
          :options="holdingOptions"
          placeholder="Escolha o ativo"
          :error="!!errors.holding"
          @update:model-value="selectHolding"
        />
        <span v-if="errors.holding" class="error-text">{{ errors.holding }}</span>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>Data</label>
          <DatePicker
            :model-value="date"
            :error="!!errors.date"
            placeholder="Selecione uma data"
            @update:model-value="(v) => (date = v)"
          />
          <span v-if="errors.date" class="error-text">{{ errors.date }}</span>
        </div>
        <div class="form-group">
          <label>Moeda</label>
          <BaseSelect
            :model-value="currency"
            :options="currencyOptions"
            @update:model-value="(v) => (currency = String(v))"
          />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="div-gross">Montante bruto</label>
          <div class="amount-wrap">
            <input
              id="div-gross"
              v-model.number="gross"
              type="number"
              step="0.01"
              min="0"
              class="input amount-input"
              :class="{ 'input-error': errors.gross }"
              placeholder="0,00"
            />
            <span class="amount-suffix">{{ currency }}</span>
          </div>
          <span v-if="errors.gross" class="error-text">{{ errors.gross }}</span>
        </div>
        <div class="form-group">
          <label for="div-tax">Imposto retido</label>
          <div class="amount-wrap">
            <input
              id="div-tax"
              v-model.number="tax"
              type="number"
              step="0.01"
              min="0"
              class="input amount-input"
              :class="{ 'input-error': errors.tax }"
              placeholder="0,00"
            />
            <span class="amount-suffix">{{ currency }}</span>
          </div>
          <span v-if="errors.tax" class="error-text">{{ errors.tax }}</span>
        </div>
      </div>

      <span class="hint">
        Líquido recebido: <strong>{{ fmt(net) }}</strong>. Conta para o retorno total dos investimentos
        (não mexe nos saldos das contas).
      </span>
    </form>

    <template #footer>
      <UiButton variant="secondary" :disabled="loading" @click="handleClose">Cancelar</UiButton>
      <UiButton type="submit" form="dividend-form" :loading="loading">{{ isEdit ? 'Guardar' : 'Adicionar' }}</UiButton>
    </template>
  </BaseModal>
</template>
