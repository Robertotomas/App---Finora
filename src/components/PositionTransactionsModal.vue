<script setup lang="ts">
import { computed } from 'vue'
import BaseModal from './BaseModal.vue'
import InstrumentLogo from './InstrumentLogo.vue'
import { INSTRUMENT_TYPE_LABELS, InvestmentOperation, INVESTMENT_OPERATION_LABELS } from '@/types/investment'
import type { InvestmentHolding, InvestmentTransaction } from '@/types/investment'

const props = defineProps<{
  open: boolean
  holding: InvestmentHolding | null
}>()

const emit = defineEmits<{
  close: []
  add: []
  edit: [tx: InvestmentTransaction]
  remove: [tx: InvestmentTransaction]
  removePosition: []
}>()

const txs = computed(() => props.holding?.transactions ?? [])

function fmtPrice(v: number): string {
  // Preços/comissões na moeda do instrumento (conforme o ticker).
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: props.holding?.currency || 'EUR' }).format(v)
}
function fmtEur(v: number): string {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)
}
function fmtQty(v: number): string {
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 6 }).format(v)
}
function fmtDate(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function fmtPct(pct: number): string {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2).replace('.', ',')}%`
}
</script>

<template>
  <BaseModal v-if="open && holding" :title="holding.providerSymbol || holding.symbol" @close="emit('close')">
    <div class="pt">
      <!-- Resumo -->
      <div class="pt-head">
        <InstrumentLogo :symbol="holding.symbol" :name="holding.name" :type="holding.type" :domain="holding.logoDomain" :size="40" />
        <div class="pt-head-info">
          <div class="pt-head-top">
            <span class="pt-badge">{{ INSTRUMENT_TYPE_LABELS[holding.type] }}</span>
            <span class="pt-meta">{{ holding.exchange }} · {{ holding.currency }}</span>
          </div>
          <span class="pt-name">{{ holding.name }}</span>
        </div>
      </div>

      <div class="pt-summary">
        <div class="pt-kpi">
          <span class="pt-kpi-label">Quantidade</span>
          <span class="pt-kpi-value">{{ fmtQty(holding.quantity) }}</span>
        </div>
        <div class="pt-kpi">
          <span class="pt-kpi-label">Custo médio</span>
          <span class="pt-kpi-value">{{ fmtPrice(holding.averageCost) }}</span>
        </div>
        <div class="pt-kpi">
          <span class="pt-kpi-label">Valor</span>
          <span class="pt-kpi-value">{{ holding.currentValueEur !== null ? fmtEur(holding.currentValueEur) : '—' }}</span>
        </div>
        <div class="pt-kpi">
          <span class="pt-kpi-label">Retorno</span>
          <span
            class="pt-kpi-value"
            :class="holding.returnEur === null ? '' : holding.returnEur >= 0 ? 'pos' : 'neg'"
          >
            {{ holding.returnPct !== null ? fmtPct(holding.returnPct) : '—' }}
          </span>
        </div>
      </div>

      <!-- Transações -->
      <div class="pt-tx-head">
        <span class="pt-section">Transações</span>
        <button type="button" class="pt-add" @click="emit('add')">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
          Adicionar
        </button>
      </div>

      <div class="pt-table-wrap">
        <table class="pt-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Op.</th>
              <th class="num">Qtd.</th>
              <th class="num">Preço</th>
              <th class="num">Comissão</th>
              <th class="act"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in txs" :key="t.id">
              <td>{{ fmtDate(t.date) }}</td>
              <td>
                <span class="op-tag" :class="t.operation === InvestmentOperation.Buy ? 'buy' : 'sell'">
                  {{ INVESTMENT_OPERATION_LABELS[t.operation] }}
                </span>
              </td>
              <td class="num">{{ fmtQty(t.quantity) }}</td>
              <td class="num">{{ fmtPrice(t.unitPrice) }}</td>
              <td class="num">{{ fmtPrice(t.commission) }}</td>
              <td class="act">
                <div class="row-actions">
                  <button type="button" class="row-btn" title="Editar" @click="emit('edit', t)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                  </button>
                  <button type="button" class="row-btn row-btn--del" title="Eliminar" @click="emit('remove', t)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <button type="button" class="pt-remove-pos" @click="emit('removePosition')">Eliminar posição inteira</button>
    </div>
  </BaseModal>
</template>

<style scoped>
.pt {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.pt-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.pt-head-info {
  min-width: 0;
}

.pt-head-top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pt-badge {
  font-size: 0.625rem;
  font-weight: 600;
  color: #166534;
  background: rgba(22, 101, 52, 0.1);
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
}

html.dark .pt-badge {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.12);
}

.pt-meta {
  font-size: 0.6875rem;
  color: var(--color-text-muted);
}

.pt-name {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.pt-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  padding: 0.875rem;
  border: 1px solid var(--color-border);
  border-radius: 12px;
}

.pt-kpi {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.pt-kpi-label {
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text-muted);
}

.pt-kpi-value {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--color-text);
}

.pt-kpi-value.pos {
  color: #166534;
}

html.dark .pt-kpi-value.pos {
  color: #4ade80;
}

.pt-kpi-value.neg {
  color: #dc2626;
}

html.dark .pt-kpi-value.neg {
  color: #f87171;
}

.pt-tx-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pt-section {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--color-text);
}

.pt-add {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
}

.pt-add:hover {
  background: var(--color-table-row-hover);
  border-color: var(--color-text-muted);
}

.pt-table-wrap {
  overflow-x: auto;
}

.pt-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.pt-table th {
  text-align: left;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text-muted);
  padding: 0.5rem 0.5rem;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.pt-table th.num {
  text-align: right;
}

.pt-table td {
  padding: 0.6rem 0.5rem;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text);
  white-space: nowrap;
}

.pt-table tbody tr:last-child td {
  border-bottom: none;
}

.pt-table .num {
  text-align: right;
}

.op-tag {
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
}

.op-tag.buy {
  color: #059669;
  background: rgba(5, 150, 105, 0.12);
}

html.dark .op-tag.buy {
  color: #34d399;
}

.op-tag.sell {
  color: #dc2626;
  background: rgba(220, 38, 38, 0.12);
}

html.dark .op-tag.sell {
  color: #f87171;
}

.act {
  width: 64px;
  text-align: right;
}

.row-actions {
  display: flex;
  gap: 0.2rem;
  justify-content: flex-end;
}

.row-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.row-btn:hover {
  color: var(--color-text);
  border-color: var(--color-border);
  background: var(--color-table-row-hover);
}

.row-btn--del:hover {
  color: #dc2626;
  border-color: #fecaca;
  background: #fef2f2;
}

html.dark .row-btn--del:hover {
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.3);
  background: rgba(248, 113, 113, 0.1);
}

.pt-remove-pos {
  align-self: flex-start;
  background: transparent;
  border: none;
  color: #dc2626;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  padding: 0.25rem 0;
}

html.dark .pt-remove-pos {
  color: #f87171;
}

.pt-remove-pos:hover {
  text-decoration: underline;
}
</style>
