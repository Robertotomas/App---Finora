import { describe, it, expect } from 'vitest'
import {
  normalize,
  findBrand,
  searchBrands,
  accountBanks,
  flagEmoji
} from './brandLogos'

describe('normalize', () => {
  it('passa a minúsculas e remove acentos', () => {
    expect(normalize('Crédito Agrícola')).toBe('credito agricola')
    expect(normalize('SANTANDER')).toBe('santander')
  })

  it('colapsa espaços e faz trim', () => {
    expect(normalize('  Pingo   Doce  ')).toBe('pingo doce')
  })

  it('tolera null/undefined', () => {
    // @ts-expect-error teste defensivo de runtime
    expect(normalize(null)).toBe('')
    // @ts-expect-error teste defensivo de runtime
    expect(normalize(undefined)).toBe('')
  })
})

describe('findBrand', () => {
  it('match exato pelo nome (sem acento)', () => {
    expect(findBrand('Santander')?.domain).toBe('santander.pt')
    expect(findBrand('credito agricola')?.domain).toBe('creditoagricola.pt')
  })

  it('match por alias', () => {
    expect(findBrand('cgd')?.domain).toBe('cgd.pt')
    expect(findBrand('bcp')?.domain).toBe('millenniumbcp.pt')
  })

  it('match por palavra inteira dentro de texto livre', () => {
    // "Conta do Continente" → resolve Continente por limite de palavra.
    expect(findBrand('Conta do Continente')?.domain).toBe('continente.pt')
  })

  it('não faz match parcial dentro de outra palavra (evita falsos positivos)', () => {
    // "lidl" embebido sem limite de palavra não deve resolver.
    expect(findBrand('consolidlado')).toBeNull()
  })

  it('devolve null para vazio ou desconhecido', () => {
    expect(findBrand('')).toBeNull()
    expect(findBrand(null)).toBeNull()
    expect(findBrand('marca inexistente xyz')).toBeNull()
  })
})

describe('searchBrands', () => {
  it('ordena match exato/prefixo antes de substring', () => {
    const res = searchBrands('santander')
    expect(res.length).toBeGreaterThan(0)
    expect(res[0].name.toLowerCase()).toContain('santander')
  })

  it('filtra por scope (só bancos)', () => {
    const res = searchBrands('santander', 'bank')
    expect(res.every((b) => b.type === 'bank')).toBe(true)
  })

  it('query vazia em scope "all" mostra lojas primeiro', () => {
    const res = searchBrands('', 'all')
    expect(res[0].type).toBe('store')
  })

  it('sem resultados devolve lista vazia', () => {
    expect(searchBrands('zzz-marca-inexistente')).toEqual([])
  })
})

describe('accountBanks', () => {
  it('devolve bancos do país + fintechs globais', () => {
    const pt = accountBanks('pt')
    expect(pt.every((b) => b.type === 'bank')).toBe(true)
    expect(pt.some((b) => b.domain === 'cgd.pt')).toBe(true)       // banco PT
    expect(pt.some((b) => b.country === 'global')).toBe(true)      // fintech global (ex.: Revolut)
  })

  it('ordena populares primeiro', () => {
    const pt = accountBanks('pt')
    const firstNonPopular = pt.findIndex((b) => !b.popular)
    const lastPopular = pt.map((b) => !!b.popular).lastIndexOf(true)
    expect(lastPopular).toBeLessThan(firstNonPopular)
  })

  it('filtra por query', () => {
    const res = accountBanks('pt', 'caixa')
    expect(res.some((b) => b.domain === 'cgd.pt')).toBe(true)
    expect(res.every((b) => /caix/i.test(b.name) || (b.aliases ?? []).some((a) => /caix/i.test(a)))).toBe(true)
  })

  it('não inclui bancos de outro país', () => {
    const pt = accountBanks('pt')
    expect(pt.some((b) => b.country === 'es')).toBe(false)
  })
})

describe('flagEmoji', () => {
  it('converte código ISO em emoji de bandeira', () => {
    expect(flagEmoji('pt')).toBe('🇵🇹')
    expect(flagEmoji('GB')).toBe('🇬🇧')
  })
})
