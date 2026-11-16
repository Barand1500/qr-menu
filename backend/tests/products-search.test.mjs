import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const out = path.join(root, 'backend/node_modules/.products-check');
process.env.UPLOAD_DIR = path.join(out, 'uploads');
process.env.JWT_SECRET = 'products-search-test-only';
const rows = Array.from({ length: 40 }, (_, i) => ({
  id: i + 1,
  restaurantId: 1,
  groupId: (i % 2) + 1,
  sortOrder: Math.floor(i / 2) + 1,
  price: 100,
  isActive: i % 3 !== 0,
  imageUrl: '/uploads/test.jpg',
  images: [],
  i18n: {
    tr: { name: i < 15 ? `Çorba ${i}` : `Pizza ${i}` },
    en: { name: `Dish ${i}` },
  },
  group: { i18n: { tr: { name: 'Grup' } } },
}));
rows.push({
  ...rows[20],
  id: 99,
  restaurantId: 2,
  i18n: { tr: { name: 'Pizza başka işletme' } },
});
const select = (where = {}) =>
  rows
    .filter(
      (p) =>
        (where.restaurantId == null || p.restaurantId === where.restaurantId) &&
        (where.groupId == null || p.groupId === where.groupId) &&
        (where.id == null ||
          (typeof where.id === 'object'
            ? where.id.in.includes(p.id)
            : p.id === where.id)) &&
        (where.isActive == null || p.isActive === where.isActive),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
globalThis.__productsPrisma = {
  user: {
    findUnique: async ({ where }) => ({
      id: where.id,
      restaurantId: where.id,
      isActive: true,
      role: 'admin',
    }),
  },
  language: {
    findMany: async () => [
      { id: 1, code: 'tr', isActive: true },
      { id: 2, code: 'en', isActive: true },
    ],
  },
  setting: { findUnique: async () => null },
  product: {
    findMany: async ({ where, skip = 0, take, distinct }) =>
      distinct
        ? []
        : select(where).slice(skip, take == null ? undefined : skip + take),
    count: async ({ where }) => select(where).length,
    findFirst: async ({ where }) => select(where)[0] || null,
    update: async ({ where, data }) =>
      Object.assign(
        rows.find((p) => p.id === where.id),
        data,
      ),
  },
  $transaction: async (promises) => Promise.all(promises),
};
await build({
  entryPoints: [path.join(root, 'backend/src/routes/products.ts')],
  outfile: path.join(out, 'router.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  plugins: [
    {
      name: 'fake-prisma',
      setup(b) {
        b.onResolve({ filter: /(^|\/)prisma\.js$/ }, () => ({
          path: 'prisma',
          namespace: 'test',
        }));
        b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
          contents: 'export const prisma = globalThis.__productsPrisma;',
          loader: 'js',
        }));
      },
    },
  ],
});
const express = (
  await import(
    pathToFileURL(path.join(root, 'backend/node_modules/express/index.js')).href
  )
).default;
const jwt = (
  await import(
    pathToFileURL(path.join(root, 'backend/node_modules/jsonwebtoken/index.js'))
      .href
  )
).default;
const router = (await import(pathToFileURL(path.join(out, 'router.mjs')).href))
  .default;
const app = express();
app.use(express.json());
app.use('/products', router);
const server = app.listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const get = async (query, user = 1) => {
  const res = await fetch(
    `http://127.0.0.1:${server.address().port}/products?${query}`,
    {
      headers: user
        ? {
            Authorization: `Bearer ${jwt.sign({ userId: user, restaurantId: 999, role: 'admin' }, process.env.JWT_SECRET)}`,
          }
        : {},
    },
  );
  return { status: res.status, body: await res.json() };
};
try {
  assert.equal((await get('search=pizza', null)).status, 401);
  let result = await get('search=pizza&limit=15&page=1');
  assert.equal(result.body.pagination.total, 25);
  assert.equal(result.body.data.length, 15);
  assert.ok(result.body.data.every((p) => p.name.startsWith('Pizza')));
  const first = result.body.data.map((p) => p.id);
  result = await get('search=pizza&limit=15&page=2');
  assert.equal(result.body.data.length, 10);
  assert.ok(result.body.data.every((p) => !first.includes(p.id)));
  result = await get('search=pizza&groupId=2&active=true&limit=15');
  assert.equal(
    result.body.pagination.total,
    select({ restaurantId: 1, groupId: 2, isActive: true }).filter((p) =>
      p.i18n.tr.name.startsWith('Pizza'),
    ).length,
  );
  assert.ok(result.body.data.every((p) => p.groupId === 2 && p.isActive));
  result = await get('search=pizza&limit=15', 2);
  assert.deepEqual(
    result.body.data.map((p) => p.id),
    [99],
  );
  assert.equal(result.body.pagination.total, 1);
  result = await get('search=does-not-exist');
  assert.equal(result.body.pagination.total, 0);
  assert.deepEqual(result.body.data, []);
  result = await get('search=%20%20&limit=15');
  assert.equal(result.body.pagination.total, 40);
  assert.equal(result.body.data.length, 15);
  console.log(
    'PASS products search before pagination, accurate counts, group/status filters, authenticated restaurant isolation and empty queries. No real database used.',
  );
} finally {
  await new Promise((r) => server.close(r));
}
