import { TransactionCategory } from './transaction'

/**
 * Metadados das categorias: agrupamento, ícone e cor.
 * Fonte única de verdade do frontend para o seletor agrupado, badges e gráficos.
 *
 * ⚠️ Ao mudar categorias, manter em sincronia com:
 *  - enum TransactionCategory + TRANSACTION_CATEGORY_LABELS (src/types/transaction.ts)
 *  - backend: TransactionCategory.cs + TransactionCategoryLabels.cs
 */

export interface CategoryGroup {
  key: string
  label: string
  /**
   * Filtra em que seletor o grupo aparece:
   *  'income'  → só em receitas
   *  'expense' → só em despesas
   *  'both'    → em receitas e despesas (ex.: Transferências, que pode ser entrada ou saída)
   */
  type: 'income' | 'expense' | 'both'
  categories: TransactionCategory[]
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    key: 'income',
    label: 'Rendimentos',
    type: 'income',
    categories: [
      TransactionCategory.Salary,
      TransactionCategory.Investments,
      TransactionCategory.PurchaseRefunds,
      TransactionCategory.TaxRefund,
      TransactionCategory.BenefitsPensions,
      TransactionCategory.SelfEmployment,
      TransactionCategory.OtherIncome,
    ],
  },
  {
    key: 'food',
    label: 'Alimentação',
    type: 'expense',
    categories: [
      TransactionCategory.Groceries,
      TransactionCategory.Restaurants,
      TransactionCategory.Cafes,
    ],
  },
  {
    key: 'housing',
    label: 'Habitação',
    type: 'expense',
    categories: [TransactionCategory.Rent, TransactionCategory.HouseholdBills],
  },
  {
    key: 'transport',
    label: 'Transportes',
    type: 'expense',
    categories: [
      TransactionCategory.Fuel,
      TransactionCategory.PublicTransport,
      TransactionCategory.Parking,
      TransactionCategory.CarMaintenance,
      TransactionCategory.TaxiRideshare,
    ],
  },
  {
    key: 'health',
    label: 'Saúde',
    type: 'expense',
    categories: [
      TransactionCategory.Pharmacy,
      TransactionCategory.Health,
      TransactionCategory.GymSports,
    ],
  },
  {
    key: 'leisure',
    label: 'Lazer',
    type: 'expense',
    categories: [
      TransactionCategory.PersonalCare,
      TransactionCategory.Gifts,
      TransactionCategory.Leisure,
      TransactionCategory.Travel,
      TransactionCategory.Donations,
      TransactionCategory.Pets,
      TransactionCategory.Subscriptions,
    ],
  },
  {
    key: 'shopping',
    label: 'Compras',
    type: 'expense',
    categories: [
      TransactionCategory.Shopping,
      TransactionCategory.Clothing,
      TransactionCategory.HomeFurniture,
      TransactionCategory.Electronics,
      TransactionCategory.CreditCard,
    ],
  },
  {
    key: 'education',
    label: 'Educação e família',
    type: 'expense',
    categories: [TransactionCategory.Education, TransactionCategory.Childcare],
  },
  {
    key: 'charges',
    label: 'Encargos',
    type: 'expense',
    categories: [
      TransactionCategory.Taxes,
      TransactionCategory.FeesCommissions,
      TransactionCategory.ProfessionalServices,
      TransactionCategory.Insurance,
    ],
  },
  {
    key: 'other',
    label: 'Outros',
    type: 'expense',
    categories: [TransactionCategory.OtherExpense],
  },
  {
    key: 'transfer',
    label: 'Transferências',
    type: 'both',
    categories: [TransactionCategory.Transfer],
  },
]

/** Categorias de receita (ordem do seletor; inclui grupos 'both'). */
export const INCOME_CATEGORIES: TransactionCategory[] = CATEGORY_GROUPS.filter(
  (g) => g.type === 'income' || g.type === 'both'
).flatMap((g) => g.categories)

/** Categorias de despesa (ordem do seletor; inclui grupos 'both'). */
export const EXPENSE_CATEGORIES: TransactionCategory[] = CATEGORY_GROUPS.filter(
  (g) => g.type === 'expense' || g.type === 'both'
).flatMap((g) => g.categories)

/** Cor de cada grupo (chave do grupo → cor). Todas as categorias de um grupo partilham esta cor. */
export const CATEGORY_GROUP_COLORS: Record<string, string> = {
  income: '#16a34a', // Rendimentos — verde
  food: '#f59e0b', // Alimentação — âmbar
  housing: '#3b82f6', // Habitação — azul
  transport: '#6366f1', // Transportes — índigo
  health: '#8b5cf6', // Saúde — violeta
  leisure: '#ec4899', // Lazer — rosa
  shopping: '#f97316', // Compras — laranja
  education: '#0ea5e9', // Educação e família — azul-céu
  charges: '#64748b', // Encargos — ardósia
  other: '#94a3b8', // Outros — cinza
  transfer: '#14b8a6', // Transferências — teal
}

