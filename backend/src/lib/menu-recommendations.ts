/** Conservative, menu-based recommendations. Unknown dishes never fill a different taste bucket. */
export type MealTaste = 'sweet' | 'savory' | 'fresh';
export type MealHunger = 'light' | 'hungry' | 'stuffed';
export type MealBudget = 'low' | 'mid' | 'high';
type Kind = 'sweet' | 'savory' | 'fresh' | 'drink' | 'unknown';
export type MealCandidate = {
  id: number;
  name: string;
  description?: string;
  classificationName: string;
  classificationDescription: string;
  classificationLang: string;
  groupNames: string[];
  price: number;
  currency?: { code?: string | null; symbol?: string | null } | null;
  calories?: number | null;
  isRecommended?: boolean;
  soldOut?: boolean;
};
const normalize = (s: string) => s.toLocaleLowerCase('tr').replace(/ı/g, 'i')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const has = (text: string, pattern: RegExp) => pattern.test(text);
const SWEET = /\b(tatli\w*|dessert\w*|tiramisu|cheesecake\w*|sufle\w*|souffle\w*|baklava\w*|kunefe\w*|sutlac\w*|kazandibi|profiterol\w*|waffle\w*|pancake\w*|brownie\w*|cookie\w*|kurabiye\w*|dondurma\w*|ice cream|chocolate cake|cake\w*|puding\w*|pudding\w*|helva\w*|lokma\w*|revani|ekler|magnolia|trilece\w*|churro\w*|bal kaymak|balli kaymak|recel\w*|jam|honey|sweets?)\b/;
const SAVORY = /\b(burger\w*|hamburger\w*|pizza\w*|kebap\w*|kebab\w*|kofte\w*|tavuk\w*|chicken\w*|steak\w*|biftek\w*|bonfile\w*|pirzola\w*|doner\w*|durum\w*|lahmacun\w*|pide\w*|makarna\w*|risotto\w*|pilav\w*|rice|manti\w*|tost\w*|toast\w*|sandvic\w*|sandwich\w*|kahvalti\w*|breakfast\w*|menemen\w*|omlet\w*|omelet\w*|sucuk\w*|balik\w*|fish|somon\w*|salmon|borek\w*|pogaca\w*|wrap\w*|fajita\w*|noodle\w*|ana yemek\w*|main course\w*|patates\w*|kumpir\w*|simit\w*|sosisli\w*|hot dog\w*|falafel\w*|humus\w*|hummus\w*|fast food|pastirma\w*)\b/;
const FRESH = /\b(salata\w*|salad\w*|corba\w*|soup\w*|cacik\w*|meyve tabagi|fruit salad|avokado\w*|sebze\w*|vegetable\w*|yogurt\w*|yogurtlu\w*|zeytinyagli\w*)\b/;
const DRINK = /\b(icecek\w*|beverage\w*|drink\w*|kahve\w*|coffee\w*|latte\w*|espresso\w*|cappuccino\w*|cay\w*|tea|cola|kola|ayran\w*|limonata\w*|lemonade\w*|smoothie\w*|milkshake\w*|meyve suyu|portakal suyu|orange juice|su|water)\b/;
const REFRESHING = /\b(salata\w*|salad\w*|meyve\w*|fruit\w*|smoothie\w*|limonata\w*|lemonade\w*|portakal\w*|orange\w*|detox\w*|ayran\w*)\b/;
function kind(text: string, lang: string): Kind {
  // Name/category beats incidental ingredients such as chocolate sauce or honey.
  if (/\b(salata\w*|salad\w*|corba\w*|soup\w*|cacik\w*|zeytinyagli\w*)\b/.test(text) &&
    !/\b(burger\w*|pizza\w*|tost\w*|sandvic\w*|sandwich\w*|wrap\w*|pilav\w*|makarna\w*)\b/.test(text)) return 'fresh';
  if (has(text, SAVORY)) return 'savory';
  if (has(text, DRINK)) return 'drink';
  if (/\b(spaghetti|penne|fettuccine|lasagna|ravioli)\b/.test(text)) return 'savory';
  if (has(text, SWEET) || /\b(pasta|pastalar|pastasi|pastalari)\b/.test(text) && lang.startsWith('tr')) return 'sweet';
  if (has(text, FRESH)) return 'fresh';
  if (/\b(pasta|spaghetti|penne|fettuccine|lasagna|ravioli)\b/.test(text)) return 'savory';
  return 'unknown';
}
export function classifyMeal(p: MealCandidate): Kind {
  const name = kind(normalize(p.classificationName), p.classificationLang);
  // Dessert categories also cover unusual names such as chocolate pizza.
  if (name !== 'drink' && p.groupNames.some(group => {
    const text = normalize(group);
    return SWEET.test(text) && !SAVORY.test(text);
  })) return 'sweet';
  if (name !== 'unknown') return name;
  // The immediate category is more specific than its parent.
  for (const group of p.groupNames) {
    const category = kind(normalize(group), p.classificationLang);
    if (category !== 'unknown') return category;
  }
  return kind(normalize(p.classificationDescription), p.classificationLang);
}
export function recommendMeals<T extends MealCandidate>(products: T[], choice: {
  taste: MealTaste; hunger: MealHunger; budget: MealBudget;
}): T[] {
  const eligible = products.filter(p => {
    if (p.soldOut || !Number.isFinite(p.price) || p.price < 0) return false;
    const type = classifyMeal(p);
    if (choice.taste === 'sweet') return type === 'sweet';
    if (choice.taste === 'savory') return type === 'savory' || type === 'fresh';
    return type === 'fresh' || type === 'drink' && choice.hunger === 'light' &&
      REFRESHING.test(normalize(p.classificationName + ' ' + p.groupNames.join(' ')));
  });
  const prices = new Map<string, number[]>();
  const currencyOf = (p: T) => p.currency?.code || p.currency?.symbol || 'TRY';
  for (const p of eligible) {
    const key = currencyOf(p);
    prices.set(key, [...(prices.get(key) || []), p.price]);
  }
  for (const [key, values] of prices) prices.set(key, [...new Set(values)].sort((a, b) => a - b));
  return eligible.map(p => {
    const type = classifyMeal(p), cal = p.calories;
    let score = p.isRecommended ? 4 : 0;
    // Missing calories are neutral, never treated as a zero-calorie/light dish.
    if (cal != null && Number.isFinite(cal) && cal > 0) {
      const target = choice.hunger === 'light' ? 300 : choice.hunger === 'stuffed' ? 850 : 550;
      score += 28 * Math.max(-1, 1 - Math.abs(cal - target) / 500);
    } else if (type === 'fresh') score += choice.hunger === 'light' ? 12 : -4;
    if (type === 'drink') score -= 12;
    const values = prices.get(currencyOf(p))!;
    const rank = values.length > 1 ? values.indexOf(p.price) / (values.length - 1) : 0.5;
    // Relative to this restaurant and this currency; no fixed/outdated lira thresholds.
    if (choice.budget === 'low') score += 45 * (1 - rank);
    if (choice.budget === 'mid') score += 14 * (1 - Math.abs(rank - 0.5) * 2);
    return { product: p, score };
  }).sort((a, b) => b.score - a.score || a.product.id - b.product.id).slice(0, 5).map(row => row.product);
}
