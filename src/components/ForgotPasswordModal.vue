<script setup lang="ts">
import { ref } from 'vue'
import BaseModal from '@/components/BaseModal.vue'
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
      error.value = err.rateLimitMessage || 'Demasiados pedidos. Tenta novamente dentro de 1 minuto.'
    } else {
      error.value = err.response?.data?.message || 'Não foi possível enviar o email. Tenta novamente.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <BaseModal title="Recuperar palavra-passe" @close="emit('close')">
    <div v-if="!sent" class="fp-body">
      <p class="fp-text">
        Introduza o email da sua conta. Se existir, enviamos-lhe um link para definir uma nova palavra-passe.
      </p>
      <form @submit.prevent="handleSubmit">
        <div v-if="error" class="fp-error">{{ error }}</div>
        <div class="fp-field">
          <label for="fp-email">Email</label>
          <input
            id="fp-email"
            v-model="email"
            type="email"
            required
            autofocus
            placeholder="Introduza o e-mail"
          />
        </div>
        <div class="fp-actions">
          <button type="button" class="fp-btn-cancel" @click="emit('close')">Cancelar</button>
          <button type="submit" class="fp-btn-primary" :disabled="loading">
            {{ loading ? 'A enviar...' : 'Enviar link' }}
          </button>
        </div>
      </form>
    </div>

    <div v-else class="fp-body fp-sent">
      <div class="fp-sent-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4Z"/></svg>
      </div>
      <p class="fp-sent-title">Verifique o seu email</p>
      <p class="fp-text">
        Se existir uma conta associada a <strong>{{ email.trim() }}</strong>, vai receber um link para
        redefinir a palavra-passe. O link expira em 1 hora.
      </p>
      <button type="button" class="fp-btn-primary fp-btn-full" @click="emit('close')">Concluir</button>
    </div>
  </BaseModal>
</template>

<style scoped>
.fp-body {
  display: flex;
  flex-direction: column;
}

.fp-text {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  line-height: 1.5;
  margin: 0 0 1.25rem;
}

.fp-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-bottom: 1.25rem;
}

.fp-field label {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text);
}

.fp-field input {
  width: 100%;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  font-family: inherit;
  color: var(--color-text);
  background: var(--color-bg-input, var(--color-bg-card));
  border: 1px solid var(--color-border);
  border-radius: 10px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.fp-field input:focus {
  outline: none;
  border-color: #166534;
  box-shadow: 0 0 0 3px rgba(22, 101, 52, 0.15);
}

.fp-error {
  padding: 0.625rem 0.875rem;
  background: #fef2f2;
  color: #dc2626;
  border-radius: 10px;
  font-size: 0.8125rem;
  margin-bottom: 1rem;
}

html.dark .fp-error {
  background: rgba(220, 38, 38, 0.1);
  color: #f87171;
}

.fp-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.fp-btn-cancel {
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
}

.fp-btn-cancel:hover {
  background: var(--color-table-row-hover);
}

.fp-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1.25rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #fff;
  background: #166534;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
}

.fp-btn-primary:hover {
  background: #15803d;
}

.fp-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.fp-btn-full {
  width: 100%;
  margin-top: 0.5rem;
}

.fp-sent {
  align-items: center;
  text-align: center;
}

.fp-sent-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #ecfdf5;
  color: #166534;
  margin-bottom: 1rem;
}

html.dark .fp-sent-icon {
  background: rgba(22, 101, 52, 0.2);
  color: #4ade80;
}

.fp-sent-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0 0 0.5rem;
}
</style>
