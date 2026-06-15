import { describe, it, expect } from 'vitest'
import {
  RecurringFrequency,
  recurringOccurrencesPerYear,
  recurringPaymentMonths,
  recurringAmountForMonth,
  recurringFrequencyDescription
} from './recurringTransaction'

// Espelho dos testes de RecurringTransaction.AmountForMonth no backend
// (Api---Finora/tests/Finora.Domain.Tests/RecurringTransactionTests.cs).
// Manter ambos em sincronia ao mexer na regra de cálculo.

describe('recurringOccurrencesPerYear', () => {
  it.each([
    [RecurringFrequency.Monthly, 12],
    [RecurringFrequency.Quarterly, 4],
    [RecurringFrequency.SemiAnnual, 2],
    [RecurringFrequency.Annual, 1]
  ])('frequência %i → %i ocorrências', (freq, expected) => {
    expect(recurringOccurrencesPerYear(freq)).toBe(expected)
  })
})

describe('recurringAmountForMonth', () => {
  it('mensal: montante inteiro todos os meses', () => {
    const r = { frequency: RecurringFrequency.Monthly, amount: 50 }
    for (let m = 1; m <= 12; m++) expect(recurringAmountForMonth(r, m)).toBe(50)
  })

  it.each([
    [RecurringFrequency.Annual, 1200, 100],
    [RecurringFrequency.Quarterly, 300, 100],
    [RecurringFrequency.SemiAnnual, 600, 100]
  ])('diluído (annualMonth null): %i spread uniforme', (frequency, amount, perMonth) => {
    const r = { frequency, amount, annualMonth: null }
    for (let m = 1; m <= 12; m++) expect(recurringAmountForMonth(r, m)).toBe(perMonth)
  })

  it('diluído arredonda a 2 casas decimais (100 anual → 8,33)', () => {
    const r = { frequency: RecurringFrequency.Annual, amount: 100, annualMonth: null }
    expect(recurringAmountForMonth(r, 3)).toBe(8.33)
  })

  it('anual real: inteiro só no mês de referência', () => {
    const r = { frequency: RecurringFrequency.Annual, amount: 1200, annualMonth: 4 }
    expect(recurringAmountForMonth(r, 4)).toBe(1200)
    expect(recurringAmountForMonth(r, 3)).toBe(0)
    expect(recurringAmountForMonth(r, 5)).toBe(0)
  })

  it.each([
    [2, 200], [5, 200], [8, 200], [11, 200],
    [3, 0], [1, 0], [12, 0]
  ])('trimestral real (ref 2): mês %i → %i', (month, expected) => {
    const r = { frequency: RecurringFrequency.Quarterly, amount: 200, annualMonth: 2 }
    expect(recurringAmountForMonth(r, month)).toBe(expected)
  })

  it.each([
    [10, 600], [4, 600], [1, 0], [7, 0]
  ])('semestral real (ref 10, wrap): mês %i → %i', (month, expected) => {
    const r = { frequency: RecurringFrequency.SemiAnnual, amount: 600, annualMonth: 10 }
    expect(recurringAmountForMonth(r, month)).toBe(expected)
  })
})

describe('recurringPaymentMonths', () => {
  it('mensal → todos os 12 meses', () => {
    expect(recurringPaymentMonths(RecurringFrequency.Monthly, 1)).toEqual(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    )
  })

  it('trimestral (ref 2) → [2,5,8,11]', () => {
    expect(recurringPaymentMonths(RecurringFrequency.Quarterly, 2)).toEqual([2, 5, 8, 11])
  })

  it('semestral (ref 10, wrap) → [4,10] ordenado', () => {
    expect(recurringPaymentMonths(RecurringFrequency.SemiAnnual, 10)).toEqual([4, 10])
  })

  it('anual (ref 6) → [6]', () => {
    expect(recurringPaymentMonths(RecurringFrequency.Annual, 6)).toEqual([6])
  })
})

describe('recurringFrequencyDescription', () => {
  it('mensal → "Mensal" (sem mês)', () => {
    expect(recurringFrequencyDescription({ frequency: RecurringFrequency.Monthly })).toBe('Mensal')
  })

  it('diluído (annualMonth null) → só o rótulo', () => {
    expect(
      recurringFrequencyDescription({ frequency: RecurringFrequency.Quarterly, annualMonth: null })
    ).toBe('Trimestral')
  })

  it('real → rótulo + mês curto', () => {
    expect(
      recurringFrequencyDescription({ frequency: RecurringFrequency.Quarterly, annualMonth: 3 })
    ).toBe('Trimestral · Mar')
  })
})
