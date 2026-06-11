import { describe, it, expect } from 'vitest'
import { userFromProfileResponse } from './auth'

describe('userFromProfileResponse', () => {
  it('aceita camelCase', () => {
    const u = userFromProfileResponse({
      id: 'abc', email: 'a@b.com', firstName: 'Ana', lastName: 'Silva', gender: 1
    })
    expect(u).toMatchObject({ id: 'abc', email: 'a@b.com', firstName: 'Ana', lastName: 'Silva', gender: 1 })
  })

  it('aceita PascalCase (resposta do .NET)', () => {
    const u = userFromProfileResponse({
      Id: 'abc', Email: 'a@b.com', FirstName: 'Ana', LastName: 'Silva', Gender: 'Male'
    })
    expect(u.id).toBe('abc')
    expect(u.email).toBe('a@b.com')
    expect(u.firstName).toBe('Ana')
    expect(u.gender).toBe(0) // 'Male' → 0
  })

  it('mapeia gender string e numérico para enum', () => {
    expect(userFromProfileResponse({ gender: 'Male' }).gender).toBe(0)
    expect(userFromProfileResponse({ gender: 'Female' }).gender).toBe(1)
    expect(userFromProfileResponse({ gender: 0 }).gender).toBe(0)
    expect(userFromProfileResponse({ gender: 1 }).gender).toBe(1)
  })

  it('gender ausente/ inválido → undefined', () => {
    expect(userFromProfileResponse({}).gender).toBeUndefined()
    expect(userFromProfileResponse({ gender: 'X' }).gender).toBeUndefined()
  })

  it('householdId vazio ou ausente → undefined', () => {
    expect(userFromProfileResponse({ householdId: '' }).householdId).toBeUndefined()
    expect(userFromProfileResponse({}).householdId).toBeUndefined()
    expect(userFromProfileResponse({ householdId: 'hh-1' }).householdId).toBe('hh-1')
  })

  it('timeZoneId vazio → null; presente → string', () => {
    expect(userFromProfileResponse({ timeZoneId: '' }).timeZoneId).toBeNull()
    expect(userFromProfileResponse({}).timeZoneId).toBeNull()
    expect(userFromProfileResponse({ timeZoneId: 'Europe/Lisbon' }).timeZoneId).toBe('Europe/Lisbon')
  })

  it('isCoupleGuest só é true quando estritamente true', () => {
    expect(userFromProfileResponse({ isCoupleGuest: true }).isCoupleGuest).toBe(true)
    expect(userFromProfileResponse({ isCoupleGuest: 'true' }).isCoupleGuest).toBe(false)
    expect(userFromProfileResponse({}).isCoupleGuest).toBe(false)
  })

  it('coupleJoinDataMigrated: null quando ausente, senão booleano', () => {
    expect(userFromProfileResponse({}).coupleJoinDataMigrated).toBeNull()
    expect(userFromProfileResponse({ coupleJoinDataMigrated: null }).coupleJoinDataMigrated).toBeNull()
    expect(userFromProfileResponse({ coupleJoinDataMigrated: true }).coupleJoinDataMigrated).toBe(true)
    expect(userFromProfileResponse({ coupleJoinDataMigrated: false }).coupleJoinDataMigrated).toBe(false)
  })

  it('input null/undefined não rebenta (campos a default)', () => {
    const u = userFromProfileResponse(null)
    expect(u.id).toBe('')
    expect(u.email).toBe('')
    expect(u.firstName).toBe('')
  })
})
