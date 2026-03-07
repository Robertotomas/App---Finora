import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'finora-theme-dark'

function applyDarkMode(isDark: boolean) {
  if (typeof document === 'undefined') return
  if (isDark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export const useThemeStore = defineStore('theme', () => {
  let stored = 'false'
  try {
    stored = localStorage.getItem(STORAGE_KEY) ?? 'false'
  } catch {
    /* ignore */
  }
  const isDark = ref(stored === 'true')

  applyDarkMode(isDark.value)

  watch(isDark, (val) => {
    localStorage.setItem(STORAGE_KEY, String(val))
    applyDarkMode(val)
  })

  function toggle() {
    isDark.value = !isDark.value
  }

  return { isDark, toggle }
})
