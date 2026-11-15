<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import UiButton from './ui/UiButton.vue'
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
    <form id="asset-form" class="modal-form" @submit.prevent="handleSubmit">
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

    </form>

    <template #footer>
      <UiButton variant="secondary" :disabled="loading" @click="handleClose">Cancelar</UiButton>
      <UiButton type="submit" form="asset-form" :loading="loading">{{ isEdit ? 'Guardar' : 'Adicionar ativo' }}</UiButton>
    </template>
  </BaseModal>
</template>
