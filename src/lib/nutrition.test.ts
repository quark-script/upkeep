import { beforeEach, describe, expect, it } from 'vitest'
import { clearTargets, setTargets, targets } from './nutrition'
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

describe('nutrition targets', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: new MemoryStorage(),
    })
  })

  it('leaves a new user without calorie or macro targets', () => {
    expect(targets()).toBeNull()
  })

  it('keeps legacy targets visible when migration storage is unavailable', () => {
    localStorage.setItem(KEYS.PROFILE, JSON.stringify({ name: 'Existing user' }))
    localStorage.setItem(KEYS.MEASUREMENTS, JSON.stringify([
      { date: '2026-09-01', weight: 70, bmr: 1_600 },
    ]))

    expect(targets()).toEqual({
      kcal: 2_600, protein: 112, carbs: 376, fat: 72,
    })
  })

  it('returns only targets the user explicitly saved', () => {
    setTargets({
      kcal: 2_100,
      protein: 120,
      carbs: 250,
      fat: 70,
    })

    expect(targets()).toEqual({
      kcal: 2_100, protein: 120, carbs: 250, fat: 70,
    })
  })

  it('clears targets without restoring preset assumptions', () => {
    setTargets({ kcal: 2_100, protein: 120, carbs: 250, fat: 70 })

    clearTargets()

    expect(targets()).toBeNull()
    expect(JSON.parse(localStorage.getItem(KEYS.TARGET_SETUP)!)).toBe(1)
  })
})
