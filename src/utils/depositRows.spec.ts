import { describe, expect, it } from 'vitest'
import { depositsForPage, filterDeposits, mergeRows } from './depositRows'

const dep = (id: string, date: string, accountId: string | null = 'acc1', amount = 300) => ({ id, date, amount, accountId })

describe('filterDeposits', () => {
  const all = [dep('a', '2026-10-02T00:00:00Z'), dep('b', '2026-09-15T00:00:00Z'), dep('c', '2026-10-05T00:00:00Z', null), dep('d', '2026-10-03T00:00:00Z', 'acc2')]

  it('só mostra depósitos que debitaram uma conta', () => {
    expect(filterDeposits(all, {}).map((d) => d.id)).toEqual(['a', 'b', 'd'])
  })

  it('respeita o intervalo de datas (inclusive)', () => {
    expect(filterDeposits(all, { from: '2026-10-01', to: '2026-10-02' }).map((d) => d.id)).toEqual(['a'])
  })

  it('respeita o filtro de conta', () => {
    expect(filterDeposits(all, { accountId: 'acc2' }).map((d) => d.id)).toEqual(['d'])
  })

  it('aparece em "Todos" e "Transferências", não em Receitas/Despesas nem com categoria', () => {
    expect(filterDeposits(all, { type: 'transfer' })).toHaveLength(3)
    expect(filterDeposits(all, { type: 'expense' })).toHaveLength(0)
    expect(filterDeposits(all, { type: 'income' })).toHaveLength(0)
    expect(filterDeposits(all, { category: '5' })).toHaveLength(0)
  })
})

describe('depositsForPage', () => {
  const deps = [dep('new', '2026-10-20'), dep('mid', '2026-10-10'), dep('gap', '2026-10-07'), dep('old', '2026-09-01')]
  const ids = (xs: { id: string }[]) => xs.map((d) => d.id)

  it('página única: mostra todos', () => {
    expect(ids(depositsForPage(deps, { page: 1, totalPages: 1, firstDate: '2026-10-15', lastDate: '2026-10-05' }))).toEqual(ids(deps))
  })

  it('1.ª página de várias: mais recentes + dentro do intervalo, não os mais antigos', () => {
    expect(ids(depositsForPage(deps, { page: 1, totalPages: 3, firstDate: '2026-10-15', lastDate: '2026-10-09' }))).toEqual(['new', 'mid'])
  })

  it('sem buracos: com a última data da página anterior, o depósito entre páginas cai na seguinte', () => {
    // Página 1 termina a 10-09; página 2 vai de 10-05 a 10-01. O depósito de 10-07 está no "buraco".
    const p2 = depositsForPage(deps, { page: 2, totalPages: 3, firstDate: '2026-10-05', lastDate: '2026-10-01', prevPageLastDate: '2026-10-09' })
    expect(ids(p2)).toEqual(['gap'])
  })

  it('não duplica: data igual à fronteira fica só na página anterior', () => {
    const p1 = depositsForPage([dep('edge', '2026-10-09')], { page: 1, totalPages: 2, firstDate: '2026-10-15', lastDate: '2026-10-09' })
    const p2 = depositsForPage([dep('edge', '2026-10-09')], { page: 2, totalPages: 2, firstDate: '2026-10-09', lastDate: '2026-10-01', prevPageLastDate: '2026-10-09' })
    expect(p1).toHaveLength(1)
    expect(p2).toHaveLength(0)
  })

  it('última página apanha os mais antigos', () => {
    expect(ids(depositsForPage(deps, { page: 3, totalPages: 3, firstDate: '2026-09-20', lastDate: '2026-09-10', prevPageLastDate: '2026-10-01' }))).toEqual(['old'])
  })

  it('página vazia: só mostra se for a única', () => {
    expect(depositsForPage(deps, { page: 1, totalPages: 1, firstDate: null, lastDate: null })).toHaveLength(4)
    expect(depositsForPage(deps, { page: 2, totalPages: 3, firstDate: null, lastDate: null })).toHaveLength(0)
  })
})

describe('mergeRows', () => {
  it('intercala por data (mais recente primeiro) e mantém a ordem dos movimentos nos empates', () => {
    const txs = [
      { id: 't1', date: '2026-10-05T00:00:00Z' },
      { id: 't2', date: '2026-10-03T00:00:00Z' },
      { id: 't3', date: '2026-10-03T00:00:00Z' },
    ]
    const rows = mergeRows(txs, [dep('d1', '2026-10-04'), dep('d2', '2026-10-03')])
    expect(rows.map((r) => r.key)).toEqual(['t1', 'dep-d1', 't2', 't3', 'dep-d2'])
  })
})
