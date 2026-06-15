<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import DatePicker from './DatePicker.vue'
import type { AddValuationRequest, AssetValuation } from '@/types/asset'

const props = defineProps<{
  open: boolean
  valuation?: AssetValuation | null
  loading?: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: AddValuationRequest]
}>()

const isEdit = computed(() => !!props.valuation)

const date = ref('')
const value = ref<number | null>(null)
const errors = ref<Record<string, string>>({})

function todayLocal(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    errors.value = {}
    if (props.valuation) {
      date.value = props.valuation.date.slice(0, 10)
      value.value = props.valuation.value
    } else {
      date.value = todayLocal()
      value.value = null
    }
  },
)

function validate(): boolean {
  const e: Record<string, string> = {}
  if (!date.value) e.date = 'A data é obrigatória'
  if (value.value === null || value.value < 0) e.value = 'Indique o valor'
  errors.value = e
  return Object.keys(e).length === 0
}

function handleSubmit() {
  if (!validate()) return
  emit('submit', { date: date.value, value: Number(value.value) || 0 })
}

function handleClose() {
  if (!props.loading) emit('close')
}
</script>

<template>
  <BaseModal v-if="open" :title="isEdit ? 'Editar avaliação' : 'Adicionar avaliação'" @close="handleClose">
    <form class="valuation-form" @submit.prevent="handleSubmit">
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
        <label for="val-value">Valor</label>
        <div class="amount-wrap">
          <input
            id="val-value"
            v-model.number="value"
            type="number"
            step="0.01"
            class="input amount-input"
            :class="{ 'input-error': errors.value }"
            placeholder="0,00"
          />
          <span class="amount-suffix">€</span>
        </div>
        <span class="hint">Valor atual em EUR</span>
        <span v-if="errors.value" class="error-text">{{ errors.value }}</span>
      </div>

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
.valuation-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
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
