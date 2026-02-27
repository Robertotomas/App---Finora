<script setup lang="ts">
import BaseModal from './BaseModal.vue'

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
  <BaseModal v-if="open" :title="title" @close="$emit('close')">
    <p class="modal-message">{{ message }}</p>
    <div class="modal-actions">
      <button type="button" class="btn-cancel" @click="$emit('close')">
        Cancelar
      </button>
      <button
        type="button"
        class="btn-danger"
        :disabled="loading"
        @click="$emit('confirm')"
      >
        {{ loading ? 'A eliminar...' : 'Eliminar' }}
      </button>
    </div>
  </BaseModal>
</template>

<style scoped>
.modal-message {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0 0 1.5rem 0;
  line-height: 1.5;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.btn-cancel {
  padding: 0.5rem 1rem;
  background: #f1f5f9;
  color: #475569;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  cursor: pointer;
}

.btn-cancel:hover {
  background: #e2e8f0;
}

.btn-danger {
  padding: 0.5rem 1rem;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  cursor: pointer;
}

.btn-danger:hover:not(:disabled) {
  background: #b91c1c;
}

.btn-danger:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