/** Cor por categoria (gráficos, badges, ícones): herda a cor do grupo a que pertence. */
export const CATEGORY_COLORS: Record<number, string> = Object.fromEntries(
  CATEGORY_GROUPS.flatMap((g) =>
    g.categories.map((c) => [c, CATEGORY_GROUP_COLORS[g.key] ?? '#94a3b8'])
  )
)

/** Conteúdo SVG (inner) de cada ícone, desenhado com stroke="currentColor". */
export const CATEGORY_ICONS: Record<number, string> = {
  // Rendimentos
  [TransactionCategory.Salary]:
    '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  [TransactionCategory.Investments]:
    '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  [TransactionCategory.PurchaseRefunds]:
    '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
  [TransactionCategory.TaxRefund]:
    '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  [TransactionCategory.BenefitsPensions]:
    '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  [TransactionCategory.SelfEmployment]:
    '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/>',
  [TransactionCategory.OtherIncome]:
    '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  // Alimentação
  [TransactionCategory.Groceries]:
    '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  [TransactionCategory.Restaurants]:
    '<path d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  [TransactionCategory.Cafes]:
    '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>',
  // Habitação
  [TransactionCategory.Rent]:
    '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  [TransactionCategory.HouseholdBills]:
    '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  // Transportes
  [TransactionCategory.Fuel]:
    '<line x1="3" x2="15" y1="22" y2="22"/><line x1="4" x2="14" y1="9" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2 2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/>',
  [TransactionCategory.PublicTransport]:
    '<path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>',
  [TransactionCategory.Parking]:
    '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
  [TransactionCategory.CarMaintenance]:
    '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.3 1 12 1 12.8V16c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  [TransactionCategory.TaxiRideshare]:
    '<path d="M10 2h4"/><path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8"/><path d="M7 14h.01"/><path d="M17 14h.01"/><rect width="18" height="8" x="3" y="10" rx="2"/><path d="M5 18v2"/><path d="M19 18v2"/>',
  // Saúde
  [TransactionCategory.Pharmacy]:
    '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
  [TransactionCategory.Health]:
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',
  [TransactionCategory.GymSports]:
    '<path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/>',
  // Lazer
  [TransactionCategory.PersonalCare]:
    '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
  [TransactionCategory.Gifts]:
    '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
  [TransactionCategory.Leisure]:
    '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>',
  [TransactionCategory.Travel]:
    '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  [TransactionCategory.Donations]:
    '<path d="M11 14h2a2 2 0 0 0 2-2 2 2 0 0 0-2-2H9.5c-.6 0-1.1.2-1.4.6L3 16"/><path d="m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6H13c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"/><path d="m2 15 6 6"/><path d="M19.5 8.5c.7-.7 1.5-1.6 1.5-2.7A2.73 2.73 0 0 0 16 4a2.78 2.78 0 0 0-5 1.8c0 1.2.8 2 1.5 2.8L16 12Z"/>',
  [TransactionCategory.Pets]:
    '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>',
  [TransactionCategory.Subscriptions]:
    '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  // Compras
  [TransactionCategory.Shopping]:
    '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  [TransactionCategory.Clothing]:
    '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>',
  [TransactionCategory.HomeFurniture]:
    '<path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 16a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2v0H4v0a2 2 0 0 1-2-2Z"/><path d="M4 18v2M20 18v2"/><path d="M6 9v5M18 9v5"/>',
  [TransactionCategory.Electronics]:
    '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>',
  [TransactionCategory.CreditCard]:
    '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
  // Educação e família
  [TransactionCategory.Education]:
    '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5"/>',
  [TransactionCategory.Childcare]:
    '<path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/>',
  // Encargos
  [TransactionCategory.Taxes]:
    '<line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  [TransactionCategory.FeesCommissions]:
    '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
  [TransactionCategory.ProfessionalServices]:
    '<rect width="20" height="14" x="2" y="7" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
  [TransactionCategory.Insurance]:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1Z"/>',
  // Outros / Transferência
  [TransactionCategory.OtherExpense]:
    '<path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z"/><rect x="3" y="14" width="7" height="7" rx="1"/><circle cx="17.5" cy="17.5" r="3.5"/>',
  [TransactionCategory.Transfer]:
    '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
}

/** Ícone de fallback (categoria desconhecida). */
export const FALLBACK_CATEGORY_ICON =
  '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>'

export function categoryIcon(category: number): string {
  return CATEGORY_ICONS[category] ?? FALLBACK_CATEGORY_ICON
}

export function categoryColor(category: number): string {
  return CATEGORY_COLORS[category] ?? '#94a3b8'
}
