<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { toasts, dismiss } = useToast()
</script>

<template>
  <div class="toast-host" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="`toast--${t.kind}`" role="status">
        <span class="toast-icon" aria-hidden="true">
          <svg v-if="t.kind === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          <svg v-else-if="t.kind === 'error'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
        </span>
        <span class="toast-msg">{{ t.message }}</span>
        <button type="button" class="toast-close" aria-label="Fechar" @click="dismiss(t.id)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  right: var(--space-5);
  bottom: var(--space-5);
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  pointer-events: none;
}
.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 260px;
  max-width: 380px;
  padding: 10px 10px 10px 12px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  font-size: var(--text-sm);
  color: var(--color-text-strong);
}
.toast-icon {
  width: 22px;
  height: 22px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.toast-icon svg {
  width: 13px;
  height: 13px;
}
.toast--success .toast-icon {
  background: var(--color-success-soft);
  color: var(--color-success);
}
.toast--error .toast-icon {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}
.toast--info .toast-icon {
  background: var(--color-info-soft);
  color: var(--color-info);
}
.toast-msg {
  flex: 1;
  line-height: 1.4;
}
.toast-close {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--color-text-subtle);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.toast-close:hover {
  background: var(--color-surface-muted);
  color: var(--color-text-strong);
}
.toast-close svg {
  width: 14px;
  height: 14px;
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
@media (max-width: 640px) {
  .toast-host {
    left: var(--space-4);
    right: var(--space-4);
    bottom: calc(var(--space-4) + env(safe-area-inset-bottom));
  }
  .toast {
    max-width: none;
  }
}
</style>
