import { ref } from 'vue'

/**
 * Notificações curtas ("toasts") — feedback depois de guardar/eliminar/erros.
 * Uso: `const toast = useToast(); toast.success('Movimento guardado')`.
 * O `ToastHost` (montado no App.vue) mostra-as no canto inferior direito.
 */
export type ToastKind = 'success' | 'error' | 'info'
export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

const toasts = ref<Toast[]>([])
let seq = 0

function push(kind: ToastKind, message: string, ms = 3500) {
  const id = ++seq
  toasts.value = [...toasts.value.slice(-3), { id, kind, message }]
  window.setTimeout(() => dismiss(id), ms)
}

function dismiss(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

export function useToast() {
  return {
    toasts,
    dismiss,
    success: (m: string) => push('success', m),
    error: (m: string) => push('error', m, 5000),
    info: (m: string) => push('info', m),
  }
}
