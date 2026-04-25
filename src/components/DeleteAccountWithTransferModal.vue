<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import type { Account } from '@/types/account'

const props = defineProps<{
  open: boolean
  account: Account | null
  accounts: Account[]
  loading?: boolean
}>()

const emit = defineEmits<{
  close: []
  confirm: [targetAccountId: string]
}>()

const targetAccountId = ref('')

const availableTargets = computed(() => {
  if (!props.account) return []
  return props.accounts.filter(
    (a) => a.id !== props.account!.id && !a.isArchived
  )
})

watch(
  () => props.open,
  (open) => {
    if (open) {
      targetAccountId.value = availableTargets.value[0]?.id ?? ''
    }
  }
)

function handleClose() {
  if (!props.loading) emit('close')
}

function handleConfirm() {
  if (!targetAccountId.value) return
  emit('confirm', targetAccountId.value)
}

const isArchived = computed(() => !!props.account?.isArchived)

function formatBalance(balance: number, currency: string): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: currency || 'EUR'
  }).format(balance)
}
</script>

<template>
  <BaseModal
    v-if="open && account"
    :title="isArchived ? 'Eliminar conta arquivada' : 'Eliminar conta com transferência'"
    @close="handleClose"
  >
    <div class="transfer-delete-body">
      <div class="transfer-warning">
        <p v-if="isArchived">
          Todo o histórico de transações de
          <strong>{{ account.name }}</strong>
          será movido para a conta de destino e a conta será eliminada permanentemente.
        </p>
        <p v-else>
          Todas as transações e o saldo de
          <strong>{{ account.name }}</strong>
          ({{ formatBalance(account.balance, account.currency) }})
          serão transferidos para a conta de destino. Esta ação não pode ser revertida.
        </p>
      </div>

      <div class="form-group">
        <label for="target-account">Mover transações para</label>
        <select
          id="target-account"
          v-model="targetAccountId"
          class="input"
        >
          <option value="" disabled>Seleciona uma conta</option>
          <option v-for="a in availableTargets" :key="a.id" :value="a.id">
            {{ a.name }} ({{ formatBalance(a.balance, a.currency) }})
          </option>
        </select>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn-cancel" @click="handleClose" :disabled="loading">
          Cancelar
        </button>
        <button
          type="button"
          class="btn-danger"
          :disabled="loading || !targetAccountId"
          @click="handleConfirm"
        >
          {{ loading ? 'A transferir...' : 'Transferir e Eliminar' }}
        </button>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.transfer-delete-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.transfer-warning {
  padding: 0.75rem 1rem;
  background: #fef2f2;
  border-radius: 8px;
  border: 1px solid #fecaca;
}

html.dark .transfer-warning {
  background: rgba(220, 38, 38, 0.12);
  border-color: rgba(220, 38, 38, 0.3);
}

.transfer-warning p {
  margin: 0;
  font-size: 0.875rem;
  color: #991b1b;
  line-height: 1.45;
}

html.dark .transfer-warning p {
  color: #fca5a5;
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

.btn-danger {
  padding: 0.5rem 1rem;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-danger:hover:not(:disabled) {
  background: #b91c1c;
}

.btn-danger:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
