<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { searchApi, type GlobalSearchResult } from '@/api/search'
import { TRANSACTION_CATEGORY_LABELS, type TransactionCategory } from '@/types/transaction'

const router = useRouter()

const emptyResult = (): GlobalSearchResult => ({ transactions: [], recurrings: [], accounts: [], objectives: [] })
const categoryLabel = (c: number): string => TRANSACTION_CATEGORY_LABELS[c as TransactionCategory] ?? 'Movimento'

const query = ref('')
const open = ref(false)
const loading = ref(false)
const activeIndex = ref(0)
const result = ref<GlobalSearchResult>(emptyResult())

const rootEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let requestId = 0

interface PaletteItem {
  id: string
  label: string
  sublabel?: string
  meta?: string
  icon: string
  run: () => void
}
interface PaletteGroup {
  title: string
  items: PaletteItem[]
}

// ── Navegação e ações (cliente, sempre disponíveis) ──
const NAV_ITEMS = [
  { label: 'Início', to: '/inicio', icon: 'home', keywords: 'inicio dashboard painel patrimonio' },
  { label: 'Movimentos', to: '/movimentos?tab=movements', icon: 'swap', keywords: 'movimentos transacoes gastos' },
  { label: 'Recorrentes', to: '/movimentos?tab=recurring', icon: 'clock', keywords: 'recorrentes subscricoes mensais' },
  { label: 'Dashboard de movimentos', to: '/movimentos?tab=dashboard', icon: 'grid', keywords: 'dashboard graficos movimentos' },
  { label: 'Contas', to: '/contas', icon: 'wallet', keywords: 'contas patrimonio saldos' },
  { label: 'Objetivos', to: '/objetivos', icon: 'target', keywords: 'objetivos poupanca metas' },
  { label: 'Plano Mensal', to: '/plano-mensal', icon: 'calendar', keywords: 'plano mensal orcamento' },
  { label: 'Relatórios', to: '/relatorios', icon: 'report', keywords: 'relatorios pdf' },
  { label: 'Perfil', to: '/perfil', icon: 'user', keywords: 'perfil conta definicoes' },
  { label: 'Agregado', to: '/agregado', icon: 'users', keywords: 'agregado familia casal couple' },
]

const ACTION_ITEMS = [
  { label: 'Novo movimento', to: '/movimentos?tab=movements&action=new', keywords: 'novo movimento despesa receita criar adicionar' },
  { label: 'Novo recorrente', to: '/movimentos?tab=recurring&action=new', keywords: 'novo recorrente mensal criar adicionar' },
  { label: 'Nova conta', to: '/contas?action=new', keywords: 'nova conta criar adicionar' },
  { label: 'Novo objetivo', to: '/objetivos?tab=active&action=new', keywords: 'novo objetivo poupanca meta criar adicionar' },
]

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function go(to: string) {
  close()
  query.value = ''
  router.push(to)
}

function fmtAmount(t: { amount: number; type: number }): string {
  const sign = t.type === 1 ? '−' : t.type === 0 ? '+' : ''
  return sign + t.amount.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
}

