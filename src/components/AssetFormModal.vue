<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import BaseSelect from './BaseSelect.vue'
import DatePicker from './DatePicker.vue'
import type { Asset, CreateAssetRequest } from '@/types/asset'
import { AssetCategory, ASSET_CATEGORY_OPTIONS } from '@/types/asset'

const props = defineProps<{
  open: boolean
  asset?: Asset | null
  loading?: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: CreateAssetRequest]
}>()

const name = ref('')
const category = ref<AssetCategory>(AssetCategory.RealEstate)
const acquisitionCost = ref<number | null>(null)
const acquisitionDate = ref('')
const errors = ref<Record<string, string>>({})

const isEdit = computed(() => !!props.asset)
const categoryOptions = ASSET_CATEGORY_OPTIONS.map((o) => ({ value: o.value as number, label: o.label }))

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
    if (props.asset) {
      name.value = props.asset.name
      category.value = props.asset.category
      acquisitionCost.value = props.asset.acquisitionCost
      acquisitionDate.value = props.asset.acquisitionDate.slice(0, 10)
    } else {
      name.value = ''
      category.value = AssetCategory.RealEstate
      acquisitionCost.value = null
      acquisitionDate.value = todayLocal()
    }
  },
)

function validate(): boolean {
  const e: Record<string, string> = {}
  if (!name.value.trim()) e.name = 'O nome é obrigatório'
  else if (name.value.length > 200) e.name = 'O nome é demasiado longo'
  if (acquisitionCost.value === null || acquisitionCost.value < 0) e.acquisitionCost = 'Indique o custo'
  if (!acquisitionDate.value) e.acquisitionDate = 'A data é obrigatória'
  errors.value = e
  return Object.keys(e).length === 0
}

function handleSubmit() {
  if (!validate()) return
  emit('submit', {
    name: name.value.trim(),
    category: category.value,
    acquisitionCost: Number(acquisitionCost.value) || 0,
    acquisitionDate: acquisitionDate.value,
  })
}

function handleClose() {
  if (!props.loading) emit('close')
}
</script>

<template>
  <BaseModal v-if="open" :title="isEdit ? 'Editar ativo' : 'Adicionar ativo'" @close="handleClose">
    <form class="asset-form" @submit.prevent="handleSubmit">
      <div class="form-group">
        <label for="asset-name">Nome</label>
        <input
          id="asset-name"
          v-model="name"
          type="text"
          class="input"
          :class="{ 'input-error': errors.name }"
          placeholder="Ex: Apartamento no centro"
          maxlength="200"
        />
        <span v-if="errors.name" class="error-text">{{ errors.name }}</span>
      </div>

      <div class="form-group">
        <label>Categoria</label>
        <BaseSelect
          :model-value="category"
          :options="categoryOptions"
          placeholder="Selecione uma categoria"
          @update:model-value="(v) => (category = Number(v) as AssetCategory)"
        />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="asset-cost">Custo de aquisição</label>
          <div class="amount-wrap">
            <input
              id="asset-cost"
              v-model.number="acquisitionCost"
              type="number"
              step="0.01"
              class="input amount-input"
              :class="{ 'input-error': errors.acquisitionCost }"
              placeholder="0,00"
            />
            <span class="amount-suffix">€</span>
          </div>
          <span v-if="errors.acquisitionCost" class="error-text">{{ errors.acquisitionCost }}</span>
        </div>
        <div class="form-group">
          <label>Data de aquisição</label>
          <DatePicker
            :model-value="acquisitionDate"
            :error="!!errors.acquisitionDate"
            placeholder="Selecione uma data"
            @update:model-value="(v) => (acquisitionDate = v)"
          />
          <span v-if="errors.acquisitionDate" class="error-text">{{ errors.acquisitionDate }}</span>
        </div>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn-cancel" @click="handleClose">Cancelar</button>
        <button type="submit" class="btn-primary" :disabled="loading">
          {{ loading ? 'A guardar...' : isEdit ? 'Guardar' : 'Adicionar ativo' }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>

<style scoped>
.asset-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-row .input {
  min-width: 0;
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
