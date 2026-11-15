import { ref, onMounted, onBeforeUnmount } from 'vue'
import { isDark as readDark } from './chartTheme'

/**
 * Reatividade ao tema para gráficos: observa a classe `dark` no <html> (aplicada pelo store `theme`,
 * incluindo o modo "system"). Incluir `isDark.value` na `:key`/computed do gráfico para redesenhar.
 */
export function useChartTheme() {
  const isDark = ref(readDark())
  let observer: MutationObserver | null = null
  onMounted(() => {
    isDark.value = readDark()
    observer = new MutationObserver(() => {
      const v = readDark()
      if (v !== isDark.value) isDark.value = v
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  })
  onBeforeUnmount(() => observer?.disconnect())
  return { isDark }
}
