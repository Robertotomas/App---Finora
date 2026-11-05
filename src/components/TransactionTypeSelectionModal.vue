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
    subtitle="Que tipo de movimento quer criar?"
    size="sm"
    @close="handleClose"
  >
    <div class="selection-body">
      <div class="selection-options">
        <button type="button" class="selection-card" @click="emit('select', 'income-expense')">
          <span class="selection-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/>
            </svg>
          </span>
          <span class="selection-text">
            <span class="selection-label">Receita ou Despesa</span>
            <span class="selection-desc">Registar uma entrada ou saída de dinheiro</span>
          </span>
          <svg class="selection-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
        <button type="button" class="selection-card" @click="emit('select', 'transfer')">
          <span class="selection-icon selection-icon--transfer">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>
            </svg>
          </span>
          <span class="selection-text">
            <span class="selection-label">Transferência interna</span>
            <span class="selection-desc">Mover dinheiro entre as suas contas</span>
          </span>
          <svg class="selection-chevron" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.selection-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.selection-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) var(--space-4) var(--space-3) var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast), box-shadow var(--transition-fast);
}
.selection-card:hover {
  border-color: var(--color-primary-soft-border);
  background: var(--color-surface-hover);
}
.selection-card:focus-visible {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: var(--focus-ring);
}

.selection-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  background: var(--color-primary-soft);
  color: var(--color-primary-text);
}
.selection-icon--transfer {
  background: var(--color-info-soft);
  color: var(--color-transfer);
}

.selection-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.selection-label {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--color-text-strong);
}
.selection-desc {
  font-size: var(--text-sm);
  line-height: 1.4;
  color: var(--color-text-muted);
}
.selection-chevron {
  flex-shrink: 0;
  color: var(--color-text-subtle);
  transition: transform var(--transition-fast), color var(--transition-fast);
}
.selection-card:hover .selection-chevron {
  color: var(--color-text-muted);
  transform: translateX(2px);
}
</style>
