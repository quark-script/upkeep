import type { Food, Macros } from './types'

/**
 * Per-100 g macros for the foods this app is actually used to log — an Indian
 * home diet plus the usual gym staples.
 *
 * Values are per 100 g **as eaten** (cooked where the serving implies it),
 * rounded to one decimal. Sourced from IFCT 2017 (Indian Food Composition
 * Tables) for Indian dishes and USDA FoodData Central for generic and packaged
 * items, cross-checked against the Atwater identity 4P + 4C + 9F ≈ kcal.
 *
 * Every row is an estimate of a home portion, not a laboratory measurement.
 * That is the right precision for the job: a daily total needs to be roughly
 * right and effortless to log, and a user who wants exactness can correct any
 * food once and have every future entry follow.
 */

/**
 * The word a person would actually type for a food whose display name carries a
 * qualifier: "Egg (whole, boiled)" -> "egg", "Toor Dal (cooked)" -> "toor dal".
 * Derived rather than hand-listed on 39 rows, so it cannot drift from the name.
 *
 * A few of these collide by design — three milks all reduce to "milk". Both the
 * migration (array order) and search (which breaks ties on catalog position)
 * take the first, which is the plain cow's milk listed first; the others surface
 * directly below it.
 */
function plainAlias(name: string): string {
  return name.split(/[(/]/)[0].trim()
}

/** Compact constructor — the table below is the point, not the boilerplate. */
function f(
  id: string,
  name: string,
  [kcal, protein, carbs, fat]: [number, number, number, number],
  servings: [string, number][],
  extra: Partial<Food> = {},
): Food {
  const list = servings.map(([label, grams]) => ({
    id: `${id}:${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    label,
    grams,
  }))
  // Every food can be logged by weight. Only append the fallback when the table
  // did not already name a 100 g portion, or the picker shows it twice.
  const hasHundred = list.some(s => s.grams === 100)
  const all = hasHundred ? list : [...list, { id: `${id}:100-g`, label: '100 g', grams: 100 }]

  const written = extra.aliases ?? []
  const plain = plainAlias(name)
  const aliases = plain.toLowerCase() === name.toLowerCase() || written.some(a => a.toLowerCase() === plain.toLowerCase())
    ? written
    : [...written, plain]

  return {
    id,
    name,
    per100: { kcal, protein, carbs, fat } as Macros,
    servings: all,
    defaultServingId: all[0].id,
    source: 'seed',
    createdAt: 0,
    ...extra,
    aliases: aliases.length > 0 ? aliases : undefined,
  }
}

export const SEED_FOODS: Food[] = [
  // ─── Eggs, dairy, paneer ───────────────────────────────────────────────────
  f('egg',           'Egg (whole, boiled)',    [155, 13, 1.1, 11],   [['1 egg', 50], ['2 eggs', 100]],
                     { aliases: ['anda', 'boiled egg', 'whole egg'] }),
  f('egg-white',     'Egg White',              [52, 11, 0.7, 0.2],   [['1 white', 33], ['3 whites', 99]]),
  f('omelette',      'Omelette (2 eggs)',      [154, 11, 1, 12],     [['1 omelette', 120]]),
  f('milk-cow',      'Milk (cow, whole)',      [61, 3.2, 4.8, 3.3],  [['1 glass', 250], ['1 cup', 200]],
                     { liquid: true, aliases: ['doodh', 'milk'] }),
  f('milk-buffalo',  'Milk (buffalo, whole)',  [97, 3.8, 5.2, 6.9],  [['1 glass', 250]], { liquid: true }),
  f('milk-toned',    'Milk (toned)',           [47, 3.1, 4.7, 1.7],  [['1 glass', 250]], { liquid: true }),
  f('curd',          'Curd / Dahi',            [61, 3.5, 4.7, 3.3],  [['1 bowl', 150], ['1 katori', 100]],
                     { aliases: ['dahi', 'yogurt', 'yoghurt'] }),
  f('greek-yogurt',  'Greek Yogurt',           [59, 10, 3.6, 0.4],   [['1 cup', 170], ['1 katori', 100]]),
  f('paneer',        'Paneer',                 [265, 18, 1.2, 21],   [['100 g', 100], ['1 cube', 25]],
                     { aliases: ['panner', 'cottage cheese', 'panir'] }),
  f('tofu',          'Tofu',                   [76, 8, 1.9, 4.8],    [['100 g', 100]]),
  f('cheese-slice',  'Cheese Slice (processed)', [300, 18, 2, 24],   [['1 slice', 20]]),
  f('butter',        'Butter',                 [717, 0.9, 0.1, 81],  [['1 tsp', 5], ['1 tbsp', 14]]),
  f('buttermilk',    'Buttermilk / Chaas',     [40, 3.3, 4.8, 0.9],  [['1 glass', 250]],
                     { liquid: true, aliases: ['chaas', 'chhach'] }),
  f('lassi',         'Lassi (sweet)',          [110, 3, 18, 3],      [['1 glass', 250]], { liquid: true }),

  // ─── Meat, fish, eggs cooked ───────────────────────────────────────────────
  f('chicken-breast','Chicken Breast (cooked)',[165, 31, 0, 3.6],    [['100 g', 100], ['1 piece', 120]],
                     { aliases: ['chicken', 'grilled chicken'] }),
  f('chicken-curry', 'Chicken Curry',          [180, 15, 5, 11],     [['1 bowl', 200], ['1 katori', 100]]),
  f('chicken-tikka', 'Chicken Tikka',          [195, 25, 4, 9],      [['4 pieces', 120]]),
  f('fish-rohu',     'Fish (rohu, cooked)',    [97, 17, 0, 3],       [['1 piece', 100]],
                     { aliases: ['machli', 'fish'] }),
  f('fish-curry',    'Fish Curry',             [130, 13, 4, 7],      [['1 bowl', 200]]),
  f('prawns',        'Prawns (cooked)',        [99, 24, 0.2, 0.3],   [['100 g', 100]],
                     { aliases: ['shrimp', 'jhinga'] }),
  f('mutton',        'Mutton (cooked)',        [258, 25, 0, 17],     [['100 g', 100]],
                     { aliases: ['lamb', 'goat meat'] }),

  // ─── Dals and legumes ──────────────────────────────────────────────────────
  f('dal-toor',      'Toor Dal (cooked)',      [120, 7, 20, 0.4],    [['1 bowl', 150], ['1 katori', 100]],
                     { aliases: ['dal', 'arhar dal', 'tur dal', 'toovar'] }),
  f('dal-moong',     'Moong Dal (cooked)',     [105, 7, 19, 0.4],    [['1 bowl', 150], ['1 katori', 100]]),
  f('dal-masoor',    'Masoor Dal (cooked)',    [116, 9, 20, 0.4],    [['1 bowl', 150], ['1 katori', 100]],
                     { aliases: ['red lentil'] }),
  f('dal-chana',     'Chana Dal (cooked)',     [130, 8, 21, 2],      [['1 bowl', 150], ['1 katori', 100]]),
  f('dal-urad',      'Urad Dal (cooked)',      [120, 8, 18, 1.5],    [['1 bowl', 150], ['1 katori', 100]],
                     { aliases: ['black gram'] }),
  f('dal-makhani',   'Dal Makhani',            [180, 7, 16, 10],     [['1 bowl', 150], ['1 katori', 100]]),
  f('rajma',         'Rajma (cooked)',         [127, 9, 23, 0.5],    [['1 bowl', 200], ['1 katori', 100]],
                     { aliases: ['kidney beans'] }),
  f('chole',         'Chole / Chana (cooked)', [164, 9, 27, 2.6],    [['1 bowl', 200], ['1 katori', 100]],
                     { aliases: ['chickpeas', 'chana masala', 'chhole'] }),
  f('chana-roasted', 'Roasted Chana',          [364, 20, 61, 5],     [['1 handful', 30], ['1 katori', 50]],
                     { aliases: ['bhuna chana', 'roasted gram'] }),
  f('soya-chunks',   'Soya Chunks (dry)',      [345, 52, 33, 0.5],   [['50 g dry', 50], ['1 katori dry', 25]],
                     { aliases: ['nutrela', 'soy chunks', 'meal maker'] }),
  f('sprouts',       'Moong Sprouts',          [30, 3, 6, 0.2],      [['1 bowl', 100]],
                     { aliases: ['sprouts', 'ankurit moong'] }),
  f('green-peas',    'Green Peas',             [81, 5, 14, 0.4],     [['1 katori', 100]], { aliases: ['matar'] }),
  f('sambar',        'Sambar',                 [85, 4, 12, 2],       [['1 bowl', 200], ['1 katori', 100]]),
  f('rasam',         'Rasam',                  [40, 1.5, 6, 1],      [['1 bowl', 200]], { liquid: true }),
  f('kadhi',         'Kadhi',                  [105, 4, 8, 6],       [['1 bowl', 200], ['1 katori', 100]]),

  // ─── Grains and breads ─────────────────────────────────────────────────────
  f('roti',          'Roti / Chapati',         [297, 11, 58, 4],     [['1 roti', 45], ['2 rotis', 90]],
                     { aliases: ['chapati', 'phulka', 'chapathi'] }),
  f('paratha',       'Paratha (plain)',        [320, 7, 45, 12],     [['1 paratha', 70]]),
  f('naan',          'Naan',                   [310, 9, 52, 7],      [['1 naan', 90]]),
  f('rice-cooked',   'Rice (cooked)',          [130, 2.7, 28, 0.3],  [['1 cup', 150], ['1 plate', 250]],
                     { aliases: ['chawal', 'boiled rice', 'steamed rice'] }),
  f('khichdi',       'Khichdi',                [120, 4, 20, 2.5],    [['1 bowl', 250]]),
  f('poha',          'Poha (cooked)',          [130, 2.5, 27, 1.8],  [['1 plate', 200]]),
  f('upma',          'Upma',                   [160, 4, 24, 5],      [['1 plate', 200]]),
  f('idli',          'Idli',                   [130, 4, 26, 0.5],    [['1 idli', 40], ['2 idlis', 80]]),
  f('dosa',          'Dosa (plain)',           [168, 4, 29, 4],      [['1 dosa', 100]]),
  f('besan-chilla',  'Besan Chilla',           [190, 9, 20, 8],      [['1 chilla', 80]],
                     { aliases: ['besan cheela', 'gram flour pancake'] }),
  f('bread-brown',   'Brown Bread',            [265, 9, 49, 3.4],    [['1 slice', 30], ['2 slices', 60]]),
  f('bread-white',   'White Bread',            [265, 9, 49, 3.2],    [['1 slice', 30], ['2 slices', 60]]),
  f('oats',          'Oats (dry)',             [389, 17, 66, 7],     [['1 bowl', 40], ['1 scoop', 30]],
                     { aliases: ['oatmeal', 'rolled oats'] }),
  f('muesli',        'Muesli',                 [380, 9, 66, 8],      [['1 bowl', 50]]),
  f('cornflakes',    'Cornflakes',             [378, 7, 84, 0.9],    [['1 bowl', 40]]),
  f('suji',          'Suji / Rava (dry)',      [360, 12, 73, 1],     [['1 katori', 50]], { aliases: ['semolina', 'rava'] }),
  f('corn',          'Corn (boiled)',          [96, 3.4, 21, 1.5],   [['1 cup', 150]], { aliases: ['bhutta', 'sweetcorn'] }),
  f('pav-bhaji',     'Pav Bhaji',              [150, 3, 18, 7],      [['1 plate', 300]]),

  // ─── Supplements ───────────────────────────────────────────────────────────
  f('whey',          'Whey Protein Powder',    [400, 80, 8, 5],      [['1 scoop', 30], ['2 scoops', 60]],
                     { aliases: ['protein powder', 'whey isolate', 'whey concentrate'] }),
  f('protein-shake', 'Protein Shake (ready)',  [60, 8, 4, 1.5],      [['1 bottle', 250]], { liquid: true }),
  f('protein-bar',   'Protein Bar',            [380, 20, 45, 12],    [['1 bar', 60]]),
  f('creatine',      'Creatine Monohydrate',   [0, 0, 0, 0],         [['1 scoop', 3]]),

  // ─── Nuts, seeds, fats ─────────────────────────────────────────────────────
  f('peanuts',       'Peanuts',                [567, 26, 16, 49],    [['1 handful', 30], ['1 katori', 50]],
                     { aliases: ['moongphali', 'groundnut'] }),
  f('peanut-butter', 'Peanut Butter',          [588, 25, 20, 50],    [['1 tbsp', 16], ['2 tbsp', 32]],
                     { aliases: ['pb', 'peanutbutter'] }),
  f('almonds',       'Almonds',                [579, 21, 22, 50],    [['10 almonds', 12], ['1 handful', 28]],
                     { aliases: ['badam'] }),
  f('cashews',       'Cashews',                [553, 18, 30, 44],    [['1 handful', 30]], { aliases: ['kaju'] }),
  f('walnuts',       'Walnuts',                [654, 15, 14, 65],    [['2 halves', 10], ['1 handful', 30]],
                     { aliases: ['akhrot'] }),
  f('pumpkin-seeds', 'Pumpkin Seeds',          [559, 30, 11, 49],    [['1 tbsp', 10], ['1 handful', 28]]),
  f('chia-seeds',    'Chia Seeds',             [486, 17, 42, 31],    [['1 tbsp', 12]]),
  f('flax-seeds',    'Flax Seeds',             [534, 18, 29, 42],    [['1 tbsp', 10]], { aliases: ['alsi', 'linseed'] }),
  f('makhana',       'Makhana (fox nuts)',     [350, 9.7, 77, 0.1],  [['1 bowl', 25]], { aliases: ['fox nuts', 'lotus seeds'] }),
  f('coconut-fresh', 'Coconut (fresh)',        [354, 3.3, 15, 33],   [['1 piece', 30]], { aliases: ['nariyal'] }),
  f('ghee',          'Ghee',                   [900, 0, 0, 100],     [['1 tsp', 5], ['1 tbsp', 14]]),
  f('oil',           'Cooking Oil',            [884, 0, 0, 100],     [['1 tsp', 5], ['1 tbsp', 14]],
                     { aliases: ['tel', 'refined oil', 'mustard oil'] }),

  // ─── Vegetables and curries ────────────────────────────────────────────────
  f('mixed-veg',     'Mixed Veg Sabzi',        [95, 3, 10, 5],       [['1 bowl', 150], ['1 katori', 100]],
                     { aliases: ['sabzi', 'sabji', 'mixed vegetable'] }),
  f('palak-paneer',  'Palak Paneer',           [180, 8, 6, 14],      [['1 bowl', 200], ['1 katori', 100]]),
  f('spinach',       'Spinach (cooked)',       [23, 2.9, 3.6, 0.4],  [['1 katori', 100]], { aliases: ['palak'] }),
  f('cauliflower',   'Cauliflower (cooked)',   [25, 1.9, 5, 0.3],    [['1 katori', 100]], { aliases: ['gobi', 'phool gobi'] }),
  f('bhindi',        'Bhindi (cooked)',        [33, 1.9, 7, 0.2],    [['1 katori', 100]], { aliases: ['okra', 'ladyfinger'] }),
  f('carrot',        'Carrot',                 [41, 0.9, 10, 0.2],   [['1 medium', 60]], { aliases: ['gajar'] }),
  f('cucumber',      'Cucumber',               [15, 0.7, 3.6, 0.1],  [['1 medium', 150]], { aliases: ['kheera'] }),
  f('tomato',        'Tomato',                 [18, 0.9, 3.9, 0.2],  [['1 medium', 100]], { aliases: ['tamatar'] }),
  f('onion',         'Onion',                  [40, 1.1, 9, 0.1],    [['1 medium', 100]], { aliases: ['pyaz'] }),
  f('potato',        'Potato (boiled)',        [87, 2, 20, 0.1],     [['1 medium', 150]], { aliases: ['aloo'] }),
  f('sweet-potato',  'Sweet Potato (boiled)',  [86, 1.6, 20, 0.1],   [['1 medium', 150]], { aliases: ['shakarkandi'] }),

  // ─── Fruit ─────────────────────────────────────────────────────────────────
  f('banana',        'Banana',                 [89, 1.1, 23, 0.3],   [['1 medium', 120]], { aliases: ['kela'] }),
  f('apple',         'Apple',                  [52, 0.3, 14, 0.2],   [['1 medium', 180]], { aliases: ['seb'] }),
  f('mango',         'Mango',                  [60, 0.8, 15, 0.4],   [['1 medium', 200]], { aliases: ['aam'] }),
  f('orange',        'Orange',                 [47, 0.9, 12, 0.1],   [['1 medium', 130]], { aliases: ['santra'] }),
  f('papaya',        'Papaya',                 [43, 0.5, 11, 0.3],   [['1 bowl', 150]], { aliases: ['papita'] }),
  f('grapes',        'Grapes',                 [69, 0.7, 18, 0.2],   [['1 bowl', 100]], { aliases: ['angoor'] }),
  f('dates',         'Dates',                  [282, 2.5, 75, 0.4],  [['2 dates', 16]], { aliases: ['khajoor'] }),
  f('raisins',       'Raisins',                [299, 3.1, 79, 0.5],  [['1 tbsp', 15]], { aliases: ['kishmish'] }),
  f('coconut-water', 'Coconut Water',          [19, 0.7, 3.7, 0.2],  [['1 glass', 250]], { liquid: true, aliases: ['nariyal pani'] }),

  // ─── Drinks, snacks, sweets ────────────────────────────────────────────────
  f('tea-milk',      'Tea (with milk & sugar)',[40, 1.2, 5, 1.5],    [['1 cup', 150]], { liquid: true, aliases: ['chai'] }),
  f('coffee-milk',   'Coffee (with milk)',     [45, 1.5, 5.5, 1.7],  [['1 cup', 150]], { liquid: true }),
  f('biscuit-marie', 'Marie Biscuit',          [420, 7, 76, 10],     [['2 biscuits', 12], ['4 biscuits', 24]]),
  f('biscuit-dig',   'Digestive Biscuit',      [480, 7, 65, 21],     [['2 biscuits', 30]]),
  f('namkeen',       'Namkeen / Mixture',      [520, 12, 50, 30],    [['1 handful', 30]], { aliases: ['sev', 'mixture'] }),
  f('samosa',        'Samosa',                 [308, 5, 32, 18],     [['1 samosa', 70]]),
  f('jalebi',        'Jalebi',                 [400, 3, 60, 16],     [['2 pieces', 50]]),
  f('gulab-jamun',   'Gulab Jamun',            [340, 5, 45, 15],     [['1 piece', 40]]),
  f('kheer',         'Kheer',                  [145, 4, 20, 5],      [['1 katori', 150]]),
  f('ice-cream',     'Ice Cream',              [207, 3.5, 24, 11],   [['1 scoop', 60]]),
  f('dark-chocolate','Dark Chocolate',         [546, 5, 61, 31],     [['2 squares', 20]]),
  f('honey',         'Honey',                  [304, 0.3, 82, 0],    [['1 tsp', 7], ['1 tbsp', 21]], { aliases: ['shahad'] }),
  f('sugar',         'Sugar',                  [387, 0, 100, 0],     [['1 tsp', 5], ['1 tbsp', 12]], { aliases: ['cheeni'] }),
  f('jaggery',       'Jaggery / Gur',          [383, 0.4, 98, 0.1],  [['1 piece', 10]], { aliases: ['gur'] }),
]
