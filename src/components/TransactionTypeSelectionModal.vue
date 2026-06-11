<script setup lang="ts">
import BaseModal from './BaseModal.vue'

defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  select: [type: 'income-expense' | 'transfer']
}>()

function handleClose() {
  emit('close')
}
</script>

<template>
  <BaseModal
    v-if="open"
    title="Novo movimento"
    @close="handleClose"
  >
    <div class="selection-body">
      <p class="selection-hint">Que tipo de movimento quer criar?</p>
      <div class="selection-options">
        <button type="button" class="selection-card" @click="emit('select', 'income-expense')">
          <span class="selection-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/>
            </svg>
          </span>
          <span class="selection-label">Receita ou Despesa</span>
          <span class="selection-desc">Registar uma entrada ou saída de dinheiro</span>
        </button>
        <button type="button" class="selection-card" @click="emit('select', 'transfer')">
          <span class="selection-icon selection-icon--transfer">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>
            </svg>
          </span>
          <span class="selection-label">Transferência interna</span>
          <span class="selection-desc">Mover dinheiro entre as suas contas</span>
        </button>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.selection-body {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.selection-hint {
  font-size: 0.875rem;
  color: var(--color-text-muted, #64748b);
  margin: 0;
}

.selection-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.selection-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.375rem;
  padding: 1rem 1.25rem;
  background: var(--color-bg-card, #fff);
  border: 1.5px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.15s;
  text-align: left;
}

.selection-card:hover {
  border-color: #166534;
  box-shadow: 0 2px 8px rgba(22, 101, 52, 0.12);
  transform: translateY(-1px);
}

.selection-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: #f0fdf4;
  color: #166534;
  margin-bottom: 0.25rem;
}

html.dark .selection-icon {
  background: rgba(22, 101, 52, 0.2);
  color: #4ade80;
}

.selection-icon--transfer {
  background: #eff6ff;
  color: #2563eb;
}

html.dark .selection-icon--transfer {
  background: rgba(37, 99, 235, 0.2);
  color: #60a5fa;
}

.selection-label {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text, #1e293b);
}

.selection-desc {
  font-size: 0.8125rem;
  color: var(--color-text-muted, #64748b);
  line-height: 1.4;
}
</style>
