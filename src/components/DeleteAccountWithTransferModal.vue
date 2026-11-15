<script setup lang="ts">
import { PT_GROUPING } from '@/utils/numberFormat'
import { ref, computed, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import BaseSelect from './BaseSelect.vue'
import UiButton from './ui/UiButton.vue'
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

const targetOptions = computed(() =>
  availableTargets.value.map((a) => ({ value: a.id, label: `${a.name} (${formatBalance(a.balance, a.currency)})` }))
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
  return new Intl.NumberFormat('pt-PT', { ...PT_GROUPING,
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
      <div class="modal-note modal-note--danger">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
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
        <label>Mover transações para</label>
        <BaseSelect
          :model-value="targetAccountId"
          :options="targetOptions"
          placeholder="Selecione uma conta"
          @update:model-value="(v) => (targetAccountId = String(v))"
        />
      </div>

    </div>

    <template #footer>
      <UiButton variant="secondary" :disabled="loading" @click="handleClose">Cancelar</UiButton>
      <UiButton variant="danger" :loading="loading" :disabled="!targetAccountId" @click="handleConfirm">
        Transferir e eliminar
      </UiButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.transfer-delete-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.modal-note p {
  margin: 0;
}
.modal-note strong {
  color: var(--color-text-strong);
}
</style>
