import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import express from 'express';
import jwt from 'jsonwebtoken';
const backend = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
  ),
  out = path.join(backend, 'node_modules/.manager-messages-check');
process.env.JWT_SECRET = 'manager-local-test';
const configs = new Map(),
  messages = [],
  users = {
    1: { isActive: true, restaurantId: 1, role: 'admin' },
    2: { isActive: true, restaurantId: 1, role: 'staff' },
    3: { isActive: true, restaurantId: 2, role: 'admin' },
  };
let id = 0;
const matches = (m, w) =>
  m.restaurantId === w.restaurantId &&
  (w.id === undefined || m.id === w.id) &&
  (w.isRead === undefined || m.isRead === w.isRead) &&
  (!w.OR ||
    w.OR.some((x) => {
      const [k, v] = Object.entries(x)[0];
      return (m[k] || '').includes(v.contains);
    }));
globalThis.__managerPrisma = {
  user: { findUnique: async ({ where }) => users[where.id] },
  restaurant: {
    findUnique: async ({ where }) =>
      where.slug === 'test' ? { id: 1, slug: 'test' } : null,
  },
  setting: {
    findUnique: async ({ where }) => ({
      value: JSON.stringify(
        configs.get(where.restaurantId_key.restaurantId) || {},
      ),
    }),
  },
  managerMessage: {
    create: async ({ data }) => {
      const row = { id: ++id, isRead: false, createdAt: new Date(), ...data };
      messages.push(row);
      return row;
    },
    findMany: async ({ where, skip, take }) =>
      messages.filter((m) => matches(m, where)).slice(skip, skip + take),
    count: async ({ where }) =>
      messages.filter((m) => matches(m, where)).length,
    updateMany: async ({ where, data }) => {
      const rows = messages.filter((m) => matches(m, where));
      rows.forEach((m) => Object.assign(m, data));
      return { count: rows.length };
    },
    findFirst: async ({ where }) =>
      messages.find((m) => matches(m, where)) || null,
    deleteMany: async ({ where }) => {
      const ix = messages.findIndex((m) => matches(m, where));
      if (ix < 0) return { count: 0 };
      messages.splice(ix, 1);
      return { count: 1 };
    },
  },
};
for (const [name, entry] of [
  ['router', 'routes/manager-messages.ts'],
  ['sofra', 'lib/sofra.ts'],
  ['cfg', 'lib/sofra-config.ts'],
])
  await build({
    entryPoints: [path.join(backend, 'src', entry)],
    outfile: path.join(out, name + '.mjs'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    plugins: [
      {
        name: 'mock-db',
        setup(b) {
          b.onResolve({ filter: /(^|\/)prisma\.js$/ }, () => ({
            path: 'prisma',
            namespace: 'test',
          }));
          b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
            contents: 'export const prisma=globalThis.__managerPrisma;',
            loader: 'js',
          }));
        },
      },
    ],
  });
const router = await import(pathToFileURL(path.join(out, 'router.mjs'))),
  sofra = await import(pathToFileURL(path.join(out, 'sofra.mjs'))),
  cfg = await import(pathToFileURL(path.join(out, 'cfg.mjs')));
