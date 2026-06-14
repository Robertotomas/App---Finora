export enum AssetCategory {
  RealEstate = 0,
  Art = 1,
  Collectibles = 2,
  RawMaterials = 3,
  PreciousMetals = 4,
  Vehicles = 5,
  Business = 6,
  Other = 7,
}

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  [AssetCategory.RealEstate]: 'Imobiliário',
  [AssetCategory.Art]: 'Arte',
  [AssetCategory.Collectibles]: 'Colecionáveis',
  [AssetCategory.RawMaterials]: 'Matérias-primas',
  [AssetCategory.PreciousMetals]: 'Metais preciosos',
  [AssetCategory.Vehicles]: 'Veículos',
  [AssetCategory.Business]: 'Negócio',
  [AssetCategory.Other]: 'Outro',
}

export const ASSET_CATEGORY_OPTIONS: { value: AssetCategory; label: string }[] = [
  AssetCategory.RealEstate,
  AssetCategory.Art,
  AssetCategory.Collectibles,
  AssetCategory.RawMaterials,
  AssetCategory.PreciousMetals,
  AssetCategory.Vehicles,
  AssetCategory.Business,
  AssetCategory.Other,
].map((value) => ({ value, label: ASSET_CATEGORY_LABELS[value] }))

export interface AssetValuation {
  id: string
  date: string
  value: number
}

export interface Asset {
  id: string
  householdId: string
  name: string
  category: AssetCategory
  acquisitionCost: number
  currency: string
  acquisitionDate: string
  currentValue: number
  lastValuationDate: string
  valuations: AssetValuation[]
}

export interface CreateAssetRequest {
  name: string
  category: AssetCategory
  acquisitionCost: number
  acquisitionDate: string
}

export type UpdateAssetRequest = CreateAssetRequest

export interface AddValuationRequest {
  date: string
  value: number
}

/** Variação do valor atual face ao custo de aquisição. */
export function assetChangeVsCost(
  currentValue: number,
  acquisitionCost: number,
): { abs: number; pct: number | null } {
  const abs = currentValue - acquisitionCost
  const pct = acquisitionCost !== 0 ? (abs / Math.abs(acquisitionCost)) * 100 : null
  return { abs, pct }
}

/**
 * Retorno anualizado (CAGR) em %: ((atual/custo)^(1/anos) - 1) * 100.
 * Devolve null se o custo for <= 0 ou o período for muito curto (< ~1 mês).
 */
export function annualizedReturn(
  acquisitionCost: number,
  currentValue: number,
  acquisitionDate: string | Date,
  now: Date = new Date(),
): number | null {
  if (acquisitionCost <= 0 || currentValue <= 0) return null
  const start = acquisitionDate instanceof Date ? acquisitionDate : new Date(acquisitionDate)
  const years = (now.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  if (!isFinite(years) || years < 1 / 12) return null
  return (Math.pow(currentValue / acquisitionCost, 1 / years) - 1) * 100
}

/** "16 anos, 3 meses" / "5 meses" / "Menos de 1 mês". */
export function holdingPeriodLabel(acquisitionDate: string | Date, now: Date = new Date()): string {
  const start = acquisitionDate instanceof Date ? acquisitionDate : new Date(acquisitionDate)
  if (isNaN(start.getTime())) return '—'
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months -= 1
  if (months < 0) months = 0
  const years = Math.floor(months / 12)
  const rem = months % 12
  const parts: string[] = []
  if (years > 0) parts.push(`${years} ${years === 1 ? 'ano' : 'anos'}`)
  if (rem > 0) parts.push(`${rem} ${rem === 1 ? 'mês' : 'meses'}`)
  if (parts.length === 0) return 'Menos de 1 mês'
  return parts.join(', ')
}

export interface ValuationRow extends AssetValuation {
  /** Variação face à avaliação anterior (mais antiga); null na primeira (aquisição). */
  deltaAbs: number | null
  deltaPct: number | null
}

/**
 * Ordena as avaliações por data desc e calcula a variação de cada uma face à anterior (mais antiga).
 * A avaliação de aquisição (a mais antiga) fica sem variação.
 */
export function valuationDeltas(valuations: AssetValuation[]): ValuationRow[] {
  const asc = [...valuations].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const rows: ValuationRow[] = asc.map((v, i) => {
    if (i === 0) return { ...v, deltaAbs: null, deltaPct: null }
    const prev = asc[i - 1]
    const deltaAbs = v.value - prev.value
    const deltaPct = prev.value !== 0 ? (deltaAbs / Math.abs(prev.value)) * 100 : null
    return { ...v, deltaAbs, deltaPct }
  })
  return rows.reverse()
}
