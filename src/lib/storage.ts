export const KEYS = {
  PROFILE: 'gainz:profile',
  SESSIONS: 'gainz:sessions',
  EXERCISES: 'gainz:exercises',
  SETTINGS: 'gainz:settings',
  MEASUREMENTS: 'gainz:measurements',
  PROTEIN_CUSTOM: 'gainz:protein:custom',
  proteinDay: (date: string) => `gainz:protein:${date}`,
  sleepDay:   (date: string) => `gainz:sleep:${date}`,
  dayOverride:(date: string) => `gainz:day-override:${date}`,
} as const
