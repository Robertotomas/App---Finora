export enum InstrumentType {
  Stock = 0,
  Etf = 1,
  Other = 2,
}

export const INSTRUMENT_TYPE_LABELS: Record<InstrumentType, string> = {
  [InstrumentType.Stock]: 'Ação',
  [InstrumentType.Etf]: 'ETF',
  [InstrumentType.Other]: 'Outro',
}

export enum InvestmentOperation {
  Buy = 0,
  Sell = 1,
}

export const INVESTMENT_OPERATION_LABELS: Record<InvestmentOperation, string> = {
  [InvestmentOperation.Buy]: 'Comprar',
  [InvestmentOperation.Sell]: 'Vender',
}

/** Emissores de ETF mais comuns → domínio da marca (para o logo correto via Logo.dev). */
const ETF_ISSUER_DOMAINS: { match: string[]; domain: string }[] = [
  { match: ['vanguard'], domain: 'vanguard.com' },
  { match: ['ishares', 'blackrock'], domain: 'ishares.com' },
  { match: ['xtrackers', 'x-trackers', 'db x'], domain: 'xtrackers.com' },
  { match: ['amundi'], domain: 'amundi.com' },
  { match: ['lyxor'], domain: 'amundietf.com' },
  { match: ['spdr', 'state street', 'ssga'], domain: 'ssga.com' },
  { match: ['invesco'], domain: 'invesco.com' },
  { match: ['wisdomtree'], domain: 'wisdomtree.eu' },
  { match: ['vaneck'], domain: 'vaneck.com' },
  { match: ['hsbc'], domain: 'hsbc.com' },
  { match: ['ubs'], domain: 'ubs.com' },
  { match: ['fidelity'], domain: 'fidelity.com' },
  { match: ['franklin', 'libertyshares', 'libertyq'], domain: 'franklintempleton.com' },
  { match: ['jpmorgan', 'jpm '], domain: 'jpmorgan.com' },
  { match: ['legal & general', 'lgim', 'l&g'], domain: 'lgim.com' },
  { match: ['pimco'], domain: 'pimco.com' },
  { match: ['vontobel'], domain: 'vontobel.com' },
  { match: ['21shares'], domain: '21shares.com' },
  { match: ['global x'], domain: 'globalxetfs.com' },
  { match: ['first trust'], domain: 'ftportfolios.com' },
  { match: ['deka'], domain: 'deka.de' },
  { match: ['vaneck'], domain: 'vaneck.com' },
]

/** Domínio do emissor de um ETF a partir do nome, ou null. */
export function etfIssuerDomain(name: string): string | null {
  const n = (name || '').toLowerCase()
  for (const e of ETF_ISSUER_DOMAINS) {
    if (e.match.some((m) => n.includes(m))) return e.domain
  }
  return null
}

/**
 * Ticker de ETF UCITS → domínio do emissor. Útil quando o instrumento foi importado
 * e o "nome" é só o ticker (ex.: "VUAA"), por isso o emissor não se deteta pelo nome.
 */
