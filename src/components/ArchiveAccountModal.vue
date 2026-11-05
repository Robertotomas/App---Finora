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

const targetOptions = computed(() =>
  availableTargets.value.map((a) => ({ value: a.id, label: `${a.name} (${formatBalance(a.balance, a.currency)})` }))
)

function handleClose() {
  if (!props.loading) emit('close')
}

function handleConfirm() {
  if (hasBalance.value && !targetAccountId.value) return
  emit('confirm', hasBalance.value ? targetAccountId.value : undefined)
}

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
          <label>Transferir saldo para</label>
          <BaseSelect
            :model-value="targetAccountId"
            :options="targetOptions"
            placeholder="Selecione uma conta"
            @update:model-value="(v) => (targetAccountId = String(v))"
          />
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

      <div class="modal-note">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        <span>Pode reativar a conta a qualquer momento.</span>
      </div>

    </div>

    <template #footer>
      <UiButton variant="secondary" :disabled="loading" @click="handleClose">Cancelar</UiButton>
      <UiButton :loading="loading" :disabled="hasBalance && !targetAccountId" @click="handleConfirm">
        {{ hasBalance ? 'Transferir e arquivar' : 'Arquivar' }}
      </UiButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.archive-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.archive-info p {
  margin: 0 0 var(--space-2);
  font-size: var(--text-base);
  line-height: 1.55;
  color: var(--color-text-secondary);
}
.archive-info p:last-child {
  margin-bottom: 0;
}
.archive-info strong {
  color: var(--color-text-strong);
}
</style>
