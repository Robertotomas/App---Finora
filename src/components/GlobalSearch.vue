<script setup lang="ts">
import { PT_GROUPING } from '@/utils/numberFormat'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { searchApi, type GlobalSearchResult } from '@/api/search'
import { TRANSACTION_CATEGORY_LABELS, type TransactionCategory } from '@/types/transaction'
import { RECURRING_FREQUENCY_LABELS, RecurringFrequency } from '@/types/recurringTransaction'
import ShellIcon, { type ShellIconName } from '@/components/shell/ShellIcon.vue'

const router = useRouter()

const emptyResult = (): GlobalSearchResult => ({ transactions: [], recurrings: [], accounts: [], objectives: [] })
const categoryLabel = (c: number): string => TRANSACTION_CATEGORY_LABELS[c as TransactionCategory] ?? 'Movimento'

const query = ref('')
const open = ref(false)
/** Mobile: a pesquisa é um ícone que abre um campo sobreposto ao header. */
const expanded = ref(false)
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
  icon: ShellIconName
  run: () => void
}
interface PaletteGroup {
  title: string
  items: PaletteItem[]
}

// ── Navegação e ações (cliente, sempre disponíveis) ──
const NAV_ITEMS: { label: string; to: string; icon: ShellIconName; keywords: string }[] = [
  { label: 'Início', to: '/overview', icon: 'home', keywords: 'inicio dashboard painel patrimonio overview' },
  { label: 'Movimentos', to: '/transactions?tab=movements', icon: 'swap', keywords: 'movimentos transacoes gastos' },
  { label: 'Recorrentes', to: '/transactions?tab=recurring', icon: 'clock', keywords: 'recorrentes subscricoes mensais' },
  { label: 'Resumo de movimentos', to: '/transactions?tab=dashboard', icon: 'grid', keywords: 'resumo dashboard graficos movimentos' },
  { label: 'Contas', to: '/accounts', icon: 'wallet', keywords: 'contas patrimonio saldos' },
  { label: 'Objetivos', to: '/goals', icon: 'target', keywords: 'objetivos poupanca metas' },
  { label: 'Plano Mensal', to: '/monthly-plan', icon: 'calendar', keywords: 'plano mensal orcamento' },
  { label: 'Relatórios', to: '/reports', icon: 'report', keywords: 'relatorios pdf' },
  { label: 'Perfil', to: '/profile', icon: 'user', keywords: 'perfil conta definicoes' },
  { label: 'Agregado', to: '/household', icon: 'users', keywords: 'agregado familia casal couple' },
]

