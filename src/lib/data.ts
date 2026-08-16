import type { Exercise, ProteinItem, DayType, WorkoutType, MuscleGroup } from './types'

export const EXERCISES: Exercise[] = [
  // PUSH
  { id: 'bench-press',     name: 'Flat Barbell Bench Press',   defaultSets: 4, defaultReps: '8–10',    category: 'compound',  day: ['PUSH'], groups: ['chest'] },
  { id: 'incline-bb',      name: 'Incline Barbell Bench Press', defaultSets: 3, defaultReps: '8–10',   category: 'compound',  day: ['PUSH'], optional: true, groups: ['chest'] },
  { id: 'incline-db',      name: 'Incline Dumbbell Press',     defaultSets: 3, defaultReps: '10–12',   category: 'isolation', day: ['PUSH'], groups: ['chest'] },
  { id: 'decline-bb',      name: 'Decline Barbell Press',      defaultSets: 3, defaultReps: '8–10',    category: 'compound',  day: ['PUSH'], optional: true, groups: ['chest'] },
  { id: 'ohp',             name: 'Overhead Press (Standing)',  defaultSets: 3, defaultReps: '8–10',    category: 'compound',  day: ['PUSH'], groups: ['shoulders'] },
  { id: 'lateral-raise',   name: 'Lateral Raises',             defaultSets: 3, defaultReps: '12–15',   category: 'isolation', day: ['PUSH'], groups: ['shoulders'] },
  { id: 'tricep-pushdown', name: 'Tricep Rope Pushdown',       defaultSets: 3, defaultReps: '12–15',   category: 'isolation', day: ['PUSH'], groups: ['arms'] },
  { id: 'dips',            name: 'Dips',                       defaultSets: 2, defaultReps: '8–12',    category: 'isolation', day: ['PUSH'], unit: 'bodyweight', groups: ['chest'] },
  { id: 'pushups',         name: 'Push-Ups',                   defaultSets: 2, defaultReps: '12–20',   category: 'isolation', day: ['PUSH'], optional: true, unit: 'bodyweight', groups: ['chest'] },
  // PULL
  { id: 'deadlift',        name: 'Conventional Deadlift',      defaultSets: 4, defaultReps: '6–8',     category: 'compound',  day: ['PULL'], groups: ['back'] },
  { id: 'tbar-row',        name: 'T-Bar Row',                  defaultSets: 3, defaultReps: '10–12',   category: 'isolation', day: ['PULL'], groups: ['back'] },
  { id: 'lat-pulldown',    name: 'Lat Pulldown',               defaultSets: 3, defaultReps: '10–12',   category: 'isolation', day: ['PULL'], groups: ['back'] },
  { id: 'assisted-pullup', name: 'Assisted Pull-Ups',          defaultSets: 3, defaultReps: '8–12',    category: 'compound',  day: ['PULL'], groups: ['back'] },
  { id: 'pullup',          name: 'Pull-Ups',                   defaultSets: 3, defaultReps: '6–10',    category: 'compound',  day: ['PULL'], optional: true, unit: 'bodyweight', groups: ['back'] },
  { id: 'face-pulls',      name: 'Face Pulls',                 defaultSets: 3, defaultReps: '15–20',   category: 'isolation', day: ['PULL'], groups: ['shoulders'] },
  { id: 'shrugs',          name: 'Shrugs',                     defaultSets: 3, defaultReps: '12–15',   category: 'isolation', day: ['PULL'], groups: ['back'] },
  { id: 'bicep-curl',      name: 'Barbell Bicep Curl',         defaultSets: 3, defaultReps: '10–12',   category: 'isolation', day: ['PULL'], groups: ['arms'] },
  { id: 'hammer-curl',     name: 'Hammer Curls',               defaultSets: 2, defaultReps: '12',      category: 'isolation', day: ['PULL'], groups: ['arms'] },
  { id: 'neck-curls',      name: 'Neck Curls + Extensions',    defaultSets: 2, defaultReps: '15–20',   category: 'isolation', day: ['PULL'], groups: ['core'] },
  // LEGS
  { id: 'squat',           name: 'Barbell Squat',              defaultSets: 4, defaultReps: '8–10',    category: 'compound',  day: ['LEGS'], groups: ['legs'] },
  { id: 'leg-press',       name: 'Leg Press',                  defaultSets: 3, defaultReps: '10–12',   category: 'isolation', day: ['LEGS'], groups: ['legs'] },
  { id: 'rdl',             name: 'Romanian Deadlift (RDL)',    defaultSets: 3, defaultReps: '10–12',   category: 'compound',  day: ['LEGS'], groups: ['legs'] },
  { id: 'lunges',          name: 'Lunges',                     defaultSets: 3, defaultReps: '10–12 ea',category: 'isolation', day: ['LEGS'], groups: ['legs'] },
  { id: 'leg-curl',        name: 'Leg Curl Machine',           defaultSets: 3, defaultReps: '12–15',   category: 'isolation', day: ['LEGS'], groups: ['legs'] },
  { id: 'leg-extension',   name: 'Leg Extension',              defaultSets: 3, defaultReps: '12–15',   category: 'isolation', day: ['LEGS'], groups: ['legs'] },
  { id: 'calf-raise',      name: 'Calf Raises (Standing)',     defaultSets: 4, defaultReps: '15–20',   category: 'isolation', day: ['LEGS'], groups: ['legs'] },
  { id: 'plank',           name: 'Plank',                      defaultSets: 3, defaultReps: '30–60s',  category: 'isolation', day: ['LEGS'], unit: 'time', groups: ['core'] },
]

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders',
  arms: 'Arms', legs: 'Legs', core: 'Core',
}

