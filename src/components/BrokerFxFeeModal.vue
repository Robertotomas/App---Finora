<script setup lang="ts">
import { ref, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import UiButton from './ui/UiButton.vue'
import { MAX_BROKER_FX_FEE_PERCENT } from '@/types/investment'

const props = defineProps<{
  open: boolean
  /** Taxa atual (%). */
  percent: number
  loading?: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [percent: number]
}>()

const text = ref('')
const error = ref('')

function formatPercent(v: number): string {
  return v > 0 ? String(v).replace('.', ',') : ''
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    error.value = ''
    text.value = formatPercent(props.percent)
  },
  { immediate: true },
)

/** Aceita vírgula ou ponto decimal; vazio = 0. null se inválido. */
function parsePercent(raw: string): number | null {
  const s = raw.trim().replace('%', '').trim().replace(',', '.')
  if (s === '') return 0
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  return Number(s)
}

function handleSubmit() {
  const v = parsePercent(text.value)
  if (v === null || v < 0 || v > MAX_BROKER_FX_FEE_PERCENT) {
    error.value = `Indique uma percentagem entre 0 e ${MAX_BROKER_FX_FEE_PERCENT}`
    return
  }
  error.value = ''
  emit('submit', Math.round(v * 10000) / 10000)
}

function handleClose() {
  if (!props.loading) emit('close')
}
</script>

<template>
  <BaseModal v-if="open" title="Taxa de conversão da corretora" size="sm" @close="handleClose">
    <form id="broker-fx-fee-form" class="modal-form" @submit.prevent="handleSubmit">
      <p class="fee-intro">
        Percentagem que a sua corretora cobra para converter moeda estrangeira em euros (ex.: XTB 0,5%).
        O valor das posições noutras moedas passa a ser o que receberia em euros ao vender, como a corretora mostra.
      </p>

      <div class="form-group">
        <label for="broker-fx-fee">Taxa de conversão</label>
        <div class="amount-wrap">
          <input
            id="broker-fx-fee"
            v-model="text"
            type="text"
            inputmode="decimal"
            autocomplete="off"
            class="input amount-input"
            :class="{ 'input-error': error }"
            placeholder="0,00"
          />
          <span class="amount-suffix">%</span>
        </div>
        <span v-if="error" class="error-text">{{ error }}</span>
        <span v-else class="hint">Entre 0 e {{ MAX_BROKER_FX_FEE_PERCENT }}%. Deixe vazio ou 0 para não aplicar taxa.</span>
      </div>
    </form>

    <template #footer>
      <UiButton variant="secondary" :disabled="loading" @click="handleClose">Cancelar</UiButton>
      <UiButton type="submit" form="broker-fx-fee-form" :loading="loading">Guardar</UiButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.fee-intro {
  margin: 0;
  font-size: var(--text-sm);
  line-height: 1.5;
  color: var(--color-text-secondary);
}
</style>
