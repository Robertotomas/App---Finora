<script setup lang="ts">
/**
 * Ícones (estilo lucide) da shell: header, sidebar, menus e pesquisa global.
 * stroke-width 2 por defeito; 1.75 a partir de 20px.
 */
import { computed } from 'vue'

export type ShellIconName =
  | 'home' | 'calendar' | 'calendar-check' | 'target' | 'grid' | 'swap' | 'clock' | 'wallet'
  | 'trending' | 'gem' | 'report' | 'plus' | 'plus-circle' | 'user' | 'users' | 'sun' | 'moon'
  | 'monitor' | 'logout' | 'check' | 'upgrade' | 'menu' | 'x' | 'chevron-down' | 'chevron-right'
  | 'panel-close' | 'panel-open' | 'search' | 'bell'

const props = withDefaults(defineProps<{ name: ShellIconName; size?: number }>(), { size: 18 })
const stroke = computed(() => (props.size >= 20 ? 1.75 : 2))
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="stroke"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'home'"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></template>
    <template v-else-if="name === 'calendar'"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></template>
    <template v-else-if="name === 'calendar-check'"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /><path d="m9 16 2 2 4-4" /></template>
    <template v-else-if="name === 'target'"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></template>
    <template v-else-if="name === 'grid'"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></template>
    <template v-else-if="name === 'swap'"><line x1="7" x2="7" y1="18" y2="6" /><polyline points="3 10 7 6 11 10" /><line x1="17" x2="17" y1="6" y2="18" /><polyline points="13 14 17 18 21 14" /></template>
    <template v-else-if="name === 'clock'"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></template>
    <template v-else-if="name === 'wallet'"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 10h20" /><circle cx="17" cy="15" r="1.5" /></template>
    <template v-else-if="name === 'trending'"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></template>
    <template v-else-if="name === 'gem'"><path d="M6 3h12l4 6-10 13L2 9z" /><path d="M2 9h20" /><path d="M11 3 8 9l4 13 4-13-3-6" /></template>
    <template v-else-if="name === 'report'"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /></template>
    <template v-else-if="name === 'plus'"><line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" y2="12" /></template>
    <template v-else-if="name === 'plus-circle'"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="16" /><line x1="8" x2="16" y1="12" y2="12" /></template>
    <template v-else-if="name === 'user'"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></template>
    <template v-else-if="name === 'users'"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></template>
    <template v-else-if="name === 'sun'"><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></template>
    <template v-else-if="name === 'moon'"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></template>
    <template v-else-if="name === 'monitor'"><rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" /></template>
    <template v-else-if="name === 'logout'"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></template>
    <template v-else-if="name === 'check'"><polyline points="20 6 9 17 4 12" /></template>
    <template v-else-if="name === 'upgrade'"><circle cx="12" cy="12" r="10" /><path d="m16 12-4-4-4 4" /><path d="M12 16V8" /></template>
    <template v-else-if="name === 'menu'"><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="18" y2="18" /></template>
    <template v-else-if="name === 'x'"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></template>
    <template v-else-if="name === 'chevron-down'"><path d="m6 9 6 6 6-6" /></template>
    <template v-else-if="name === 'chevron-right'"><path d="m9 18 6-6-6-6" /></template>
    <template v-else-if="name === 'panel-close'"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" /><path d="m16 15-3-3 3-3" /></template>
    <template v-else-if="name === 'panel-open'"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" /><path d="m14 9 3 3-3 3" /></template>
    <template v-else-if="name === 'search'"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></template>
    <template v-else-if="name === 'bell'"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></template>
  </svg>
</template>