// Gram figures are estimates for the usual portion — enough to make the daily
// total meaningful without turning logging into a weighing exercise.
export const PROTEIN_ITEMS: ProteinItem[] = [
  { id: 'eggs',        label: '2 Eggs at breakfast',    time: '7:30 AM',  grams: 12 },
  { id: 'whey',        label: 'Whey protein shake',     time: '9:00 AM',  grams: 24 },
  { id: 'chana',       label: 'Roasted chana + nuts',   time: '11:00 AM', grams: 12 },
  { id: 'pb-sandwich', label: 'PB sandwich',            time: '5:00 PM',  grams: 12 },
  { id: 'milk',        label: 'Warm milk at dinner',    time: '9:30 PM',  grams: 8 },
  { id: 'creatine',    label: 'Creatine (3g)',          time: 'anytime',  grams: 0 },
]

// Common Indian-diet additions, offered as one-tap adds when logging extras.
export const PROTEIN_QUICK_ADDS: { label: string; grams: number }[] = [
  { label: 'Dal (1 bowl)',        grams: 9 },
  { label: 'Curd (1 bowl)',       grams: 8 },
  { label: 'Paneer (100g)',       grams: 18 },
  { label: 'Chicken (100g)',      grams: 27 },
  { label: 'Rajma / chole bowl',  grams: 12 },
  { label: 'Soya chunks (50g)',   grams: 26 },
  { label: 'Roti ×2',             grams: 6 },
  { label: 'Rice (1 cup)',        grams: 4 },
  { label: 'Peanuts (30g)',       grams: 8 },
  { label: 'Whey scoop',          grams: 24 },
]

// Grams of protein per kg of body weight to aim for while building muscle.
export const PROTEIN_G_PER_KG = 1.6
export const PROTEIN_TARGET_FALLBACK = 110

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

const DAY_MUSCLES: Record<WorkoutType, string> = {
  PUSH: 'Chest · Shoulders · Triceps',
  PULL: 'Back · Biceps · Traps',
  LEGS: 'Quads · Hamstrings · Calves',
}

// Lift count is derived, so editing EXERCISES can't leave the label lying.
export const DAY_LABELS = Object.fromEntries(
  (Object.keys(DAY_MUSCLES) as WorkoutType[]).map(t => {
    const n = EXERCISES.filter(e => e.day.includes(t) && !e.optional).length
    return [t, `${DAY_MUSCLES[t]} · ${n} lifts`]
  }),
) as Record<Exclude<DayType, 'REST'>, string>

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
