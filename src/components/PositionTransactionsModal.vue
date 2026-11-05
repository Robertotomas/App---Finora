<script setup lang="ts">
import { PT_GROUPING } from '@/utils/numberFormat'
import { computed } from 'vue'
import BaseModal from './BaseModal.vue'
import UiButton from './ui/UiButton.vue'
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
  return new Intl.NumberFormat('pt-PT', { ...PT_GROUPING, style: 'currency', currency: props.holding?.currency || 'EUR' }).format(v)
}
function fmtEur(v: number): string {
  return new Intl.NumberFormat('pt-PT', { ...PT_GROUPING, style: 'currency', currency: 'EUR' }).format(v)
}
function fmtQty(v: number): string {
  return new Intl.NumberFormat('pt-PT', { ...PT_GROUPING, maximumFractionDigits: 6 }).format(v)
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
  <BaseModal v-if="open && holding" :title="holding.providerSymbol || holding.symbol" size="lg" @close="emit('close')">
    <div class="pt">
      <!-- Resumo -->
      <div class="pt-head">
        <InstrumentLogo :symbol="holding.symbol" :name="holding.name" :type="holding.type" :domain="holding.logoDomain" :size="40" />
        <div class="pt-head-info">
          <div class="pt-head-top">
            <span class="ui-badge ui-badge--brand">{{ INSTRUMENT_TYPE_LABELS[holding.type] }}</span>
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
        <span class="ui-label">Transações</span>
        <UiButton variant="secondary" size="sm" @click="emit('add')">
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>
          </template>
          Adicionar
        </UiButton>
      </div>

      <div class="pt-table-wrap ui-table-wrap">
        <table class="ui-table pt-table">
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
                <span class="ui-badge" :class="t.operation === InvestmentOperation.Buy ? 'ui-badge--success' : 'ui-badge--danger'">
                  {{ INVESTMENT_OPERATION_LABELS[t.operation] }}
                </span>
              </td>
              <td class="num">{{ fmtQty(t.quantity) }}</td>
              <td class="num">{{ fmtPrice(t.unitPrice) }}</td>
              <td class="num">{{ fmtPrice(t.commission) }}</td>
              <td class="act">
                <div class="row-actions">
                  <UiButton variant="ghost" size="sm" icon-only title="Editar" aria-label="Editar transação" @click="emit('edit', t)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                  </UiButton>
                  <UiButton variant="danger-ghost" size="sm" icon-only title="Eliminar" aria-label="Eliminar transação" @click="emit('remove', t)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                  </UiButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <template #footer>
      <UiButton variant="danger-ghost" class="pt-remove-pos" @click="emit('removePosition')">Eliminar posição inteira</UiButton>
      <UiButton variant="secondary" @click="emit('close')">Fechar</UiButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.pt {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.pt-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.pt-head-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.pt-head-top {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.pt-meta {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}
.pt-name {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pt-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
}
@media (max-width: 520px) {
  .pt-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.pt-kpi {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  min-width: 0;
}
.pt-kpi-label {
  font-size: var(--text-2xs);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-caps);
  color: var(--color-text-muted);
}
.pt-kpi-value {
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pt-kpi-value.pos {
  color: var(--color-income);
}
.pt-kpi-value.neg {
  color: var(--color-expense);
}

.pt-tx-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: calc(-1 * var(--space-2));
}

.pt-table-wrap {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
.pt-table th,
.pt-table td {
  padding-left: var(--space-3);
  padding-right: var(--space-3);
}
.pt-table td {
  padding-top: 8px;
  padding-bottom: 8px;
  white-space: nowrap;
}
.pt-table .num {
  text-align: right;
}
.pt-table .act {
  width: 1%;
}
.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 2px;
}

.pt-remove-pos {
  margin-right: auto;
}
</style>
