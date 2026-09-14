import { beforeEach, describe, expect, it } from 'vitest'
import { initializeNewUserTracking } from './onboarding'
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

describe('new-user tracking setup', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: new MemoryStorage(),
    })
  })

  it('starts medicines, skincare, and nutrition targets empty', () => {
    initializeNewUserTracking()

    expect(JSON.parse(localStorage.getItem(KEYS.MEDICINES)!)).toEqual([])
    expect(JSON.parse(localStorage.getItem(KEYS.SKINCARE)!)).toEqual([])
    expect(targets()).toBeNull()
    expect(JSON.parse(localStorage.getItem(KEYS.TARGET_SETUP)!)).toBe(1)
  })

  it('does not replace routines already stored on the device', () => {
    const medicines = [{ id: 'my-medicine' }]
    const skincare = [{ id: 'my-skincare' }]
    localStorage.setItem(KEYS.MEDICINES, JSON.stringify(medicines))
    localStorage.setItem(KEYS.SKINCARE, JSON.stringify(skincare))

    initializeNewUserTracking()

    expect(JSON.parse(localStorage.getItem(KEYS.MEDICINES)!)).toEqual(medicines)
    expect(JSON.parse(localStorage.getItem(KEYS.SKINCARE)!)).toEqual(skincare)
  })
})
