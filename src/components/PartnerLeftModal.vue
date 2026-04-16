<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useHouseholdStore } from '@/stores/household'
import { clearAllBudgetsForHousehold } from '@/composables/useMonthlyBudget'

type Phase = 'main' | 'continueAck' | 'reset1' | 'reset2'

const householdStore = useHouseholdStore()

const phase = ref<Phase>('main')
const continueAck = ref(false)
const resetPhrase = ref('')
const actionLoading = ref(false)
const errorMsg = ref('')

const dialogRef = ref<HTMLElement | null>(null)
const continueAckCheckboxRef = ref<HTMLInputElement | null>(null)
const resetInputRef = ref<HTMLInputElement | null>(null)

let lastActiveElement: HTMLElement | null = null
let prevBodyOverflow = ''
let prevBodyPaddingRight = ''

/** Não usar `householdStore.loading` aqui — durante dismiss/reset o loading global escondia o modal. */
const visible = computed(
  () => !!householdStore.household && householdStore.hasPartnerLeftNotice,
)

watch(visible, (show) => {
  if (show) {
    // Scroll lock + foco (acessibilidade)
    prevBodyOverflow = document.body.style.overflow
    prevBodyPaddingRight = document.body.style.paddingRight
    lastActiveElement = document.activeElement as HTMLElement | null

    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`

    phase.value = 'main'
    continueAck.value = false
    resetPhrase.value = ''
    errorMsg.value = ''

    void nextTick(() => {
      const el =
        dialogRef.value?.querySelector<HTMLElement>(
          'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
        ) ?? null
      el?.focus()
    })
  } else {
    // Restore scroll lock + devolve foco ao elemento que abriu o modal
    document.body.style.overflow = prevBodyOverflow
    document.body.style.paddingRight = prevBodyPaddingRight
    void nextTick(() => lastActiveElement?.focus?.())
  }
})

watch(phase, async (p) => {
  if (!visible.value) return
  await nextTick()
  if (p === 'continueAck') {
    continueAckCheckboxRef.value?.focus()
  } else if (p === 'reset2') {
    resetInputRef.value?.focus()
  }
})

function goMain() {
  phase.value = 'main'
  continueAck.value = false
  resetPhrase.value = ''
  errorMsg.value = ''
}

function startContinue() {
  phase.value = 'continueAck'
  continueAck.value = false
  errorMsg.value = ''
}

function startReset() {
  phase.value = 'reset1'
  resetPhrase.value = ''
  errorMsg.value = ''
}

async function confirmContinue() {
  if (!continueAck.value) return
  actionLoading.value = true
  errorMsg.value = ''
  try {
    await householdStore.dismissPartnerLeftNotice()
    goMain()
  } catch {
    errorMsg.value = householdStore.error ?? 'Não foi possível confirmar.'
  } finally {
    actionLoading.value = false
  }
}

async function confirmReset() {
  actionLoading.value = true
  errorMsg.value = ''
  const householdId = householdStore.household?.id
  try {
    await householdStore.resetFinancialData(resetPhrase.value.trim())
    if (householdId) clearAllBudgetsForHousehold(householdId)
    window.location.reload()
  } catch {
    errorMsg.value = householdStore.error ?? 'Não foi possível limpar os dados.'
    actionLoading.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="partner-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="partner-left-title"
    >
      <div class="partner-dialog" ref="dialogRef">
        <!-- Escolha inicial -->
        <template v-if="phase === 'main'">
          <div class="partner-icon" aria-hidden="true">👋</div>
          <h2 id="partner-left-title" class="partner-title">A outra pessoa saiu do agregado</h2>
          <p class="partner-lead">
            O plano casal terminou para este agregado. Todo o histórico (contas, movimentos, objetivos,
            relatórios) continua <strong>aqui</strong> — só tu o vês neste agregado.
          </p>
          <p class="partner-hint">Escolhe como queres prosseguir:</p>
          <div class="partner-actions-stack">
            <button type="button" class="btn-primary" @click="startContinue">
              Continuar com os dados existentes
            </button>
            <button type="button" class="btn-danger-outline" @click="startReset">
              Apagar tudo e começar do zero…
            </button>
          </div>
        </template>

        <!-- Dupla confirmação: manter dados -->
        <template v-else-if="phase === 'continueAck'">
          <h2 class="partner-title">Confirmar — manter dados</h2>
          <p class="partner-lead">
            Vais manter contas, movimentos e restante histórico neste agregado. Este aviso deixa de
            aparecer.
          </p>
          <label class="partner-check">
            <input
              ref="continueAckCheckboxRef"
              v-model="continueAck"
              type="checkbox"
            />
            <span>Confirmo que quero manter os dados deste agregado.</span>
          </label>
          <p v-if="errorMsg" class="partner-error">{{ errorMsg }}</p>
          <div class="partner-actions-row">
            <button type="button" class="btn-secondary" :disabled="actionLoading" @click="goMain">
              Voltar
            </button>
            <button
              type="button"
              class="btn-primary"
              :disabled="actionLoading || !continueAck"
              @click="confirmContinue"
            >
              {{ actionLoading ? 'A guardar…' : 'Confirmar e continuar' }}
            </button>
          </div>
        </template>

        <!-- Reset passo 1 -->
        <template v-else-if="phase === 'reset1'">
          <h2 class="partner-title">Apagar todos os dados?</h2>
          <p class="partner-lead reset-strong">
            Isto remove <strong>todas</strong> as contas, movimentos, recorrentes, objetivos de poupança
            e relatórios mensais deste agregado. <strong>Não pode ser anulado.</strong>
          </p>
          <p v-if="errorMsg" class="partner-error">{{ errorMsg }}</p>
          <div class="partner-actions-row">
            <button type="button" class="btn-secondary" :disabled="actionLoading" @click="goMain">
              Voltar
            </button>
            <button
              type="button"
              class="btn-danger"
              :disabled="actionLoading"
              @click="phase = 'reset2'"
            >
              Continuar para confirmação final
            </button>
          </div>
        </template>

        <!-- Reset passo 2 + RECOMECAR -->
        <template v-else>
          <h2 class="partner-title">Confirmação final</h2>
          <p class="partner-lead">
            Para apagar definitivamente, escreve <strong>RECOMECAR</strong> (maiúsculas, tal como está).
          </p>
          <input
            ref="resetInputRef"
            v-model="resetPhrase"
            type="text"
            class="partner-input"
            autocomplete="off"
            placeholder="RECOMECAR"
            aria-label="Escreve RECOMECAR para confirmar"
          />
          <p v-if="errorMsg" class="partner-error">{{ errorMsg }}</p>
          <div class="partner-actions-row">
            <button
              type="button"
              class="btn-secondary"
              :disabled="actionLoading"
              @click="phase = 'reset1'"
            >
              Voltar
            </button>
            <button
              type="button"
              class="btn-danger"
              :disabled="actionLoading || resetPhrase.trim() !== 'RECOMECAR'"
              @click="confirmReset"
            >
              {{ actionLoading ? 'A apagar…' : 'Apagar definitivamente' }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.partner-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(2px);
}

.partner-dialog {
  width: 100%;
  max-width: min(480px, 100%);
  max-height: min(90vh, 640px);
  overflow-y: auto;
  padding: 1.75rem;
  border-radius: 14px;
  background: var(--color-bg-card, #fff);
  border: 1px solid var(--color-border, #e2e8f0);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.partner-icon {
  font-size: 2rem;
  text-align: center;
  margin-bottom: 0.5rem;
}

.partner-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-text, #0f172a);
  margin: 0 0 0.75rem 0;
  text-align: center;
}

.partner-lead {
  font-size: 0.9rem;
  line-height: 1.55;
  color: var(--color-text-muted, #64748b);
  margin: 0 0 1rem 0;
}

.reset-strong {
  color: var(--color-text, #334155);
}

.partner-hint {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text, #475569);
  margin: 0 0 0.75rem 0;
}

.partner-actions-stack {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.partner-actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.btn-primary {
  padding: 0.65rem 1.1rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
  background: #166534;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-family: inherit;
}

.btn-primary:hover:not(:disabled) {
  background: #14532d;
}

.btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-danger {
  padding: 0.65rem 1.1rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #fff;
  background: #dc2626;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-family: inherit;
}

.btn-danger:hover:not(:disabled) {
  background: #b91c1c;
}

.btn-danger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.btn-danger-outline {
  padding: 0.65rem 1.1rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #dc2626;
  background: transparent;
  border: 1px solid #fecaca;
  border-radius: 10px;
  cursor: pointer;
  font-family: inherit;
}

.btn-danger-outline:hover {
  background: rgba(220, 38, 38, 0.06);
}

.btn-secondary {
  padding: 0.65rem 1.1rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text, #475569);
  background: var(--color-btn-secondary-hover, #f1f5f9);
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-family: inherit;
}

.btn-secondary:hover:not(:disabled) {
  filter: brightness(0.97);
}

.partner-check {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--color-text, #0f172a);
  margin-bottom: 1rem;
  line-height: 1.45;
  cursor: pointer;
}

.partner-check input {
  margin-top: 0.2rem;
  flex-shrink: 0;
}

.partner-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.65rem 0.85rem;
  font-size: 0.9rem;
  font-family: ui-monospace, monospace;
  letter-spacing: 0.03em;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  background: var(--color-input-bg, #fff);
  color: var(--color-text, #0f172a);
  margin-bottom: 0.75rem;
}

.partner-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
}

.partner-error {
  font-size: 0.8125rem;
  color: #dc2626;
  margin: 0 0 0.75rem 0;
}
</style>