const groups = computed<PaletteGroup[]>(() => {
  const nq = norm(query.value.trim())
  if (!nq) return []
  const out: PaletteGroup[] = []

  // Dados (vêm do backend)
  const tx = result.value.transactions.map<PaletteItem>((t) => ({
    id: 'tx-' + t.id,
    label: t.description || t.entityName || categoryLabel(t.category),
    sublabel: t.entityName && t.description ? t.entityName : undefined,
    meta: `${fmtAmount(t)} · ${fmtDate(t.date)}`,
    icon: 'tx',
    run: () => go('/movimentos?tab=movements'),
  }))
  if (tx.length) out.push({ title: 'Movimentos', items: tx })

  const rec = result.value.recurrings.map<PaletteItem>((r) => ({
    id: 'rec-' + r.id,
    label: r.description || r.entityName || categoryLabel(r.category),
    sublabel: r.entityName && r.description ? r.entityName : undefined,
    meta: `${fmtAmount(r)} · ${r.frequency === 1 ? 'Anual' : 'Mensal'}`,
    icon: 'clock',
    run: () => go('/movimentos?tab=recurring'),
  }))
  if (rec.length) out.push({ title: 'Recorrentes', items: rec })

  const accs = result.value.accounts.map<PaletteItem>((a) => ({
    id: 'acc-' + a.id,
    label: a.name,
    meta: a.balance.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €',
    icon: 'wallet',
    run: () => go('/contas'),
  }))
  if (accs.length) out.push({ title: 'Contas', items: accs })

  const objs = result.value.objectives.map<PaletteItem>((o) => ({
    id: 'obj-' + o.id,
    label: o.name,
    meta: o.completed ? 'Concluído' : undefined,
    icon: 'target',
    run: () => go(o.completed ? '/objetivos?tab=history' : '/objetivos?tab=active'),
  }))
  if (objs.length) out.push({ title: 'Objetivos', items: objs })

  // Navegação
  const nav = NAV_ITEMS.filter((i) => norm(i.label + ' ' + i.keywords).includes(nq)).map<PaletteItem>((i) => ({
    id: 'nav-' + i.to,
    label: i.label,
    icon: i.icon,
    run: () => go(i.to),
  }))
  if (nav.length) out.push({ title: 'Ir para', items: nav })

  // Ações
  const actions = ACTION_ITEMS.filter((i) => norm(i.label + ' ' + i.keywords).includes(nq)).map<PaletteItem>((i) => ({
    id: 'act-' + i.to,
    label: i.label,
    icon: 'plus',
    run: () => go(i.to),
  }))
  if (actions.length) out.push({ title: 'Ações', items: actions })

  return out
})

const flatItems = computed<PaletteItem[]>(() => groups.value.flatMap((g) => g.items))
const hasResults = computed(() => flatItems.value.length > 0)

function flatIndexOf(item: PaletteItem): number {
  return flatItems.value.findIndex((i) => i.id === item.id)
}

watch(query, (val) => {
  const q = val.trim()
  activeIndex.value = 0
  if (!q) {
    open.value = false
    result.value = emptyResult()
    return
  }
  open.value = true
  if (q.length < 2) {
    // Só navegação/ações para 1 caractere — não chamamos o backend.
    result.value = emptyResult()
    return
  }
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => runSearch(q), 220)
})

async function runSearch(q: string) {
  const id = ++requestId
  loading.value = true
  try {
    const { data } = await searchApi.global(q)
    if (id !== requestId) return // resultado obsoleto
    result.value = data
  } catch {
    if (id === requestId) result.value = emptyResult()
  } finally {
    if (id === requestId) loading.value = false
  }
}

function onFocus() {
  if (query.value.trim()) open.value = true
}

function moveActive(delta: number) {
  if (!hasResults.value) return
  const n = flatItems.value.length
  activeIndex.value = (activeIndex.value + delta + n) % n
}

function onEnter() {
  const item = flatItems.value[activeIndex.value]
  if (item) item.run()
}

function close() {
  open.value = false
  if (debounceTimer) clearTimeout(debounceTimer)
}

function onClickOutside(e: MouseEvent) {
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) close()
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
  if (debounceTimer) clearTimeout(debounceTimer)
})

// Atalho "/" para focar a pesquisa (quando não se está a escrever noutro campo)
function onGlobalKey(e: KeyboardEvent) {
  if (e.key !== '/') return
  const t = e.target as HTMLElement
  const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
  if (typing) return
  e.preventDefault()
  nextTick(() => inputEl.value?.focus())
}
onMounted(() => document.addEventListener('keydown', onGlobalKey))
onUnmounted(() => document.removeEventListener('keydown', onGlobalKey))
</script>

