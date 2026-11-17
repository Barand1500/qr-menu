import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  out = path.join(root, 'node_modules/.tinyplates-test.mjs');
process.env.TINYPLATES_API_KEY = 'unit-test-key';
await build({
  entryPoints: [path.join(root, 'src/lib/tinyplates.ts')],
  outfile: out,
  platform: 'node',
  format: 'esm',
  bundle: true,
});
const { normalizeTinyRecipe, searchTinyRecipes, getTinyRecipe } = await import(
  pathToFileURL(out).href
);
const recipe = {
  id: 'abc123',
  title: 'Chicken soup',
  url: 'https://example.com/recipe',
  ingredients: [{ name: 'Chicken' }, { name: 'Milk' }],
  categories: ['soup'],
  dietary: { vegetarian: false, glutenFree: true },
  allergens: { milk: true, eggs: false, celery: true },
  times: { prep: { seconds: 601 }, total: { seconds: 4000 } },
  nutrition: {
    source: 'provided',
    basis: { type: 'serving' },
    calories: { value: 320.4, unit: 'kcal' },
  },
};
let result = normalizeTinyRecipe(recipe);
assert.equal(result.calories, 320);
assert.equal(result.prepTimeMinutes, 11);
assert.deepEqual(result.allergenTags, ['dairy', 'Kereviz']);
assert.deepEqual(result.dietTags, []);
assert.ok(result.ingredients.includes('Süt'));
assert.equal(result.source.url, recipe.url);
result = normalizeTinyRecipe({
  ...recipe,
  nutrition: { ...recipe.nutrition, basis: { type: '100g' } },
});
assert.equal('calories' in result, false);
result = normalizeTinyRecipe({
  ...recipe,
  nutrition: undefined,
  times: {},
  dietary: { vegan: true },
  url: 'javascript:alert(1)',
});
assert.equal('calories' in result, false);
assert.equal('prepTimeMinutes' in result, false);
assert.deepEqual(result.dietTags, ['vegan', 'vegetarian']);
assert.equal(result.source.url, 'https://www.tinyplates.dev');
assert.equal(normalizeTinyRecipe({}), null);
const originalFetch = globalThis.fetch;
let count = 0,
  mode = '';
globalThis.fetch = async (url, options) => {
  count++;
  assert.equal(new URL(url).hostname, 'api.tinyplates.dev');
  assert.equal(options.headers.Authorization, 'Bearer unit-test-key');
  if (mode === 'quota') return new Response('{}', { status: 429 });
  return Response.json(
    new URL(url).pathname === '/search'
      ? { results: [{ id: recipe.id, title: recipe.title }] }
      : { recipe },
  );
};
try {
  const [a, b] = await Promise.all([
    searchTinyRecipes('tav'),
    searchTinyRecipes('tav'),
  ]);
  assert.deepEqual(a, b);
  assert.equal(count, 1);
  assert.equal(a[0].id, 'tiny:abc123');
  assert.equal(a[0].source, 'Tiny Plates');
  assert.equal((await getTinyRecipe('abc123')).calories, 320);
  assert.equal(count, 2);
  mode = 'quota';
  await assert.rejects(() => searchTinyRecipes('new request'));
  const beforeCooldown = count;
  await assert.rejects(() => searchTinyRecipes('another uncached request'));
  assert.equal(count, beforeCooldown);
  console.log(
    'PASS Tiny Plates: documented response envelope, allergen/unsupported-tag mapping, per-serving kcal only, seconds conversion, source link validation, optional data, cache/auth/quota cooldown. Provider responses mocked.',
  );
} finally {
  globalThis.fetch = originalFetch;
}
