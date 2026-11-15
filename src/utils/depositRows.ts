/**
 * Linhas informativas "→ Investimentos" na lista de movimentos.
 *
 * Um depósito na corretora que debitou uma conta não é despesa nem movimento real (é só um ajuste
 * de saldo), mas o utilizador deve ver que o dinheiro saiu da conta. Por isso mostramo-lo intercalado
 * com os movimentos, sem contar para totais.
 *
 * A lista de movimentos é paginada no servidor (ordenada por data, mais recente primeiro), por isso cada
 * depósito tem de cair numa só página: a página cujo intervalo de datas o contém. Para não haver "buracos"
 * entre páginas, o limite superior de uma página é a última data da página anterior (quando a conhecemos).
 */

export interface DepositLike {
  id: string
  date: string // ISO; só se usa yyyy-MM-dd
  amount: number
  accountId?: string | null
}

export interface DepositFilters {
  from?: string // yyyy-MM-dd (inclusive)
  to?: string // yyyy-MM-dd (inclusive)
  accountId?: string
  /** '' (todos) | 'income' | 'expense' | 'transfer' */
  type?: string
  /** Filtro de categoria ativo → os depósitos não têm categoria, não aparecem. */
  category?: string
}

export interface PageWindow {
  page: number
  totalPages: number
  /** Datas (yyyy-MM-dd) do 1.º e último movimento da página atual; null se a página está vazia. */
  firstDate: string | null
  lastDate: string | null
  /** Última data da página anterior, se já foi vista (fecha o intervalo sem buracos). */
  prevPageLastDate?: string | null
}

const day = (iso: string) => iso.slice(0, 10)

/** Depósitos que debitaram uma conta e passam os filtros da lista. */
export function filterDeposits<T extends DepositLike>(deposits: T[], f: DepositFilters): T[] {
  if (f.category) return []
  if (f.type && f.type !== 'transfer') return []
  return deposits.filter((d) => {
    if (!d.accountId) return false // importados / dinheiro de fora: não saíram de uma conta registada
    if (f.accountId && d.accountId !== f.accountId) return false
    const dd = day(d.date)
    if (f.from && dd < f.from) return false
    if (f.to && dd > f.to) return false
    return true
  })
}

/** Dos depósitos já filtrados, os que pertencem à página atual. */
export function depositsForPage<T extends DepositLike>(deposits: T[], w: PageWindow): T[] {
  if (w.firstDate === null || w.lastDate === null) {
    // Página sem movimentos: só faz sentido mostrar depósitos se for a única página.
    return w.totalPages <= 1 ? deposits : []
  }
  const isFirst = w.page <= 1
  const isLast = w.page >= w.totalPages
  return deposits.filter((d) => {
    const dd = day(d.date)
    if (!isLast && dd < w.lastDate!) return false
    if (!isFirst) {
      if (w.prevPageLastDate) {
        if (dd >= w.prevPageLastDate) return false // pertence à página anterior
      } else if (dd > w.firstDate!) {
        return false
      }
    }
    return true
  })
}

export type ListRow<Tx, Dep> = { kind: 'tx'; key: string; date: string; tx: Tx } | { kind: 'deposit'; key: string; date: string; dep: Dep }

/** Junta movimentos e depósitos por data (mais recente primeiro), mantendo a ordem do servidor nos empates. */
export function mergeRows<Tx extends { id: string; date: string }, Dep extends DepositLike>(txs: Tx[], deps: Dep[]): ListRow<Tx, Dep>[] {
  const rows: ListRow<Tx, Dep>[] = [
    ...txs.map((tx) => ({ kind: 'tx' as const, key: tx.id, date: day(tx.date), tx })),
    ...deps.map((dep) => ({ kind: 'deposit' as const, key: `dep-${dep.id}`, date: day(dep.date), dep })),
  ]
  // sort é estável: em datas iguais, os movimentos (que vêm primeiro) mantêm a ordem e ficam antes.
  return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}
