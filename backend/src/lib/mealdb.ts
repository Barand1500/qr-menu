// Official V1 API: the shared key is for development; production needs a supporter key.
const API = 'https://www.themealdb.com/api/json/v1';
export const mealDbKey = () => {
  const configured = process.env.THEMEALDB_API_KEY?.trim();
  if (process.env.NODE_ENV === 'production')
    return configured && configured !== '1' ? configured : '';
  return configured || '1';
};
type Meal = Record<string, unknown>;
type Cached = { expires: number; value: Meal[] };
const cache = new Map<string, Cached>();
const pending = new Map<string, Promise<Meal[]>>();
const words: Record<string, string> = {
  tavuk: 'chicken',
  pilav: 'rice',
  pirinc: 'rice',
  mercimek: 'lentil',
  corba: 'soup',
  et: 'beef',
  dana: 'beef',
  kuzu: 'lamb',
  balik: 'fish',
  somon: 'salmon',
  karides: 'shrimp',
  patates: 'potato',
  mantar: 'mushroom',
  makarna: 'pasta',
  salata: 'salad',
  yumurta: 'egg',
  peynir: 'cheese',
  nohut: 'chickpea',
  fasulye: 'bean',
  cikolata: 'chocolate',
  kahve: 'coffee',
  tatli: 'dessert',
};
const fold = (text: string) =>
  text
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
export function mealSearchTerm(query: string) {
  return fold(query)
    .split(/\s+/)
    .map(
      (word) =>
        words[word] ||
        (word.length >= 3
          ? Object.entries(words).find(([key]) => key.startsWith(word))?.[1]
          : undefined) ||
        word,
    )
    .join(' ');
}
const translations: Record<string, string> = {
  chicken: 'Tavuk',
  beef: 'Dana eti',
  lamb: 'Kuzu eti',
  pork: 'Domuz eti',
  salmon: 'Somon',
  fish: 'Balık',
  rice: 'Pirinç',
  potato: 'Patates',
  potatoes: 'Patates',
  onion: 'Soğan',
  onions: 'Soğan',
  garlic: 'Sarımsak',
  tomato: 'Domates',
  tomatoes: 'Domates',
  milk: 'Süt',
  butter: 'Tereyağı',
  cream: 'Krema',
  cheese: 'Peynir',
  eggs: 'Yumurta',
  egg: 'Yumurta',
  flour: 'Un',
  sugar: 'Şeker',
  salt: 'Tuz',
  water: 'Su',
  yogurt: 'Yoğurt',
  yoghurt: 'Yoğurt',
  'olive oil': 'Zeytinyağı',
  'vegetable oil': 'Bitkisel yağ',
  'sunflower oil': 'Ayçiçek yağı',
  'black pepper': 'Karabiber',
  'red pepper': 'Kırmızı biber',
  'green chilli': 'Yeşil acı biber',
  'green chillies': 'Yeşil acı biber',
  'red chilli': 'Kırmızı acı biber',
  'tomato puree': 'Domates püresi',
  'tomato paste': 'Domates salçası',
  'chicken breast': 'Tavuk göğsü',
  'chicken thighs': 'Tavuk but',
  'chicken thigh': 'Tavuk but',
  'orange chicken': 'Portakallı tavuk',
  'cashew chicken': 'Kajulu tavuk',
  'chicken soup': 'Tavuk çorbası',
  'soy sauce': 'Soya sosu',
  'light soy sauce': 'Açık soya sosu',
  'dark soy sauce': 'Koyu soya sosu',
  'brown sugar': 'Esmer şeker',
  'white vinegar': 'Beyaz sirke',
  'rice vinegar': 'Pirinç sirkesi',
  'orange juice': 'Portakal suyu',
  'orange zest': 'Portakal kabuğu rendesi',
  'chicken broth': 'Tavuk suyu',
  cornstarch: 'Mısır nişastası',
  'corn starch': 'Mısır nişastası',
  'sesame oil': 'Susam yağı',
  'sesame seeds': 'Susam',
  'red pepper flakes': 'Pul biber',
  'all-purpose flour': 'Buğday unu',
  'all purpose flour': 'Buğday unu',
  'baking soda': 'Karbonat',
  'baking powder': 'Kabartma tozu',
  'neutral oil': 'Nötr bitkisel yağ',
  'cooking oil': 'Yemeklik yağ',
  'peanut oil': 'Yer fıstığı yağı',
  'canola oil': 'Kanola yağı',
  scallion: 'Taze soğan',
  scallions: 'Taze soğan',
  'green onions': 'Taze soğan',
  'bell pepper': 'Dolmalık biber',
  cashews: 'Kaju',
  'chicken stock': 'Tavuk suyu',
  'beef stock': 'Et suyu',
  'plain flour': 'Buğday unu',
  'self-raising flour': 'Kabartıcılı un',
  'red lentils': 'Kırmızı mercimek',
  'brown lentils': 'Kahverengi mercimek',
  ginger: 'Zencefil',
  cumin: 'Kimyon',
  coriander: 'Kişniş',
  'coriander seeds': 'Kişniş tohumu',
  'cumin seeds': 'Kimyon tohumu',
  turmeric: 'Zerdeçal',
  'turmeric powder': 'Toz zerdeçal',
  'chilli powder': 'Toz acı biber',
  'red chilli powder': 'Toz kırmızı acı biber',
  'bay leaf': 'Defne yaprağı',
  'bay leaves': 'Defne yaprağı',
  cinnamon: 'Tarçın',
  'coconut milk': 'Hindistan cevizi sütü',
  'double cream': 'Yoğun krema',
  'lemon juice': 'Limon suyu',
  lemon: 'Limon',
  parsley: 'Maydanoz',
  basil: 'Fesleğen',
  mushrooms: 'Mantar',
  chickpeas: 'Nohut',
  saltfish: 'Tuzlanmış balık',
  bread: 'Ekmek',
  seafood: 'Deniz ürünleri',
  starter: 'Başlangıç',
  vegetarian: 'Vejetaryen',
  vegan: 'Vegan',
  dessert: 'Tatlı',
  pasta: 'Makarna',
  breakfast: 'Kahvaltı',
};
export const mealTextTr = (text: string) =>
  translations[text.trim().toLowerCase()] ||
  text.replace(
    /\b(chicken|beef|lamb|pork|salmon|fish|rice|potato|mushroom)\b/gi,
    (word) => translations[word.toLowerCase()] || word,
  );
