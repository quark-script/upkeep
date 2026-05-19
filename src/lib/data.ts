import type { Exercise, ProteinItem, DayType } from './types'

export const EXERCISES: Exercise[] = [
  // PUSH
  { id: 'bench-press',     name: 'Flat Barbell Bench Press',   defaultSets: 4, defaultReps: '8–10',    category: 'compound',  day: ['PUSH'] },
  { id: 'incline-db',      name: 'Incline Dumbbell Press',     defaultSets: 3, defaultReps: '10–12',   category: 'isolation', day: ['PUSH'] },
  { id: 'ohp',             name: 'Overhead Press (Standing)',  defaultSets: 3, defaultReps: '8–10',    category: 'compound',  day: ['PUSH'] },
  { id: 'lateral-raise',   name: 'Lateral Raises',             defaultSets: 3, defaultReps: '12–15',   category: 'isolation', day: ['PUSH'] },
  { id: 'tricep-pushdown', name: 'Tricep Rope Pushdown',       defaultSets: 3, defaultReps: '12–15',   category: 'isolation', day: ['PUSH'] },
  { id: 'dips',            name: 'Dips / Close-Grip Pushups',  defaultSets: 2, defaultReps: '8–12',    category: 'isolation', day: ['PUSH'] },
  // PULL
  { id: 'deadlift',        name: 'Conventional Deadlift',      defaultSets: 4, defaultReps: '6–8',     category: 'compound',  day: ['PULL'] },
  { id: 'tbar-row',        name: 'T-Bar Row',                  defaultSets: 3, defaultReps: '10–12',   category: 'isolation', day: ['PULL'] },
  { id: 'lat-pulldown',    name: 'Lat Pulldown',               defaultSets: 3, defaultReps: '10–12',   category: 'isolation', day: ['PULL'] },
  { id: 'face-pulls',      name: 'Face Pulls',                 defaultSets: 3, defaultReps: '15–20',   category: 'isolation', day: ['PULL'] },
  { id: 'shrugs',          name: 'Shrugs',                     defaultSets: 3, defaultReps: '12–15',   category: 'isolation', day: ['PULL'] },
  { id: 'bicep-curl',      name: 'Barbell Bicep Curl',         defaultSets: 3, defaultReps: '10–12',   category: 'isolation', day: ['PULL'] },
  { id: 'hammer-curl',     name: 'Hammer Curls',               defaultSets: 2, defaultReps: '12',      category: 'isolation', day: ['PULL'] },
  { id: 'neck-curls',      name: 'Neck Curls + Extensions',    defaultSets: 2, defaultReps: '15–20',   category: 'isolation', day: ['PULL'] },
  // LEGS
  { id: 'squat',           name: 'Barbell Squat',              defaultSets: 4, defaultReps: '8–10',    category: 'compound',  day: ['LEGS'] },
  { id: 'leg-press',       name: 'Leg Press',                  defaultSets: 3, defaultReps: '10–12',   category: 'isolation', day: ['LEGS'] },
  { id: 'rdl',             name: 'Romanian Deadlift (RDL)',    defaultSets: 3, defaultReps: '10–12',   category: 'compound',  day: ['LEGS'] },
  { id: 'lunges',          name: 'Lunges',                     defaultSets: 3, defaultReps: '10–12 ea',category: 'isolation', day: ['LEGS'] },
  { id: 'leg-curl',        name: 'Leg Curl Machine',           defaultSets: 3, defaultReps: '12–15',   category: 'isolation', day: ['LEGS'] },
  { id: 'leg-extension',   name: 'Leg Extension',              defaultSets: 3, defaultReps: '12–15',   category: 'isolation', day: ['LEGS'] },
  { id: 'calf-raise',      name: 'Calf Raises (Standing)',     defaultSets: 4, defaultReps: '15–20',   category: 'isolation', day: ['LEGS'] },
  { id: 'plank',           name: 'Plank',                      defaultSets: 3, defaultReps: '30–60s',  category: 'isolation', day: ['LEGS'] },
]

export const PROTEIN_ITEMS: ProteinItem[] = [
  { id: 'eggs',        label: '3 Eggs at breakfast',    time: '7:30 AM' },
  { id: 'whey',        label: 'Whey protein shake',     time: '9:00 AM' },
  { id: 'chana',       label: 'Roasted chana + nuts',   time: '11:00 AM' },
  { id: 'pb-sandwich', label: 'PB sandwich',            time: '5:00 PM' },
  { id: 'milk',        label: 'Warm milk at dinner',    time: '9:30 PM' },
  { id: 'creatine',    label: 'Creatine (3g)',           time: 'anytime' },
]

// Mon=Push, Tue=Pull, Wed=Legs, Thu=Push, Fri=Pull, Sat=Legs, Sun=Rest
export const SPLIT: Record<number, DayType> = {
  0: 'REST',
  1: 'PUSH',
  2: 'PULL',
  3: 'LEGS',
  4: 'PUSH',
  5: 'PULL',
  6: 'LEGS',
}

export const DAY_LABELS: Record<Exclude<DayType, 'REST'>, string> = {
  PUSH: 'Chest · Shoulders · Triceps · 6 lifts',
  PULL: 'Back · Biceps · Traps · 8 lifts',
  LEGS: 'Quads · Hamstrings · Calves · 8 lifts',
}

// Compounds tracked for stall detection
export const COMPOUND_IDS = new Set(['bench-press', 'ohp', 'deadlift', 'squat'])

// Seed measurement from brief
export const BASELINE_MEASUREMENT = {
  date: '2026-03-01',
  weight: 70,
  bodyFat: 18,
  muscleMass: 33,
  bmi: 22.9,
  bmr: 1650,
  measurements: {
    neck: 15, shoulder: 18, chest: 38, biceps: 13, forearm: 11,
    upperAbdomen: 33, lowerAbdomen: 33, waist: 33, hips: 38,
    thigh: 22, calf: 14,
  },
}
