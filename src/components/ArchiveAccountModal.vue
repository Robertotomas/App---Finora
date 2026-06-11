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
  confirm: [targetAccountId: string | undefined]
}>()

const targetAccountId = ref('')

const hasBalance = computed(() => !!props.account && props.account.balance !== 0)

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
  if (hasBalance.value && !targetAccountId.value) return
  emit('confirm', hasBalance.value ? targetAccountId.value : undefined)
}

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
    title="Arquivar conta"
    @close="handleClose"
  >
    <div class="archive-body">
      <!-- Account has balance: needs transfer -->
      <template v-if="hasBalance">
        <div class="archive-info">
          <p>
            A conta <strong>{{ account.name }}</strong> tem um saldo de
            <strong>{{ formatBalance(account.balance, account.currency) }}</strong>.
          </p>
          <p>
            Para arquivar, o saldo será transferido para outra conta. As transações permanecem associadas a esta conta para consulta futura.
          </p>
        </div>

        <div class="form-group">
          <label for="archive-target">Transferir saldo para</label>
          <select
            id="archive-target"
            v-model="targetAccountId"
            class="input"
          >
            <option value="" disabled>Selecione uma conta</option>
            <option v-for="a in availableTargets" :key="a.id" :value="a.id">
              {{ a.name }} ({{ formatBalance(a.balance, a.currency) }})
            </option>
          </select>
        </div>
      </template>

      <!-- Account has no balance: simple confirm -->
      <template v-else>
        <div class="archive-info">
          <p>
            A conta <strong>{{ account.name }}</strong> será arquivada.
          </p>
          <p>
            Deixará de aparecer no património total, mas as transações ficam guardadas para consulta no futuro.
          </p>
        </div>
      </template>

      <div class="archive-hint">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        <span>Pode reativar a conta a qualquer momento.</span>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn-cancel" @click="handleClose" :disabled="loading">
          Cancelar
        </button>
        <button
          type="button"
          class="btn-archive"
          :disabled="loading || (hasBalance && !targetAccountId)"
          @click="handleConfirm"
        >
          {{ loading ? 'A arquivar...' : (hasBalance ? 'Transferir e Arquivar' : 'Arquivar') }}
        </button>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.archive-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.archive-info p {
  margin: 0 0 0.5rem;
  font-size: 0.875rem;
  color: var(--color-text, #334155);
  line-height: 1.5;
}

.archive-info p:last-child {
  margin-bottom: 0;
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

.archive-hint {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 8px;
  font-size: 0.8125rem;
  color: #166534;
}

html.dark .archive-hint {
  background: rgba(22, 101, 52, 0.12);
  border-color: rgba(22, 101, 52, 0.3);
  color: #4ade80;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 0.25rem;
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

.btn-archive {
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
}

.btn-archive:hover:not(:disabled) {
  opacity: 0.95;
}

.btn-archive:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
