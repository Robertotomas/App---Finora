<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import UiButton from './ui/UiButton.vue'
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
    <form id="valuation-form" class="modal-form" @submit.prevent="handleSubmit">
      <div class="form-group">
        <label>Data</label>
        <DatePicker max="today"
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

    </form>

    <template #footer>
      <UiButton variant="secondary" :disabled="loading" @click="handleClose">Cancelar</UiButton>
      <UiButton type="submit" form="valuation-form" :loading="loading">{{ isEdit ? 'Guardar' : 'Adicionar' }}</UiButton>
    </template>
  </BaseModal>
</template>
