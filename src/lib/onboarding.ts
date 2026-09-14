import { markTargetSetupComplete } from './nutrition'
import { KEYS } from './storage'

function writeEmptyListIfMissing(key: string): void {
  try {
    if (localStorage.getItem(key) == null) localStorage.setItem(key, '[]')
  } catch (err) {
    console.warn(`could not initialise ${key}`, err)
  }
}

/** Persist intentionally empty personal sections when onboarding finishes. */
export function initializeNewUserTracking(): void {
  writeEmptyListIfMissing(KEYS.MEDICINES)
  writeEmptyListIfMissing(KEYS.SKINCARE)
  markTargetSetupComplete()
}
