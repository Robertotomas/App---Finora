<script setup lang="ts">
import { PT_GROUPING } from '@/utils/numberFormat'
import { ref, computed, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import UiButton from './ui/UiButton.vue'
import BaseSelect from './BaseSelect.vue'
import DatePicker from './DatePicker.vue'
import type { AddDepositRequest, InvestmentDepositItem } from '@/types/investment'
import type { Account } from '@/types/account'

const props = defineProps<{
  open: boolean
  accounts: Account[]
  deposit?: InvestmentDepositItem | null
  loading?: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [payload: AddDepositRequest]
}>()

const isEdit = computed(() => !!props.deposit)

const date = ref('')
const amount = ref<number | null>(null)
const accountId = ref('') // '' = não debitar
const errors = ref<Record<string, string>>({})

function todayLocal(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

// Opção "não debitar" + contas ativas.
const accountOptions = computed(() => [
  { value: '', label: 'Não debitar (só registar)' },
  ...props.accounts
    .filter((a) => !a.isArchived)
    .map((a) => ({ value: a.id, label: a.name })),
])

const selectedAccount = computed(() => props.accounts.find((a) => a.id === accountId.value) || null)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    errors.value = {}
    if (props.deposit) {
      date.value = props.deposit.date.slice(0, 10)
      amount.value = Math.abs(props.deposit.amount)
      accountId.value = props.deposit.accountId ?? ''
    } else {
      date.value = todayLocal()
      amount.value = null
      accountId.value = ''
    }
  },
)

function validate(): boolean {
  const e: Record<string, string> = {}
  if (!date.value) e.date = 'A data é obrigatória'
  if (amount.value === null || amount.value <= 0) e.amount = 'Indique o montante'
  errors.value = e
  return Object.keys(e).length === 0
}

function handleSubmit() {
  if (!validate()) return
  emit('submit', {
    date: date.value,
    amount: Number(amount.value) || 0,
    accountId: accountId.value || null,
  })
}

function handleClose() {
  if (!props.loading) emit('close')
}
</script>

<template>
  <BaseModal v-if="open" :title="isEdit ? 'Editar depósito' : 'Adicionar depósito'" @close="handleClose">
    <form id="deposit-form" class="modal-form" @submit.prevent="handleSubmit">
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
        <label for="dep-amount">Montante</label>
        <div class="amount-wrap">
          <input
            id="dep-amount"
            v-model.number="amount"
            type="number"
            step="0.01"
            class="input amount-input"
            :class="{ 'input-error': errors.amount }"
            placeholder="0,00"
          />
          <span class="amount-suffix">€</span>
        </div>
        <span v-if="errors.amount" class="error-text">{{ errors.amount }}</span>
      </div>

      <div class="form-group">
        <label>Debitar da conta</label>
        <BaseSelect
          :model-value="accountId"
          :options="accountOptions"
          placeholder="Não debitar (só registar)"
          @update:model-value="(v) => (accountId = String(v))"
        />
        <span v-if="selectedAccount" class="hint">
          O saldo de "{{ selectedAccount.name }}" desce
          {{ amount ? amount.toLocaleString('pt-PT', { ...PT_GROUPING, style: 'currency', currency: 'EUR' }) : 'o montante' }}.
          O Património não muda: o valor passa para os fundos livres da corretora.
        </span>
        <span v-else class="hint hint--warn">
          Sem conta: o valor conta como dinheiro novo no Património. Se saiu de uma conta registada,
          escolha-a para não ser contado a dobrar.
        </span>
      </div>
    </form>

    <template #footer>
      <UiButton variant="secondary" :disabled="loading" @click="handleClose">Cancelar</UiButton>
      <UiButton type="submit" form="deposit-form" :loading="loading">{{ isEdit ? 'Guardar' : 'Adicionar' }}</UiButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.bm-body .hint--warn {
  color: var(--color-warning);
}
</style>
