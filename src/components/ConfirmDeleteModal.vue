<script setup lang="ts">
import BaseModal from './BaseModal.vue'
import UiButton from './ui/UiButton.vue'

defineProps<{
  open: boolean
  title: string
  message: string
  loading?: boolean
}>()

defineEmits<{
  close: []
  confirm: []
}>()
</script>

<template>
  <BaseModal v-if="open" :title="title" size="sm" @close="$emit('close')">
    <div class="confirm">
      <span class="confirm-icon" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
      </span>
      <p class="confirm-message">{{ message }}</p>
    </div>

    <template #footer>
      <UiButton variant="secondary" @click="$emit('close')">Cancelar</UiButton>
      <UiButton variant="danger" :loading="loading" @click="$emit('confirm')">Eliminar</UiButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.confirm {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}
.confirm-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: var(--radius-full);
  background: var(--color-danger-soft);
  color: var(--color-danger);
}
.confirm-message {
  margin: 0;
  padding-top: 2px;
  font-size: var(--text-base);
  line-height: 1.55;
  color: var(--color-text-secondary);
}
</style>