<template>
  <div ref="rootEl" class="global-search">
    <span class="gs-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
    </span>
    <input
      ref="inputEl"
      v-model="query"
      type="text"
      class="gs-input"
      placeholder="Pesquisar..."
      role="combobox"
      :aria-expanded="open"
      aria-controls="gs-results"
      autocomplete="off"
      @focus="onFocus"
      @keydown.down.prevent="moveActive(1)"
      @keydown.up.prevent="moveActive(-1)"
      @keydown.enter.prevent="onEnter"
      @keydown.esc.prevent="close"
    />

    <div v-if="open" id="gs-results" class="gs-panel" role="listbox">
      <div v-if="loading && !hasResults" class="gs-empty">A pesquisar…</div>
      <div v-else-if="!hasResults" class="gs-empty">Sem resultados para “{{ query.trim() }}”.</div>

      <template v-else>
        <div v-for="group in groups" :key="group.title" class="gs-group">
          <p class="gs-group-title">{{ group.title }}</p>
          <button
            v-for="item in group.items"
            :key="item.id"
            type="button"
            class="gs-item"
            :class="{ active: flatIndexOf(item) === activeIndex }"
            @mouseenter="activeIndex = flatIndexOf(item)"
            @click="item.run()"
          >
            <span class="gs-item-icon" :class="'gs-item-icon--' + item.icon">
              <svg v-if="item.icon === 'tx'" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="7" x2="7" y1="18" y2="6"/><polyline points="3 10 7 6 11 10"/><line x1="17" x2="17" y1="6" y2="18"/><polyline points="13 14 17 18 21 14"/></svg>
              <svg v-else-if="item.icon === 'wallet'" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20"/><circle cx="17" cy="15" r="1.5"/></svg>
              <svg v-else-if="item.icon === 'target'" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
              <svg v-else-if="item.icon === 'plus'" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="16"/><line x1="8" x2="16" y1="12" y2="12"/></svg>
              <svg v-else-if="item.icon === 'home'" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              <svg v-else-if="item.icon === 'swap'" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="7" x2="7" y1="18" y2="6"/><polyline points="3 10 7 6 11 10"/><line x1="17" x2="17" y1="6" y2="18"/><polyline points="13 14 17 18 21 14"/></svg>
              <svg v-else-if="item.icon === 'clock'" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <svg v-else-if="item.icon === 'grid'" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
              <svg v-else-if="item.icon === 'calendar'" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
              <svg v-else-if="item.icon === 'report'" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" x2="16" y1="13" y2="13"/><line x1="8" x2="16" y1="17" y2="17"/></svg>
              <svg v-else-if="item.icon === 'user'" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <svg v-else-if="item.icon === 'users'" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <svg v-else viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </span>
            <span class="gs-item-text">
              <span class="gs-item-label">{{ item.label }}</span>
              <span v-if="item.sublabel" class="gs-item-sub">{{ item.sublabel }}</span>
            </span>
            <span v-if="item.meta" class="gs-item-meta">{{ item.meta }}</span>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.global-search {
  position: relative;
  width: min(240px, 30vw);
  flex-shrink: 1;
}

.gs-icon {
  position: absolute;
  left: 0.625rem;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  color: var(--color-text-muted);
  pointer-events: none;
}

.gs-input {
  width: 100%;
  padding: 0.45rem 0.75rem 0.45rem 2rem;
  font-size: 0.8125rem;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.gs-input::placeholder {
  color: var(--color-text-muted);
}

.gs-input:focus {
  border-color: #166534;
  box-shadow: 0 0 0 3px rgba(22, 101, 52, 0.08);
}

.gs-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: min(360px, 90vw);
  max-height: 70vh;
  overflow-y: auto;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
  padding: 0.375rem;
  z-index: 200;
}

.gs-empty {
  padding: 0.875rem 0.75rem;
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  text-align: center;
}

.gs-group + .gs-group {
  margin-top: 0.25rem;
  padding-top: 0.25rem;
  border-top: 1px solid var(--color-border);
}

.gs-group-title {
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  margin: 0.375rem 0.5rem 0.25rem;
}

.gs-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.5rem 0.5rem;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  color: var(--color-text);
  font-family: inherit;
}

.gs-item.active {
  background: rgba(22, 101, 52, 0.1);
}

html.dark .gs-item.active {
  background: rgba(74, 222, 128, 0.12);
}

.gs-item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  flex-shrink: 0;
  background: var(--color-bg);
  color: var(--color-text-muted);
}


.gs-item-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.gs-item-label {
  font-size: 0.8125rem;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gs-item-sub {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gs-item-meta {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  flex-shrink: 0;
  margin-left: auto;
}

@media (max-width: 768px) {
  .global-search {
    width: 100%;
    max-width: none;
  }
}
</style>
