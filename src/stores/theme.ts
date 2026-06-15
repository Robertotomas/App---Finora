import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'finora-theme-mode'
const LEGACY_KEY = 'finora-theme-dark'

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyDarkMode(isDark: boolean) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', isDark)
}

function readStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
    // Migração da definição antiga (booleano true/false)
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy === 'true') return 'dark'
    if (legacy === 'false') return 'light'
  } catch {
    /* ignore */
  }
  return 'light'
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(readStoredMode())
  const systemDark = ref(systemPrefersDark())

  /** Modo efetivo: em 'system' segue o SO, caso contrário o modo escolhido. */
  const isDark = computed(() =>
    mode.value === 'system' ? systemDark.value : mode.value === 'dark',
  )

  applyDarkMode(isDark.value)

  // Reage a mudanças de tema do sistema operativo (relevante em modo 'system').
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => {
      systemDark.value = e.matches
    }
    if (mq.addEventListener) mq.addEventListener('change', handler)
    else if (mq.addListener) mq.addListener(handler)
  }

  watch(isDark, (val) => applyDarkMode(val))

  watch(mode, (val) => {
    try {
      localStorage.setItem(STORAGE_KEY, val)
    } catch {
      /* ignore */
    }
  })

  function setMode(m: ThemeMode) {
    mode.value = m
  }

  /** Mantido por compatibilidade: alterna entre claro e escuro explícitos. */
  function toggle() {
    mode.value = isDark.value ? 'light' : 'dark'
  }

  return { mode, isDark, systemDark, setMode, toggle }
})