const ACTION_ITEMS = [
  { label: 'Novo movimento', to: '/transactions?tab=movements&action=new', keywords: 'novo movimento despesa receita criar adicionar' },
  { label: 'Novo recorrente', to: '/transactions?tab=recurring&action=new', keywords: 'novo recorrente mensal criar adicionar' },
  { label: 'Nova conta', to: '/accounts?action=new', keywords: 'nova conta criar adicionar' },
  { label: 'Novo objetivo', to: '/goals?tab=active&action=new', keywords: 'novo objetivo poupanca meta criar adicionar' },
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
  return sign + t.amount.toLocaleString('pt-PT', { ...PT_GROUPING, minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
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
    icon: 'swap',
    run: () => go('/transactions?tab=movements'),
  }))
  if (tx.length) out.push({ title: 'Movimentos', items: tx })

  const rec = result.value.recurrings.map<PaletteItem>((r) => ({
    id: 'rec-' + r.id,
    label: r.description || r.entityName || categoryLabel(r.category),
    sublabel: r.entityName && r.description ? r.entityName : undefined,
    meta: `${fmtAmount(r)} · ${RECURRING_FREQUENCY_LABELS[r.frequency as RecurringFrequency]}`,
    icon: 'clock',
    run: () => go('/transactions?tab=recurring'),
  }))
  if (rec.length) out.push({ title: 'Recorrentes', items: rec })

  const accs = result.value.accounts.map<PaletteItem>((a) => ({
    id: 'acc-' + a.id,
    label: a.name,
    meta: a.balance.toLocaleString('pt-PT', { ...PT_GROUPING, minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €',
    icon: 'wallet',
    run: () => go('/accounts'),
  }))
  if (accs.length) out.push({ title: 'Contas', items: accs })

  const objs = result.value.objectives.map<PaletteItem>((o) => ({
    id: 'obj-' + o.id,
    label: o.name,
    meta: o.completed ? 'Concluído' : undefined,
    icon: 'target',
    run: () => go(o.completed ? '/goals?tab=history' : '/goals?tab=active'),
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
    icon: 'plus-circle',
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
  expanded.value = false
  if (debounceTimer) clearTimeout(debounceTimer)
}

function expand() {
  expanded.value = true
  if (query.value.trim()) open.value = true
  nextTick(() => inputEl.value?.focus())
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
  expand()
}
onMounted(() => document.addEventListener('keydown', onGlobalKey))
onUnmounted(() => document.removeEventListener('keydown', onGlobalKey))
</script>

<template>
  <div ref="rootEl" class="global-search" :class="{ 'is-expanded': expanded }">
    <!-- Mobile: ícone que abre a pesquisa -->
    <button type="button" class="shell-icon-btn gs-trigger" aria-label="Pesquisar" @click.stop="expand">
      <ShellIcon name="search" :size="18" />
    </button>

    <div class="gs-field">
      <span class="gs-icon" aria-hidden="true"><ShellIcon name="search" :size="16" /></span>
      <input
        ref="inputEl"
        v-model="query"
        type="text"
        class="gs-input"
        placeholder="Pesquisar..."
        aria-label="Pesquisar"
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
      <kbd class="gs-kbd" aria-hidden="true">/</kbd>
      <button type="button" class="gs-cancel" @click="close">Cancelar</button>
    </div>

    <div v-if="open" id="gs-results" class="shell-menu gs-panel" role="listbox">
      <div v-if="loading && !hasResults" class="gs-empty">A pesquisar…</div>
      <div v-else-if="!hasResults" class="gs-empty">Sem resultados para “{{ query.trim() }}”.</div>

      <template v-else>
        <div v-for="group in groups" :key="group.title" class="gs-group">
          <span class="shell-menu-label">{{ group.title }}</span>
          <button
            v-for="item in group.items"
            :key="item.id"
            type="button"
            role="option"
            class="shell-menu-item gs-item"
            :class="{ 'is-highlighted': flatIndexOf(item) === activeIndex }"
            :aria-selected="flatIndexOf(item) === activeIndex"
            @mouseenter="activeIndex = flatIndexOf(item)"
            @click="item.run()"
          >
            <span class="gs-item-icon"><ShellIcon :name="item.icon" :size="16" /></span>
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
  width: min(260px, 28vw);
  flex-shrink: 1;
  min-width: 0;
}

.gs-trigger {
  display: none;
}

.gs-field {
  position: relative;
  display: flex;
  align-items: center;
}

.gs-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  color: var(--color-text-muted);
  pointer-events: none;
}

.gs-input {
  width: 100%;
  height: var(--control-h);
  padding: 0 32px 0 34px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font-family: inherit;
  font-size: var(--text-sm);
  outline: none;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast), background var(--transition-fast);
}

.gs-input::placeholder {
  color: var(--color-text-subtle);
}

.gs-input:hover {
  border-color: var(--color-border-strong);
}

.gs-input:focus {
  background: var(--color-surface);
  border-color: var(--color-primary-text);
  box-shadow: var(--focus-ring);
}

.gs-kbd {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border: 1px solid var(--color-border);
  border-radius: 5px;
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-family: inherit;
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
  pointer-events: none;
}

.gs-input:focus ~ .gs-kbd {
  display: none;
}

.gs-cancel {
  display: none;
}

.gs-panel {
  left: 0;
  right: auto;
  width: min(380px, 90vw);
  max-height: 70vh;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
}

.gs-empty {
  padding: var(--space-4) var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  text-align: center;
}

.gs-group + .gs-group {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--color-border-subtle);
}

.gs-item {
  padding-top: 6px;
  padding-bottom: 6px;
}

.gs-item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 6px;
  background: var(--color-surface-muted);
  color: var(--color-text-muted);
}

.gs-item.is-highlighted .gs-item-icon {
  background: var(--color-selected);
  color: var(--color-primary-text);
}

.gs-item-text {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.gs-item-label {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--color-text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gs-item-sub {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gs-item-meta {
  margin-left: auto;
  flex-shrink: 0;
  font-size: var(--text-xs);
  font-weight: var(--weight-regular);
  color: var(--color-text-muted);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/* ─── Mobile: ícone → campo sobreposto ao header ─── */
@media (max-width: 768px) {
  .global-search {
    width: auto;
  }

  .gs-trigger {
    display: inline-flex;
  }

  .gs-field,
  .gs-kbd {
    display: none;
  }

  .global-search.is-expanded .gs-field {
    display: flex;
    gap: var(--space-2);
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 300;
    height: 56px;
    padding: 0 var(--space-2) 0 var(--space-3);
    background: var(--color-header-bg);
    border-bottom: 1px solid var(--color-header-border);
  }

  .global-search.is-expanded .gs-icon {
    left: calc(var(--space-3) + 10px);
  }

  .global-search.is-expanded .gs-input {
    flex: 1;
    min-width: 0;
    padding-right: 12px;
    font-size: var(--text-md); /* ≥16px evita o zoom automático do iOS */
  }

  .gs-cancel {
    display: inline-flex;
    align-items: center;
    height: var(--control-h);
    padding: 0 var(--space-2);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-primary-text);
    font-family: inherit;
    font-size: var(--text-base);
    font-weight: var(--weight-semibold);
    cursor: pointer;
    flex-shrink: 0;
  }

  .gs-panel {
    position: fixed;
    top: 60px;
    left: var(--space-2);
    right: var(--space-2);
    width: auto;
    z-index: 300;
    max-height: calc(100dvh - 72px);
  }

  .global-search:not(.is-expanded) .gs-panel {
    display: none;
  }
}
</style>
