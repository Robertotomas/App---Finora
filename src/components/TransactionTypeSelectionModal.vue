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
    title="Nova transação"
    @close="handleClose"
  >
    <div class="selection-body">
      <p class="selection-hint">Que tipo de transação queres criar?</p>
      <div class="selection-options">
        <button type="button" class="selection-card" @click="emit('select', 'income-expense')">
          <span class="selection-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </span>
          <span class="selection-label">Receita ou Despesa</span>
          <span class="selection-desc">Registar uma entrada ou saída de dinheiro</span>
        </button>
        <button type="button" class="selection-card" @click="emit('select', 'transfer')">
          <span class="selection-icon selection-icon--transfer">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8L22 12L18 16"/><path d="M2 12H22"/><path d="M6 16L2 12L6 8"/>
            </svg>
          </span>
          <span class="selection-label">Transferência interna</span>
          <span class="selection-desc">Mover dinheiro entre as tuas contas</span>
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
