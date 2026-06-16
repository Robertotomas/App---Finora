<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import InstrumentLogo from './InstrumentLogo.vue'
import { investmentsApi } from '@/api/investments'
import { InstrumentType, INSTRUMENT_TYPE_LABELS, POPULAR_INSTRUMENTS } from '@/types/investment'
import type { InstrumentSearchResult } from '@/types/investment'

defineProps<{
  error?: boolean
}>()

const emit = defineEmits<{
  select: [result: InstrumentSearchResult]
}>()

const RECENTS_KEY = 'finora_recent_instruments'

const query = ref('')
const loading = ref(false)
const results = ref<InstrumentSearchResult[]>([])
const recents = ref<InstrumentSearchResult[]>(loadRecents())
const activeIndex = ref(-1)
let debounce: ReturnType<typeof setTimeout> | null = null
let reqSeq = 0

type Filter = 'all' | InstrumentType.Stock | InstrumentType.Etf
const filter = ref<Filter>('all')
const chips: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tudo' },
  { value: InstrumentType.Stock, label: 'Ações' },
  { value: InstrumentType.Etf, label: 'ETFs e Fundos' },
]

function loadRecents(): InstrumentSearchResult[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.slice(0, 8) : []
  } catch {
    return []
  }
}

function pushRecent(r: InstrumentSearchResult) {
  const next = [r, ...recents.value.filter((x) => x.providerSymbol !== r.providerSymbol)].slice(0, 8)
  recents.value = next
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

function matchesFilter(r: InstrumentSearchResult): boolean {
  return filter.value === 'all' || r.type === filter.value
}

const isSearching = computed(() => query.value.trim().length > 0)

const recentList = computed(() => recents.value.filter(matchesFilter))
const popularList = computed(() => {
  const used = new Set(recents.value.map((r) => r.providerSymbol))
  return POPULAR_INSTRUMENTS.filter(matchesFilter).filter((p) => !used.has(p.providerSymbol))
})

// Lista plana (para navegação por teclado).
const displayList = computed(() =>
  isSearching.value ? results.value.filter(matchesFilter) : [...recentList.value, ...popularList.value],
)

// Secções para renderização (com cabeçalhos), com o offset do índice global de cada item.
const sections = computed(() => {
  if (isSearching.value) return [{ title: '', items: displayList.value, offset: 0 }]
  const s: { title: string; items: InstrumentSearchResult[]; offset: number }[] = []
  let offset = 0
  if (recentList.value.length) {
    s.push({ title: 'Pesquisas recentes', items: recentList.value, offset })
    offset += recentList.value.length
  }
  if (popularList.value.length) {
    s.push({ title: 'Populares', items: popularList.value, offset })
    offset += popularList.value.length
  }
  return s
})

function onInput() {
  activeIndex.value = -1
  if (debounce) clearTimeout(debounce)
  const q = query.value.trim()
  if (q.length < 1) {
    results.value = []
    loading.value = false
    return
  }
  loading.value = true
  debounce = setTimeout(() => runSearch(q), 280)
}

async function runSearch(q: string) {
  const seq = ++reqSeq
  try {
    const { data } = await investmentsApi.search(q)
    if (seq !== reqSeq) return
    results.value = data
  } catch {
    if (seq === reqSeq) results.value = []
  } finally {
    if (seq === reqSeq) loading.value = false
  }
}

function select(r: InstrumentSearchResult) {
  pushRecent(r)
  emit('select', r)
}

function moveActive(delta: number) {
  const n = displayList.value.length
  if (n === 0) return
  activeIndex.value = (activeIndex.value + delta + n) % n
}

function onEnter() {
  const list = displayList.value
  if (list.length === 0) return
  select(list[activeIndex.value >= 0 ? activeIndex.value : 0])
}

onMounted(() => {})
onUnmounted(() => {
  if (debounce) clearTimeout(debounce)
})
</script>

<template>
  <div class="ia">
    <div class="ia-input-wrap" :class="{ 'is-error': error }">
      <svg class="ia-search-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      <input
        v-model="query"
        type="text"
        class="ia-input"
        placeholder="Pesquisar produto…"
        autocomplete="off"
        @input="onInput"
        @keydown.down.prevent="moveActive(1)"
        @keydown.up.prevent="moveActive(-1)"
        @keydown.enter.prevent="onEnter"
      />
      <span v-if="loading" class="ia-spinner"></span>
    </div>

    <div class="ia-chips">
      <button
        v-for="c in chips"
        :key="String(c.value)"
        type="button"
        class="ia-chip"
        :class="{ active: filter === c.value }"
        @click="filter = c.value"
      >
        {{ c.label }}
      </button>
    </div>

    <div class="ia-results">
      <template v-for="sec in sections" :key="sec.title || 'results'">
        <p v-if="sec.title" class="ia-section">{{ sec.title }}</p>
        <button
          v-for="(r, i) in sec.items"
          :key="r.providerSymbol + i"
          type="button"
          class="ia-option"
          :class="{ 'is-active': sec.offset + i === activeIndex }"
          @mouseenter="activeIndex = sec.offset + i"
          @click="select(r)"
        >
          <InstrumentLogo :symbol="r.symbol" :name="r.name" :type="r.type" :domain="r.logoDomain" :size="34" />
          <span class="ia-option-text">
            <span class="ia-name">{{ r.name }}</span>
            <span class="ia-sub">{{ INSTRUMENT_TYPE_LABELS[r.type] }} · {{ r.exchange }} · {{ r.currency }}</span>
          </span>
          <span class="ia-ticker">{{ r.providerSymbol || r.symbol }}</span>
        </button>
      </template>

      <p v-if="isSearching && !loading && displayList.length === 0" class="ia-empty">
        Sem resultados para “{{ query.trim() }}”
      </p>
    </div>
  </div>
</template>

<style scoped>
.ia {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ia-input-wrap {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.75rem 1rem;
  background: var(--color-input-bg, #fff);
  border: 1.5px solid var(--color-input-border, #e2e8f0);
  border-radius: 12px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.ia-input-wrap:focus-within {
  border-color: #166534;
  box-shadow: 0 0 0 2px rgba(22, 101, 52, 0.18);
}

html.dark .ia-input-wrap:focus-within {
  border-color: #4ade80;
  box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.18);
}

.ia-input-wrap.is-error {
  border-color: #dc2626;
}

.ia-search-icon {
  flex-shrink: 0;
  color: var(--color-text-muted, #94a3b8);
}

.ia-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-family: inherit;
  font-size: 0.9375rem;
  color: var(--color-text, #0f172a);
}

.ia-input:focus,
.ia-input:focus-visible {
  border: none;
  outline: none;
  box-shadow: none;
}

.ia-input::placeholder {
  color: var(--color-text-muted, #94a3b8);
}

.ia-spinner {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border: 2px solid var(--color-border);
  border-top-color: #166534;
  border-radius: 50%;
  animation: ia-spin 0.7s linear infinite;
}

@keyframes ia-spin {
  to {
    transform: rotate(360deg);
  }
}

.ia-chips {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.ia-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: inherit;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
  white-space: nowrap;
}

.ia-chip:hover {
  border-color: #166534;
  color: #166534;
}

.ia-chip.active {
  border-color: #166534;
  background: rgba(22, 101, 52, 0.1);
  color: #166534;
}

html.dark .ia-chip.active {
  border-color: #4ade80;
  background: rgba(74, 222, 128, 0.12);
  color: #4ade80;
}

html.dark .ia-chip:hover {
  border-color: #4ade80;
  color: #4ade80;
}

.ia-results {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 0.375rem;
}

.ia-section {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
  margin: 0.375rem 0.5rem 0.25rem;
}

.ia-option {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: none;
  background: transparent;
  font-family: inherit;
  color: var(--color-text);
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
}

.ia-option.is-active {
  background: var(--color-table-row-hover, #f1f5f9);
}

.ia-option-text {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  flex: 1;
}

.ia-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ia-sub {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ia-ticker {
  flex-shrink: 0;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--color-text-muted);
}

.ia-empty {
  padding: 1rem 0.625rem;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  text-align: center;
  margin: 0;
}
</style>
