import type { Exercise, DayType, WorkoutType, MuscleGroup } from './types'

export const EXERCISES: Exercise[] = [
  // ── PUSH ───────────────────────────────────────────────────────────────────
  { id: 'bench-press',     name: 'Flat Barbell Bench Press',    defaultSets: 4, defaultReps: '8–10',     category: 'compound',  day: ['PUSH'], groups: ['chest'], equipment: 'barbell', aliases: ['bench press', 'flat bench', 'barbell bench'] },
  { id: 'incline-bb',      name: 'Incline Barbell Bench Press', defaultSets: 3, defaultReps: '8–10',     category: 'compound',  day: ['PUSH'], optional: true, groups: ['chest'], equipment: 'barbell', aliases: ['incline bench', 'incline barbell press'] },
  { id: 'incline-db',      name: 'Incline Dumbbell Press',      defaultSets: 3, defaultReps: '10–12',    category: 'isolation', day: ['PUSH'], groups: ['chest'], equipment: 'dumbbell', aliases: ['incline db press', 'incline dumbell press'] },
  { id: 'decline-bb',      name: 'Decline Barbell Press',       defaultSets: 3, defaultReps: '8–10',     category: 'compound',  day: ['PUSH'], optional: true, groups: ['chest'], equipment: 'barbell', aliases: ['decline bench press', 'decline press', 'decline bench'] },
  { id: 'ohp',             name: 'Overhead Press (Standing)',   defaultSets: 3, defaultReps: '8–10',     category: 'compound',  day: ['PUSH'], groups: ['shoulders'], equipment: 'barbell', aliases: ['overhead press', 'military press', 'standing press', 'shoulder press barbell'] },
  { id: 'lateral-raise',   name: 'Lateral Raises',              defaultSets: 3, defaultReps: '12–15',    category: 'isolation', day: ['PUSH'], groups: ['shoulders'], equipment: 'dumbbell', aliases: ['side raise', 'side lateral raise', 'db lateral raise'] },
  { id: 'tricep-pushdown', name: 'Tricep Rope Pushdown',        defaultSets: 3, defaultReps: '12–15',    category: 'isolation', day: ['PUSH'], groups: ['arms'], equipment: 'cable', aliases: ['tricep pushdown', 'rope pushdown', 'cable pushdown', 'triceps pushdown'] },
  { id: 'dips',            name: 'Dips',                        defaultSets: 2, defaultReps: '8–12',     category: 'isolation', day: ['PUSH'], unit: 'bodyweight', groups: ['chest'], equipment: 'bodyweight', aliases: ['parallel bar dips', 'chest dips', 'tricep dips'] },
  { id: 'pushups',         name: 'Push-Ups',                    defaultSets: 2, defaultReps: '12–20',    category: 'isolation', day: ['PUSH'], optional: true, unit: 'bodyweight', groups: ['chest'], equipment: 'bodyweight', aliases: ['push ups', 'pushup', 'press ups'] },
  // PUSH: added from lifts the logs prove were being typed by hand
  { id: 'machine-shoulder-press', name: 'Machine Shoulder Press', defaultSets: 3, defaultReps: '10–12', category: 'isolation', day: ['PUSH'], optional: true, groups: ['shoulders'], equipment: 'machine', aliases: ['shoulder press machine', 'shoulder machine press', 'seated shoulder press machine', 'machine press shoulder'] },
  { id: 'db-bench-press',  name: 'Flat Dumbbell Press',         defaultSets: 3, defaultReps: '10–12',    category: 'compound',  day: ['PUSH'], optional: true, groups: ['chest'], equipment: 'dumbbell', aliases: ['dumbbell bench press', 'flat db press', 'db bench press', 'flat dumbell press'] },
  { id: 'machine-chest-press', name: 'Chest Press Machine',     defaultSets: 3, defaultReps: '10–12',    category: 'isolation', day: ['PUSH'], optional: true, groups: ['chest'], equipment: 'machine', aliases: ['chest press vertical', 'vertical chest press', 'seated chest press', 'machine chest press'] },
  { id: 'pec-deck',        name: 'Pec Deck / Chest Fly Machine',defaultSets: 3, defaultReps: '12–15',    category: 'isolation', day: ['PUSH'], optional: true, groups: ['chest'], equipment: 'machine', aliases: ['ply fly chest machine', 'pec fly', 'chest fly machine', 'butterfly', 'peck deck'] },
  // PUSH: neighbours
  { id: 'cable-fly',       name: 'Cable Fly',                   defaultSets: 3, defaultReps: '12–15',    category: 'isolation', day: ['PUSH'], optional: true, groups: ['chest'], equipment: 'cable', aliases: ['cable crossover', 'cable chest fly'] },
  { id: 'incline-db-fly',  name: 'Incline Dumbbell Fly',        defaultSets: 3, defaultReps: '12–15',    category: 'isolation', day: ['PUSH'], optional: true, groups: ['chest'], equipment: 'dumbbell', aliases: ['incline fly', 'db fly'] },
  { id: 'arnold-press',    name: 'Arnold Press',                defaultSets: 3, defaultReps: '10–12',    category: 'isolation', day: ['PUSH'], optional: true, groups: ['shoulders'], equipment: 'dumbbell', aliases: ['arnolds'] },
  { id: 'cable-lateral',   name: 'Cable Lateral Raise',         defaultSets: 3, defaultReps: '12–15',    category: 'isolation', day: ['PUSH'], optional: true, groups: ['shoulders'], equipment: 'cable', aliases: ['cable side raise'] },
  { id: 'rear-delt-fly',   name: 'Rear Delt Fly',               defaultSets: 3, defaultReps: '12–15',    category: 'isolation', day: ['PUSH'], optional: true, groups: ['shoulders'], equipment: 'dumbbell', aliases: ['reverse fly', 'rear delt raise', 'reverse pec deck'] },
  { id: 'skull-crusher',   name: 'Skull Crusher',               defaultSets: 3, defaultReps: '10–12',    category: 'isolation', day: ['PUSH'], optional: true, groups: ['arms'], equipment: 'barbell', aliases: ['lying tricep extension', 'ez bar skull crusher'] },
  { id: 'overhead-tricep', name: 'Overhead Tricep Extension',   defaultSets: 3, defaultReps: '10–12',    category: 'isolation', day: ['PUSH'], optional: true, groups: ['arms'], equipment: 'cable', aliases: ['french press', 'overhead extension', 'tricep extension'] },
  { id: 'close-grip-bench',name: 'Close-Grip Bench Press',      defaultSets: 3, defaultReps: '8–10',     category: 'compound',  day: ['PUSH'], optional: true, groups: ['arms'], equipment: 'barbell', aliases: ['close grip bench', 'cgbp'] },
  { id: 'machine-dip',     name: 'Machine Tricep Dip',          defaultSets: 3, defaultReps: '10–12',    category: 'isolation', day: ['PUSH'], optional: true, groups: ['arms'], equipment: 'machine', aliases: ['assisted dip', 'dip machine'] },

  // ── PULL ───────────────────────────────────────────────────────────────────
  { id: 'deadlift',        name: 'Conventional Deadlift',       defaultSets: 4, defaultReps: '6–8',      category: 'compound',  day: ['PULL'], groups: ['back'], equipment: 'barbell', aliases: ['deadlift', 'conventional dl'] },
  { id: 'tbar-row',        name: 'T-Bar Row',                   defaultSets: 3, defaultReps: '10–12',    category: 'isolation', day: ['PULL'], groups: ['back'], equipment: 'barbell', aliases: ['t bar row', 'tbar'] },
  { id: 'lat-pulldown',    name: 'Lat Pulldown',                defaultSets: 3, defaultReps: '10–12',    category: 'isolation', day: ['PULL'], groups: ['back'], equipment: 'cable', aliases: ['pulldown', 'lat pull down', 'wide grip pulldown'] },
  { id: 'assisted-pullup', name: 'Assisted Pull-Ups',           defaultSets: 3, defaultReps: '8–12',     category: 'compound',  day: ['PULL'], groups: ['back'], equipment: 'machine', aliases: ['assisted pull ups', 'machine pull up'] },
  { id: 'pullup',          name: 'Pull-Ups',                    defaultSets: 3, defaultReps: '6–10',     category: 'compound',  day: ['PULL'], optional: true, unit: 'bodyweight', groups: ['back'], equipment: 'bodyweight', aliases: ['pull ups', 'pullup'] },
  { id: 'face-pulls',      name: 'Face Pulls',                  defaultSets: 3, defaultReps: '15–20',    category: 'isolation', day: ['PULL'], groups: ['shoulders'], equipment: 'cable', aliases: ['face pull', 'rope face pull'] },
  { id: 'shrugs',          name: 'Shrugs',                      defaultSets: 3, defaultReps: '12–15',    category: 'isolation', day: ['PULL'], groups: ['back'], equipment: 'dumbbell', aliases: ['shrug', 'trap shrugs', 'barbell shrugs'] },
  { id: 'bicep-curl',      name: 'Barbell Bicep Curl',          defaultSets: 3, defaultReps: '10–12',    category: 'isolation', day: ['PULL'], groups: ['arms'], equipment: 'barbell', aliases: ['bicep curl', 'barbell curl', 'biceps curl'] },
  { id: 'hammer-curl',     name: 'Hammer Curls',                defaultSets: 2, defaultReps: '12',       category: 'isolation', day: ['PULL'], groups: ['arms'], equipment: 'dumbbell', aliases: ['hammer curl', 'neutral grip curl'] },
  { id: 'neck-curls',      name: 'Neck Curls + Extensions',     defaultSets: 2, defaultReps: '15–20',    category: 'isolation', day: ['PULL'], groups: ['core'], equipment: 'other', aliases: ['neck curl', 'neck extension'] },
  // PULL: added from lifts the logs prove were being typed by hand
  { id: 'preacher-curl',   name: 'Preacher Curl',               defaultSets: 3, defaultReps: '10–12',    category: 'isolation', day: ['PULL'], optional: true, groups: ['arms'], equipment: 'barbell', aliases: ['preacher curls', 'ez bar preacher curl', 'scott curl'] },
  { id: 'hyperextension',  name: 'Back Extension (Hyperextension)', defaultSets: 3, defaultReps: '12–15', category: 'isolation', day: ['PULL'], optional: true, unit: 'bodyweight', groups: ['back'], equipment: 'bodyweight', aliases: ['hyper extension', 'hyperextensions', 'back extension', '45 degree extension', 'roman chair'] },
  { id: 'upright-row',     name: 'Upright Row',                 defaultSets: 3, defaultReps: '12–15',    category: 'isolation', day: ['PULL'], optional: true, groups: ['shoulders'], equipment: 'barbell', aliases: ['upright rows', 'upright barbell row'] },
  { id: 'seated-cable-row',name: 'Seated Cable Row',            defaultSets: 3, defaultReps: '10–12',    category: 'isolation', day: ['PULL'], optional: true, groups: ['back'], equipment: 'cable', aliases: ['seated row', 'cable row', 'low row'] },
  // PULL: neighbours
  { id: 'chest-supported-row', name: 'Chest-Supported Row',     defaultSets: 3, defaultReps: '10–12',    category: 'isolation', day: ['PULL'], optional: true, groups: ['back'], equipment: 'machine', aliases: ['chest supported row', 'seal row'] },
  { id: 'db-row',          name: 'Single-Arm Dumbbell Row',     defaultSets: 3, defaultReps: '10–12',    category: 'isolation', day: ['PULL'], optional: true, groups: ['back'], equipment: 'dumbbell', aliases: ['one arm row', 'db row', 'dumbbell row'] },
  { id: 'barbell-row',     name: 'Barbell Row',                 defaultSets: 3, defaultReps: '8–10',     category: 'compound',  day: ['PULL'], optional: true, groups: ['back'], equipment: 'barbell', aliases: ['bent over row', 'bb row', 'pendlay row'] },
  { id: 'straight-arm-pulldown', name: 'Straight-Arm Pulldown', defaultSets: 3, defaultReps: '12–15',    category: 'isolation', day: ['PULL'], optional: true, groups: ['back'], equipment: 'cable', aliases: ['straight arm pulldown', 'lat pushdown'] },
  { id: 'cable-curl',      name: 'Cable Curl',                  defaultSets: 3, defaultReps: '12–15',    category: 'isolation', day: ['PULL'], optional: true, groups: ['arms'], equipment: 'cable', aliases: ['rope curl', 'cable bicep curl'] },
  { id: 'concentration-curl', name: 'Concentration Curl',       defaultSets: 3, defaultReps: '12–15',    category: 'isolation', day: ['PULL'], optional: true, groups: ['arms'], equipment: 'dumbbell', aliases: ['concentration curls'] },
  { id: 'reverse-curl',    name: 'Reverse Curl',                defaultSets: 3, defaultReps: '12–15',    category: 'isolation', day: ['PULL'], optional: true, groups: ['arms'], equipment: 'barbell', aliases: ['reverse grip curl'] },
  { id: 'wrist-curl',      name: 'Wrist Curl',                  defaultSets: 3, defaultReps: '15–20',    category: 'isolation', day: ['PULL'], optional: true, groups: ['arms'], equipment: 'dumbbell', aliases: ['forearm curl', 'wrist curls'] },
  { id: 'chin-up',         name: 'Chin-Ups',                    defaultSets: 3, defaultReps: '6–10',     category: 'compound',  day: ['PULL'], optional: true, unit: 'bodyweight', groups: ['arms'], equipment: 'bodyweight', aliases: ['chin ups', 'underhand pull up'] },
  { id: 'rack-pull',       name: 'Rack Pull',                   defaultSets: 3, defaultReps: '6–8',      category: 'compound',  day: ['PULL'], optional: true, groups: ['back'], equipment: 'barbell', aliases: ['rack pulls', 'partial deadlift'] },

  // ── LEGS ───────────────────────────────────────────────────────────────────
  { id: 'squat',           name: 'Barbell Squat',               defaultSets: 4, defaultReps: '8–10',     category: 'compound',  day: ['LEGS'], groups: ['legs'], equipment: 'barbell', aliases: ['squat', 'back squat', 'barbell back squat'] },
  { id: 'leg-press',       name: 'Leg Press',                   defaultSets: 3, defaultReps: '10–12',    category: 'isolation', day: ['LEGS'], groups: ['legs'], equipment: 'machine', aliases: ['leg press machine', '45 degree leg press'] },
  { id: 'rdl',             name: 'Romanian Deadlift (RDL)',     defaultSets: 3, defaultReps: '10–12',    category: 'compound',  day: ['LEGS'], groups: ['legs'], equipment: 'barbell', aliases: ['romanian deadlift', 'rdl', 'stiff leg deadlift'] },
  { id: 'lunges',          name: 'Lunges',                      defaultSets: 3, defaultReps: '10–12 ea', category: 'isolation', day: ['LEGS'], groups: ['legs'], equipment: 'dumbbell', aliases: ['lunge', 'static lunges'] },
  { id: 'leg-curl',        name: 'Leg Curl Machine',            defaultSets: 3, defaultReps: '12–15',    category: 'isolation', day: ['LEGS'], groups: ['legs'], equipment: 'machine', aliases: ['hamstring curl', 'lying leg curl', 'seated leg curl'] },
  { id: 'leg-extension',   name: 'Leg Extension',               defaultSets: 3, defaultReps: '12–15',    category: 'isolation', day: ['LEGS'], groups: ['legs'], equipment: 'machine', aliases: ['quad extension', 'leg extensions'] },
  { id: 'calf-raise',      name: 'Calf Raises (Standing)',      defaultSets: 4, defaultReps: '15–20',    category: 'isolation', day: ['LEGS'], groups: ['legs'], equipment: 'machine', aliases: ['calf raise', 'standing calf raise'] },
  { id: 'plank',           name: 'Plank',                       defaultSets: 3, defaultReps: '30–60s',   category: 'isolation', day: ['LEGS'], unit: 'time', groups: ['core'], equipment: 'bodyweight', aliases: ['front plank', 'planks'] },
  // LEGS: added from lifts the logs prove were being typed by hand
  { id: 'walking-lunges',  name: 'Walking Lunges',              defaultSets: 3, defaultReps: '10–12 ea', category: 'isolation', day: ['LEGS'], optional: true, groups: ['legs'], equipment: 'dumbbell', aliases: ['walking lunge', 'db walking lunges'] },
  // LEGS: neighbours
  { id: 'front-squat',     name: 'Front Squat',                 defaultSets: 3, defaultReps: '8–10',     category: 'compound',  day: ['LEGS'], optional: true, groups: ['legs'], equipment: 'barbell', aliases: ['front squats'] },
  { id: 'hack-squat',      name: 'Hack Squat',                  defaultSets: 3, defaultReps: '10–12',    category: 'compound',  day: ['LEGS'], optional: true, groups: ['legs'], equipment: 'machine', aliases: ['hack squat machine'] },
  { id: 'bulgarian-split', name: 'Bulgarian Split Squat',       defaultSets: 3, defaultReps: '10–12 ea', category: 'isolation', day: ['LEGS'], optional: true, groups: ['legs'], equipment: 'dumbbell', aliases: ['split squat', 'rear foot elevated split squat'] },
  { id: 'goblet-squat',    name: 'Goblet Squat',                defaultSets: 3, defaultReps: '10–12',    category: 'isolation', day: ['LEGS'], optional: true, groups: ['legs'], equipment: 'dumbbell', aliases: ['goblet squats'] },
  { id: 'step-up',         name: 'Step-Up',                     defaultSets: 3, defaultReps: '10–12 ea', category: 'isolation', day: ['LEGS'], optional: true, groups: ['legs'], equipment: 'dumbbell', aliases: ['step ups', 'box step up'] },
  { id: 'hip-thrust',      name: 'Hip Thrust',                  defaultSets: 3, defaultReps: '10–12',    category: 'compound',  day: ['LEGS'], optional: true, groups: ['legs'], equipment: 'barbell', aliases: ['barbell hip thrust', 'hip thrusts'] },
  { id: 'glute-bridge',    name: 'Glute Bridge',                defaultSets: 3, defaultReps: '12–15',    category: 'isolation', day: ['LEGS'], optional: true, unit: 'bodyweight', groups: ['legs'], equipment: 'bodyweight', aliases: ['glute bridges'] },
  { id: 'good-morning',    name: 'Good Morning',                defaultSets: 3, defaultReps: '10–12',    category: 'compound',  day: ['LEGS'], optional: true, groups: ['legs'], equipment: 'barbell', aliases: ['good mornings'] },
  { id: 'seated-calf-raise', name: 'Seated Calf Raise',         defaultSets: 4, defaultReps: '15–20',    category: 'isolation', day: ['LEGS'], optional: true, groups: ['legs'], equipment: 'machine', aliases: ['seated calf raises'] },
  { id: 'sumo-deadlift',   name: 'Sumo Deadlift',               defaultSets: 3, defaultReps: '6–8',      category: 'compound',  day: ['LEGS'], optional: true, groups: ['legs'], equipment: 'barbell', aliases: ['sumo dl'] },
  { id: 'adductor-machine',name: 'Adductor Machine',            defaultSets: 3, defaultReps: '12–15',    category: 'isolation', day: ['LEGS'], optional: true, groups: ['legs'], equipment: 'machine', aliases: ['inner thigh machine', 'hip adduction'] },
  { id: 'abductor-machine',name: 'Abductor Machine',            defaultSets: 3, defaultReps: '12–15',    category: 'isolation', day: ['LEGS'], optional: true, groups: ['legs'], equipment: 'machine', aliases: ['outer thigh machine', 'hip abduction'] },

  // ── CORE ───────────────────────────────────────────────────────────────────
  // `day: []` is deliberate: search ranks by day instead of filtering by it, so
  // these stay reachable from every session without cluttering any day's plan.
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise',         defaultSets: 3, defaultReps: '10–15',    category: 'isolation', day: [], optional: true, unit: 'bodyweight', groups: ['core'], equipment: 'bodyweight', aliases: ['leg raise', 'hanging knee raise'] },
  { id: 'cable-crunch',    name: 'Cable Crunch',                defaultSets: 3, defaultReps: '12–15',    category: 'isolation', day: [], optional: true, groups: ['core'], equipment: 'cable', aliases: ['kneeling cable crunch', 'rope crunch'] },
  { id: 'ab-wheel',        name: 'Ab Wheel Rollout',            defaultSets: 3, defaultReps: '8–12',     category: 'isolation', day: [], optional: true, unit: 'bodyweight', groups: ['core'], equipment: 'other', aliases: ['ab roller', 'rollout'] },
  { id: 'russian-twist',   name: 'Russian Twist',               defaultSets: 3, defaultReps: '15–20 ea', category: 'isolation', day: [], optional: true, groups: ['core'], equipment: 'other', aliases: ['russian twists', 'seated twist'] },
  { id: 'side-plank',      name: 'Side Plank',                  defaultSets: 2, defaultReps: '30–45s',   category: 'isolation', day: [], optional: true, unit: 'time', groups: ['core'], equipment: 'bodyweight', aliases: ['side planks'] },
  { id: 'dead-bug',        name: 'Dead Bug',                    defaultSets: 3, defaultReps: '10–12 ea', category: 'isolation', day: [], optional: true, unit: 'bodyweight', groups: ['core'], equipment: 'bodyweight', aliases: ['dead bugs'] },
  { id: 'farmers-walk',    name: "Farmer's Walk",               defaultSets: 3, defaultReps: '30–60s',   category: 'compound',  day: [], optional: true, unit: 'time', groups: ['core'], equipment: 'dumbbell', aliases: ['farmers carry', 'loaded carry'] },
]

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders',
  arms: 'Arms', legs: 'Legs', core: 'Core',
}

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
