import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  out = path.join(root, 'node_modules/.mealdb-test.mjs');
process.env.NODE_ENV = 'development';
delete process.env.TINYPLATES_API_KEY;
delete process.env.THEMEALDB_API_KEY;
await build({
  stdin: {
    contents:
      "export * from './src/lib/mealdb.js';export {default as router} from './src/routes/recipe-suggestions.js';",
    resolveDir: root,
    loader: 'ts',
  },
  outfile: out,
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  plugins: [
    {
      name: 'tenant-test',
      setup(b) {
        b.onResolve({ filter: /\/auth\.js$/ }, () => ({
          path: 'auth',
          namespace: 'test',
        }));
        b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
          contents:
            "export async function getRestaurantId(req){return req.headers['x-restaurant']?Number(req.headers['x-restaurant']):null}",
          loader: 'js',
        }));
      },
    },
  ],
});
const lib = await import(pathToFileURL(out).href),
  originalFetch = globalThis.fetch;
let mode = '',
  calls = [];
const meal = {
  idMeal: '52795',
  strMeal: 'Chicken Handi',
  strCategory: 'Chicken',
  strIngredient1: 'Chicken',
  strMeasure1: '500g',
  strIngredient2: 'Milk',
  strMeasure2: '1 cup',
  strIngredient3: 'Ginger',
  strMeasure3: '1 tsp',
  strInstructions: 'Never copy cooking instructions to the menu',
};
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.tinyplates.dev/')) {
    assert.equal(init.headers.Authorization, 'Bearer test-tiny-key');
    if (mode === 'quota') return new Response('{}', { status: 429 });
    return Response.json(
      new URL(url).pathname === '/search'
        ? { results: [{ id: 'abc123', title: 'Chicken soup' }] }
        : { recipe: { id: 'abc123', title: 'Chicken soup', ingredients: [] } },
    );
  }
  if (!String(url).startsWith('https://www.themealdb.com/'))
    return originalFetch(url, init);
  calls.push(String(url));
  assert.ok(init.signal instanceof AbortSignal);
  if (mode === 'bad') return new Response('no', { status: 503 });
  if (mode === 'invalid') return new Response('not json');
  if (mode === 'large') return new Response('x'.repeat(2_000_001));
  return Response.json({ meals: mode === 'empty' ? null : [meal] });
};
const express = (
  await import(
    pathToFileURL(path.join(root, 'node_modules/express/index.js')).href
  )
).default;
const app = express();
app.use('/recipes', lib.router);
app.use((e, _req, res, _next) => res.status(500).json({ message: e.message }));
const server = app.listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const get = (query, tenant = '1') =>
  originalFetch(`http://127.0.0.1:${server.address().port}/recipes${query}`, {
    headers: tenant ? { 'x-restaurant': tenant } : {},
  });
try {
  assert.equal(lib.mealSearchTerm('tav'), 'chicken');
  assert.equal(lib.mealSearchTerm('Tavuk pilav'), 'chicken rice');
  const [a, b] = await Promise.all([
    lib.searchMeals('tav'),
    lib.searchMeals('tav'),
  ]);
  assert.deepEqual(a, b);
  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0]).searchParams.get('s'), 'chicken');
  assert.equal(a[0].name, 'Tavuk Handi');
  const detail = await lib.getMeal('52795');
  assert.equal(detail.ingredients[1], 'Süt (1 cup)');
  assert.equal(detail.source.name, 'TheMealDB');
  assert.deepEqual(detail.allergenTags, []);
  assert.deepEqual(detail.dietTags, []);
  assert.equal('calories' in detail, false);
  assert.equal('prepTimeMinutes' in detail, false);
  assert.ok(!detail.description.includes('Never copy'));
  assert.equal((await get('?search=tav', null)).status, 403);
  assert.equal((await get('?search=ta')).status, 400);
  assert.equal((await get('/not-an-id')).status, 400);
  assert.equal((await get('?search=tav')).status, 200);
  mode = 'bad';
  assert.equal((await get('?search=unavailable')).status, 502);
  mode = 'invalid';
  await assert.rejects(() => lib.searchMeals('invalid'));
  mode = 'large';
  await assert.rejects(() => lib.searchMeals('large'));
  mode = 'empty';
  assert.deepEqual(await lib.searchMeals('empty'), []);
  assert.equal(await lib.getMeal('9999'), null);
  mode = '';
  for (let i = 0; i < 30; i++) await get('?search=tav', '77');
  assert.equal((await get('?search=tav', '77')).status, 429);
  process.env.NODE_ENV = 'production';
  assert.equal((await get('?search=tav')).status, 503);
  process.env.THEMEALDB_API_KEY = '1';
  assert.equal((await get('?search=tav')).status, 503);
  process.env.THEMEALDB_API_KEY = 'test-private-key';
  assert.equal((await get('?search=tav')).status, 200);
  process.env.TINYPLATES_API_KEY = 'test-tiny-key';
  const tiny = await (await get('?search=tav')).json();
  assert.equal(tiny.source, 'Tiny Plates');
  assert.equal(tiny.developmentKey, false);
  assert.equal(tiny.data[0].id, 'tiny:abc123');
  assert.equal(
    (await (await get('/tiny%3Aabc123')).json()).template.name,
    'Tavuk çorbası',
  );
  mode = 'quota';
  assert.equal((await get('?search=quota-new-query')).status, 429);
  console.log(
    'PASS recipe routes: Turkish search, cache, no invented fields, errors, tenant limits, production key guard, Tiny Plates priority/detail/quota. Provider responses mocked.',
  );
} finally {
  globalThis.fetch = originalFetch;
  await new Promise((r) => server.close(r));
}