function text(value: unknown, max = 120) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
async function read(
  endpoint: 'search.php' | 'lookup.php',
  param: string,
  value: string,
) {
  const key = mealDbKey();
  if (!key || !/^[a-zA-Z0-9_-]{1,100}$/.test(key))
    throw new Error('RECIPE_KEY_REQUIRED');
  const cacheKey = `${key}:${endpoint}:${value}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return hit.value;
  const inFlight = pending.get(cacheKey);
  if (inFlight) return inFlight;
  if (pending.size >= 8) throw new Error('RECIPE_BUSY');
  const promise = (async () => {
    const url = new URL(`${API}/${encodeURIComponent(key)}/${endpoint}`);
    url.searchParams.set(param, value);
    const response = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('RECIPE_UNAVAILABLE');
    const raw = await response.text();
    if (raw.length > 2_000_000) throw new Error('RECIPE_RESPONSE_TOO_LARGE');
    const body = JSON.parse(raw) as { meals?: unknown };
    const meals = Array.isArray(body.meals)
      ? body.meals
          .filter((meal): meal is Meal => !!meal && typeof meal === 'object')
          .slice(0, 30)
      : [];
    if (cache.size >= 200) cache.delete(cache.keys().next().value!);
    cache.set(cacheKey, {
      value: meals,
      expires: Date.now() + (endpoint === 'lookup.php' ? 3_600_000 : 300_000),
    });
    return meals;
  })();
  pending.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    pending.delete(cacheKey);
  }
}
export async function searchMeals(query: string) {
  const meals = await read('search.php', 's', mealSearchTerm(query));
  return meals
    .filter((meal) => /^\d+$/.test(text(meal.idMeal)))
    .slice(0, 4)
    .map((meal) => ({
      id: text(meal.idMeal),
      name: mealTextTr(text(meal.strMeal)),
      originalName: text(meal.strMeal),
      source: 'TheMealDB',
    }));
}
export async function getMeal(id: string) {
  const meal = (await read('lookup.php', 'i', id)).find(
    (meal) => text(meal.idMeal) === id,
  );
  if (!meal) return null;
  const name = mealTextTr(text(meal.strMeal)),
    ingredients: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const ingredient = text(meal[`strIngredient${i}`]);
    if (!ingredient) continue;
    const measure = text(meal[`strMeasure${i}`], 60);
    ingredients.push(
      `${mealTextTr(ingredient)}${measure ? ` (${measure})` : ''}`,
    );
  }
  const category = text(meal.strCategory);
  return {
    id: `mealdb-${id}`,
    name,
    aliases: [],
    ingredients,
    description: ingredients.length
      ? `${name}; ${ingredients
          .slice(0, 4)
          .map((value) => value.replace(/\s*\([^)]*\)/g, ''))
          .join(', ')} ile hazırlanan bir tarif.`
      : `${name} — TheMealDB tarif önerisi.`,
    // The provider has no structured allergen or nutrition data. Never infer "free from" labels.
    allergenTags: [],
    dietTags:
      category === 'Vegan'
        ? ['vegan', 'vegetarian']
        : category === 'Vegetarian'
          ? ['vegetarian']
          : [],
    features: category ? [mealTextTr(category)] : [],
    source: {
      name: 'TheMealDB',
      url: `https://www.themealdb.com/meal/${id}`,
      kind: 'api' as const,
    },
  };
}
