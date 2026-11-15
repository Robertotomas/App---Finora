<script setup lang="ts">
import { ref } from 'vue'
import BaseModal from '@/components/BaseModal.vue'
import UiButton from '@/components/ui/UiButton.vue'
import { authApi } from '@/api/auth'

const props = defineProps<{
  /** Pré-preenche o email (ex.: o que já foi escrito no login). */
  initialEmail?: string
}>()

const emit = defineEmits<{ close: [] }>()

const email = ref(props.initialEmail ?? '')
const loading = ref(false)
const error = ref('')
const sent = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    await authApi.forgotPassword(email.value.trim())
    sent.value = true
  } catch (e: unknown) {
    const err = e as { rateLimited?: boolean; rateLimitMessage?: string; response?: { data?: { message?: string } } }
    if (err.rateLimited) {
      error.value = err.rateLimitMessage || 'Demasiados pedidos. Tente novamente dentro de 1 minuto.'
    } else {
      error.value = err.response?.data?.message || 'Não foi possível enviar o email. Tente novamente.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <BaseModal title="Recuperar palavra-passe" size="sm" @close="emit('close')">
    <div v-if="!sent" class="fp-body">
      <p class="fp-text">
        Introduza o email da sua conta. Se existir, enviamos-lhe um link para definir uma nova palavra-passe.
      </p>
      <form id="forgot-password-form" class="modal-form" @submit.prevent="handleSubmit">
        <div v-if="error" class="fp-error" role="alert">{{ error }}</div>
        <div class="form-group">
          <label for="fp-email">Email</label>
          <input
            id="fp-email"
            v-model="email"
            type="email"
            class="input"
            required
            autofocus
            autocomplete="email"
            placeholder="Introduza o e-mail"
          />
        </div>
      </form>
    </div>

    <div v-else class="fp-body fp-sent">
      <div class="fp-sent-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/></svg>
      </div>
      <p class="fp-sent-title">Verifique o seu email</p>
      <p class="fp-text">
        Se existir uma conta associada a <strong>{{ email.trim() }}</strong>, vai receber um link para
        redefinir a palavra-passe. O link expira em 1 hora.
      </p>
    </div>

    <template #footer>
      <template v-if="!sent">
        <UiButton variant="secondary" @click="emit('close')">Cancelar</UiButton>
        <UiButton type="submit" form="forgot-password-form" :loading="loading">Enviar link</UiButton>
      </template>
      <UiButton v-else block @click="emit('close')">Concluir</UiButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.fp-body {
  display: flex;
  flex-direction: column;
}

.fp-text {
  margin: 0 0 var(--space-4);
  font-size: var(--text-base);
  line-height: 1.55;
  color: var(--color-text-secondary);
}
.fp-text strong {
  color: var(--color-text-strong);
}

.fp-error {
  padding: 10px 12px;
  font-size: var(--text-sm);
  color: var(--color-danger);
  background: var(--color-danger-soft);
  border: 1px solid var(--color-danger-border);
  border-radius: var(--radius-sm);
}

.fp-sent {
  align-items: center;
  text-align: center;
  padding-top: var(--space-2);
}
.fp-sent .fp-text {
  margin-bottom: 0;
}
.fp-sent-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  margin-bottom: var(--space-4);
  border-radius: var(--radius-full);
  background: var(--color-primary-soft);
  color: var(--color-primary-text);
}
.fp-sent-title {
  margin: 0 0 var(--space-2);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}
</style>