const ETF_TICKER_DOMAINS: Record<string, string> = {
  // Vanguard
  VWCE: 'vanguard.com', VWRL: 'vanguard.com', VWRP: 'vanguard.com', VWCG: 'vanguard.com', VUAA: 'vanguard.com',
  VUSA: 'vanguard.com', VUSD: 'vanguard.com', VUAG: 'vanguard.com', VFEM: 'vanguard.com', VFEG: 'vanguard.com',
  VHYL: 'vanguard.com', VHVG: 'vanguard.com', VEUR: 'vanguard.com', VEVE: 'vanguard.com', VNRT: 'vanguard.com',
  VMID: 'vanguard.com', VJPN: 'vanguard.com', VGEK: 'vanguard.com', VAGP: 'vanguard.com', VDEV: 'vanguard.com',
  // iShares / BlackRock
  IWDA: 'ishares.com', EUNL: 'ishares.com', SWDA: 'ishares.com', CSPX: 'ishares.com', SXR8: 'ishares.com',
  CSP1: 'ishares.com', IUSA: 'ishares.com', SXRV: 'ishares.com', QDVE: 'ishares.com', IS3N: 'ishares.com',
  EUNM: 'ishares.com', EIMI: 'ishares.com', EMIM: 'ishares.com', SUSW: 'ishares.com', IMAE: 'ishares.com',
  SXRG: 'ishares.com', IUSQ: 'ishares.com', AGGH: 'ishares.com', IUSN: 'ishares.com', ISAC: 'ishares.com',
  SGLN: 'ishares.com', IGLN: 'ishares.com', EUNA: 'ishares.com', IBTA: 'ishares.com', IS3R: 'ishares.com',
  // Xtrackers / DWS
  XDWD: 'xtrackers.com', XESC: 'xtrackers.com', XMME: 'xtrackers.com', XDEW: 'xtrackers.com', XNAS: 'xtrackers.com',
  XMWO: 'xtrackers.com', XDWT: 'xtrackers.com', XDWL: 'xtrackers.com', XMEU: 'xtrackers.com',
  // Amundi / Lyxor
  CW8: 'amundietf.com', MWRD: 'amundietf.com', WLDA: 'amundietf.com', LCWD: 'amundietf.com', PRAW: 'amundietf.com',
  AMEM: 'amundietf.com', ESE: 'amundietf.com', LYP6: 'amundietf.com', CD9: 'amundietf.com',
  // SPDR / State Street
  SPYY: 'ssga.com', SPY5: 'ssga.com', SPPW: 'ssga.com', ZPRV: 'ssga.com', ZPRX: 'ssga.com', SPYI: 'ssga.com',
  // Invesco
  EQQQ: 'invesco.com', SPXP: 'invesco.com', SP5: 'invesco.com', MXIS: 'invesco.com',
}

/** Domínio do emissor de um ETF a partir do TICKER (ex.: "VUAA" → vanguard.com), ou null. */
export function etfTickerDomain(symbol: string): string | null {
  if (!symbol) return null
  const base = symbol.split('.')[0].toUpperCase()
  return ETF_TICKER_DOMAINS[base] ?? null
}

/**
 * Empresas (sobretudo europeias/PT) → domínio da marca, para o logo correto.
 * Útil porque o logo por ticker do Logo.dev é orientado aos EUA e erra em tickers europeus.
 */
const STOCK_BRAND_DOMAINS: { match: string[]; domain: string }[] = [
  // Portugal
  { match: ['galp'], domain: 'galp.com' },
  { match: ['edp '], domain: 'edp.com' },
  { match: ['jeronimo martins', 'jerónimo martins'], domain: 'jeronimomartins.com' },
  { match: ['sonae'], domain: 'sonae.pt' },
  { match: ['mota-engil', 'mota engil'], domain: 'mota-engil.com' },
  { match: ['navigator'], domain: 'thenavigatorcompany.com' },
  { match: ['corticeira amorim', 'amorim'], domain: 'amorim.com' },
  { match: ['altri'], domain: 'altri.pt' },
  { match: ['nos '], domain: 'nos.pt' },
  { match: ['ctt'], domain: 'ctt.pt' },
  { match: ['ibersol'], domain: 'ibersol.pt' },
  { match: ['semapa'], domain: 'semapa.pt' },
  // Europa — blue chips
  { match: ['adidas'], domain: 'adidas.com' },
  { match: ['asml'], domain: 'asml.com' },
  { match: ['sap'], domain: 'sap.com' },
  { match: ['siemens'], domain: 'siemens.com' },
  { match: ['infineon'], domain: 'infineon.com' },
  { match: ['volkswagen'], domain: 'volkswagen.com' },
  { match: ['bmw'], domain: 'bmw.com' },
  { match: ['mercedes', 'daimler'], domain: 'mercedes-benz.com' },
  { match: ['allianz'], domain: 'allianz.com' },
  { match: ['deutsche bank'], domain: 'db.com' },
  { match: ['deutsche telekom'], domain: 'telekom.com' },
  { match: ['deutsche post', 'dhl'], domain: 'dhl.com' },
  { match: ['munich re', 'münchener'], domain: 'munichre.com' },
  { match: ['nestle', 'nestlé'], domain: 'nestle.com' },
  { match: ['novartis'], domain: 'novartis.com' },
  { match: ['roche'], domain: 'roche.com' },
  { match: ['novo nordisk'], domain: 'novonordisk.com' },
  { match: ['astrazeneca'], domain: 'astrazeneca.com' },
  { match: ['unilever'], domain: 'unilever.com' },
  { match: ['shell'], domain: 'shell.com' },
  { match: ['totalenergies', 'total '], domain: 'totalenergies.com' },
  { match: ['lvmh', 'louis vuitton'], domain: 'lvmh.com' },
  { match: ['hermes', 'hermès'], domain: 'hermes.com' },
  { match: ['kering'], domain: 'kering.com' },
  { match: ["l'oreal", 'loreal', 'l’oréal'], domain: 'loreal.com' },
  { match: ['airbus'], domain: 'airbus.com' },
  { match: ['bnp paribas'], domain: 'bnpparibas.com' },
  { match: ['santander'], domain: 'santander.com' },
  { match: ['bbva', 'banco bilbao'], domain: 'bbva.com' },
  { match: ['iberdrola'], domain: 'iberdrola.com' },
  { match: ['inditex', 'zara'], domain: 'inditex.com' },
  { match: ['telefonica', 'telefónica'], domain: 'telefonica.com' },
  { match: ['enel'], domain: 'enel.com' },
  { match: ['eni'], domain: 'eni.com' },
  { match: ['ferrari'], domain: 'ferrari.com' },
  { match: ['stellantis'], domain: 'stellantis.com' },
  { match: ['philips'], domain: 'philips.com' },
  { match: ['adyen'], domain: 'adyen.com' },
  { match: ['prosus'], domain: 'prosus.com' },
  { match: ['ab inbev', 'anheuser'], domain: 'ab-inbev.com' },
  { match: ['schneider electric'], domain: 'se.com' },
  { match: ['vinci'], domain: 'vinci.com' },
  { match: ['essilorluxottica'], domain: 'essilorluxottica.com' },
  { match: ['safran'], domain: 'safran-group.com' },
  { match: ['vonovia'], domain: 'vonovia.de' },
]

