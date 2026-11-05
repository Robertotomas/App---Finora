/**
 * Milhares sempre separados nos valores pt-PT ("5 550,00 €", não "5550,00 €").
 *
 * Por defeito o Intl 'pt-PT' só agrupa a partir de 10 000, o que numa lista de valores parece um erro
 * ("5550,00 €" ao lado de "18 651,37 €"). `useGrouping: 'always'` corrige-o, mas o TypeScript 5.4 ainda
 * só tipa `boolean` — daí o cast. Usar com spread: `new Intl.NumberFormat('pt-PT', { ...PT_GROUPING, ... })`.
 * O PDF do relatório segue a mesma regra (`MonthlyReportGenerationService.Money`).
 */
export const PT_GROUPING = { useGrouping: 'always' } as unknown as Intl.NumberFormatOptions
