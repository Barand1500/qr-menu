import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'backend/node_modules/.sofra-check');
process.env.UPLOAD_DIR = path.join(out, 'uploads');
const rows = new Map();
const users = {
  1: { isActive: true, restaurantId: 1, role: 'admin', email: 'a' },
  2: { isActive: true, restaurantId: 2, role: 'admin', email: 'b' },
  3: { isActive: true, restaurantId: 1, role: 'staff', email: 'c' },
};
globalThis.__testPrisma = {
  user: { findUnique: async ({ where }) => users[where.id] },
  restaurant: {
    findUnique: async ({ where }) => ({ name: `Restaurant ${where.id}`, logoUrl: null }),
  },
  language: { findMany: async () => [{ code: 'tr', name: 'Türkçe' }] },
  group: { findMany: async () => [] },
  product: { findMany: async () => [] },
  setting: {
    findUnique: async ({ where }) => rows.get(where.restaurantId_key.restaurantId) || null,
    create: async ({ data }) => {
      if (rows.has(data.restaurantId)) {
        const err = new Error();
        err.code = 'P2002';
        throw err;
      }
      const row = { id: data.restaurantId, ...data };
      rows.set(data.restaurantId, row);
      return row;
    },
    updateMany: async ({ where, data }) => {
      const row = rows.get(where.restaurantId);
      if (!row || row.value !== where.value) return { count: 0 };
      rows.set(where.restaurantId, { ...row, ...data });
      return { count: 1 };
    },
  },
};
await build({
  entryPoints: [path.join(root, 'backend/src/routes/theme-settings.ts')],
  outfile: path.join(out, 'router.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  plugins: [
    {
      name: 'fake-prisma',
      setup(b) {
        b.onResolve({ filter: /(^|\/)prisma\.js$/ }, () => ({ path: 'prisma', namespace: 'test' }));
        b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
          contents: 'export const prisma = globalThis.__testPrisma;',
          loader: 'js',
        }));
      },
    },
  ],
});
const express = (
  await import(pathToFileURL(path.join(root, 'backend/node_modules/express/index.js')).href)
).default;
const jwt = (
  await import(pathToFileURL(path.join(root, 'backend/node_modules/jsonwebtoken/index.js')).href)
).default;
const router = (await import(pathToFileURL(path.join(out, 'router.mjs')).href)).default;
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/theme', router);
app.use((err, req, res, next) => res.status(500).json({ message: err.message }));
const server = app.listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}/theme`;
const token = (id) =>
  jwt.sign(
    { userId: id, restaurantId: 999, role: 'admin' },
    process.env.JWT_SECRET || 'dev-secret',
  );
const call = async (method = '', body, user = 1, route = '') =>
  fetch(base + route, {
    method: method || 'GET',
    headers: {
      ...(user ? { Authorization: `Bearer ${token(user)}` } : {}),
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
try {
  assert.equal((await call('', null, null)).status, 401);
  assert.equal((await call('', null, 3)).status, 403);
  let res = await call();
  assert.equal(res.status, 200);
  const initial = await res.json();
  assert.equal(initial.restaurant.name, 'Restaurant 1');
  assert.equal(initial.revision, '');
  const config = {
    ...initial.config,
    brandName: 'Sofra',
    texts: {
      tr: { welcomeTitle: 'Yeni başlık', enterLabel: 'Başla' },
      en: { welcomeTitle: 'New title' },
    },
    welcomeImage: 'javascript:alert(1)',
  };
  res = await call('PUT', { config, revision: '' });
  assert.equal(res.status, 200);
  const saved = await res.json();
  assert.equal(saved.config.texts.tr.welcomeTitle, 'Yeni başlık');
  assert.equal(saved.config.welcomeImage, '/sofra/breakfast.webp');
  assert.ok(saved.revision);
  res = await call();
  assert.equal((await res.json()).config.texts.en.welcomeTitle, 'New title');
  res = await call('', null, 2);
  assert.equal((await res.json()).config.brandName, '');
  assert.equal((await call('PUT', { config, revision: '' })).status, 409);
  assert.equal((await call('PUT', { config, revision: saved.revision }, 3)).status, 403);
  assert.equal((await call('PUT', { config: [], revision: saved.revision })).status, 400);
  assert.equal(
    (
      await call('PUT', {
        config: { ...config, texts: { tr: { enterLabel: '' } } },
        revision: saved.revision,
      })
    ).status,
    400,
  );
  const concurrent = await Promise.all([
    call('PUT', { config: { ...config, brandName: 'one' }, revision: saved.revision }),
    call('PUT', { config: { ...config, brandName: 'two' }, revision: saved.revision }),
  ]);
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
  const upload = async (bytes, type = 'image/png', user = 1) => {
    const form = new FormData();
    form.append('image', new Blob([bytes], { type }), 'image.png');
    return call('POST', form, user, '/image');
  };
  assert.equal((await upload(Buffer.from('<svg></svg>'), 'image/png')).status, 400);
  assert.equal((await upload(Buffer.alloc(5 * 1024 * 1024 + 1))).status, 400);
  assert.equal((await upload(Buffer.from('not an image'), 'image/png', 3)).status, 403);
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlZkAAAAASUVORK5CYII=',
    'base64',
  );
  res = await upload(png);
  assert.equal(res.status, 200);
  const image = await res.json();
  assert.match(image.imageUrl, /^\/uploads\/sofra-[a-f0-9-]+\.png$/);
  assert.ok(await fs.stat(path.join(process.env.UPLOAD_DIR, path.basename(image.imageUrl))));
  // Upload is staged: saving the file does not change the public configuration row.
  assert.ok(!rows.get(1).value.includes(path.basename(image.imageUrl)));
  await fs.rm(path.join(process.env.UPLOAD_DIR, path.basename(image.imageUrl)));
  await fs.rmdir(process.env.UPLOAD_DIR);
  console.log(
    'PASS: actual auth middleware, admin-only access, restaurant isolation, config persistence/normalization, stale/concurrent saves, invalid payload, image signature/size checks, staged image upload. No real database accessed.',
  );
} finally {
  server.close();
}
