import { beforeEach, describe, expect, it } from 'vitest'
import { migrateLegacyTargets } from './migrations'
import { targets } from './nutrition'
import { KEYS } from './storage'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()

  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

describe('legacy calorie target migration', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: new MemoryStorage(),
    })
  })

  it('preserves the calculated targets of an existing profile', () => {
    localStorage.setItem(KEYS.PROFILE, JSON.stringify({ name: 'Existing user' }))
    localStorage.setItem(KEYS.MEASUREMENTS, JSON.stringify([{
      date: '2026-09-01',
      weight: 70,
      bmr: 1_600,
      bodyFat: 0,
      muscleMass: 0,
      bmi: 0,
      measurements: {},
    }]))

    migrateLegacyTargets()

    expect(targets()).toEqual({
      kcal: 2_600,
      protein: 112,
      carbs: 376,
      fat: 72,
    })
    expect(JSON.parse(localStorage.getItem(KEYS.TARGET_SETUP)!)).toBe(1)
  })

  it('keeps old overrides while materialising their derived values', () => {
    localStorage.setItem(KEYS.PROFILE, JSON.stringify({ name: 'Existing user' }))
    localStorage.setItem(KEYS.TARGETS, JSON.stringify({
      kcal: 2_400,
      protein: 140,
      activityFactor: 1.7,
      goalDelta: -100,
    }))

    migrateLegacyTargets()

    expect(targets()).toEqual({
      kcal: 2_400,
      protein: 140,
      carbs: 309,
      fat: 67,
    })
  })


  it('preserves a legacy target whose derived carbs are zero', () => {
    localStorage.setItem(KEYS.PROFILE, JSON.stringify({ name: 'Existing user' }))
    localStorage.setItem(KEYS.TARGETS, JSON.stringify({
      kcal: 1_000,
      protein: 200,
      fat: 100,
    }))

    migrateLegacyTargets()

    expect(targets()).toEqual({
      kcal: 1_000,
      protein: 200,
      carbs: 0,
      fat: 100,
    })
  })
  it('does not give a brand-new install legacy target assumptions', () => {
    migrateLegacyTargets()

    expect(targets()).toBeNull()
    expect(localStorage.getItem(KEYS.TARGET_SETUP)).toBeNull()
  })
})
