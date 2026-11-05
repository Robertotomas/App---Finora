<script setup lang="ts">
import { ref } from 'vue'

/**
 * Campo de palavra-passe com botão para mostrar/ocultar. Usa os estilos de `.auth-field input`.
 * `autocomplete` é obrigatório para os gestores de palavras-passe: `current-password` no login,
 * `new-password` no registo e na redefinição.
 */
defineProps<{
  id: string
  autocomplete: 'current-password' | 'new-password'
  placeholder?: string
}>()

const model = defineModel<string>({ required: true })
const visible = ref(false)
</script>

<template>
  <div class="pw-wrap">
    <input
      :id="id"
      v-model="model"
      :type="visible ? 'text' : 'password'"
      :autocomplete="autocomplete"
      :placeholder="placeholder"
      required
    />
    <button
      type="button"
      class="pw-toggle"
      :aria-label="visible ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'"
      :aria-pressed="visible"
      :title="visible ? 'Ocultar' : 'Mostrar'"
      @click="visible = !visible"
    >
      <svg v-if="!visible" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
    </button>
  </div>
</template>

<style scoped>
.pw-wrap {
  position: relative;
}

.pw-wrap input {
  padding-right: 2.75rem !important;
}

.pw-toggle {
  position: absolute;
  top: 50%;
  right: 6px;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-subtle);
  cursor: pointer;
  transition: color var(--transition-fast), background var(--transition-fast);
}
.pw-toggle:hover {
  color: var(--color-text-strong);
  background: var(--color-surface-muted);
}
.pw-toggle:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
</style>
