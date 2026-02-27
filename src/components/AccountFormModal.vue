<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import type { Account, CreateAccountRequest, AccountType } from '@/types/account'
import { ACCOUNT_TYPE_LABELS } from '@/types/account'

const props = defineProps<{
  open: boolean
  account?: Account | null
  loading?: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: CreateAccountRequest]
}>()

const name = ref('')
const type = ref<AccountType>(0)
const balance = ref<number>(0)
const currency = ref('EUR')

const errors = ref<Record<string, string>>({})

const isEdit = computed(() => !!props.account)

watch(
  () => props.open,
  (open) => {
    if (open) {
      errors.value = {}
      if (props.account) {
        name.value = props.account.name
        type.value = props.account.type
        balance.value = props.account.balance
        currency.value = props.account.currency
      } else {
        name.value = ''
        type.value = 0
        balance.value = 0
        currency.value = 'EUR'
      }
    }
  }
)

function validate(): boolean {
  const e: Record<string, string> = {}
  if (!name.value.trim()) e.name = 'Nome é obrigatório'
  else if (name.value.length > 200) e.name = 'Nome é demasiado longo'
  if (currency.value.length !== 3) e.currency = 'Moeda deve ter 3 caracteres (ex: EUR)'
  errors.value = e
  return Object.keys(e).length === 0
}

function handleSubmit() {
  if (!validate()) return
  emit('submit', {
    name: name.value.trim(),
    type: type.value,
    balance: balance.value,
    currency: currency.value.toUpperCase()
  })
}

function handleClose() {
  if (!props.loading) emit('close')
}

const accountTypes = Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => ({
  value: Number(k) as AccountType,
  label: v
}))
</script>

<template>
  <BaseModal
    v-if="open"
    :title="isEdit ? 'Editar conta' : 'Nova conta'"
    @close="handleClose"
  >
    <form @submit.prevent="handleSubmit" class="account-form">
      <div class="form-group">
        <label for="account-name">Nome</label>
        <input
          id="account-name"
          v-model="name"
          type="text"
          class="input"
          :class="{ 'input-error': errors.name }"
          placeholder="Ex: Conta à ordem"
          maxlength="200"
        />
        <span v-if="errors.name" class="error-text">{{ errors.name }}</span>
      </div>

      <div class="form-group">
        <label for="account-type">Tipo</label>
        <select
          id="account-type"
          v-model="type"
          class="input"
        >
          <option
            v-for="opt in accountTypes"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="account-balance">Saldo</label>
          <input
            id="account-balance"
            v-model.number="balance"
            type="number"
            step="0.01"
            class="input"
            :class="{ 'input-error': errors.balance }"
            placeholder="0.00"
          />
          <span v-if="errors.balance" class="error-text">{{ errors.balance }}</span>
        </div>
        <div class="form-group">
          <label for="account-currency">Moeda</label>
          <input
            id="account-currency"
            v-model="currency"
            type="text"
            class="input"
            :class="{ 'input-error': errors.currency }"
            placeholder="EUR"
            maxlength="3"
          />
          <span v-if="errors.currency" class="error-text">{{ errors.currency }}</span>
        </div>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn-cancel" @click="handleClose">
          Cancelar
        </button>
        <button type="submit" class="btn-primary" :disabled="loading">
          {{ loading ? 'A guardar...' : (isEdit ? 'Guardar' : 'Criar') }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>

<style scoped>
.account-form {
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
  color: #475569;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 80px;
  gap: 2rem;
}

.input {
  padding: 0.625rem 0.875rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9375rem;
}

.input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
}

.input-error {
  border-color: #dc2626;
}

.input-error:focus {
  border-color: #dc2626;
  box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.2);
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
  background: #f1f5f9;
  color: #475569;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  cursor: pointer;
}

.btn-cancel:hover {
  background: #e2e8f0;
}

.btn-primary {
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.95;
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