assert.deepEqual(cfg.normalizeSofraConfig({}).managerContact, {
  enabled: false,
  email: '',
  phone: '',
});
assert.deepEqual(
  cfg.normalizeSofraConfig({
    managerContact: {
      enabled: 'true',
      email: 'javascript:bad',
      phone: '<bad>',
    },
  }).managerContact,
  { enabled: false, email: '', phone: '' },
);
configs.set(1, {
  managerContact: {
    enabled: false,
    email: 'manager@example.invalid',
    phone: '+90 555 123 45 67',
  },
});
assert.deepEqual((await sofra.loadSofraConfig(1)).managerContact, {
  enabled: false,
  email: '',
  phone: '',
});
const app = express();
app.use(express.json());
app.use('/api/admin/manager-messages', router.default);
app.use('/api/menu', router.publicManagerMessages);
app.use((req, res) => res.status(404).json({ message: 'not found' }));
const server = app.listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const base = 'http://127.0.0.1:' + server.address().port;
const req = async (p, method = 'GET', body, user) => {
  const r = await fetch(base + p, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(user
        ? {
            Authorization:
              'Bearer ' +
              jwt.sign({ userId: user, role: 'admin' }, process.env.JWT_SECRET),
          }
        : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, headers: r.headers, data: await r.json() };
};
const url = '/api/menu/test/manager-messages',
  inbox = '/api/admin/manager-messages',
  note = {
    kind: 'complaint',
    message: 'Özel bir not bırakıyorum.',
    fullName: 'Misafir',
    contact: 'guest@example.invalid',
    restaurantId: 2,
  };
try {
  assert.equal((await req(url, 'POST', note)).status, 403);
  const hiddenContact = await req('/api/menu/test/manager-contact');
  assert.equal(hiddenContact.headers.get('cache-control'), 'no-store');
  assert.deepEqual(hiddenContact.data, {
    enabled: false,
    email: '',
    phone: '',
  });
  configs.set(1, {
    managerContact: {
      enabled: true,
      email: 'manager@example.invalid',
      phone: '+90 555 123 45 67',
    },
  });
  assert.equal(
    (await sofra.loadSofraConfig(1)).managerContact.email,
    'manager@example.invalid',
  );
  for (const body of [
    { ...note, kind: 'other' },
    { ...note, message: '' },
    { ...note, message: 'a'.repeat(2001) },
    { ...note, contact: 'invalid@' },
    { ...note, contact: 'javascript:alert(1)' },
    { ...note, fullName: 'a'.repeat(151) },
  ])
    assert.equal((await req(url, 'POST', body)).status, 400);
  const visibleContact = await req('/api/menu/test/manager-contact');
  assert.deepEqual(Object.keys(visibleContact.data).sort(), [
    'email',
    'enabled',
    'phone',
  ]);
  assert.equal(visibleContact.data.enabled, true);
  let r = await req(url, 'POST', note);
  assert.equal(r.status, 201);
  assert.deepEqual(r.data, { ok: true });
  assert.equal(messages[0].restaurantId, 1);
  assert.equal(messages[0].email, 'guest@example.invalid');
  assert.equal((await req(url)).status, 404);
  assert.equal((await req('/api/menu/test/manager-messages/1')).status, 404);
  assert.equal((await req(inbox)).status, 401);
  for (const [method, p] of [
    ['GET', inbox],
    ['PATCH', inbox + '/1/read'],
    ['DELETE', inbox + '/1'],
  ])
    assert.equal((await req(p, method, undefined, 2)).status, 403);
  assert.equal((await req(inbox, 'GET', undefined, 3)).data.data.length, 0);
  assert.equal(
    (await req(inbox + '/1/read', 'PATCH', undefined, 3)).status,
    404,
  );
  assert.equal((await req(inbox + '/1', 'DELETE', undefined, 3)).status, 404);
  r = await req(
    inbox + '?unread=true&q=Özel&page=bad&limit=999',
    'GET',
    undefined,
    1,
  );
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.data.data[0].message, note.message);
  assert.equal(r.data.pagination.limit, 100);
  assert.equal(r.data.pagination.page, 1);
  assert.equal(r.data.unreadCount, 1);
  assert.equal(
    (await req(inbox + '/1/read', 'PATCH', undefined, 1)).data.isRead,
    true,
  );
  assert.equal(
    (await req(inbox + '?unread=true', 'GET', undefined, 1)).data.data.length,
    0,
  );
  users[1].role = 'staff';
  assert.equal((await req(inbox, 'GET', undefined, 1)).status, 403);
  users[1].role = 'admin';
  assert.equal(
    (
      await req(url, 'POST', {
        kind: 'suggestion',
        message: 'Bir önerim var.',
        contact: '+90 555 123 45 67',
      })
    ).status,
    201,
  );
  assert.equal(messages[1].phone, '+90 555 123 45 67');
  assert.equal(messages[1].fullName, null);
  assert.equal((await req(inbox + '/1', 'DELETE', undefined, 1)).status, 200);
  assert.equal((await req(inbox + '/1', 'DELETE', undefined, 1)).status, 404);
  for (let i = 0; i < 3; i++)
    assert.equal((await req(url, 'POST', note)).status, 201);
  r = await req(url, 'POST', note);
  assert.equal(r.status, 429);
  assert.equal(r.headers.get('retry-after'), '600');
  configs.set(1, { managerContact: { enabled: false } });
  assert.equal((await req(url, 'POST', note)).status, 403);
  assert((await req(inbox, 'GET', undefined, 1)).data.data.length > 0);
  console.log(
    'PASS: opt-in default/config roundtrip, hidden disabled contacts, validation, anonymous submit, admin-only read/update/delete, forged-role rejection, tenant isolation, role revocation, retained inbox while disabled, rate limit. Mock DB only.',
  );
} finally {
  await new Promise((r) => server.close(r));
}