/** Domínio da marca de uma empresa a partir do nome, ou null. */
export function stockBrandDomain(name: string): string | null {
  const n = (name || '').toLowerCase()
  for (const e of STOCK_BRAND_DOMAINS) {
    if (e.match.some((m) => n.includes(m))) return e.domain
  }
  return null
}

/** Domínio da marca para um instrumento (ETF → emissor; ação → empresa). */
export function instrumentBrandDomain(name: string, type: InstrumentType): string | null {
  return type === InstrumentType.Etf ? etfIssuerDomain(name) : stockBrandDomain(name)
}

export interface InvestmentTransaction {
  id: string
  operation: InvestmentOperation
  date: string
  quantity: number
  unitPrice: number
  commission: number
  /** Margem de câmbio do broker em % (ex.: 0,5% na XTB). 0 para instrumentos em EUR. */
  fxFeePercent: number
}

export interface InvestmentHolding {
  id: string
  householdId: string
  symbol: string
  exchange: string
  providerSymbol: string
  name: string
  currency: string
  type: InstrumentType
  logoDomain?: string | null
  /** Quantidade líquida (compras − vendas), calculada das transações. */
  quantity: number
  /** Custo médio por unidade (das compras, incl. comissões). */
  averageCost: number
  currentPrice: number | null
  priceAsOf: string | null
  investedEur: number
  currentValueEur: number | null
  returnEur: number | null
  returnPct: number | null
  transactions: InvestmentTransaction[]
}

/** Ponto da série de evolução (valor de mercado + custo investido, em EUR). */
export interface InvestmentHistoryPoint {
  date: string
  value: number
  cost: number
}

export interface InvestmentHistory {
  currency: string
  points: InvestmentHistoryPoint[]
}

/** Cotação histórica de um ticker (na moeda do instrumento), para o mini-gráfico do modal. */
export interface InstrumentPricePoint {
  date: string
  value: number
}

export interface InstrumentPriceHistory {
  points: InstrumentPricePoint[]
}

/** Uma transação parseada no cliente (Excel/CSV da corretora), pronta a importar. */
export interface BrokerTrade {
  providerSymbol: string
  baseSymbol: string
  isin?: string | null
  name: string
  currency: string
  exchange: string
  type: InstrumentType
  operation: InvestmentOperation
  date: string
  quantity: number
  unitPrice: number
  fxRateToEur: number | null
  externalId: string
}

