<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useHouseholdStore } from '@/stores/household'
import { clearAllBudgetsForHousehold } from '@/composables/useMonthlyBudget'
import UiButton from '@/components/ui/UiButton.vue'

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
          <div class="partner-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
          </div>
          <h2 id="partner-left-title" class="partner-title">A outra pessoa saiu do agregado</h2>
          <p class="partner-lead">
            O plano casal terminou para este agregado. Todo o histórico (contas, movimentos, objetivos,
            relatórios) continua <strong>aqui</strong> — só você o vê neste agregado.
          </p>
          <p class="partner-hint">Escolha como quer prosseguir:</p>
          <div class="partner-actions-stack">
            <UiButton block @click="startContinue">
              Continuar com os dados existentes
            </UiButton>
            <UiButton block variant="danger-ghost" @click="startReset">
              Apagar tudo e começar do zero…
            </UiButton>
          </div>
        </template>

        <!-- Dupla confirmação: manter dados -->
        <template v-else-if="phase === 'continueAck'">
          <h2 class="partner-title">Confirmar — manter dados</h2>
          <p class="partner-lead">
            Vai manter contas, movimentos e restante histórico neste agregado. Este aviso deixa de
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
          <p v-if="errorMsg" class="partner-error" role="alert">{{ errorMsg }}</p>
          <div class="partner-actions-row">
            <UiButton variant="secondary" :disabled="actionLoading" @click="goMain">
              Voltar
            </UiButton>
            <UiButton
              :disabled="!continueAck"
              :loading="actionLoading"
              @click="confirmContinue"
            >
              {{ actionLoading ? 'A guardar…' : 'Confirmar e continuar' }}
            </UiButton>
          </div>
        </template>

        <!-- Reset passo 1 -->
        <template v-else-if="phase === 'reset1'">
          <div class="partner-icon partner-icon--danger" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
          </div>
          <h2 class="partner-title">Apagar todos os dados?</h2>
          <p class="partner-lead reset-strong">
            Isto remove <strong>todas</strong> as contas, movimentos, recorrentes, objetivos de poupança
            e relatórios mensais deste agregado. <strong>Não pode ser anulado.</strong>
          </p>
          <p v-if="errorMsg" class="partner-error" role="alert">{{ errorMsg }}</p>
          <div class="partner-actions-row">
            <UiButton variant="secondary" :disabled="actionLoading" @click="goMain">
              Voltar
            </UiButton>
            <UiButton
              variant="danger"
              :disabled="actionLoading"
              @click="phase = 'reset2'"
            >
              Continuar para confirmação final
            </UiButton>
          </div>
        </template>

        <!-- Reset passo 2 + RECOMECAR -->
        <template v-else>
          <h2 class="partner-title">Confirmação final</h2>
          <p class="partner-lead">
            Para apagar definitivamente, escreva <strong>RECOMECAR</strong> (maiúsculas, tal como está).
          </p>
          <input
            ref="resetInputRef"
            v-model="resetPhrase"
            type="text"
            class="partner-input"
            autocomplete="off"
            placeholder="RECOMECAR"
            aria-label="Escreva RECOMECAR para confirmar"
          />
          <p v-if="errorMsg" class="partner-error" role="alert">{{ errorMsg }}</p>
          <div class="partner-actions-row">
            <UiButton
              variant="secondary"
              :disabled="actionLoading"
              @click="phase = 'reset1'"
            >
              Voltar
            </UiButton>
            <UiButton
              variant="danger"
              :disabled="resetPhrase.trim() !== 'RECOMECAR'"
              :loading="actionLoading"
              @click="confirmReset"
            >
              {{ actionLoading ? 'A apagar…' : 'Apagar definitivamente' }}
            </UiButton>
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
  z-index: var(--z-modal);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: var(--color-modal-overlay);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.partner-dialog {
  width: 100%;
  max-width: min(460px, 100%);
  max-height: min(90vh, 640px);
  overflow-y: auto;
  padding: var(--space-8) var(--space-6) var(--space-6);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
}

.partner-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin: 0 auto var(--space-4);
  border-radius: 50%;
  background: var(--color-primary-soft);
  color: var(--color-primary-text);
}

.partner-icon--danger {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.partner-title {
  margin: 0 0 var(--space-3);
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
  text-align: center;
}

.partner-lead {
  margin: 0 0 var(--space-4);
  font-size: var(--text-base);
  line-height: 1.55;
  color: var(--color-text-muted);
}

.partner-lead strong {
  color: var(--color-text-strong);
}

.reset-strong {
  color: var(--color-text);
}

.partner-hint {
  margin: 0 0 var(--space-3);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}

.partner-actions-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.partner-actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: flex-end;
  margin-top: var(--space-2);
}

.partner-check {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
  font-size: var(--text-base);
  line-height: 1.45;
  color: var(--color-text);
  cursor: pointer;
}

.partner-check input {
  margin-top: 3px;
  flex-shrink: 0;
  accent-color: var(--color-primary);
}

.partner-input {
  width: 100%;
  box-sizing: border-box;
  height: 40px;
  margin-bottom: var(--space-3);
  padding: 0 var(--space-3);
  font-size: var(--text-base);
  font-family: ui-monospace, monospace;
  letter-spacing: 0.03em;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text-strong);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.partner-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--focus-ring);
}

.partner-error {
  margin: 0 0 var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-danger);
}
</style>
