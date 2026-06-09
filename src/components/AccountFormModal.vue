<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BaseModal from './BaseModal.vue'
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

const name = ref('')
const balance = ref<number | null>(null)

const errors = ref<Record<string, string>>({})

const isEdit = computed(() => !!props.account)

watch(
  () => props.open,
  (open) => {
    if (open) {
      errors.value = {}
      if (props.account) {
        name.value = props.account.name
        balance.value = props.account.balance
      } else {
        name.value = ''
        balance.value = null
      }
    }
  }
)

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
    currency: 'EUR'
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
        <label for="account-balance">Saldo</label>
        <div class="amount-wrap">
          <input
            id="account-balance"
            v-model.number="balance"
            type="number"
            step="0.01"
            class="input amount-input"
            :class="{ 'input-error': errors.balance }"
            placeholder="0,00"
          />
          <span class="amount-suffix">€</span>
        </div>
        <span v-if="errors.balance" class="error-text">{{ errors.balance }}</span>
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
  color: var(--color-text-muted, #475569);
}

.amount-wrap {
  position: relative;
}

.amount-input {
  width: 100%;
  padding-right: 2rem;
  /* Esconde as setas do input numérico para o € ficar limpo */
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
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.9375rem;
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
  background: linear-gradient(135deg, #166534 0%, #15803d 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
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