/** Resultado da importação de um extrato de corretora (XTB). */
export interface InvestmentImportItem {
  providerSymbol: string
  name: string
  operation: string // "Compra" | "Venda"
  date: string
  quantity: number
  unitPrice: number
  currency: string
  status: 'new' | 'duplicate'
}

export interface InvestmentImportResult {
  dryRun: boolean
  detected: number
  created: number
  skipped: number
  hasUnparsedRows: boolean
  error?: string | null
  items: InvestmentImportItem[]
}

export interface InstrumentSearchResult {
  symbol: string
  name: string
  exchange: string
  micCode: string
  currency: string
  type: InstrumentType
  providerSymbol: string
  /** Domínio da marca para o logo (ex.: "adidas.com"), resolvido no backend via Logo.dev. */
  logoDomain?: string | null
}

/** Instrumentos populares (sugeridos quando a pesquisa está vazia). ETFs em EUR + ações conhecidas. */
export const POPULAR_INSTRUMENTS: InstrumentSearchResult[] = [
  { symbol: 'VWCE', name: 'Vanguard FTSE All-World UCITS ETF (USD) Accumulating', exchange: 'XETR', micCode: 'XETR', currency: 'EUR', type: InstrumentType.Etf, providerSymbol: 'VWCE.DE', logoDomain: 'vanguard.com' },
  { symbol: 'VUAA', name: 'Vanguard S&P 500 UCITS ETF (USD) Accumulating', exchange: 'XETR', micCode: 'XETR', currency: 'EUR', type: InstrumentType.Etf, providerSymbol: 'VUAA.DE', logoDomain: 'vanguard.com' },
  { symbol: 'IWDA', name: 'iShares Core MSCI World UCITS ETF USD (Acc)', exchange: 'Euronext', micCode: 'XAMS', currency: 'EUR', type: InstrumentType.Etf, providerSymbol: 'IWDA.AS', logoDomain: 'ishares.com' },
  { symbol: 'SXR8', name: 'iShares Core S&P 500 UCITS ETF USD (Acc)', exchange: 'XETR', micCode: 'XETR', currency: 'EUR', type: InstrumentType.Etf, providerSymbol: 'SXR8.DE', logoDomain: 'ishares.com' },
  { symbol: 'AAPL', name: 'Apple Inc', exchange: 'NASDAQ', micCode: 'XNGS', currency: 'USD', type: InstrumentType.Stock, providerSymbol: 'AAPL', logoDomain: 'apple.com' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', exchange: 'NASDAQ', micCode: 'XNGS', currency: 'USD', type: InstrumentType.Stock, providerSymbol: 'MSFT', logoDomain: 'microsoft.com' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', micCode: 'XNGS', currency: 'USD', type: InstrumentType.Stock, providerSymbol: 'NVDA', logoDomain: 'nvidia.com' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NASDAQ', micCode: 'XNGS', currency: 'USD', type: InstrumentType.Stock, providerSymbol: 'AMZN', logoDomain: 'amazon.com' },
  { symbol: 'GOOGL', name: 'Alphabet Inc Class A', exchange: 'NASDAQ', micCode: 'XNGS', currency: 'USD', type: InstrumentType.Stock, providerSymbol: 'GOOGL', logoDomain: 'abc.xyz' },
  { symbol: 'TSLA', name: 'Tesla, Inc.', exchange: 'NASDAQ', micCode: 'XNGS', currency: 'USD', type: InstrumentType.Stock, providerSymbol: 'TSLA', logoDomain: 'tesla.com' },
]

export interface AddTransactionRequest {
  symbol: string
  exchange: string
  micCode: string
  providerSymbol: string
  name: string
  logoDomain?: string | null
  currency: string
  type: InstrumentType
  operation: InvestmentOperation
  date: string
  quantity: number
  unitPrice: number
  commission: number
  fxFeePercent: number
}

export interface UpdateTransactionRequest {
  operation: InvestmentOperation
  date: string
  quantity: number
  unitPrice: number
  commission: number
  fxFeePercent: number
}
